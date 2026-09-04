import { db } from "@/lib/db";
import {
  appUsers,
  attemptAnswers,
  classMemberships,
  questionBank,
  testAttempts,
  testQuestions,
  tests,
} from "@/drizzle/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { extractHandwrittenStack } from "@/lib/reducto";
import { coerceParsePreset, type DocumentParsePreset } from "@/lib/parse-presets";
import { gradeOneAttempt } from "@/lib/grading";
import { expandPaperUploadPaths } from "@/lib/pdf-page-images";
import { coercePrintedQuestionIndex } from "@/lib/question-index";
import {
  OcrAnswer,
  RosterEntry,
  StackAssignment,
  StackCommitResult,
  StackPagePreview,
  StackPerStudentResult,
  StackPreview,
  type GradeStackCommitPayload,
} from "@/lib/types";

/**
 * Shared question-prompt normalizer.
 *
 * Lowercases, collapses whitespace, and strips non-alphanumeric characters
 * so the OCR'd question text can be compared against the test's stored prompts
 * (and the question_bank UUIDs, which are matched verbatim).
 *
 * Imported from `app/api/ocr/route.ts` to keep one source of truth.
 */
export function normalizeQuestion(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function joinAnswerParts(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

function formatOcrPart(entry: OcrAnswer): string {
  const question = entry.question.trim();
  const answer = entry.answer.trim();
  if (question && answer && !answer.toLowerCase().includes(question.toLowerCase())) {
    return `${question}: ${answer}`;
  }
  return answer || question;
}

function printedIndexOf(entry: OcrAnswer): number | null {
  return coercePrintedQuestionIndex(entry.question_index);
}

function withPrintedIndex(entry: OcrAnswer): OcrAnswer {
  return { ...entry, question_index: printedIndexOf(entry) };
}

/**
 * Combine OCR fragments that share a printed question number
 * (e.g. "define any 3 of 4" split into four Q1 rows) so they grade as one answer.
 */
export function mergeOcrAnswersByQuestionNumber(extracted: OcrAnswer[]): OcrAnswer[] {
  const groups: OcrAnswer[][] = [];
  const indexToGroup = new Map<number, number>();

  for (const entry of extracted) {
    const index = printedIndexOf(entry);
    if (index === null) {
      groups.push([entry]);
      continue;
    }
    const existing = indexToGroup.get(index);
    if (existing === undefined) {
      indexToGroup.set(index, groups.length);
      groups.push([entry]);
    } else {
      groups[existing].push(entry);
    }
  }

  return groups.map((group) => {
    if (group.length === 1) return group[0];
    return {
      ...group[0],
      question: group[0].question,
      answer: joinAnswerParts(group.map(formatOcrPart)),
      question_index: group[0].question_index,
      needs_review: group.some((item) => item.needs_review),
      parse_confidence: minNullable(
        ...group.map((item) => item.parse_confidence ?? null),
      ),
      extract_confidence: minNullable(
        ...group.map((item) => item.extract_confidence ?? null),
      ),
    };
  });
}

function minNullable(...values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number");
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

/**
 * Match OCR rows onto test questions.
 * Prompt-match unmerged rows first so a long later question that was stamped
 * with question_index 1 is not concatenated onto Q1. Then merge remaining
 * same-number fragments, map by printed index, and split a stolen tail if
 * one answer still contains another question's stem or key.
 */
function printedIndexesCollapsedToOne(extracted: OcrAnswer[]): boolean {
  const indexes = extracted
    .map((entry) => printedIndexOf(entry))
    .filter((n): n is number => n !== null);
  return indexes.length > 1 && new Set(indexes).size === 1;
}

export type MatchableQuestion = {
  questionId: string;
  prompt: string;
  correctAnswer?: string | null;
};

const KEY_STOPWORDS = new Set(["mark", "marks", "point", "points", "pts", "key"]);

function distinctiveNeedles(question: MatchableQuestion): string[] {
  const needles: string[] = [];
  const prompt = normalizeQuestion(question.prompt);
  if (prompt.length >= 24) needles.push(prompt.slice(0, 48));
  const keySource = (question.correctAnswer ?? "")
    .split(/\n+|–|—/)[0]
    ?.trim() ?? "";
  const keyWords = normalizeQuestion(keySource)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !/^\d+$/.test(word) && !KEY_STOPWORDS.has(word));
  if (keyWords.length >= 3) needles.push(keyWords.slice(0, 3).join(" "));
  if (keyWords.length >= 2) needles.push(keyWords.slice(0, 2).join(" "));
  return needles;
}

function cutIndexForNeedle(answer: string, needle: string): number {
  const words = needle.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (words.length < 2) return -1;
  const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const match = answer.match(new RegExp(pattern, "i"));
  return typeof match?.index === "number" ? match.index : -1;
}

/** If Q1's answer still contains Q21's stem/key, move that tail onto Q21. */
export function splitStolenAnswerTails(
  rows: { questionId: string; studentAnswer: string }[],
  questions: MatchableQuestion[],
): { questionId: string; studentAnswer: string }[] {
  const next = rows.map((row) => ({ ...row }));
  const assigned = new Set(next.map((row) => row.questionId));

  for (const question of questions) {
    if (assigned.has(question.questionId)) continue;
    for (const needle of distinctiveNeedles(question)) {
      const owner = next.find((row) => {
        if (row.questionId === question.questionId) return false;
        return normalizeQuestion(row.studentAnswer).indexOf(needle) >= 24;
      });
      if (!owner) continue;
      const cut = cutIndexForNeedle(owner.studentAnswer, needle);
      if (cut < 20) continue;
      const stolen = owner.studentAnswer.slice(cut).trim();
      const kept = owner.studentAnswer.slice(0, cut).trim();
      if (!stolen || !kept) continue;
      owner.studentAnswer = kept;
      next.push({ questionId: question.questionId, studentAnswer: stolen });
      assigned.add(question.questionId);
      break;
    }
  }

  return next.filter((row) => row.studentAnswer);
}

export function matchOcrAnswersToQuestions(
  extracted: OcrAnswer[],
  questions: MatchableQuestion[],
): { questionId: string; studentAnswer: string }[] {
  const normalized = extracted.map(withPrintedIndex);
  const zipByOrder =
    printedIndexesCollapsedToOne(normalized) &&
    normalized.length === questions.length &&
    questions.length > 1;
  if (zipByOrder) {
    return splitStolenAnswerTails(
      questions
        .map((q, i) => ({
          questionId: q.questionId,
          studentAnswer:
            (normalized[i]?.answer ?? "").trim() || (normalized[i]?.question ?? "").trim(),
        }))
        .filter((row) => row.studentAnswer),
      questions,
    );
  }

  const byPrompt = new Map<string, string>();
  for (const q of questions) {
    byPrompt.set(normalizeQuestion(q.prompt), q.questionId);
    byPrompt.set(normalizeQuestion(q.questionId), q.questionId);
  }

  const used = new Set<string>();
  const rows: { questionId: string; studentAnswer: string }[] = [];
  const claimed = new Set<number>();

  const tryAdd = (questionId: string | undefined, answer: string, allowMerge = true) => {
    const trimmed = answer.trim();
    if (!questionId || !trimmed) return false;
    if (used.has(questionId)) {
      if (!allowMerge) return false;
      const existing = rows.find((row) => row.questionId === questionId);
      if (!existing) return false;
      existing.studentAnswer = joinAnswerParts([existing.studentAnswer, trimmed]);
      return true;
    }
    used.add(questionId);
    rows.push({ questionId, studentAnswer: trimmed });
    return true;
  };

  normalized.forEach((entry, index) => {
    const promptId = byPrompt.get(normalizeQuestion(entry.question));
    if (promptId && tryAdd(promptId, entry.answer)) {
      claimed.add(index);
    }
  });

  const leftover = normalized.filter((_, index) => !claimed.has(index));
  const merged = mergeOcrAnswersByQuestionNumber(leftover);

  for (const entry of merged) {
    const promptId = byPrompt.get(normalizeQuestion(entry.question));
    const text = entry.answer.trim() || (promptId ? "" : formatOcrPart(entry));
    if (tryAdd(promptId, text)) {
      continue;
    }

    const raw = printedIndexOf(entry);
    if (raw === null) continue;

    const oneBased = raw >= 1 ? raw - 1 : raw;
    const zeroBased = raw;
    const unusedSlot = [oneBased, zeroBased].find((idx) => {
      const q = questions[idx];
      return q && !used.has(q.questionId);
    });
    const idx = unusedSlot ?? oneBased;
    const q = questions[idx];
    if (q) tryAdd(q.questionId, text, unusedSlot === undefined);
  }

  if (rows.length === 0 && merged.length > 0 && merged.length === questions.length) {
    for (let i = 0; i < merged.length; i += 1) {
      tryAdd(questions[i]?.questionId, formatOcrPart(merged[i] ?? { question: "", answer: "" }));
    }
  }

  return splitStolenAnswerTails(rows, questions);
}

/**
 * Normalizes a person's name or email for fuzzy comparison: lowercases, trims,
 * and collapses runs of whitespace to single spaces. No diacritic folding for v1.
 */
function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function emailLocalPart(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(0, at) : email;
}

type ImagePayload = {
  filename: string;
  mimeType: string;
  base64: string;
};

type RosterIndexEntry = {
  userId: string;
  normalizedFullName: string;
  normalizedEmail: string;
  normalizedEmailLocal: string;
};

function buildRosterIndex(roster: RosterEntry[]): RosterIndexEntry[] {
  return roster.map((entry) => ({
    userId: entry.user_id,
    normalizedFullName: normalizeName(entry.full_name),
    normalizedEmail: normalizeName(entry.email),
    normalizedEmailLocal: normalizeName(emailLocalPart(entry.email)),
  }));
}

/**
 * Page-to-roster matching heuristic (v1):
 * - Normalize the OCR'd `studentNameGuess` (lowercase + collapsed whitespace).
 * - "exact": case-insensitive equality with `full_name` OR with the email
 *   local-part. Returns one suggestedStudentId.
 * - "fuzzy": substring containment in either direction (guess includes a roster
 *   entry, or a roster entry includes the guess) AND the OCR confidence is
 *   >= 0.5. Returns all matching candidate studentIds.
 * - "unmatched": empty/zero-confidence guess, OR no matches found.
 *
 * Deliberately simple — no Levenshtein library. The wizard UI is responsible
 * for letting the teacher pick the right student when fuzzy/unmatched.
 */
function matchPageToRoster(
  rosterIndex: RosterIndexEntry[],
  studentNameGuess: string,
  confidence: number,
): { status: "exact" | "fuzzy" | "unmatched"; suggestedStudentId: string | null; candidates: string[] } {
  const normalizedGuess = normalizeName(studentNameGuess);

  if (!normalizedGuess || confidence <= 0) {
    return { status: "unmatched", suggestedStudentId: null, candidates: [] };
  }

  const exactMatches = rosterIndex.filter(
    (entry) =>
      (entry.normalizedFullName && entry.normalizedFullName === normalizedGuess) ||
      (entry.normalizedEmailLocal && entry.normalizedEmailLocal === normalizedGuess) ||
      (entry.normalizedEmail && entry.normalizedEmail === normalizedGuess),
  );

  if (exactMatches.length === 1) {
    return {
      status: "exact",
      suggestedStudentId: exactMatches[0].userId,
      candidates: [],
    };
  }

  if (confidence < 0.5) {
    return { status: "unmatched", suggestedStudentId: null, candidates: [] };
  }

  const fuzzyMatches = rosterIndex.filter((entry) => {
    if (entry.normalizedFullName) {
      if (
        entry.normalizedFullName.includes(normalizedGuess) ||
        normalizedGuess.includes(entry.normalizedFullName)
      ) {
        return true;
      }
    }
    if (entry.normalizedEmailLocal) {
      if (
        entry.normalizedEmailLocal.includes(normalizedGuess) ||
        normalizedGuess.includes(entry.normalizedEmailLocal)
      ) {
        return true;
      }
    }
    return false;
  });

  if (fuzzyMatches.length === 0) {
    return { status: "unmatched", suggestedStudentId: null, candidates: [] };
  }

  // If multiple exact matches existed, we treat them as fuzzy (ambiguous).
  if (exactMatches.length > 1) {
    return {
      status: "fuzzy",
      suggestedStudentId: null,
      candidates: exactMatches.map((entry) => entry.userId),
    };
  }

  return {
    status: "fuzzy",
    suggestedStudentId: null,
    candidates: fuzzyMatches.map((entry) => entry.userId),
  };
}

async function fetchClassRoster(classId: string): Promise<RosterEntry[]> {
  const memberships = await db
    .select({ userId: classMemberships.userId })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, classId),
        eq(classMemberships.role, "student"),
        eq(classMemberships.status, "active"),
      ),
    );

  if (memberships.length === 0) {
    return [];
  }

  const userIds = memberships.map((row) => row.userId);
  const users = await db
    .select({ id: appUsers.id, email: appUsers.email, fullName: appUsers.fullName })
    .from(appUsers)
    .where(inArray(appUsers.id, userIds));

  return users.map((user) => ({
    user_id: user.id,
    full_name: user.fullName,
    email: user.email,
  }));
}

