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
import { extractHandwrittenStack } from "@/lib/openrouter";
import { gradeOneAttempt } from "@/lib/grading";
import {
  OcrAnswer,
  RosterEntry,
  StackAssignment,
  StackCommitResult,
  StackPagePreview,
  StackPerStudentResult,
  StackPreview,
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

export async function previewStack(params: {
  testId: string;
  images: ImagePayload[];
  storagePaths: (string | null)[];
  teacherId: string;
  ocrPages?: Awaited<ReturnType<typeof extractHandwrittenStack>>;
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

  const ocrPages = precomputedOcrPages ?? (await extractHandwrittenStack(images));

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
}): Promise<StackCommitResult> {
  const { testId, pages } = params;

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

  const questionByNormalizedPrompt = new Map<string, string>();
  for (const row of tqRows) {
    questionByNormalizedPrompt.set(normalizeQuestion(row.prompt), row.questionId);
    questionByNormalizedPrompt.set(normalizeQuestion(row.qbId), row.questionId);
  }

  const results: StackPerStudentResult[] = [];

  for (const page of pages) {
    const { studentId, ocrAnswers, storagePath } = page;

    // Idempotent attempt creation: same pattern as teacher-attempt.
    const [existing] = await db
      .select({ id: testAttempts.id })
      .from(testAttempts)
      .where(
        and(eq(testAttempts.testId, testId), eq(testAttempts.studentId, studentId)),
      )
      .limit(1);

    let attemptId: string;
    let created: boolean;

    if (existing) {
      attemptId = existing.id;
      created = false;
    } else {
      const [inserted] = await db
        .insert(testAttempts)
        .values({
          testId,
          studentId,
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

    if (storagePath) {
      const [attemptRow] = await db
        .select({ ocrUploads: testAttempts.ocrUploads })
        .from(testAttempts)
        .where(eq(testAttempts.id, attemptId))
        .limit(1);
      const existingUploads = attemptRow?.ocrUploads ?? [];
      if (!existingUploads.includes(storagePath)) {
        await db
          .update(testAttempts)
          .set({ ocrUploads: [...existingUploads, storagePath] })
          .where(eq(testAttempts.id, attemptId));
      }
    }

    // Match OCR answers to test_questions and upsert.
    const matchRows: { questionId: string; studentAnswer: string }[] = [];
    for (const extracted of ocrAnswers) {
      const match = questionByNormalizedPrompt.get(normalizeQuestion(extracted.question));
      if (!match) continue;
      matchRows.push({ questionId: match, studentAnswer: extracted.answer });
    }

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

  return { results };
}

// Re-export so callers (e.g. the OCR route) can import OcrAnswer for typing.
export type { OcrAnswer };
