export const CONTENT_IMPORT_QUEUE_NAME =
  process.env.CONTENT_IMPORT_QUEUE_NAME ?? "content-import";

export const CONTENT_IMPORT_QUEUE_PREFIX =
  process.env.CONTENT_IMPORT_QUEUE_PREFIX ?? "graider";

export const CONTENT_IMPORT_JOB_QUESTION_BANK = "question_bank";
export const CONTENT_IMPORT_JOB_TEST = "test";

export const CONTENT_IMPORT_WORKER_CONCURRENCY = Number.parseInt(
  process.env.CONTENT_IMPORT_WORKER_CONCURRENCY ?? "2",
  10,
);

export const CONTENT_IMPORT_JOB_ATTEMPTS = Number.parseInt(
  process.env.CONTENT_IMPORT_JOB_ATTEMPTS ?? "3",
  10,
);

export const CONTENT_IMPORT_JOB_BACKOFF_MS = Number.parseInt(
  process.env.CONTENT_IMPORT_JOB_BACKOFF_MS ?? "5000",
  10,
);

export const CONTENT_IMPORT_JOB_TTL_SECONDS = Number.parseInt(
  process.env.CONTENT_IMPORT_JOB_TTL_SECONDS ?? "604800",
  10,
);

export const MAX_PDF_BYTES = Number.parseInt(
  process.env.CONTENT_IMPORT_MAX_PDF_BYTES ?? String(15 * 1024 * 1024),
  10,
);
