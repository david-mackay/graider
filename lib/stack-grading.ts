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
import { and, asc, eq, inArray } from "drizzle-orm";
import { extractHandwrittenStack } from "@/lib/reducto";
import { coerceParsePreset, type DocumentParsePreset } from "@/lib/parse-presets";
import { gradeOneAttempt } from "@/lib/grading";
import { canApplyOcrToAttempt } from "@/lib/attempt-ocr-policy";
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

/**
 * Match OCR rows onto test questions.
 * Prefer exact/normalized prompt match; fall back to printed question_index
 * (1-based or 0-based) — critical for MCQ sheets where stems OCR poorly.
 */
export function matchOcrAnswersToQuestions(
  extracted: OcrAnswer[],
  questions: { questionId: string; prompt: string }[],
): { questionId: string; studentAnswer: string }[] {
  const byPrompt = new Map<string, string>();
  for (const q of questions) {
    byPrompt.set(normalizeQuestion(q.prompt), q.questionId);
    byPrompt.set(normalizeQuestion(q.questionId), q.questionId);
  }

  const used = new Set<string>();
  const rows: { questionId: string; studentAnswer: string }[] = [];

  const tryAdd = (questionId: string | undefined, answer: string) => {
    const trimmed = answer.trim();
    if (!questionId || !trimmed || used.has(questionId)) return false;
    used.add(questionId);
    rows.push({ questionId, studentAnswer: trimmed });
    return true;
  };

  for (const entry of extracted) {
    if (tryAdd(byPrompt.get(normalizeQuestion(entry.question)), entry.answer)) {
      continue;
    }

    if (typeof entry.question_index === "number" && Number.isFinite(entry.question_index)) {
      const raw = Math.trunc(entry.question_index);
      // Prefer 1-based printed numbers; also accept 0-based indexes.
      const candidates = raw >= 1 ? [raw - 1, raw] : [raw];
      for (const idx of candidates) {
        const q = questions[idx];
        if (q && tryAdd(q.questionId, entry.answer)) break;
      }
    }
  }

  // Positional fallback when counts line up and little matched by prompt/index.
  if (rows.length === 0 && extracted.length > 0 && extracted.length === questions.length) {
    for (let i = 0; i < extracted.length; i += 1) {
      tryAdd(questions[i]?.questionId, extracted[i]?.answer ?? "");
    }
  }

  return rows;
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
    storagePath: params.storagePaths[page.pageIndex ?? index] ?? null,
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
      qbId: questionBank.id,
    })
    .from(testQuestions)
    .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
    .where(eq(testQuestions.testId, testId))
    .orderBy(asc(testQuestions.sortOrder));

  const questionsForMatch = tqRows.map((row) => ({
    questionId: row.questionId,
    prompt: row.prompt,
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

    // Idempotent attempt creation: same pattern as teacher-attempt.
    const [existing] = await db
      .select({
        id: testAttempts.id,
        source: testAttempts.source,
        submittedAt: testAttempts.submittedAt,
      })
      .from(testAttempts)
      .where(
        and(eq(testAttempts.testId, testId), eq(testAttempts.studentId, studentId)),
      )
      .limit(1);

    let attemptId: string;
    let created: boolean;

    if (existing) {
      const gate = canApplyOcrToAttempt({
        source: existing.source,
        submittedAt: existing.submittedAt,
      });
      if (!gate.ok) {
        throw new Error(gate.reason);
      }
      attemptId = existing.id;
      created = false;
    } else {
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
      attemptId = inserted.id;
      created = true;
    }

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
      if (merged.length !== existingUploads.length) {
        await db
          .update(testAttempts)
          .set({ ocrUploads: merged })
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
