export const ONBOARDING_VAULT_VERSION = 1 as const;
export const ONBOARDING_MAX_ANSWER_KEYS = 8;

export type OnboardingAnswerKey = {
  prompt: string;
  correctAnswer: string;
  marks: number;
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
  studentPaper?: OnboardingPaper;
  sampleGrade?: OnboardingSampleGrade;
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

export function answerKeyVaultUpdate(
  keys: OnboardingAnswerKey[],
  source: "pdf" | "manual",
): Pick<OnboardingVault, "answerKeys" | "answerKey" | "answerKeySource" | "sampleGrade" | "completedAt"> {
  const trimmed = keys.slice(0, ONBOARDING_MAX_ANSWER_KEYS);
  return {
    answerKeys: trimmed,
    answerKey: trimmed[0],
    answerKeySource: source,
    // Changing the key invalidates a prior demo grade.
    sampleGrade: undefined,
    completedAt: undefined,
  };
}
