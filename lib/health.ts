import { sql } from "drizzle-orm";
import { Queue } from "bullmq";
import { db } from "@/lib/db";
import {
  GRADE_STACK_QUEUE_NAME,
  GRADE_STACK_QUEUE_PREFIX,
} from "@/lib/grade-stack-jobs/constants";
import { getRedisConnection } from "@/lib/grade-stack-jobs/queue";

const CHECK_TIMEOUT_MS = 3_000;

export type HealthServiceName = "api" | "database" | "worker";

export type HealthServiceStatus = "ok" | "error";

export type HealthServiceResult = {
  status: HealthServiceStatus;
  message?: string;
};

export type HealthReport = {
  ok: boolean;
  checkedAt: string;
  services: Record<HealthServiceName, HealthServiceResult>;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function checkDatabase(): Promise<HealthServiceResult> {
  try {
    await withTimeout(db.execute(sql`SELECT 1`), CHECK_TIMEOUT_MS, "Database");
    return { status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unreachable";
    return { status: "error", message };
  }
}

async function checkWorker(): Promise<HealthServiceResult> {
  if (!process.env.REDIS_URL) {
    return { status: "error", message: "REDIS_URL is not configured" };
  }

  const queue = new Queue(GRADE_STACK_QUEUE_NAME, {
    connection: getRedisConnection(),
    prefix: GRADE_STACK_QUEUE_PREFIX,
  });

  try {
    await withTimeout(queue.waitUntilReady(), CHECK_TIMEOUT_MS, "Redis");
    const workers = await withTimeout(queue.getWorkers(), CHECK_TIMEOUT_MS, "Worker");
    if (workers.length === 0) {
      return { status: "error", message: "No grading workers connected" };
    }
    return { status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker check failed";
    return { status: "error", message };
  } finally {
    await queue.close();
  }
}

export async function getHealthReport(): Promise<HealthReport> {
  const [database, worker] = await Promise.all([checkDatabase(), checkWorker()]);
  const services: HealthReport["services"] = {
    api: { status: "ok" },
    database,
    worker,
  };
  const ok = Object.values(services).every((service) => service.status === "ok");
  return { ok, checkedAt: new Date().toISOString(), services };
}
