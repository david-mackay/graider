import { Job, Worker } from "bullmq";
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
import { startWorkerHealthServer } from "@/worker/health";

async function runJob(job: Job<GradeStackQueueJobData>) {
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

async function main() {
  const healthPort = Number.parseInt(process.env.WORKER_HEALTH_PORT ?? "10000", 10);
  startWorkerHealthServer(healthPort);

  const connection = getRedisConnection();
  const worker = new Worker<GradeStackQueueJobData>(
    GRADE_STACK_QUEUE_NAME,
    async (job) => runJob(job),
    {
      connection,
      prefix: GRADE_STACK_QUEUE_PREFIX,
      concurrency: GRADE_STACK_WORKER_CONCURRENCY,
    },
  );

  worker.on("failed", async (job, error) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;
    const message = error instanceof Error ? error.message : "Job failed.";
    await failJob(job.data.jobId, message);
    console.error(`[grade-stack-worker] job ${job.data.jobId} failed:`, message);
  });

  worker.on("completed", (job) => {
    console.log(`[grade-stack-worker] job ${job.data.jobId} (${job.name}) completed`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[grade-stack-worker] received ${signal}, shutting down`);
    await worker.close();
    await closeGradeStackQueue();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log(
    `[grade-stack-worker] listening on queue "${GRADE_STACK_QUEUE_NAME}" (concurrency=${GRADE_STACK_WORKER_CONCURRENCY})`,
  );
}

main().catch((error) => {
  console.error("[grade-stack-worker] fatal error:", error);
  process.exit(1);
});
