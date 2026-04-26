export const ONBOARDING_VAULT_VERSION = 1 as const;

export type OnboardingAnswerKey = {
  prompt: string;
  correctAnswer: string;
  marks: number;
};

export type OnboardingPaper = {
  mimeType: string;
  base64: string; // image data
  filename: string;
  widthPx?: number; // optional, set by client if it can read it
  heightPx?: number;
};

export type OnboardingSampleGrade = {
  marksEarned: number;
  maxMarks: number;
  feedback: string;
  ocrAnswerText: string;
};

export type OnboardingVault = {
  schemaVersion: typeof ONBOARDING_VAULT_VERSION;
  startedAt: string; // ISO timestamp
  completedAt?: string;
  answerKey?: OnboardingAnswerKey;
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
