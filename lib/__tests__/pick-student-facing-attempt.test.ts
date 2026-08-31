import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickStudentFacingAttempt } from "@/lib/pick-student-facing-attempt";

describe("pickStudentFacingAttempt", () => {
  it("ignores paper scans so the student can still start digitally", () => {
    const picked = pickStudentFacingAttempt(
      [{ test_id: "t1", source: "teacher_ocr", status: "graded" }],
      "t1",
    );
    assert.equal(picked, null);
  });

  it("prefers a digital draft over a paper grade", () => {
    const picked = pickStudentFacingAttempt(
      [
        { test_id: "t1", source: "teacher_ocr", status: "graded" },
        { test_id: "t1", source: "student", status: "draft" },
      ],
      "t1",
    );
    assert.equal(picked?.status, "draft");
  });
});
