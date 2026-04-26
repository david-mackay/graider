"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { type AppRole } from "@/lib/types";
import { ALL_CLASSES_VALUE, handleJson, type StatusType } from "@/lib/dashboard-client";
import type {
  ActiveView,
  ClassMember,
  DashboardAttempt,
  DashboardClass,
  DashboardQuestion,
  DashboardTest,
  Invitation,
} from "@/lib/dashboard-types";
import { Badge } from "@/components/shared/ui";
import { IconMenu, IconX } from "@/components/shared/icons";
import StatusBanner from "@/components/shared/StatusBanner";
import ProfileSetup from "@/components/onboarding/ProfileSetup";
import TeacherSidebar from "@/components/teacher/Sidebar";
import TeacherClassesView from "@/components/teacher/ClassesView";
import QuestionsView from "@/components/teacher/QuestionsView";
import TestsView from "@/components/teacher/TestsView";
import StudentsView from "@/components/teacher/StudentsView";

export default function TeacherDashboard() {
  const { isLoaded, isSignedIn } = useUser();

  // Profile state
  const [profileName, setProfileName] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileFormRole, setProfileFormRole] = useState<AppRole>("teacher");

  // Chrome / nav
  const [activeView, setActiveView] = useState<ActiveView>("classes");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>(ALL_CLASSES_VALUE);

  // Data
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [questions, setQuestions] = useState<DashboardQuestion[]>([]);
  const [tests, setTests] = useState<DashboardTest[]>([]);
  const [attempts, setAttempts] = useState<DashboardAttempt[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [invitesByClass, setInvitesByClass] = useState<Record<string, Invitation[]>>({});

  // Status / busy
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");
  const [isBusy, setIsBusy] = useState(false);

  function setStatus(message: string, type: StatusType = "info") {
    setStatusMessage(message);
    setStatusType(type);
    if (message) {
      window.setTimeout(() => setStatusMessage(""), 5000);
    }
  }

  function getScopedClassId() {
    return selectedClassId !== ALL_CLASSES_VALUE ? selectedClassId : "";
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
      setAttempts(
        (attemptsRes.attempts ?? []).map((a) => ({
          ...a,
          test_class_id: attemptsByClass.get(a.test_id) ?? null,
        })),
      );

      const scopedClassId = nextSelectedClassId !== ALL_CLASSES_VALUE ? nextSelectedClassId : "";
      if (scopedClassId) {
        const qRes = await handleJson<{ questions: DashboardQuestion[] }>(
          await fetch(`/api/questions?classId=${scopedClassId}`, { cache: "no-store" }),
        );
        setQuestions(qRes.questions ?? []);

        const mRes = await handleJson<{ members: ClassMember[] }>(
          await fetch(`/api/classes/${scopedClassId}/members`, { cache: "no-store" }),
        );
        setClassMembers(mRes.members ?? []);
      } else {
        setQuestions([]);
        setClassMembers([]);
      }
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, selectedClassId]);

  async function loadInvites(classId: string) {
    try {
      const payload = await handleJson<{ invitations: Invitation[] }>(
        await fetch(`/api/classes/${classId}/invite`, { cache: "no-store" }),
      );
      setInvitesByClass((c) => ({ ...c, [classId]: payload.invitations }));
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

  function navigate(view: ActiveView) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  // Derived
  const activeClass = classes.find((c) => c.id === selectedClassId);
  const scopedClassId = getScopedClassId();
  const classCanManage = scopedClassId !== "" && activeClass?.role_in_class === "teacher";

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

  const attemptsGradedCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attempts) {
      if (a.status !== "graded" || !a.test_class_id) continue;
      map.set(a.test_class_id, (map.get(a.test_class_id) ?? 0) + 1);
    }
    return map;
  }, [attempts]);

  // Loading / profile gates
  if (!isLoaded) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-indigo-400">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <ProfileSetup
        initialRole={profileFormRole}
        onComplete={async ({ full_name, role: nextRole }) => {
          if (nextRole === "student") {
            window.location.href = "/s";
            return;
          }
          setNeedsProfile(false);
          setProfileName(full_name);
          await loadDashboard();
        }}
      />
    );
  }

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
        className={`fixed inset-y-14 left-0 z-40 w-64 bg-white border-r border-indigo-100 transform transition-transform duration-200 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar navigation"
      >
        <div className="flex items-center justify-between p-4 border-b border-indigo-100/60">
          <p className="text-sm font-semibold text-indigo-950">Menu</p>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-indigo-50 transition-colors duration-150"
            aria-label="Close menu"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <TeacherSidebar
          classes={classes}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          activeView={activeView}
          onNavigate={navigate}
          profileName={profileName}
        />
      </aside>

      <aside className="hidden lg:flex lg:w-60 xl:w-64 flex-col bg-white border-r border-indigo-100 flex-shrink-0">
        <TeacherSidebar
          classes={classes}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          activeView={activeView}
          onNavigate={navigate}
          profileName={profileName}
        />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-indigo-100 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 transition-colors duration-150"
            aria-label="Open menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-indigo-950">
              {activeView.charAt(0).toUpperCase() + activeView.slice(1)}
            </span>
            {activeClass && selectedClassId !== ALL_CLASSES_VALUE ? (
              <Badge variant="blue">{activeClass.name}</Badge>
            ) : null}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            <StatusBanner message={statusMessage} type={statusType} onDismiss={() => setStatusMessage("")} />

            {activeView === "classes" ? (
              <div className="space-y-6">
                <TeacherClassesView
                  classes={classes}
                  tests={tests}
                  attemptsGradedCountByClass={attemptsGradedCountByClass}
                  invitesByClass={invitesByClass}
                  loadInvites={loadInvites}
                  onCreated={loadDashboard}
                  onJoined={loadDashboard}
                  onOpenClass={(id) => {
                    setSelectedClassId(id);
                    navigate("questions");
                  }}
                  onStatus={setStatus}
                  isBusy={isBusy}
                  setBusy={setIsBusy}
                />
              </div>
            ) : null}

            {activeView === "questions" ? (
              <QuestionsView
                classId={scopedClassId || null}
                className={activeClass?.name ?? null}
                classCanManage={classCanManage}
                questions={questions}
                onChanged={loadDashboard}
                onStatus={setStatus}
                onGoToClasses={() => navigate("classes")}
                isBusy={isBusy}
                setBusy={setIsBusy}
              />
            ) : null}

            {activeView === "tests" ? (
              <TestsView
                classId={scopedClassId || null}
                className={activeClass?.name ?? null}
                classCanManage={classCanManage}
                questions={questions}
                testsInScope={testsInScope}
                attemptsInScope={attemptsInScope}
                onChanged={loadDashboard}
                onStatus={setStatus}
                onGoToClasses={() => navigate("classes")}
                onGoToQuestions={() => navigate("questions")}
                isBusy={isBusy}
                setBusy={setIsBusy}
              />
            ) : null}

            {activeView === "students" ? (
              <StudentsView
                classId={scopedClassId || null}
                className={activeClass?.name ?? null}
                members={classMembers}
                attemptsInScope={attemptsInScope}
                onGoToClasses={() => navigate("classes")}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
