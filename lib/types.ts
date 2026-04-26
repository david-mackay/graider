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
