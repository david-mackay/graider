import type {
  QuestionBankQuestion,
  SchoolClass,
  TestAttempt,
  TestSummary,
} from "@/lib/types";

export type ActiveView = "classes" | "questions" | "tests" | "students";

export type DashboardQuestion = QuestionBankQuestion;
export type DashboardTest = TestSummary;
export type DashboardAttempt = TestAttempt & {
  test_title: string;
  test_class_id?: string | null;
};

export type GradedAttemptQuestion = {
  question_id: string;
  prompt: string;
  student_answer: string;
  correct_answer: string | null;
  marks: number;
  marks_earned: number | null;
  feedback: string | null;
};

export type GradedAttemptDetail = {
  id: string;
  test_id: string;
  test_title: string;
  student_id: string;
  student_name?: string | null;
  status: "draft" | "submitted" | "graded";
  total_marks: number | null;
  max_marks: number | null;
  graded_at?: string | null;
  test_class_id?: string | null;
  ocr_uploads?: string[] | null;
  questions: GradedAttemptQuestion[];
};

export type DashboardClass = SchoolClass & {
  role_in_class?: "teacher" | "student";
  student_count?: number;
};

export type ClassMember = {
  user_id: string;
  role: "teacher" | "student";
  status: "active" | "pending";
  full_name: string | null;
  email: string | null;
};

export type GroupedQuestions = { topic: string; items: DashboardQuestion[] };

export type Invitation = {
  id: string;
  code: string;
  role: "student" | "teacher";
  status: string;
  invited_email: string | null;
  invited_name: string | null;
  expires_at: string | null;
  created_at: string | null;
  accepted_by_name: string | null;
  single_use?: boolean;
};
