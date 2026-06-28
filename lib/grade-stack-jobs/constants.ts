export const GRADE_STACK_QUEUE_NAME =
  process.env.GRADE_STACK_QUEUE_NAME ?? "grade-stack";

export const GRADE_STACK_QUEUE_PREFIX = process.env.GRADE_STACK_QUEUE_PREFIX ?? "graider";

export const GRADE_STACK_JOB_STACK_PREVIEW = "stack_preview";
export const GRADE_STACK_JOB_STACK_COMMIT = "stack_commit";

export const GRADE_STACK_WORKER_CONCURRENCY = Number.parseInt(
  process.env.GRADE_STACK_WORKER_CONCURRENCY ?? "2",
  10,
);

export const GRADE_STACK_JOB_ATTEMPTS = Number.parseInt(
  process.env.GRADE_STACK_JOB_ATTEMPTS ?? "3",
  10,
);

export const GRADE_STACK_JOB_BACKOFF_MS = Number.parseInt(
  process.env.GRADE_STACK_JOB_BACKOFF_MS ?? "5000",
  10,
);

export const GRADE_STACK_JOB_TTL_SECONDS = Number.parseInt(
  process.env.GRADE_STACK_JOB_TTL_SECONDS ?? "604800",
  10,
);
