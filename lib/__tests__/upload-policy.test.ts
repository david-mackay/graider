import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeStoragePath,
  isAllowedUploadContentType,
  isAllowedUploadPurpose,
} from "@/lib/upload-policy";

describe("M7 upload-policy (UP-03 UP-04)", () => {
  it("UP-03 only allows stack_preview purpose", () => {
    assert.equal(isAllowedUploadPurpose("stack_preview"), true);
    assert.equal(isAllowedUploadPurpose("imports"), false);
    assert.equal(isAllowedUploadPurpose(undefined), false);
  });

  it("allows image and pdf content types", () => {
    assert.equal(isAllowedUploadContentType("image/png"), true);
    assert.equal(isAllowedUploadContentType("application/pdf"), true);
    assert.equal(isAllowedUploadContentType("text/html"), false);
  });

  it("UP-04 rejects path traversal", () => {
    assert.equal(assertSafeStoragePath("stack-preview/t1/a.png").ok, true);
    const bad = assertSafeStoragePath("stack-preview/../secret.png");
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.reason, "FORBIDDEN");
  });
});
