import type { AppUser } from "@/lib/types";

export const actors = {
  studentA: {
    id: "user_student_a",
    email: "a@school.test",
    full_name: "Student A",
    role: "student",
  } satisfies AppUser,
  studentB: {
    id: "user_student_b",
    email: "b@school.test",
    full_name: "Student B",
    role: "student",
  } satisfies AppUser,
  teacherA: {
    id: "user_teacher_a",
    email: "ta@school.test",
    full_name: "Teacher A",
    role: "teacher",
  } satisfies AppUser,
  teacherB: {
    id: "user_teacher_b",
    email: "tb@school.test",
    full_name: "Teacher B",
    role: "teacher",
  } satisfies AppUser,
  outsider: {
    id: "user_outsider",
    email: "out@school.test",
    full_name: "Outsider",
    role: "student",
  } satisfies AppUser,
};

export function jsonRequest(url: string, init?: RequestInit & { json?: unknown }) {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  return new Request(url, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
}
