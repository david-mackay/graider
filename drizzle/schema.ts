import { boolean, index, jsonb, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appUsers = pgTable("app_users", {
  id: text("id").primaryKey(),
  email: text("email"),
  fullName: text("full_name"),
  role: text("role").notNull().default("student"),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  subscriptionUpdatedAt: timestamp("subscription_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const classMemberships = pgTable(
  "class_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    classIdIdx: index("class_memberships_class_id_idx").on(table.classId),
    userIdIdx: index("class_memberships_user_id_idx").on(table.userId),
    classAndUser: unique("class_memberships_class_id_user_id_uniq").on(table.classId, table.userId),
  }),
);

export const classInvitations = pgTable(
  "class_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email"),
    invitationCode: text("invitation_code").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("student"),
    studentId: text("student_id").references(() => appUsers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    classIdIdx: index("class_invitations_class_id_idx").on(table.classId),
    invitationCodeIdx: index("class_invitations_code_idx").on(table.invitationCode),
  }),
);

export const questionBank = pgTable(
  "question_bank",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    marks: integer("marks").notNull(),
    topic: text("topic"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);

export const tests = pgTable("tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  gradesReleased: boolean("grades_released").notNull().default(true),
  showAiFeedback: boolean("show_ai_feedback").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const testQuestions = pgTable(
  "test_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questionBank.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    testQuestionUnique: unique("test_questions_test_id_question_id_uniq").on(table.testId, table.questionId),
  }),
);

export const testAttempts = pgTable("test_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: uuid("test_id")
    .notNull()
    .references(() => tests.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("submitted"),
  totalMarks: integer("total_marks"),
  maxMarks: integer("max_marks"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  ocrUploads: text("ocr_uploads")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => testAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questionBank.id, { onDelete: "cascade" }),
    studentAnswer: text("student_answer").notNull(),
    marksEarned: integer("marks_earned"),
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    attemptQuestionUnique: unique("attempt_answers_attempt_id_question_id_uniq").on(table.attemptId, table.questionId),
  }),
);

export const ocrBatches = pgTable("ocr_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => testAttempts.id, { onDelete: "cascade" }),
  graderTeacherId: text("grader_teacher_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const gradeStackJobs = pgTable(
  "grade_stack_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phase: text("phase").notNull(),
    status: text("status").notNull().default("queued"),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    previewJobId: uuid("preview_job_id"),
    idempotencyKey: text("idempotency_key"),
    bullmqJobId: text("bullmq_job_id"),
    inputPayload: jsonb("input_payload").notNull().default({}),
    previewPayload: jsonb("preview_payload"),
    commitPayload: jsonb("commit_payload"),
    failures: jsonb("failures").notNull().default([]),
    error: text("error"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    testIdIdx: index("grade_stack_jobs_test_id_idx").on(table.testId),
    statusIdx: index("grade_stack_jobs_status_idx").on(table.status),
    idempotencyKeyUniq: unique("grade_stack_jobs_idempotency_key_uniq").on(table.idempotencyKey),
  }),
);

export const contentImportJobs = pgTable(
  "content_import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("queued"),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    bullmqJobId: text("bullmq_job_id"),
    resultPayload: jsonb("result_payload"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    classIdIdx: index("content_import_jobs_class_id_idx").on(table.classId),
    statusIdx: index("content_import_jobs_status_idx").on(table.status),
  }),
);

