import { Queue } from "bullmq";
import {
  GRADE_STACK_JOB_ATTEMPTS,
  GRADE_STACK_JOB_BACKOFF_MS,
  GRADE_STACK_JOB_STACK_COMMIT,
  GRADE_STACK_JOB_STACK_PREVIEW,
  GRADE_STACK_JOB_TTL_SECONDS,
  GRADE_STACK_QUEUE_NAME,
  GRADE_STACK_QUEUE_PREFIX,
} from "@/lib/grade-stack-jobs/constants";

export type GradeStackQueueJobData = {
  jobId: string;
};

let sharedQueue: Queue<GradeStackQueueJobData> | null = null;

export function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for grade stack jobs.");
  }
  return { url, maxRetriesPerRequest: null };
}

export function getGradeStackQueue(): Queue<GradeStackQueueJobData> {
  if (!sharedQueue) {
    sharedQueue = new Queue<GradeStackQueueJobData>(GRADE_STACK_QUEUE_NAME, {
      connection: getRedisConnection(),
      prefix: GRADE_STACK_QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: GRADE_STACK_JOB_ATTEMPTS,
        backoff: { type: "fixed", delay: GRADE_STACK_JOB_BACKOFF_MS },
        removeOnComplete: { age: GRADE_STACK_JOB_TTL_SECONDS },
        removeOnFail: { age: GRADE_STACK_JOB_TTL_SECONDS },
      },
    });
  }
  return sharedQueue;
}

function defaultEnqueueOptions(jobId: string) {
  return {
    jobId,
    attempts: GRADE_STACK_JOB_ATTEMPTS,
    backoff: { type: "fixed" as const, delay: GRADE_STACK_JOB_BACKOFF_MS },
    removeOnComplete: { age: GRADE_STACK_JOB_TTL_SECONDS },
    removeOnFail: { age: GRADE_STACK_JOB_TTL_SECONDS },
  };
}

export async function enqueueStackPreviewJob(jobId: string) {
  const queue = getGradeStackQueue();
  const bullJob = await queue.add(
    GRADE_STACK_JOB_STACK_PREVIEW,
    { jobId },
    defaultEnqueueOptions(jobId),
  );
  return bullJob.id ?? jobId;
}

export async function enqueueStackCommitJob(jobId: string) {
  const queue = getGradeStackQueue();
  const bullJob = await queue.add(
    GRADE_STACK_JOB_STACK_COMMIT,
    { jobId },
    defaultEnqueueOptions(jobId),
  );
  return bullJob.id ?? jobId;
}

export async function closeGradeStackQueue(): Promise<void> {
  if (sharedQueue) {
    await sharedQueue.close();
    sharedQueue = null;
  }
}
