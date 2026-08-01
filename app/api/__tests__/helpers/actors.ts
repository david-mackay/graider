import type { AppUser } from "@/lib/types";

/** Catalog actors for L2 route contract tests. */
export const actors = {
  studentA: {
    id: "user_student_a",
    email: "studentA@school.test",
    full_name: "Student A",
    role: "student",
  } satisfies AppUser,
  studentB: {
    id: "user_student_b",
    email: "studentB@school.test",
    full_name: "Student B",
    role: "student",
  } satisfies AppUser,
  teacherA: {
    id: "user_teacher_a",
    email: "teacherA@school.test",
    full_name: "Teacher A",
    role: "teacher",
  } satisfies AppUser,
  teacherB: {
    id: "user_teacher_b",
    email: "teacherB@school.test",
    full_name: "Teacher B",
    role: "teacher",
  } satisfies AppUser,
  outsider: {
    id: "user_outsider",
    email: "outsider@school.test",
    full_name: "Outsider",
    role: "student",
  } satisfies AppUser,
} as const;

export const ids = {
  classA: "class-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  classB: "class-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  testA: "test-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  testB: "test-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  attemptA: "attempt-aaaa-aaaa-aaaa-aaaaaaaa",
  questionA: "question-aaaa-aaaa-aaaa-aaaaaaaa",
} as const;
