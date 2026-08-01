import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AttemptNotSubmittedError } from "@/lib/grading";

describe("M6 grading gates", () => {
  it("GR-03 AttemptNotSubmittedError is distinguishable", () => {
    const err = new AttemptNotSubmittedError();
    assert.equal(err.name, "AttemptNotSubmittedError");
    assert.match(err.message, /in progress/i);
  });
});
