import { mock } from "node:test";
import type { AppUser, ClassMembership, ClassRole } from "@/lib/types";
import { ScriptedDb } from "./scripted-db";

type AuthState = {
  user: AppUser | null;
  classRoles: Map<string, ClassRole>;
  memberships: ClassMembership[];
};

const authState: AuthState = {
  user: null,
  classRoles: new Map(),
  memberships: [],
};

export const scriptedDb = new ScriptedDb();

export const l2Stubs = {
  listedClasses: [] as unknown[],
  subscriptionSummary: {
    plan: "free",
    status: "active",
    classesUsed: 0,
    classesLimit: 3,
    stackGradesUsed: 0,
    stackGradesLimit: 20,
  } as unknown,
  deletedUserIds: [] as string[],
  jobsById: new Map<string, { id: string; teacherId: string; status: string; classId?: string | null }>(),
  rateLimitAllowed: true,
  rateLimitRetryAfterMs: 0,
  reductoConfigured: true,
  healthReport: { ok: true, checks: {} } as unknown,
  appVersion: {
    minimumVersion: "1.0.0",
    latestVersion: "1.0.0",
    forceUpgrade: false,
  } as unknown,
  setTeacherSubscriptionCalls: [] as Array<{ teacherId: string; tier: string }>,
};

let mocksInstalled = false;

export function setActor(user: AppUser | null) {
  authState.user = user;
}

export function setClassRole(classId: string, role: ClassRole | null) {
  if (role === null) authState.classRoles.delete(classId);
  else authState.classRoles.set(classId, role);
}

export function setMemberships(memberships: ClassMembership[]) {
  authState.memberships = memberships;
}

export function clearClassRoles() {
  authState.classRoles.clear();
}

export function resetL2Mocks() {
  authState.user = null;
  authState.classRoles.clear();
  authState.memberships = [];
  scriptedDb.reset();
  l2Stubs.listedClasses = [];
  l2Stubs.deletedUserIds = [];
  l2Stubs.jobsById.clear();
  l2Stubs.rateLimitAllowed = true;
  l2Stubs.rateLimitRetryAfterMs = 0;
  l2Stubs.reductoConfigured = true;
  l2Stubs.setTeacherSubscriptionCalls = [];
}

export function installL2Mocks() {
  if (mocksInstalled) return;
  mocksInstalled = true;

  mock.module("@/lib/auth", {
    namedExports: {
      getCurrentUser: async (): Promise<AppUser> => {
        if (!authState.user) throw new Error("UNAUTHORIZED");
        return authState.user;
      },
      requireRole: async (requiredRole: AppUser["role"]): Promise<AppUser> => {
        if (!authState.user) throw new Error("UNAUTHORIZED");
        if (authState.user.role !== requiredRole) throw new Error("FORBIDDEN");
        return authState.user;
      },
      requireClassAccess: async (
        classId: string,
        acceptedRoles: ClassRole[],
      ): Promise<AppUser & { classRole: ClassRole }> => {
        if (!authState.user) throw new Error("UNAUTHORIZED");
        const role = authState.classRoles.get(classId) ?? null;
        if (!role || !acceptedRoles.includes(role)) throw new Error("FORBIDDEN");
        return { ...authState.user, classRole: role };
      },
      getClassRole: async (classId: string): Promise<ClassRole | null> => {
        if (!authState.user) throw new Error("UNAUTHORIZED");
        return authState.classRoles.get(classId) ?? null;
      },
      setUserRole: async (role: AppUser["role"]): Promise<AppUser> => {
        if (!authState.user) throw new Error("UNAUTHORIZED");
        authState.user = { ...authState.user, role };
        return authState.user;
      },
      getClassMemberships: async () => authState.memberships,
    },
  });

  mock.module("@/lib/db", {
    namedExports: {
      get db() {
        return scriptedDb.asDb();
      },
    },
  });

  mock.module("@/lib/grading", {
    namedExports: {
      AttemptNotSubmittedError: class AttemptNotSubmittedError extends Error {
        constructor(message = "Attempt has not been submitted yet.") {
          super(message);
          this.name = "AttemptNotSubmittedError";
        }
      },
      gradeOneAttempt: async () => ({
        total_marks: 1,
        max_marks: 1,
        grades: [],
      }),
    },
  });

  mock.module("@/lib/classes/list-for-user", {
    namedExports: {
      listClassesForUser: async () => l2Stubs.listedClasses,
    },
  });

  mock.module("@/lib/classes/invalidate", {
    namedExports: {
      invalidateUserClasses: async () => undefined,
      invalidateClassMemberCaches: async () => undefined,
    },
  });

  mock.module("@/lib/account-deletion", {
    namedExports: {
      deleteUserAccount: async (userId: string) => {
        l2Stubs.deletedUserIds.push(userId);
      },
    },
  });

  class SubscriptionLimitError extends Error {
    code: string;
    constructor(message: string, code = "LIMIT") {
      super(message);
      this.name = "SubscriptionLimitError";
      this.code = code;
    }
  }

  mock.module("@/lib/subscriptions/limits", {
    namedExports: {
      SubscriptionLimitError,
      getSubscriptionSummary: async () => l2Stubs.subscriptionSummary,
      assertCanCreateClass: async () => l2Stubs.subscriptionSummary,
      assertCanStartStackGrade: async () => l2Stubs.subscriptionSummary,
      setTeacherSubscription: async (params: { teacherId: string; tier: string }) => {
        l2Stubs.setTeacherSubscriptionCalls.push({
          teacherId: params.teacherId,
          tier: params.tier,
        });
      },
    },
  });

  mock.module("@/lib/grade-stack-jobs/repository", {
    namedExports: {
      findJobById: async (jobId: string) => l2Stubs.jobsById.get(jobId) ?? null,
      cancelJob: async () => undefined,
      findJobByIdempotencyKey: async () => null,
    },
  });

  mock.module("@/lib/grade-stack-jobs/map-job", {
    namedExports: {
      mapGradeStackJobRow: (row: { id: string; teacherId: string; status: string }) => ({
        id: row.id,
        status: row.status,
        teacherId: row.teacherId,
      }),
    },
  });

  mock.module("@/lib/storage", {
    namedExports: {
      usesObjectStorage: () => true,
      createSignedUpload: async (pathKey: string) => ({
        path: pathKey,
        token: "tok",
        signedUrl: `https://storage.test/${pathKey}`,
        bucket: "uploads",
      }),
      readFile: async () => Buffer.from("file-bytes"),
    },
  });

  mock.module("@/lib/onboarding/rate-limit", {
    namedExports: {
      checkRateLimit: () => ({
        allowed: l2Stubs.rateLimitAllowed,
        retryAfterMs: l2Stubs.rateLimitRetryAfterMs,
      }),
    },
  });

  mock.module("@/lib/reducto", {
    namedExports: {
      isReductoConfigured: () => l2Stubs.reductoConfigured,
      extractAnswerKeyQuestions: async () => [],
      extractHandwrittenAnswers: async () => [],
    },
  });

  mock.module("@/lib/health", {
    namedExports: {
      getHealthReport: async () => l2Stubs.healthReport,
    },
  });

  mock.module("@/lib/mobile-app-version", {
    namedExports: {
      getMobileAppVersionConfig: () => l2Stubs.appVersion,
    },
  });

  mock.module("@/lib/subscriptions/revenuecat", {
    namedExports: {
      tierFromWebhookEntitlements: () => ({ tier: "pro", expiresAt: null }),
      resolveTierFromRevenueCat: async () => ({ tier: "pro", expiresAt: null }),
    },
  });
}