export async function buildStackPreviewPages(params: {
  classId: string;
  ocrPages: Awaited<ReturnType<typeof extractHandwrittenStack>>;
  storagePaths: (string | null)[];
}): Promise<StackPagePreview[]> {
  const roster = await fetchClassRoster(params.classId);
  const rosterIndex = buildRosterIndex(roster);

  return params.ocrPages.map((page, index) => {
    const match = matchPageToRoster(rosterIndex, page.studentNameGuess, page.confidence);
    return {
      pageIndex: page.pageIndex ?? index,
      studentNameGuess: page.studentNameGuess,
      confidence: page.confidence,
      suggestedStudentId: match.suggestedStudentId,
      candidates: match.candidates,
      status: match.status,
      ocrAnswers: page.answers,
      storagePath: params.storagePaths[index] ?? null,
    };
  });
}

/** Student-first flow: pages are pre-assigned — no roster name matching. */
export function buildStudentFirstPreviewPages(params: {
  ocrPages: Awaited<ReturnType<typeof extractHandwrittenStack>>;
  storagePaths: (string | null)[];
}): StackPagePreview[] {
  return params.ocrPages.map((page, index) => ({
    pageIndex: page.pageIndex ?? index,
    studentNameGuess: "",
    confidence: 0,
    suggestedStudentId: null,
    candidates: [],
    status: "exact" as const,
    ocrAnswers: page.answers,
    storagePath: params.storagePaths[index] ?? params.storagePaths[page.pageIndex ?? index] ?? null,
  }));
}

