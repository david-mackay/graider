/** Shared catalog TTL. Writes always delete the key; this is only a safety net. */
export const CATALOG_CACHE_TTL_SECONDS = 60 * 60 * 24;

export function classesCacheKey(userId: string): string {
  return `classes:user:${userId}`;
}

export function classMembersCacheKey(classId: string): string {
  return `class:${classId}:members`;
}

export function classRosterCacheKey(classId: string): string {
  return `class:${classId}:roster`;
}

export function classTestsCacheKey(classId: string): string {
  return `class:${classId}:tests`;
}

export function classQuestionsCacheKey(classId: string, teacherId: string): string {
  return `class:${classId}:questions:teacher:${teacherId}`;
}

export function teacherQuestionsCacheKey(teacherId: string): string {
  return `questions:teacher:${teacherId}`;
}
