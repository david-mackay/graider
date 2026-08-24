import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getOrSetJson } from "@/lib/cache/json";
import { CATALOG_CACHE_TTL_SECONDS, classTestsCacheKey } from "@/lib/cache/keys";
import type { TestSummary } from "@/lib/types";
import { isTestAvailableNow, mapTestScheduleToApi } from "@/lib/test-availability";

function toSummary(row: typeof tests.$inferSelect): TestSummary {
  const schedule = mapTestScheduleToApi(row);
  return {
    id: row.id,
    title: row.title,
    class_id: row.classId,
    teacher_id: row.teacherId,
    grades_released: row.gradesReleased,
    show_ai_feedback: row.showAiFeedback,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
    ...schedule,
  };
}

export function refreshTestAvailability(test: TestSummary): TestSummary {
  return {
    ...test,
    available_now: isTestAvailableNow({
      status: test.status,
      opensAt: test.opens_at,
      closesAt: test.closes_at,
      durationMinutes: test.duration_minutes,
      allowLateSubmit: test.allow_late_submit,
    }),
  };
}

async function fetchTestsForClass(classId: string): Promise<TestSummary[]> {
  const rows = await db.select().from(tests).where(eq(tests.classId, classId)).orderBy(desc(tests.createdAt));
  return rows.map(toSummary);
}

export async function listTestsForClass(classId: string): Promise<TestSummary[]> {
  return getOrSetJson(classTestsCacheKey(classId), CATALOG_CACHE_TTL_SECONDS, () =>
    fetchTestsForClass(classId),
  );
}