export function firstStudentPageIndices(
  assignments: { pageIndex: number; studentId: string }[],
): number[] {
  if (assignments.length === 0) return [];
  const sorted = [...assignments].sort((a, b) => a.pageIndex - b.pageIndex);
  const firstStudentId = sorted[0].studentId;
  return sorted.filter((a) => a.studentId === firstStudentId).map((a) => a.pageIndex);
}

export async function previewStack(params: {
  testId: string;
  images: ImagePayload[];
  storagePaths: (string | null)[];
  teacherId: string;
  ocrPages?: Awaited<ReturnType<typeof extractHandwrittenStack>>;
  parsePreset?: DocumentParsePreset | string;
}): Promise<StackPreview> {
  const { testId, images, storagePaths, ocrPages: precomputedOcrPages } = params;

  const [test] = await db
    .select({ id: tests.id, classId: tests.classId })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);

  if (!test) {
    throw new Error("TEST_NOT_FOUND");
  }

  const ocrPages =
    precomputedOcrPages ??
    (await extractHandwrittenStack(
      images,
      coerceParsePreset(params.parsePreset, "grade_stack"),
    ));

  const pages = await buildStackPreviewPages({
    classId: test.classId,
    ocrPages,
    storagePaths,
  });

  return { pages };
}

export async function commitStack(params: {
  testId: string;
  pages: StackAssignment[];
  teacherId: string;
  onProgress?: (payload: GradeStackCommitPayload) => Promise<void>;
}): Promise<StackCommitResult> {
  const { testId, pages, onProgress } = params;

  const [test] = await db
    .select({ id: tests.id, classId: tests.classId })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);

  if (!test) {
    throw new Error("TEST_NOT_FOUND");
  }

  // Validate every studentId is an active student in this test's class.
  const distinctStudentIds = Array.from(new Set(pages.map((page) => page.studentId)));

  const validMemberships = await db
    .select({ userId: classMemberships.userId })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, test.classId),
        eq(classMemberships.role, "student"),
        eq(classMemberships.status, "active"),
        inArray(classMemberships.userId, distinctStudentIds),
      ),
    );

  const validIdSet = new Set(validMemberships.map((row) => row.userId));
  const invalid = distinctStudentIds.filter((id) => !validIdSet.has(id));
  if (invalid.length > 0) {
    throw new Error(`INVALID_STUDENT_IDS:${invalid.join(",")}`);
  }

  // Pre-compute the question lookup so we can match each page's OCR answers to
  // test_questions rows by normalized prompt (or by question_bank UUID).
  const tqRows = await db
    .select({
      questionId: testQuestions.questionId,
      prompt: questionBank.prompt,
      correctAnswer: questionBank.correctAnswer,
      qbId: questionBank.id,
    })
    .from(testQuestions)
    .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
    .where(eq(testQuestions.testId, testId))
    .orderBy(asc(testQuestions.sortOrder));

  const questionsForMatch = tqRows.map((row) => ({
    questionId: row.questionId,
    prompt: row.prompt,
    correctAnswer: row.correctAnswer,
  }));

  // Group pages by student so multi-page submissions grade once per student.
  const pagesByStudent = new Map<
    string,
    { ocrAnswers: OcrAnswer[]; storagePaths: string[] }
  >();
  for (const page of pages) {
    const existing = pagesByStudent.get(page.studentId) ?? {
      ocrAnswers: [],
      storagePaths: [],
    };
    existing.ocrAnswers.push(...page.ocrAnswers);
    if (page.storagePath) existing.storagePaths.push(page.storagePath);
    pagesByStudent.set(page.studentId, existing);
  }

  const results: StackPerStudentResult[] = [];
  const totalStudents = pagesByStudent.size;

  const reportProgress = async (currentStudentId: string | null) => {
    if (!onProgress) return;
    await onProgress({
      results: [...results],
      progress: {
        total: totalStudents,
        completed: results.length,
        currentStudentId,
      },
    });
  };

  for (const [studentId, studentPages] of pagesByStudent) {
    await reportProgress(studentId);

    // Onboarding sync used to default source=student. Relabel paper rows so
    // they are not treated as a digital take. Never touch rows with startedAt.
    await db
      .update(testAttempts)
      .set({ source: "teacher_ocr", updatedAt: new Date() })
      .where(
        and(
          eq(testAttempts.testId, testId),
          eq(testAttempts.studentId, studentId),
          eq(testAttempts.source, "student"),
          isNull(testAttempts.startedAt),
        ),
      );

    const [inserted] = await db
      .insert(testAttempts)
      .values({
        testId,
        studentId,
        source: "teacher_ocr",
        status: "submitted",
        submittedAt: new Date(),
      })
      .returning({ id: testAttempts.id });

    if (!inserted) {
      throw new Error("Failed to create attempt for student.");
    }
    const attemptId = inserted.id;
    const created = true;

    if (studentPages.storagePaths.length > 0) {
      const [attemptRow] = await db
        .select({ ocrUploads: testAttempts.ocrUploads })
        .from(testAttempts)
        .where(eq(testAttempts.id, attemptId))
        .limit(1);
      const existingUploads = attemptRow?.ocrUploads ?? [];
      const merged = [...existingUploads];
      for (const path of studentPages.storagePaths) {
        if (!merged.includes(path)) merged.push(path);
      }
      const paperPaths = await expandPaperUploadPaths(merged);
      if (paperPaths.join() !== existingUploads.join()) {
        await db
          .update(testAttempts)
          .set({ ocrUploads: paperPaths })
          .where(eq(testAttempts.id, attemptId));
      }
    }

    // Match OCR answers to test_questions and upsert (all pages for this student).
    const matchRows = matchOcrAnswersToQuestions(studentPages.ocrAnswers, questionsForMatch);

    for (const row of matchRows) {
      await db
        .insert(attemptAnswers)
        .values({
          attemptId,
          questionId: row.questionId,
          studentAnswer: row.studentAnswer,
        })
        .onConflictDoUpdate({
          target: [attemptAnswers.attemptId, attemptAnswers.questionId],
          set: { studentAnswer: row.studentAnswer },
        });
    }

    const graded = await gradeOneAttempt(attemptId, testId);

    results.push({
      studentId,
      attemptId,
      created,
      totalMarks: graded.total_marks,
      maxMarks: graded.max_marks,
      grades: graded.grades.map((entry) => ({
        questionId: entry.question_id,
        marksEarned: entry.marks_earned,
        feedback: entry.feedback,
      })),
    });
  }

  await reportProgress(null);

  return { results };
}

// Re-export so callers (e.g. the OCR route) can import OcrAnswer for typing.
export type { OcrAnswer };
