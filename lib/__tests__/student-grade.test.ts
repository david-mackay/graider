import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PAGES_PER_STUDENT,
  MAX_STUDENTS_PER_SESSION,
  MAX_TOTAL_PAGES,
  createEmptyBucket,
  movePageInBucket,
  totalPageCount,
} from "@/lib/student-grade";

describe("student-grade helpers", () => {
  it("exposes session limits", () => {
    assert.ok(MAX_PAGES_PER_STUDENT > 0);
    assert.ok(MAX_STUDENTS_PER_SESSION > 0);
    assert.ok(MAX_TOTAL_PAGES >= MAX_PAGES_PER_STUDENT);
  });

  it("creates empty buckets and counts pages", () => {
    const bucket = createEmptyBucket("s1", "Ada");
    assert.equal(bucket.sendStatus, "idle");
    assert.equal(totalPageCount([bucket]), 0);
  });

  it("reorders pages in a bucket", () => {
    const a = { name: "a" } as unknown as File;
    const b = { name: "b" } as unknown as File;
    const c = { name: "c" } as unknown as File;
    const moved = movePageInBucket([a, b, c], 0, 2);
    assert.equal((moved[2] as { name: string }).name, "a");
    assert.deepEqual(
      movePageInBucket([a, b], 0, 0).map((f) => (f as { name: string }).name),
      ["a", "b"],
    );
  });
});
