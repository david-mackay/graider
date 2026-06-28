import { Job, Worker } from "bullmq";
import {
  CONTENT_IMPORT_JOB_QUESTION_BANK,
  CONTENT_IMPORT_JOB_TEST,
  CONTENT_IMPORT_QUEUE_NAME,
  CONTENT_IMPORT_QUEUE_PREFIX,
  CONTENT_IMPORT_WORKER_CONCURRENCY,
} from "@/lib/content-import-jobs/constants";
import {
  closeContentImportQueue,
  ContentImportQueueJobData,
  getContentImportQueue,
} from "@/lib/content-import-jobs/queue";
import { failContentImportJob } from "@/lib/content-import-jobs/repository";
import {
  GRADE_STACK_JOB_STACK_COMMIT,
  GRADE_STACK_JOB_STACK_PREVIEW,
  GRADE_STACK_QUEUE_NAME,
  GRADE_STACK_QUEUE_PREFIX,
  GRADE_STACK_WORKER_CONCURRENCY,
} from "@/lib/grade-stack-jobs/constants";
import {
  closeGradeStackQueue,
  getRedisConnection,
  GradeStackQueueJobData,
} from "@/lib/grade-stack-jobs/queue";
import { failJob } from "@/lib/grade-stack-jobs/repository";
import { processStackCommitJob, processStackPreviewJob } from "@/worker/process-grade-stack-job";
import {
  processQuestionBankImportJob,
  processTestImportJob,
} from "@/worker/process-content-import-job";
import { startWorkerHealthServer } from "@/worker/health";

async function runGradeStackJob(job: Job<GradeStackQueueJobData>) {
  if (job.name === GRADE_STACK_JOB_STACK_PREVIEW) {
    await processStackPreviewJob(job.data);
    return;
  }
  if (job.name === GRADE_STACK_JOB_STACK_COMMIT) {
    await processStackCommitJob(job.data);
    return;
  }
  throw new Error(`Unknown grade stack job name: ${job.name}`);
}

async function runContentImportJob(job: Job<ContentImportQueueJobData>) {
  if (job.name === CONTENT_IMPORT_JOB_QUESTION_BANK) {
    await processQuestionBankImportJob(job.data.jobId);
    return;
  }
  if (job.name === CONTENT_IMPORT_JOB_TEST) {
    await processTestImportJob(job.data.jobId);
    return;
  }
  throw new Error(`Unknown content import job name: ${job.name}`);
}

async function main() {
  const healthPort = Number.parseInt(process.env.WORKER_HEALTH_PORT ?? "10000", 10);
  startWorkerHealthServer(healthPort);

  const connection = getRedisConnection();

  const gradeStackWorker = new Worker<GradeStackQueueJobData>(
    GRADE_STACK_QUEUE_NAME,
    async (job) => runGradeStackJob(job),
    {
      connection,
      prefix: GRADE_STACK_QUEUE_PREFIX,
      concurrency: GRADE_STACK_WORKER_CONCURRENCY,
    },
  );

  const contentImportWorker = new Worker<ContentImportQueueJobData>(
    CONTENT_IMPORT_QUEUE_NAME,
    async (job) => runContentImportJob(job),
    {
      connection,
      prefix: CONTENT_IMPORT_QUEUE_PREFIX,
      concurrency: CONTENT_IMPORT_WORKER_CONCURRENCY,
    },
  );

  gradeStackWorker.on("failed", async (job, error) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;
    const message = error instanceof Error ? error.message : "Job failed.";
    await failJob(job.data.jobId, message);
    console.error(`[grade-stack-worker] job ${job.data.jobId} failed:`, message);
  });

  contentImportWorker.on("failed", async (job, error) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;
    const message = error instanceof Error ? error.message : "Job failed.";
    await failContentImportJob(job.data.jobId, message);
    console.error(`[content-import-worker] job ${job.data.jobId} failed:`, message);
  });

  gradeStackWorker.on("completed", (job) => {
    console.log(`[grade-stack-worker] job ${job.data.jobId} (${job.name}) completed`);
  });

  contentImportWorker.on("completed", (job) => {
    console.log(`[content-import-worker] job ${job.data.jobId} (${job.name}) completed`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[worker] received ${signal}, shutting down`);
    await gradeStackWorker.close();
    await contentImportWorker.close();
    await closeGradeStackQueue();
    await closeContentImportQueue();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Warm queues
  getContentImportQueue();

  console.log(
    `[worker] grade-stack queue "${GRADE_STACK_QUEUE_NAME}" (concurrency=${GRADE_STACK_WORKER_CONCURRENCY}); ` +
      `content-import queue "${CONTENT_IMPORT_QUEUE_NAME}" (concurrency=${CONTENT_IMPORT_WORKER_CONCURRENCY})`,
  );
}

main().catch((error) => {
  console.error("[grade-stack-worker] fatal error:", error);
  process.exit(1);
});
