export type AppRole = "student" | "teacher";

export type AppUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
};

export type ClassRole = "teacher" | "student";

export type SchoolClass = {
  id: string;
  name: string;
  owner_user_id: string;
  invite_code: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClassMembership = {
  class_id: string;
  user_id: string;
  role: ClassRole;
  status: "active" | "pending";
  created_at?: string | null;
};

export type QuestionBankQuestion = {
  id: string;
  teacher_id: string;
  class_id: string;
  prompt: string;
  correct_answer: string;
  marks: number;
  topic?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TestSummary = {
  id: string;
  title: string;
  class_id: string;
  teacher_id: string;
  grades_released: boolean;
  show_ai_feedback: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TestQuestion = {
  question_id: string;
  prompt: string;
  marks: number;
  sort_order: number;
};

export type TestDetail = {
  id: string;
  title: string;
  class_id: string;
  teacher_id: string;
  questions: TestQuestion[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type TestAttempt = {
  id: string;
  test_id: string;
  student_id: string;
  status: "submitted" | "graded" | "draft";
  total_marks: number | null;
  max_marks: number | null;
  submitted_at: string | null;
  graded_at: string | null;
  ocr_uploads: string[] | null;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  student_answer: string;
  marks_earned: number | null;
  feedback: string | null;
};

export type OcrAnswer = {
  question: string;
  answer: string;
  question_index?: number | null;
};

export type OcrPage = {
  pageIndex: number;
  studentNameGuess: string;
  confidence: number;
  answers: OcrAnswer[];
};

export type RosterEntry = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

export type TeacherAttemptRequest = {
  testId: string;
  studentId: string;
};

export type TeacherAttemptResponse = {
  attempt_id: string;
  created: boolean;
};

export type StackPagePreview = {
  pageIndex: number;
  studentNameGuess: string;
  confidence: number;
  suggestedStudentId: string | null; // from "exact" match
  candidates: string[]; // from "fuzzy" match (studentIds)
  status: "exact" | "fuzzy" | "unmatched";
  ocrAnswers: OcrAnswer[];
  storagePath: string | null; // path of the uploaded image, for the wizard to display
};

export type StackAssignment = {
  pageIndex: number;
  studentId: string;
  ocrAnswers: OcrAnswer[];
  storagePath?: string | null;
};

export type StackPerStudentResult = {
  studentId: string;
  attemptId: string;
  created: boolean;
  totalMarks: number;
  maxMarks: number;
  grades: { questionId: string; marksEarned: number; feedback: string }[];
};

export type StackPreview = { pages: StackPagePreview[] };

export type StackCommitResult = { results: StackPerStudentResult[] };

export type GradeStackJobPhase = "preview" | "commit";

export type GradeStackJobStatus =
  | "queued"
  | "processing"
  | "needs_review"
  | "completed"
  | "failed"
  | "cancelled";

export type GradeStackJobFailure = {
  studentId?: string | null;
  pageIndex?: number | null;
  code: string;
  message: string;
  retryable: boolean;
};

export type GradeStackPreviewPayload = {
  pages: StackPagePreview[];
  discovery?: StackTestDiscovery | null;
  /** Pre-assigned student per page (student-first mobile flow). */
  studentPageAssignments?: StudentPageAssignment[];
};

export type StudentPageAssignment = {
  pageIndex: number;
  studentId: string;
};

export type StackTestDiscovery = {
  source: "matched" | "created";
  testId: string;
  testTitle: string;
  confidence: number;
};

export type GradeStackCommitProgress = {
  total: number;
  completed: number;
  currentStudentId?: string | null;
};

export type GradeStackCommitPayload = {
  results: StackPerStudentResult[];
  progress?: GradeStackCommitProgress;
};

export type GradeStackJob = {
  id: string;
  phase: GradeStackJobPhase;
  status: GradeStackJobStatus;
  testId: string;
  classId: string | null;
  attemptCount: number;
  idempotencyKey?: string | null;
  preview?: GradeStackPreviewPayload | null;
  commit?: GradeStackCommitPayload | null;
  /** From preview job input — lets mobile resume student-first review after a push tap. */
  studentPageAssignments?: StudentPageAssignment[];
  failures: GradeStackJobFailure[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GradeStackPreviewJobInput = {
  storagePaths: string[];
  imageMeta: { filename: string; mimeType: string }[];
  autoDiscover?: boolean;
  classId?: string | null;
  studentPageAssignments?: StudentPageAssignment[];
  gradingMode?: "student_first" | "stack";
};

export type GradeStackCommitJobInput = {
  assignments: StackAssignment[];
  previewJobId: string | null;
};

export type SampleGradeResponse = {
  marksEarned: number;
  maxMarks: number;
  feedback: string;
  ocrAnswerText: string;
};

export type OnboardingSyncResponse = {
  classId: string;
  testId: string;
  attemptId: string;
  created: boolean;
};

export type ContentImportJobKind = "question_bank" | "test";

export type ContentImportJobStatus = "queued" | "processing" | "completed" | "failed";

export type ParsedImportQuestion = {
  prompt: string;
  correct_answer: string;
  marks: number;
  topic?: string | null;
};

export type ContentImportResult = {
  questionsCreated?: number;
  testId?: string;
  testTitle?: string;
};
