"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { type AppRole, type TestDetail } from "@/lib/types";
import {
  ALL_CLASSES_VALUE,
  type AttemptAnswerPayload,
  handleJson,
  type StatusType,
} from "@/lib/dashboard-client";
import type {
  ActiveView,
  DashboardAttempt,
  DashboardClass,
  DashboardTest,
  GradedAttemptDetail,
} from "@/lib/dashboard-types";
import { Badge } from "@/components/shared/ui";
import { IconMenu, IconX } from "@/components/shared/icons";
import StatusBanner from "@/components/shared/StatusBanner";
import ProfileSetup from "@/components/onboarding/ProfileSetup";
import StudentSidebar from "@/components/student/Sidebar";
import StudentClassesView from "@/components/student/ClassesView";
import TestList from "@/components/student/TestList";
import TestTakingForm from "@/components/student/TestTakingForm";
import AttemptDetailCard from "@/components/student/AttemptDetailCard";

export default function StudentDashboard() {
  const { isLoaded, isSignedIn } = useUser();

  // ─── State ───────────────────────────────────────────────────────────────
  const [profileName, setProfileName] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileFormRole, setProfileFormRole] = useState<AppRole>("student");

  const [activeView, setActiveView] = useState<ActiveView>("classes");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(ALL_CLASSES_VALUE);

  const [tests, setTests] = useState<DashboardTest[]>([]);
  const [attempts, setAttempts] = useState<DashboardAttempt[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestDetail | null>(null);

  const [testTakingAnswers, setTestTakingAnswers] = useState<Record<string, string>>({});
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState<GradedAttemptDetail | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinEmail, setJoinEmail] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");
  const [isBusy, setIsBusy] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────────────────
  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const testsInScope = useMemo(
    () => (selectedClassId === ALL_CLASSES_VALUE ? tests : tests.filter((t) => t.class_id === selectedClassId)),
    [selectedClassId, tests],
  );

  const attemptsInScope = useMemo(
    () =>
      selectedClassId === ALL_CLASSES_VALUE
        ? attempts
        : attempts.filter((a) => a.test_class_id === selectedClassId),
    [attempts, selectedClassId],
  );

  const studentTestRows = useMemo(
    () =>
      testsInScope.map((test) => ({
        test,
        attempt: attemptsInScope.find((a) => a.test_id === test.id) ?? null,
      })),
    [testsInScope, attemptsInScope],
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function setStatus(message: string, type: StatusType = "info") {
    setStatusMessage(message);
    setStatusType(type);
    if (message) {
      window.setTimeout(() => setStatusMessage(""), 5000);
    }
  }

  async function loadDashboard() {
    try {
      const userRes = await handleJson<{ user: { role: AppRole; full_name: string | null } }>(
        await fetch("/api/me/role", { cache: "no-store" }),
      );
      const nextRole = userRes.user.role;
      const name = userRes.user.full_name;
      setProfileName(name);

      const nameMissing = !name || /^user_[a-zA-Z0-9]{20,}$/.test(name);
      if (nameMissing) {
        setNeedsProfile(true);
        setProfileFormRole(nextRole);
        return;
      }

      const classRes = await handleJson<{ classes: DashboardClass[] }>(
        await fetch("/api/classes", { cache: "no-store" }),
      );
      const loadedClasses = classRes.classes ?? [];
      setClasses(loadedClasses);

      const nextSelectedClassId =
        loadedClasses.length > 0
          ? loadedClasses.some((c) => c.id === selectedClassId)
            ? selectedClassId
            : ALL_CLASSES_VALUE
          : ALL_CLASSES_VALUE;

      if (selectedClassId !== nextSelectedClassId) setSelectedClassId(nextSelectedClassId);

      const testsRes = await handleJson<{ tests: DashboardTest[] }>(
        await fetch("/api/tests", { cache: "no-store" }),
      );
      const loadedTests = testsRes.tests ?? [];
      setTests(loadedTests);

      const attemptsRes = await handleJson<{ attempts: DashboardAttempt[] }>(
        await fetch("/api/submissions", { cache: "no-store" }),
      );
      const attemptsByClass = new Map(loadedTests.map((t) => [t.id, t.class_id] as const));
      setSelectedAttemptDetail(null);
      setAttempts(
        (attemptsRes.attempts ?? []).map((a) => ({
          ...a,
          test_class_id: attemptsByClass.get(a.test_id) ?? null,
        })),
      );
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, selectedClassId]);

  function navigate(view: ActiveView) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  async function joinClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setIsBusy(true);
    try {
      await handleJson<{ joined: boolean }>(
        await fetch("/api/classes/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: joinCode, email: joinEmail || undefined }),
        }),
      );
      setJoinCode("");
      setJoinEmail("");
      setStatus("Successfully joined class!");
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function openTestForSubmission(testId: string) {
    try {
      const payload = await handleJson<{ test: TestDetail }>(
        await fetch(`/api/tests/${testId}`, { cache: "no-store" }),
      );
      setSelectedTest(payload.test);
      const initial: Record<string, string> = {};
      for (const q of payload.test.questions) initial[q.question_id] = "";
      setTestTakingAnswers(initial);
      setSelectedClassId(payload.test.class_id);
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

  async function openAttemptDetail(attemptId: string) {
    try {
      const payload = await handleJson<{ attempt: GradedAttemptDetail }>(
        await fetch(`/api/submissions/${attemptId}`, { cache: "no-store" }),
      );
      setSelectedAttemptDetail(payload.attempt);
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

  async function submitTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTest) return;
    setIsBusy(true);
    const answers: AttemptAnswerPayload[] = selectedTest.questions.map((q) => ({
      question_id: q.question_id,
      answer: testTakingAnswers[q.question_id] ?? "",
    }));
    try {
      await handleJson<{ attempt_id: string }>(
        await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId: selectedTest.id, answers }),
        }),
      );
      setStatus("Test submitted successfully!");
      setSelectedTest(null);
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-pen border-t-transparent" />
          <p className="font-hand text-xl text-ink-soft">Opening your backpack…</p>
        </div>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <ProfileSetup
        initialRole={profileFormRole}
        onComplete={async ({ full_name, role: nextRole }) => {
          if (nextRole === "teacher") {
            window.location.href = "/t";
            return;
          }
          setNeedsProfile(false);
          setProfileName(full_name);
          await loadDashboard();
        }}
      />
    );
  }

  const activeClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-14 left-0 z-40 w-64 bg-paper border-r border-line-soft transform transition-transform duration-200 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar navigation"
      >
        <div className="flex items-center justify-between p-4 border-b border-line-soft">
          <p className="text-sm font-semibold text-ink">Menu</p>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="cursor-pointer rounded-lg p-1 text-ink-soft hover:bg-cream transition-colors duration-150"
            aria-label="Close menu"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <StudentSidebar
          classes={classes}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          activeView={activeView}
          onNavigate={navigate}
          profileName={profileName}
        />
      </aside>

      <aside className="hidden lg:flex lg:w-60 xl:w-64 flex-col bg-paper border-r border-line-soft flex-shrink-0">
        <StudentSidebar
          classes={classes}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          activeView={activeView}
          onNavigate={navigate}
          profileName={profileName}
        />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line-soft bg-paper px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="cursor-pointer rounded-lg p-1.5 text-ink-soft hover:bg-cream transition-colors duration-150"
            aria-label="Open menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              {activeView === "classes" ? "My Classes" : "My Tests"}
            </span>
            {activeClass && selectedClassId !== ALL_CLASSES_VALUE ? (
              <Badge variant="blue">{activeClass.name}</Badge>
            ) : null}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            <StatusBanner message={statusMessage} type={statusType} onDismiss={() => setStatusMessage("")} />

            {selectedTest ? (
              <TestTakingForm
                test={selectedTest}
                answers={testTakingAnswers}
                onChangeAnswer={(qid, value) => setTestTakingAnswers((c) => ({ ...c, [qid]: value }))}
                onSubmit={submitTest}
                onClose={() => setSelectedTest(null)}
                isBusy={isBusy}
              />
            ) : null}

            {activeView === "classes" ? (
              <div className="space-y-6">
                <StudentClassesView
                  classes={classes}
                  tests={tests}
                  attempts={attempts}
                  joinCode={joinCode}
                  setJoinCode={setJoinCode}
                  joinEmail={joinEmail}
                  setJoinEmail={setJoinEmail}
                  onJoin={joinClass}
                  onSelectClass={(id) => {
                    setSelectedClassId(id);
                    navigate("tests");
                  }}
                  isBusy={isBusy}
                />
              </div>
            ) : null}

            {activeView === "tests" ? (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-ink">My Tests</h2>
                {selectedAttemptDetail ? (
                  <AttemptDetailCard attempt={selectedAttemptDetail} onClose={() => setSelectedAttemptDetail(null)} />
                ) : null}
                <TestList
                  rows={studentTestRows}
                  classNameById={classNameById}
                  onStart={openTestForSubmission}
                  onViewResult={openAttemptDetail}
                />
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
