export const ONBOARDING_VAULT_VERSION = 2 as const;
/** Soft cap for the free onboarding demo review screen (not a Reducto limit). */
export const ONBOARDING_MAX_ANSWER_KEYS = 200;
export const ONBOARDING_MAX_STUDENTS = 3;

export type OnboardingAnswerKey = {
  prompt: string;
  correctAnswer: string;
  marks: number;
  questionType?: "open" | "mcq";
  choices?: Array<{ key: string; text: string }> | null;
};

export type OnboardingPaper = {
  mimeType: string;
  base64: string;
  filename: string;
  widthPx?: number;
  heightPx?: number;
};

export type OnboardingQuestionGrade = {
  prompt: string;
  marksEarned: number;
  maxMarks: number;
  feedback: string;
  ocrAnswerText: string;
};

export type OnboardingSampleGrade = {
  marksEarned: number;
  maxMarks: number;
  feedback: string;
  ocrAnswerText: string;
  questions?: OnboardingQuestionGrade[];
};

/** Flatten sample grade into per-question rows for the shared breakdown UI. */
export function onboardingGradeQuestions(
  grade: OnboardingSampleGrade,
): Array<{
  prompt: string;
  studentAnswer: string;
  feedback: string;
  marksEarned: number;
  maxMarks: number;
}> {
  if (grade.questions && grade.questions.length > 0) {
    return grade.questions.map((q) => ({
      prompt: q.prompt,
      studentAnswer: q.ocrAnswerText,
      feedback: q.feedback,
      marksEarned: q.marksEarned,
      maxMarks: q.maxMarks,
    }));
  }
  return [
    {
      prompt: "Response",
      studentAnswer: grade.ocrAnswerText,
      feedback: grade.feedback,
      marksEarned: grade.marksEarned,
      maxMarks: grade.maxMarks,
    },
  ];
}

export type OnboardingStudentSubmission = {
  id: string;
  name: string;
  source: "photo" | "typed";
  /** All pages for this student's paper (multi-page support). */
  papers?: OnboardingPaper[];
  typedAnswers?: string[];
  parsePreset?: string;
  /** Set after this student is graded — others can still be waiting. */
  grade?: OnboardingSampleGrade;
};

export type OnboardingVault = {
  schemaVersion: typeof ONBOARDING_VAULT_VERSION;
  startedAt: string;
  completedAt?: string;
  /** Preferred multi-question key (PDF import or manual). */
  answerKeys?: OnboardingAnswerKey[];
  /**
   * Legacy single-question field. Prefer `answerKeys`.
   * Still written as `answerKeys[0]` so older resume/sync paths keep working.
   */
  answerKey?: OnboardingAnswerKey;
  answerKeySource?: "pdf" | "manual";
  /** Roster of students (photos/typed answers). Graded once the class is submitted. */
  students?: OnboardingStudentSubmission[];
  syncedAt?: string;
};

export type OnboardingStep =
  | "hook"
  | "capabilities"
  | "answer-key"
  | "upload"
  | "result"
  | "save"
  | "completed";

export function normalizeAnswerKeys(
  vault: Pick<OnboardingVault, "answerKeys" | "answerKey"> | null | undefined,
): OnboardingAnswerKey[] {
  if (!vault) return [];
  if (Array.isArray(vault.answerKeys) && vault.answerKeys.length > 0) {
    return vault.answerKeys.filter(
      (q) =>
        typeof q?.prompt === "string" &&
        q.prompt.trim() &&
        typeof q?.correctAnswer === "string" &&
        q.correctAnswer.trim() &&
        Number.isInteger(q.marks) &&
        q.marks > 0,
    );
  }
  if (vault.answerKey) {
    const q = vault.answerKey;
    if (
      typeof q.prompt === "string" &&
      q.prompt.trim() &&
      typeof q.correctAnswer === "string" &&
      q.correctAnswer.trim() &&
      Number.isInteger(q.marks) &&
      q.marks > 0
    ) {
      return [q];
    }
  }
  return [];
}

export function hasAnswerKey(
  vault: Pick<OnboardingVault, "answerKeys" | "answerKey"> | null | undefined,
): boolean {
  return normalizeAnswerKeys(vault).length > 0;
}

export function normalizeRoster(
  vault: Pick<OnboardingVault, "students"> | null | undefined,
): OnboardingStudentSubmission[] {
  if (!vault?.students?.length) return [];
  return vault.students.filter(
    (s) =>
      s &&
      typeof s.id === "string" &&
      typeof s.name === "string" &&
      (s.source === "photo" || s.source === "typed") &&
      ((s.source === "photo" && (s.papers?.length ?? 0) > 0) ||
        (s.source === "typed" && (s.typedAnswers?.some((a) => a.trim()) ?? false))),
  );
}

export function hasRoster(
  vault: Pick<OnboardingVault, "students"> | null | undefined,
): boolean {
  return normalizeRoster(vault).length > 0;
}

/** Students that already have a grade (ready for result / sync). */
export type GradedOnboardingStudent = OnboardingStudentSubmission & {
  grade: OnboardingSampleGrade;
};

export function normalizeStudents(
  vault: Pick<OnboardingVault, "students"> | null | undefined,
): GradedOnboardingStudent[] {
  return normalizeRoster(vault).filter(
    (s): s is GradedOnboardingStudent =>
      !!s.grade &&
      Number.isInteger(s.grade.marksEarned) &&
      Number.isInteger(s.grade.maxMarks),
  );
}

export function hasGradedStudents(
  vault: Pick<OnboardingVault, "students"> | null | undefined,
): boolean {
  const roster = normalizeRoster(vault);
  return roster.some(
    (s) =>
      !!s.grade &&
      Number.isInteger(s.grade.marksEarned) &&
      Number.isInteger(s.grade.maxMarks),
  );
}

export function answerKeyVaultUpdate(
  keys: OnboardingAnswerKey[],
  source: "pdf" | "manual",
): Pick<
  OnboardingVault,
  "answerKeys" | "answerKey" | "answerKeySource" | "students" | "completedAt"
> {
  const trimmed = keys.slice(0, ONBOARDING_MAX_ANSWER_KEYS);
  return {
    answerKeys: trimmed,
    answerKey: trimmed[0],
    answerKeySource: source,
    // Changing the key invalidates any grading done against the old one.
    students: undefined,
    completedAt: undefined,
  };
}
