import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { needsProfileSetup, postAuthHomePath } from "@/lib/post-auth-routing";

describe("post-auth routing", () => {
  it("treats missing and Clerk placeholder names as incomplete", () => {
    assert.equal(needsProfileSetup(null), true);
    assert.equal(needsProfileSetup(""), true);
    assert.equal(needsProfileSetup("user_2abcDEFGHIJKLMNOPQRST"), true);
    assert.equal(needsProfileSetup("Jane Smith"), false);
  });

  it("incomplete profiles prefer teacher home unless student intent", () => {
    assert.equal(
      postAuthHomePath({ role: "student", fullName: null, signupIntent: null }),
      "/t",
    );
    assert.equal(
      postAuthHomePath({ role: "student", fullName: null, signupIntent: "teacher" }),
      "/t",
    );
    assert.equal(
      postAuthHomePath({ role: "student", fullName: null, signupIntent: "student" }),
      "/s",
    );
  });

  it("complete profiles follow stored role", () => {
    assert.equal(
      postAuthHomePath({ role: "teacher", fullName: "Ada", signupIntent: "student" }),
      "/t",
    );
    assert.equal(
      postAuthHomePath({ role: "student", fullName: "Ada", signupIntent: "teacher" }),
      "/s",
    );
  });
});
