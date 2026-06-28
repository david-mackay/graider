import { Queue } from "bullmq";
import {
  CONTENT_IMPORT_JOB_ATTEMPTS,
  CONTENT_IMPORT_JOB_BACKOFF_MS,
  CONTENT_IMPORT_JOB_QUESTION_BANK,
  CONTENT_IMPORT_JOB_TEST,
  CONTENT_IMPORT_JOB_TTL_SECONDS,
  CONTENT_IMPORT_QUEUE_NAME,
  CONTENT_IMPORT_QUEUE_PREFIX,
} from "@/lib/content-import-jobs/constants";
import { getRedisConnection } from "@/lib/grade-stack-jobs/queue";

export type ContentImportQueueJobData = {
  jobId: string;
};

let sharedQueue: Queue<ContentImportQueueJobData> | null = null;

export function getContentImportQueue(): Queue<ContentImportQueueJobData> {
  if (!sharedQueue) {
    sharedQueue = new Queue<ContentImportQueueJobData>(CONTENT_IMPORT_QUEUE_NAME, {
      connection: getRedisConnection(),
      prefix: CONTENT_IMPORT_QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: CONTENT_IMPORT_JOB_ATTEMPTS,
        backoff: { type: "fixed", delay: CONTENT_IMPORT_JOB_BACKOFF_MS },
        removeOnComplete: { age: CONTENT_IMPORT_JOB_TTL_SECONDS },
        removeOnFail: { age: CONTENT_IMPORT_JOB_TTL_SECONDS },
      },
    });
  }
  return sharedQueue;
}

function defaultEnqueueOptions(jobId: string) {
  return {
    jobId: `content-import-${jobId}`,
    attempts: CONTENT_IMPORT_JOB_ATTEMPTS,
    backoff: { type: "fixed" as const, delay: CONTENT_IMPORT_JOB_BACKOFF_MS },
    removeOnComplete: { age: CONTENT_IMPORT_JOB_TTL_SECONDS },
    removeOnFail: { age: CONTENT_IMPORT_JOB_TTL_SECONDS },
  };
}

export async function enqueueQuestionBankImportJob(jobId: string) {
  const queue = getContentImportQueue();
  const bullJob = await queue.add(
    CONTENT_IMPORT_JOB_QUESTION_BANK,
    { jobId },
    defaultEnqueueOptions(jobId),
  );
  return bullJob.id ?? jobId;
}

export async function enqueueTestImportJob(jobId: string) {
  const queue = getContentImportQueue();
  const bullJob = await queue.add(
    CONTENT_IMPORT_JOB_TEST,
    { jobId },
    defaultEnqueueOptions(jobId),
  );
  return bullJob.id ?? jobId;
}

export async function closeContentImportQueue(): Promise<void> {
  if (sharedQueue) {
    await sharedQueue.close();
    sharedQueue = null;
  }
}
