/**
 * M8 — onboarding / public / webhooks.
 */
import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { actors, ids } from "./helpers/actors";
import {
  installL2Mocks,
  l2Stubs,
  resetL2Mocks,
  scriptedDb,
  setActor,
} from "./helpers/l2-mocks";

installL2Mocks();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response>;

let parseKeyPOST: AnyHandler;
let sampleGradePOST: AnyHandler;
let syncPOST: AnyHandler;
let webhookPOST: AnyHandler;
let healthGET: AnyHandler;
let appVersionGET: AnyHandler;

function jsonRequest(url: string, body: unknown, method = "POST", headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function minimalVault() {
  return {
    schemaVersion: 2,
    startedAt: new Date().toISOString(),
    answerKeys: [{ prompt: "Q1", correctAnswer: "A", marks: 1 }],
    students: [
      {
        id: "s1",
        name: "Ada",
        source: "typed",
        typedAnswers: ["A"],
        grade: {
          marksEarned: 1,
          maxMarks: 1,
          feedback: "ok",
          ocrAnswerText: "A",
        },
      },
    ],
  };
}

describe("M8 onboarding / public / webhooks L2", () => {
  before(async () => {
    installL2Mocks();
    ({ POST: parseKeyPOST } = await import("@/app/api/onboarding/parse-answer-key/route"));
    ({ POST: sampleGradePOST } = await import("@/app/api/onboarding/sample-grade/route"));
    ({ POST: syncPOST } = await import("@/app/api/onboarding/sync/route"));
    ({ POST: webhookPOST } = await import("@/app/api/webhooks/revenuecat/route"));
    ({ GET: healthGET } = await import("@/app/api/health/route"));
    ({ GET: appVersionGET } = await import("@/app/api/app-version/route"));
  });

  beforeEach(() => {
    resetL2Mocks();
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
  });

  it("ON-01 public parse remains unauthenticated but rate-limited", async () => {
    // No actor — must not 401; rate-limit gate runs first after reducto check.
    setActor(null);
    l2Stubs.reductoConfigured = true;
    l2Stubs.rateLimitAllowed = false;
    l2Stubs.rateLimitRetryAfterMs = 30_000;

    const res = await parseKeyPOST(
      new NextRequest("http://localhost/api/onboarding/parse-answer-key", {
        method: "POST",
        headers: { "x-forwarded-for": "1.2.3.4" },
        body: new FormData(),
      }),
    );
    assert.equal(res.status, 429);
    assert.ok(res.headers.get("retry-after"));
  });

  it("ON-01 sample-grade rate-limited without auth", async () => {
    setActor(null);
    l2Stubs.rateLimitAllowed = false;
    l2Stubs.rateLimitRetryAfterMs = 12_000;
    const res = await sampleGradePOST(
      new NextRequest("http://localhost/api/onboarding/sample-grade", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.9" },
        body: new FormData(),
      }),
    );
    assert.equal(res.status, 429);
  });

  it("ON-02 sync requires auth; may set teacher via onboarding path", async () => {
    setActor(null);
    const anon = await syncPOST(jsonRequest("http://localhost/api/onboarding/sync", minimalVault()));
    assert.equal(anon.status, 401);

    setActor({ ...actors.studentA, role: "student" });
    // Idempotent early return: existing class + test + attempts
    scriptedDb.enqueueSelect(
      [{ id: ids.classA, createdAt: new Date() }],
      [{ id: ids.testA }],
      [{ id: ids.attemptA }, { id: "attempt-2" }],
    );
    const synced = await syncPOST(jsonRequest("http://localhost/api/onboarding/sync", minimalVault()));
    assert.equal(synced.status, 200);
    const body = await synced.json();
    assert.equal(body.classId, ids.classA);
    assert.equal(body.created, false);
    // Student was promoted to teacher during sync.
    assert.equal(actors.studentA.role, "student"); // fixture unchanged
    // Actor mutated via setUserRole mock:
    const { getCurrentUser } = await import("@/lib/auth");
    const user = await getCurrentUser();
    assert.equal(user.role, "teacher");
  });

  it("WH-01 revenuecat webhook rejects missing/invalid bearer", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "secret-token";
    const missing = await webhookPOST(
      jsonRequest("http://localhost/api/webhooks/revenuecat", {
        app_user_id: actors.teacherA.id,
      }),
    );
    assert.equal(missing.status, 401);

    const bad = await webhookPOST(
      jsonRequest(
        "http://localhost/api/webhooks/revenuecat",
        { app_user_id: actors.teacherA.id },
        "POST",
        { authorization: "Bearer wrong" },
      ),
    );
    assert.equal(bad.status, 401);
  });

  it("WH-02 valid bearer accepted", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "secret-token";
    const res = await webhookPOST(
      jsonRequest(
        "http://localhost/api/webhooks/revenuecat",
        { app_user_id: actors.teacherA.id, type: "INITIAL_PURCHASE" },
        "POST",
        { authorization: "Bearer secret-token" },
      ),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(l2Stubs.setTeacherSubscriptionCalls.length, 1);
    assert.equal(l2Stubs.setTeacherSubscriptionCalls[0].teacherId, actors.teacherA.id);
  });

  it("PUB-01 health + app-version public", async () => {
    setActor(null);
    l2Stubs.healthReport = { ok: true, service: "graider" };
    l2Stubs.appVersion = {
      ios: { minVersion: "1.0.0", latestVersion: "1.0.0", storeUrl: "" },
      android: { minVersion: "1.0.0", latestVersion: "1.0.0", storeUrl: "" },
    };

    const health = await healthGET();
    // Public: never auth-gated (200 healthy / 503 degraded both fine).
    assert.notEqual(health.status, 401);
    assert.ok(health.status === 200 || health.status === 503);
    const healthBody = await health.json();
    assert.equal(typeof healthBody, "object");

    const version = await appVersionGET();
    assert.equal(version.status, 200);
    const versionBody = await version.json();
    assert.equal(versionBody.schemaVersion, 1);
    assert.ok(versionBody.ios || versionBody.android);
  });
});
