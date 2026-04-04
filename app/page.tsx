"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import {
  type AppRole,
  type OcrAnswer,
  type QuestionBankQuestion,
  type SchoolClass,
  type TestAttempt,
  type TestDetail,
  type TestSummary,
} from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveView = "classes" | "questions" | "tests" | "students";

type DashboardQuestion = QuestionBankQuestion;
type DashboardTest = TestSummary;
type DashboardAttempt = TestAttempt & { test_title: string; test_class_id?: string | null };
type GradedAttemptQuestion = {
  question_id: string;
  prompt: string;
  student_answer: string;
  marks: number;
  marks_earned: number | null;
  feedback: string | null;
};
type GradedAttemptDetail = {
  id: string;
  test_id: string;
  test_title: string;
  student_id: string;
  status: "draft" | "submitted" | "graded";
  total_marks: number | null;
  max_marks: number | null;
  test_class_id?: string | null;
  questions: GradedAttemptQuestion[];
};
type DashboardClass = SchoolClass & { role_in_class?: "teacher" | "student" };
type AttemptAnswerPayload = { question_id: string; answer: string };
type ClassMember = {
  user_id: string;
  role: "teacher" | "student";
  status: "active" | "pending";
  full_name: string | null;
  email: string | null;
};
type GroupedQuestions = { topic: string; items: DashboardQuestion[] };
type Invitation = {
  id: string;
  code: string;
  role: "student" | "teacher";
  status: string;
  invited_email: string | null;
  expires_at: string | null;
  created_at: string | null;
  accepted_by_name: string | null;
};

const ALL_CLASSES_VALUE = "__all__";

function normalizeTopic(topic: string | null | undefined): string {
  const trimmed = topic?.trim();
  return trimmed ? trimmed : "General";
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  );
}

// ─── Small reusable UI pieces ─────────────────────────────────────────────────

function Badge({ children, variant = "blue" }: { children: React.ReactNode; variant?: "blue" | "green" | "gray" | "yellow" }) {
  const colors = {
    blue: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    gray: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    yellow: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-indigo-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-indigo-100 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <div>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-indigo-200 bg-white px-3 py-2.5 text-sm text-indigo-950 placeholder-slate-400 outline-none transition duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const btnPrimary =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

const btnSecondary =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

const btnDanger =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors duration-150 disabled:opacity-50";

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const { isLoaded, isSignedIn } = useUser();
  const [role, setRole] = useState<AppRole>("student");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileFormName, setProfileFormName] = useState("");
  const [profileFormRole, setProfileFormRole] = useState<AppRole>("student");

  const [activeView, setActiveView] = useState<ActiveView>("classes");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(ALL_CLASSES_VALUE);

  const [questions, setQuestions] = useState<DashboardQuestion[]>([]);
  const [tests, setTests] = useState<DashboardTest[]>([]);
  const [attempts, setAttempts] = useState<DashboardAttempt[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestDetail | null>(null);

  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [questionTopic, setQuestionTopic] = useState("");
  const [questionMarks, setQuestionMarks] = useState("2");

  const [questionEditId, setQuestionEditId] = useState<string | null>(null);
  const [questionEditPrompt, setQuestionEditPrompt] = useState("");
  const [questionEditAnswer, setQuestionEditAnswer] = useState("");
  const [questionEditTopic, setQuestionEditTopic] = useState("");
  const [questionEditMarks, setQuestionEditMarks] = useState("2");

  const [testTitle, setTestTitle] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [testTakingAnswers, setTestTakingAnswers] = useState<Record<string, string>>({});
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState<GradedAttemptDetail | null>(null);

  const [className, setClassName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinEmail, setJoinEmail] = useState("");

  const [ocrFilesByAttempt, setOcrFilesByAttempt] = useState<Record<string, File[]>>({});
  const [ocrFeedback, setOcrFeedback] = useState<Record<string, string>>({});
  const [generatedInviteCodes, setGeneratedInviteCodes] = useState<Record<string, string>>({});
  const [generatedTeacherCodes, setGeneratedTeacherCodes] = useState<Record<string, string>>({});
  const [invitesByClass, setInvitesByClass] = useState<Record<string, Invitation[]>>({});
  const [expandedInviteClassId, setExpandedInviteClassId] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string>("0");
  const [copiedInviteCodeForClassId, setCopiedInviteCodeForClassId] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"info" | "error">("info");
  const [isBusy, setIsBusy] = useState(false);

  // UI-only state
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);
  const [questionTopicFilter, setQuestionTopicFilter] = useState<string | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState<"all" | "submitted" | "graded">("all");
  const [expandedOcrAttemptId, setExpandedOcrAttemptId] = useState<string | null>(null);
  const [showCreateClassForm, setShowCreateClassForm] = useState(false);

  const activeClass = classes.find((c) => c.id === selectedClassId);
  const classCanManage =
    role === "teacher" && selectedClassId !== ALL_CLASSES_VALUE && activeClass?.role_in_class === "teacher";

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
    () => (selectedClassId === ALL_CLASSES_VALUE ? attempts : attempts.filter((a) => a.test_class_id === selectedClassId)),
    [attempts, selectedClassId],
  );

  const filteredAttempts = useMemo(
    () => (submissionFilter === "all" ? attemptsInScope : attemptsInScope.filter((a) => a.status === submissionFilter)),
    [attemptsInScope, submissionFilter],
  );

  // For student Tests view: merge each test with its submission
  const studentTestRows = useMemo(() => {
    return testsInScope.map((test) => ({
      test,
      attempt: attemptsInScope.find((a) => a.test_id === test.id) ?? null,
    }));
  }, [testsInScope, attemptsInScope]);

  const questionsByTopic = useMemo<GroupedQuestions[]>(() => {
    const grouped = new Map<string, DashboardQuestion[]>();
    for (const q of questions) {
      const topic = normalizeTopic(q.topic);
      grouped.set(topic, [...(grouped.get(topic) ?? []), q]);
    }
    return Array.from(grouped.entries())
      .map(([topic, items]) => ({ topic, items }))
      .sort((a, b) => a.topic.localeCompare(b.topic));
  }, [questions]);

  const filteredQuestionsByTopic = useMemo<GroupedQuestions[]>(
    () => (questionTopicFilter ? questionsByTopic.filter((g) => g.topic === questionTopicFilter) : questionsByTopic),
    [questionsByTopic, questionTopicFilter],
  );

  const totalMarks = useMemo(() => questions.reduce((sum, q) => sum + q.marks, 0), [questions]);

  // Students grouped by role
  const teacherMembers = useMemo(() => classMembers.filter((m) => m.role === "teacher"), [classMembers]);
  const studentMembers = useMemo(() => classMembers.filter((m) => m.role === "student"), [classMembers]);

  // Per-student attempt counts
  const attemptsByStudent = useMemo(() => {
    const map = new Map<string, { submitted: number; graded: number; totalScore: number; maxScore: number }>();
    for (const a of attemptsInScope) {
      const existing = map.get(a.student_id) ?? { submitted: 0, graded: 0, totalScore: 0, maxScore: 0 };
      existing.submitted += 1;
      if (a.status === "graded") {
        existing.graded += 1;
        existing.totalScore += a.total_marks ?? 0;
        existing.maxScore += a.max_marks ?? 0;
      }
      map.set(a.student_id, existing);
    }
    return map;
  }, [attemptsInScope]);

  const navItems =
    role === "teacher"
      ? [
          { id: "classes" as ActiveView, label: "Classes", icon: IconHome },
          { id: "questions" as ActiveView, label: "Questions", icon: IconBook },
          { id: "tests" as ActiveView, label: "Tests", icon: IconClipboard },
          { id: "students" as ActiveView, label: "Students", icon: IconUsers },
        ]
      : [
          { id: "classes" as ActiveView, label: "My Classes", icon: IconHome },
          { id: "tests" as ActiveView, label: "My Tests", icon: IconClipboard },
        ];

  function getScopedClassId(classId?: string) {
    const c = classId ?? selectedClassId;
    return c && c !== ALL_CLASSES_VALUE ? c : "";
  }

  function setStatus(message: string, type: "info" | "error" = "info") {
    setStatusMessage(message);
    setStatusType(type);
    if (message) {
      window.setTimeout(() => setStatusMessage(""), 5000);
    }
  }

  async function handleJson<T>(response: Response) {
    const payload = (await response.json()) as { error?: string; [key: string]: unknown };
    if (!response.ok) throw new Error(payload.error ?? "Unexpected error");
    return payload as T;
  }

  async function loadDashboard() {
    try {
      const userRes = await handleJson<{ user: { role: AppRole; full_name: string | null } }>(
        await fetch("/api/me/role", { cache: "no-store" }),
      );
      const nextRole = userRes.user.role;
      const name = userRes.user.full_name;
      setRole(nextRole);
      setProfileName(name);

      // Detect missing or Clerk-ID-like names
      const nameMissing = !name || /^user_[a-zA-Z0-9]{20,}$/.test(name);
      if (nameMissing) {
        setNeedsProfile(true);
        setProfileFormRole(nextRole);
        return; // Don't load rest of dashboard until profile is set
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
      const scopedClassId = getScopedClassId(nextSelectedClassId);

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

      if (nextRole === "teacher" && scopedClassId) {
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
  }, [isLoaded, isSignedIn, selectedClassId]);

  useEffect(() => {
    if (!navItems.some((n) => n.id === activeView)) {
      setActiveView(navItems[0]?.id ?? "classes");
    }
  }, [role]);

  function navigate(view: ActiveView) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  async function updateRole(nextRole: AppRole) {
    try {
      const payload = await handleJson<{ user: { role: AppRole } }>(
        await fetch("/api/me/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        }),
      );
      setRole(payload.user.role);
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileFormName.trim()) return;
    setIsBusy(true);
    try {
      await handleJson(
        await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: profileFormName }),
        }),
      );
      await handleJson(
        await fetch("/api/me/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: profileFormRole }),
        }),
      );
      setNeedsProfile(false);
      setProfileName(profileFormName);
      setRole(profileFormRole);
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!className.trim()) return;
    setIsBusy(true);
    try {
      const payload = await handleJson<{ class: DashboardClass }>(
        await fetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: className }),
        }),
      );
      setClassName("");
      setSelectedClassId(payload.class.id);
      setGeneratedInviteCodes((c) => ({ ...c, [payload.class.id]: payload.class.invite_code }));
      setStatus(`Class "${payload.class.name}" created.`);
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function createInviteForClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const classId = getScopedClassId();
    if (!classId) {
      setStatus("Select a specific class first.", "error");
      return;
    }
    setIsBusy(true);
    try {
      const payload = await handleJson<{ invitation_code: string }>(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invited_email: inviteEmail || null }),
        }),
      );
      setGeneratedInviteCodes((c) => ({ ...c, [classId]: payload.invitation_code }));
      setStatus(`Invite code generated: ${payload.invitation_code}`);
      setInviteEmail("");
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
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

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const classId = getScopedClassId();
    if (!classId) { setStatus("Select a class first.", "error"); return; }
    setIsBusy(true);
    try {
      await handleJson(
        await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ class_id: classId, prompt: questionPrompt, correct_answer: questionAnswer, marks: Number(questionMarks), topic: questionTopic }),
        }),
      );
      setQuestionPrompt(""); setQuestionAnswer(""); setQuestionTopic(""); setQuestionMarks("2");
      setStatus("Question added.");
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  function startQuestionEdit(q: DashboardQuestion) {
    setQuestionEditId(q.id);
    setQuestionEditPrompt(q.prompt);
    setQuestionEditAnswer(q.correct_answer);
    setQuestionEditTopic(q.topic ?? "");
    setQuestionEditMarks(String(q.marks));
  }

  async function saveQuestionEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const classId = getScopedClassId();
    if (!questionEditId || !classId) return;
    setIsBusy(true);
    try {
      await handleJson(
        await fetch(`/api/questions/${questionEditId}?classId=${classId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ class_id: classId, prompt: questionEditPrompt, correct_answer: questionEditAnswer, marks: Number(questionEditMarks), topic: questionEditTopic }),
        }),
      );
      setQuestionEditId(null);
      setStatus("Question updated.");
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    const classId = getScopedClassId();
    if (!classId) return;
    if (!confirm("Delete this question?")) return;
    try {
      await handleJson(await fetch(`/api/questions/${questionId}?classId=${classId}`, { method: "DELETE" }));
      setStatus("Question deleted.");
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

  function toggleQuestion(questionId: string) {
    setSelectedQuestionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId],
    );
  }

  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const classId = getScopedClassId();
    if (!classId || !testTitle.trim() || selectedQuestionIds.length === 0) {
      setStatus("Select a class and at least one question.", "error");
      return;
    }
    setIsBusy(true);
    try {
      await handleJson(
        await fetch("/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, title: testTitle, questionIds: selectedQuestionIds }),
        }),
      );
      setTestTitle(""); setSelectedQuestionIds([]);
      setStatus("Test created.");
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

  async function gradeAttempt(attemptId: string) {
    setIsBusy(true);
    try {
      const payload = await handleJson<{ total_marks: number; max_marks: number }>(
        await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId }),
        }),
      );
      setStatus(`Graded: ${payload.total_marks}/${payload.max_marks}`);
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function batchGradeTest(testId: string) {
    setIsBusy(true);
    try {
      const payload = await handleJson<{ graded_count: number }>(
        await fetch("/api/grade/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId }),
        }),
      );
      setStatus(payload.graded_count > 0 ? `Batch graded ${payload.graded_count} submission${payload.graded_count !== 1 ? "s" : ""}.` : "No ungraded submissions found.");
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function updateTestSettings(testId: string, settings: { grades_released?: boolean; show_ai_feedback?: boolean }) {
    setIsBusy(true);
    try {
      await handleJson(
        await fetch(`/api/tests/${testId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }),
      );
      if (typeof settings.grades_released === "boolean") {
        setStatus(settings.grades_released ? "Grades released to students." : "Grades hidden from students.");
      }
      if (typeof settings.show_ai_feedback === "boolean") {
        setStatus(settings.show_ai_feedback ? "AI feedback visible to students." : "AI feedback hidden from students.");
      }
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function runOcrForAttempt(attemptId: string) {
    const files = ocrFilesByAttempt[attemptId] ?? [];
    if (files.length === 0) { setStatus("Select images first.", "error"); return; }
    setIsBusy(true);
    const formData = new FormData();
    formData.append("attemptId", attemptId);
    for (const file of files) formData.append("images", file);
    try {
      const payload = await handleJson<{ extracted: OcrAnswer[]; matched: number }>(
        await fetch("/api/ocr", { method: "POST", body: formData }),
      );
      setOcrFeedback((c) => ({ ...c, [attemptId]: `Extracted ${payload.extracted.length} answers, matched ${payload.matched}.` }));
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function copyInviteCode(classId: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedInviteCodeForClassId(classId);
      window.setTimeout(() => setCopiedInviteCodeForClassId((c) => (c === classId ? "" : c)), 2000);
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    }
  }

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

  async function generateInvite(classId: string, codeRole: "student" | "teacher") {
    setIsBusy(true);
    try {
      const expiresInDays = Number(inviteExpiry) || undefined;
      await handleJson(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invited_email: null, role: codeRole, expires_in_days: expiresInDays }),
        }),
      );
      setStatus(`New ${codeRole} invite code generated.`);
      await loadInvites(classId);
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteInvite(classId: string, invitationId: string) {
    setIsBusy(true);
    try {
      await handleJson(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitationId }),
        }),
      );
      setStatus("Invite code deleted.");
      await loadInvites(classId);
    } catch (error) {
      if (error instanceof Error) setStatus(error.message, "error");
    } finally {
      setIsBusy(false);
    }
  }

  function getInviteStatus(invite: Invitation): "active" | "expired" | "accepted" {
    if (invite.status === "accepted") return "accepted";
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return "expired";
    return "active";
  }

  function formatExpiry(invite: Invitation): string {
    if (!invite.expires_at) return "No expiry";
    const exp = new Date(invite.expires_at);
    const now = new Date();
    if (exp < now) return "Expired";
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Expires today";
    if (diffDays === 1) return "Expires tomorrow";
    return `Expires in ${diffDays} days`;
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

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

  // ─── Landing / not signed in ───────────────────────────────────────────────

  if (!isSignedIn) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Hero */}
        <div className="relative bg-gradient-to-b from-indigo-50/80 via-white to-violet-50/40">
          {/* Decorative blurs */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-br from-indigo-200/40 via-violet-200/30 to-transparent blur-3xl" />

          <div className="relative mx-auto max-w-3xl px-4 pt-24 pb-16 text-center">
            {/* Sparkle icon */}
            <div className="mx-auto mb-8 inline-flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
              <svg className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </div>

            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-200/60">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              Powered by AI
            </p>

            <h1 className="text-5xl font-extrabold tracking-tight text-indigo-950 sm:text-6xl">
              Meet{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                gr<span className="font-black">AI</span>der
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 leading-relaxed sm:text-xl">
              The AI-powered grading assistant that marks tests in seconds.
              Build question banks, collect submissions, and let AI deliver instant grades and feedback.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="cursor-pointer w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-300/40 hover:from-indigo-700 hover:to-violet-700 transition-all duration-200"
                >
                  Get started free
                </button>
              </SignInButton>
            </div>
            <p className="mt-3 text-xs text-slate-400">No credit card required</p>
          </div>
        </div>

        {/* How it works */}
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-4">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-indigo-400">How it works</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Build",
                desc: "Create classes, invite students, and build question banks with answer keys.",
                gradient: "from-indigo-500 to-indigo-600",
                iconBg: "bg-indigo-50",
                icon: (
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                ),
              },
              {
                step: "2",
                title: "Collect",
                desc: "Students submit answers online or teachers upload handwritten sheets via photo.",
                gradient: "from-violet-500 to-violet-600",
                iconBg: "bg-violet-50",
                icon: (
                  <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                  </svg>
                ),
              },
              {
                step: "3",
                title: "AI Grades",
                desc: "One click to batch-grade every submission with detailed marks and personalized feedback.",
                gradient: "from-emerald-500 to-emerald-600",
                iconBg: "bg-emerald-50",
                icon: (
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="group relative rounded-xl border border-indigo-100 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-200">
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${item.gradient} text-xs font-bold text-white shadow-sm`}>
                    {item.step}
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}>
                    {item.icon}
                  </div>
                </div>
                <p className="text-base font-semibold text-indigo-950">{item.title}</p>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-12 shadow-xl shadow-indigo-300/30">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Stop grading by hand
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-indigo-100">
              Join teachers who save hours every week with AI-powered grading. Set up your first class in under a minute.
            </p>
            <div className="mt-8">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="cursor-pointer rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors duration-150"
                >
                  Start grading with AI
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Profile setup ─────────────────────────────────────────────────────────

  if (needsProfile) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-b from-indigo-50/60 via-white to-violet-50/40">
        <div className="w-full max-w-md px-4">
          <Card className="border-indigo-200">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200/60">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-indigo-950">Welcome to gr<span className="text-indigo-600">AI</span>der</h2>
              <p className="mt-1 text-sm text-slate-500">Set up your profile to get started.</p>
            </div>
            <form onSubmit={submitProfile} className="space-y-4">
              <FormField label="Your name">
                <input
                  className={inputClass}
                  value={profileFormName}
                  onChange={(e) => setProfileFormName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  required
                  autoFocus
                />
              </FormField>
              <FormField label="I am a…">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProfileFormRole("teacher")}
                    className={`cursor-pointer rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                      profileFormRole === "teacher"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-indigo-100 bg-white text-slate-600 hover:border-indigo-200"
                    }`}
                  >
                    Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileFormRole("student")}
                    className={`cursor-pointer rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                      profileFormRole === "student"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-indigo-100 bg-white text-slate-600 hover:border-indigo-200"
                    }`}
                  >
                    Student
                  </button>
                </div>
              </FormField>
              <button disabled={isBusy || !profileFormName.trim()} className={`${btnPrimary} w-full justify-center py-3`} type="submit">
                {isBusy ? "Saving…" : "Continue"}
              </button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Authenticated app shell ───────────────────────────────────────────────

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "flex flex-col h-full" : "flex flex-col h-full"}>
      {/* Class selector */}
      <div className="p-4 border-b border-indigo-100/60">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300">Active class</p>
        <select
          className="w-full cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-2 text-sm text-indigo-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors duration-150"
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setSelectedQuestionIds([]);
            setSelectedTest(null);
          }}
        >
          <option value={ALL_CLASSES_VALUE}>All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedClassId !== ALL_CLASSES_VALUE && activeClass ? (
          <p className="mt-1.5 text-xs text-slate-400">
            You are a <span className="font-semibold text-indigo-600">{activeClass.role_in_class ?? "member"}</span>
          </p>
        ) : null}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-0.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`cursor-pointer w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-700"
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User info + role switcher */}
      <div className="p-4 border-t border-indigo-100/60 space-y-3">
        {profileName ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
              {profileName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-indigo-950">{profileName}</p>
              <p className="text-xs text-slate-400 capitalize">{role}</p>
            </div>
          </div>
        ) : null}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300">Role</p>
          <select
            className="w-full cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-2 text-sm text-indigo-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors duration-150"
            value={role}
            onChange={(e) => void updateRole(e.target.value as AppRole)}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-14 left-0 z-40 w-64 bg-white border-r border-indigo-100 transform transition-transform duration-200 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar navigation"
      >
        <div className="flex items-center justify-between p-4 border-b border-indigo-100/60">
          <p className="text-sm font-semibold text-indigo-950">Menu</p>
          <button type="button" onClick={() => setSidebarOpen(false)} className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-indigo-50 transition-colors duration-150" aria-label="Close menu">
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <Sidebar mobile />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 xl:w-64 flex-col bg-white border-r border-indigo-100 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
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
              {navItems.find((n) => n.id === activeView)?.label ?? "Dashboard"}
            </span>
            {activeClass && selectedClassId !== ALL_CLASSES_VALUE ? (
              <Badge variant="blue">{activeClass.name}</Badge>
            ) : null}
          </div>
        </div>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

            {/* Global status banner */}
            {statusMessage ? (
              <div
                role="alert"
                className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                  statusType === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {statusType === "error" ? (
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                ) : (
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                <span className="flex-1">{statusMessage}</span>
                <button type="button" onClick={() => setStatusMessage("")} className="cursor-pointer text-current opacity-60 hover:opacity-100 transition-opacity duration-150" aria-label="Dismiss">
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {/* ── CLASSES VIEW ─────────────────────────────────────────── */}
            {activeView === "classes" ? (
              <div className="space-y-6">
                {role === "teacher" ? (
                  <>
                    <SectionHeader
                      title="Classes"
                      subtitle="Create and manage your classes. Click a class to open it."
                      action={
                        <button className={btnPrimary} type="button" onClick={() => setShowCreateClassForm((v) => !v)}>
                          {showCreateClassForm ? "Cancel" : "+ New class"}
                        </button>
                      }
                    />

                    {showCreateClassForm ? (
                      <Card>
                        <h3 className="mb-4 text-sm font-semibold text-indigo-950">Create new class</h3>
                        <form
                          onSubmit={(e) => { void createClass(e); setShowCreateClassForm(false); }}
                          className="space-y-3 sm:flex sm:items-end sm:gap-3 sm:space-y-0"
                        >
                          <div className="flex-1">
                            <FormField label="Class name">
                              <input
                                className={inputClass}
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                placeholder="e.g. Year 10 Biology"
                                required
                                autoFocus
                              />
                            </FormField>
                          </div>
                          <button disabled={isBusy} className={`${btnPrimary} flex-shrink-0`} type="submit">
                            Create class
                          </button>
                        </form>
                      </Card>
                    ) : null}

                    {classes.length === 0 ? (
                      <Card className="text-center py-14">
                        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                          <IconHome className="h-6 w-6 text-indigo-400" />
                        </div>
                        <p className="text-sm font-semibold text-indigo-950">No classes yet</p>
                        <p className="mt-1 text-xs text-slate-400">Create your first class to get started.</p>
                        <button className={`${btnPrimary} mt-4`} type="button" onClick={() => setShowCreateClassForm(true)}>
                          Create a class
                        </button>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {classes.map((entry) => {
                          const isSelected = selectedClassId === entry.id;
                          const classTests = tests.filter((t) => t.class_id === entry.id);
                          return (
                            <Card
                              key={entry.id}
                              className={`transition-colors duration-150 ${isSelected ? "border-indigo-300 bg-indigo-50/40" : "hover:border-indigo-200"}`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-indigo-950">{entry.name}</h4>
                                    <Badge variant={entry.role_in_class === "teacher" ? "blue" : "gray"}>
                                      {entry.role_in_class ?? "member"}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {classTests.length} test{classTests.length !== 1 ? "s" : ""}
                                  </p>
                                  {entry.role_in_class === "teacher" ? (
                                    <div className="mt-2.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = expandedInviteClassId === entry.id ? null : entry.id;
                                          setExpandedInviteClassId(next);
                                          if (next && !invitesByClass[next]) void loadInvites(next);
                                        }}
                                        className="cursor-pointer text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-150"
                                      >
                                        {expandedInviteClassId === entry.id ? "Hide invites" : "Manage invites"}
                                      </button>

                                      {expandedInviteClassId === entry.id ? (
                                        <div className="mt-3 space-y-4 border-t border-indigo-100 pt-3">
                                          {/* Generate section */}
                                          <div className="flex flex-wrap items-end gap-2">
                                            <div>
                                              <label className="text-xs font-medium text-slate-500">Expiry</label>
                                              <select
                                                className="mt-0.5 block w-full cursor-pointer rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs text-indigo-900 outline-none focus:border-indigo-400 transition-colors duration-150"
                                                value={inviteExpiry}
                                                onChange={(e) => setInviteExpiry(e.target.value)}
                                              >
                                                <option value="0">No expiry</option>
                                                <option value="1">1 day</option>
                                                <option value="7">7 days</option>
                                                <option value="30">30 days</option>
                                              </select>
                                            </div>
                                            <button
                                              type="button"
                                              disabled={isBusy}
                                              onClick={() => void generateInvite(entry.id, "student")}
                                              className={`${btnPrimary} py-1.5 px-3 text-xs`}
                                            >
                                              + Student code
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isBusy}
                                              onClick={() => void generateInvite(entry.id, "teacher")}
                                              className={`${btnSecondary} py-1.5 px-3 text-xs`}
                                            >
                                              + Teacher code
                                            </button>
                                          </div>

                                          {/* Invitations list */}
                                          {(invitesByClass[entry.id] ?? []).length === 0 ? (
                                            <p className="text-xs text-slate-400">No invite codes yet. Generate one above.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {(invitesByClass[entry.id] ?? []).map((inv) => {
                                                const derivedStatus = getInviteStatus(inv);
                                                return (
                                                  <div
                                                    key={inv.id}
                                                    className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                                                      derivedStatus === "accepted"
                                                        ? "border-slate-100 bg-slate-50/50"
                                                        : derivedStatus === "expired"
                                                          ? "border-red-100 bg-red-50/30"
                                                          : "border-indigo-100 bg-white"
                                                    }`}
                                                  >
                                                    <code className="font-mono font-semibold text-indigo-700">{inv.code}</code>
                                                    <Badge variant={inv.role === "teacher" ? "blue" : "gray"}>
                                                      {inv.role}
                                                    </Badge>
                                                    <Badge variant={derivedStatus === "active" ? "green" : derivedStatus === "expired" ? "yellow" : "gray"}>
                                                      {derivedStatus}
                                                    </Badge>
                                                    <span className="text-slate-400">
                                                      {derivedStatus === "accepted" && inv.accepted_by_name
                                                        ? inv.accepted_by_name
                                                        : formatExpiry(inv)}
                                                    </span>
                                                    <div className="ml-auto flex items-center gap-1.5">
                                                      {derivedStatus === "active" ? (
                                                        <button
                                                          type="button"
                                                          onClick={() => void copyInviteCode(inv.id, inv.code)}
                                                          className="cursor-pointer flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150"
                                                        >
                                                          {copiedInviteCodeForClassId === inv.id ? (
                                                            <IconCheck className="h-3 w-3 text-emerald-600" />
                                                          ) : (
                                                            <IconCopy className="h-3 w-3" />
                                                          )}
                                                        </button>
                                                      ) : null}
                                                      {derivedStatus !== "accepted" ? (
                                                        <button
                                                          type="button"
                                                          disabled={isBusy}
                                                          onClick={() => void deleteInvite(entry.id, inv.id)}
                                                          className="cursor-pointer rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
                                                        >
                                                          <IconX className="h-3 w-3" />
                                                        </button>
                                                      ) : null}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClassId(entry.id);
                                      navigate("questions");
                                    }}
                                    className={btnPrimary}
                                  >
                                    Open class
                                  </button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}

                    {/* Join a class — teachers can also join other classes */}
                    <Card>
                      <h3 className="mb-3 text-sm font-semibold text-indigo-950">Join a class</h3>
                      <form onSubmit={joinClass} className="flex flex-wrap items-end gap-3">
                        <FormField label="Invite code">
                          <input
                            className={inputClass}
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="Enter code"
                            required
                          />
                        </FormField>
                        <button disabled={isBusy} className={`${btnSecondary} flex-shrink-0`} type="submit">
                          Join
                        </button>
                      </form>
                    </Card>
                  </>
                ) : (
                  /* ── Student classes view ── */
                  <>
                    <SectionHeader
                      title="My Classes"
                      subtitle="Join a class using an invite code."
                    />

                    <Card>
                      <h3 className="mb-4 text-sm font-semibold text-indigo-950">Join a class</h3>
                      <form onSubmit={joinClass} className="space-y-3 sm:flex sm:items-end sm:gap-3 sm:space-y-0">
                        <FormField label="Invite code">
                          <input
                            className={inputClass}
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="Enter code from your teacher"
                            required
                          />
                        </FormField>
                        <FormField label="Email (if required)">
                          <input
                            className={inputClass}
                            value={joinEmail}
                            onChange={(e) => setJoinEmail(e.target.value)}
                            placeholder="your@email.com"
                            type="email"
                          />
                        </FormField>
                        <button disabled={isBusy} className={`${btnPrimary} flex-shrink-0`} type="submit">
                          Join
                        </button>
                      </form>
                    </Card>

                    {classes.length === 0 ? (
                      <Card className="text-center py-12">
                        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                          <IconHome className="h-6 w-6 text-indigo-400" />
                        </div>
                        <p className="text-sm font-semibold text-indigo-950">No classes yet</p>
                        <p className="mt-1 text-xs text-slate-400">Ask your teacher for an invite code to get started.</p>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Enrolled classes</h3>
                        {classes.map((entry) => {
                          const classTests = tests.filter((t) => t.class_id === entry.id);
                          const classAttempts = attempts.filter((a) => a.test_class_id === entry.id);
                          const gradedCount = classAttempts.filter((a) => a.status === "graded").length;
                          return (
                            <Card key={entry.id} className="hover:border-indigo-200 transition-colors duration-150">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <h4 className="font-semibold text-indigo-950">{entry.name}</h4>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {classTests.length} test{classTests.length !== 1 ? "s" : ""}
                                    {gradedCount > 0 ? ` · ${gradedCount} graded` : ""}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClassId(entry.id);
                                    navigate("tests");
                                  }}
                                  className={btnPrimary}
                                >
                                  View tests
                                </button>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {/* ── QUESTIONS VIEW ───────────────────────────────────────── */}
            {activeView === "questions" && role === "teacher" ? (
              <div className="space-y-6">
                <SectionHeader
                  title="Question Bank"
                  subtitle={
                    activeClass
                      ? `${activeClass.name} · ${questions.length} question${questions.length !== 1 ? "s" : ""} · ${totalMarks} marks total`
                      : "Select a class from the sidebar to manage questions."
                  }
                  action={
                    classCanManage ? (
                      <button
                        className={showAddQuestionForm ? btnSecondary : btnPrimary}
                        type="button"
                        onClick={() => setShowAddQuestionForm((v) => !v)}
                      >
                        {showAddQuestionForm ? "Cancel" : "+ Add question"}
                      </button>
                    ) : undefined
                  }
                />

                {!classCanManage ? (
                  <Card className="text-center py-10">
                    <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                      <IconBook className="h-5 w-5 text-indigo-400" />
                    </div>
                    <p className="text-sm font-semibold text-indigo-950">
                      {selectedClassId === ALL_CLASSES_VALUE ? "No class selected" : "Access restricted"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {selectedClassId === ALL_CLASSES_VALUE
                        ? "Open a class from the Classes tab to manage its questions."
                        : "You need to be a teacher of this class to manage questions."}
                    </p>
                    {selectedClassId === ALL_CLASSES_VALUE ? (
                      <button className={`${btnSecondary} mt-4`} type="button" onClick={() => navigate("classes")}>
                        Go to Classes
                      </button>
                    ) : null}
                  </Card>
                ) : (
                  <>
                    {/* Add question form — collapsed by default */}
                    {showAddQuestionForm ? (
                      <Card className="border-indigo-300">
                        <h3 className="mb-4 text-sm font-semibold text-indigo-950">New question</h3>
                        <form onSubmit={(e) => { void createQuestion(e); setShowAddQuestionForm(false); }} className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Topic" hint="Groups questions by subject area (e.g. Cell Biology)">
                              <input
                                className={inputClass}
                                value={questionTopic}
                                onChange={(e) => setQuestionTopic(e.target.value)}
                                placeholder="e.g. Photosynthesis"
                                autoFocus
                              />
                            </FormField>
                            <FormField label="Marks">
                              <input
                                className={inputClass}
                                type="number"
                                min={0}
                                value={questionMarks}
                                onChange={(e) => setQuestionMarks(e.target.value)}
                                required
                              />
                            </FormField>
                          </div>
                          <FormField label="Question">
                            <textarea
                              className={`${inputClass} min-h-[100px] resize-y`}
                              value={questionPrompt}
                              onChange={(e) => setQuestionPrompt(e.target.value)}
                              placeholder="Write the question that students will see…"
                              required
                            />
                          </FormField>
                          <FormField
                            label="Answer key"
                            hint="The model answer AI uses for grading — be specific and detailed. Students won't see this."
                          >
                            <textarea
                              className={`${inputClass} min-h-[80px] resize-y`}
                              value={questionAnswer}
                              onChange={(e) => setQuestionAnswer(e.target.value)}
                              placeholder="Write the ideal answer. More detail = better AI grading accuracy."
                              required
                            />
                          </FormField>
                          <div className="flex gap-2">
                            <button disabled={isBusy} className={btnPrimary} type="submit">
                              Add question
                            </button>
                            <button className={btnSecondary} type="button" onClick={() => setShowAddQuestionForm(false)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      </Card>
                    ) : null}

                    {/* Topic filter pills */}
                    {questionsByTopic.length > 1 ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setQuestionTopicFilter(null)}
                          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                            questionTopicFilter === null
                              ? "bg-indigo-600 text-white"
                              : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                          }`}
                        >
                          All topics
                        </button>
                        {questionsByTopic.map((g) => (
                          <button
                            key={g.topic}
                            type="button"
                            onClick={() => setQuestionTopicFilter(g.topic === questionTopicFilter ? null : g.topic)}
                            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                              questionTopicFilter === g.topic
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            }`}
                          >
                            {g.topic} <span className="opacity-60">{g.items.length}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/* Question list by topic */}
                    {questions.length === 0 ? (
                      <Card className="text-center py-10">
                        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                          <IconBook className="h-5 w-5 text-indigo-400" />
                        </div>
                        <p className="text-sm font-semibold text-indigo-950">No questions yet</p>
                        <p className="mt-1 text-xs text-slate-400">Click "+ Add question" above to build your question bank.</p>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {filteredQuestionsByTopic.map((group) => (
                          <div key={group.topic}>
                            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                              <span className="flex-1 border-t border-indigo-100" />
                              {group.topic}
                              <span className="text-indigo-200 font-normal normal-case tracking-normal">{group.items.length}</span>
                              <span className="flex-1 border-t border-indigo-100" />
                            </h3>
                            <div className="space-y-2">
                              {group.items.map((q) => (
                                <Card key={q.id} className="group hover:border-indigo-200 transition-colors duration-150">
                                  {questionEditId === q.id ? (
                                    <form onSubmit={saveQuestionEdit} className="space-y-3">
                                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Editing question</p>
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <FormField label="Topic">
                                          <input className={inputClass} value={questionEditTopic} onChange={(e) => setQuestionEditTopic(e.target.value)} placeholder="Topic" />
                                        </FormField>
                                        <FormField label="Marks">
                                          <input className={inputClass} type="number" min={0} value={questionEditMarks} onChange={(e) => setQuestionEditMarks(e.target.value)} required />
                                        </FormField>
                                      </div>
                                      <FormField label="Question">
                                        <textarea className={`${inputClass} min-h-[80px]`} value={questionEditPrompt} onChange={(e) => setQuestionEditPrompt(e.target.value)} required />
                                      </FormField>
                                      <FormField label="Answer key" hint="Be specific — this is what AI grades against.">
                                        <textarea className={`${inputClass} min-h-[60px]`} value={questionEditAnswer} onChange={(e) => setQuestionEditAnswer(e.target.value)} required />
                                      </FormField>
                                      <div className="flex gap-2">
                                        <button className={btnPrimary} type="submit" disabled={isBusy}>Save changes</button>
                                        <button className={btnSecondary} type="button" onClick={() => setQuestionEditId(null)}>Cancel</button>
                                      </div>
                                    </form>
                                  ) : (
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-indigo-950 leading-snug">{q.prompt}</p>
                                        <p className="mt-1.5 text-xs text-slate-400">Answer key: <span className="italic">{q.correct_answer}</span></p>
                                      </div>
                                      <div className="flex flex-shrink-0 items-center gap-2">
                                        <Badge variant="gray">{q.marks} mark{q.marks !== 1 ? "s" : ""}</Badge>
                                        <button className={`${btnSecondary} py-1.5 px-3 text-xs`} type="button" onClick={() => startQuestionEdit(q)}>Edit</button>
                                        <button className={`${btnDanger} py-1.5 px-3`} type="button" onClick={() => void deleteQuestion(q.id)}>Delete</button>
                                      </div>
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {/* ── TESTS VIEW ───────────────────────────────────────────── */}
            {/* ── FULLSCREEN TEST-TAKING OVERLAY ──────────────────────── */}
            {selectedTest && role === "student" ? (
              <div className="fixed inset-0 z-50 bg-[#f5f3ff] overflow-y-auto">
                <div className="mx-auto max-w-2xl px-4 py-8">
                  {/* Header */}
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">In progress</p>
                      <h2 className="mt-0.5 text-xl font-bold text-indigo-950">{selectedTest.title}</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedTest.questions.length} question{selectedTest.questions.length !== 1 ? "s" : ""} ·{" "}
                        {selectedTest.questions.reduce((s, q) => s + q.marks, 0)} marks
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTest(null)}
                      className="cursor-pointer rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-indigo-50 transition-colors duration-150"
                    >
                      Exit test
                    </button>
                  </div>
                  <form onSubmit={submitTest} className="space-y-4">
                    {selectedTest.questions.map((q, i) => (
                      <Card key={q.question_id} className="border-indigo-100">
                        <label className="block">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                              Question {i + 1}
                            </span>
                            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                              {q.marks} mark{q.marks !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="text-base font-semibold text-indigo-950 leading-relaxed">{q.prompt}</p>
                          <textarea
                            required
                            className={`${inputClass} mt-4 min-h-[120px]`}
                            value={testTakingAnswers[q.question_id] ?? ""}
                            onChange={(e) =>
                              setTestTakingAnswers((c) => ({ ...c, [q.question_id]: e.target.value }))
                            }
                            placeholder="Type your answer here…"
                          />
                        </label>
                      </Card>
                    ))}
                    <div className="sticky bottom-4 mt-6">
                      <div className="flex gap-3 rounded-2xl border border-indigo-200 bg-white/90 backdrop-blur-sm p-3 shadow-lg shadow-indigo-100">
                        <button className={`${btnPrimary} flex-1 justify-center py-3`} type="submit" disabled={isBusy}>
                          {isBusy ? "Submitting…" : "Submit test"}
                        </button>
                        <button className={btnSecondary} type="button" onClick={() => setSelectedTest(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {activeView === "tests" ? (
              <div className="space-y-6">
                <SectionHeader
                  title={role === "teacher" ? "Tests" : "My Tests"}
                  subtitle={
                    role === "teacher" && activeClass
                      ? `${activeClass.name} — build tests and grade submissions`
                      : role === "teacher"
                      ? "Select a class to manage tests and submissions."
                      : activeClass
                      ? `${activeClass.name} — your tests and results`
                      : "Your tests and results across all classes."
                  }
                />

                {/* ── TEACHER TESTS VIEW ── */}
                {role === "teacher" ? (
                  <>
                    {/* Create test — collapsible */}
                    {classCanManage ? (
                      <div>
                        {!testTitle && selectedQuestionIds.length === 0 ? (
                          <button
                            type="button"
                            className={`${btnSecondary} w-full justify-center py-3`}
                            onClick={() => setTestTitle(" ")}
                          >
                            + Create new test
                          </button>
                        ) : (
                          <Card className="border-indigo-300">
                            <div className="mb-4 flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-indigo-950">New test</h3>
                              <button
                                type="button"
                                className="cursor-pointer text-xs text-slate-400 hover:text-slate-600"
                                onClick={() => { setTestTitle(""); setSelectedQuestionIds([]); }}
                              >
                                Cancel
                              </button>
                            </div>
                            {questions.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No questions in this class yet.{" "}
                                <button className="cursor-pointer text-indigo-600 underline hover:no-underline" type="button" onClick={() => navigate("questions")}>
                                  Add questions first
                                </button>
                              </p>
                            ) : (
                              <form onSubmit={createTest} className="space-y-4">
                                <FormField label="Test title">
                                  <input
                                    className={inputClass}
                                    value={testTitle}
                                    onChange={(e) => setTestTitle(e.target.value)}
                                    placeholder="e.g. Chapter 3 Test"
                                    required
                                    autoFocus
                                  />
                                </FormField>
                                <div>
                                  <p className="mb-2 text-sm font-medium text-slate-700">Select questions</p>
                                  <div className="space-y-3">
                                    {questionsByTopic.map((group) => (
                                      <div key={group.topic}>
                                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-400">{group.topic}</p>
                                        <div className="space-y-1.5">
                                          {group.items.map((q) => (
                                            <label
                                              key={q.id}
                                              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150 ${
                                                selectedQuestionIds.includes(q.id)
                                                  ? "border-indigo-300 bg-indigo-50"
                                                  : "border-indigo-100 bg-white hover:bg-indigo-50/40"
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedQuestionIds.includes(q.id)}
                                                onChange={() => toggleQuestion(q.id)}
                                              />
                                              <span className="flex-1 text-sm text-indigo-900">
                                                {q.prompt}
                                                <span className="ml-2 text-xs text-slate-400">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {selectedQuestionIds.length > 0 ? (
                                  <p className="text-xs text-slate-500">
                                    <span className="font-semibold text-indigo-600">{selectedQuestionIds.length}</span> question{selectedQuestionIds.length !== 1 ? "s" : ""} ·{" "}
                                    <span className="font-semibold text-indigo-600">
                                      {questions.filter((q) => selectedQuestionIds.includes(q.id)).reduce((sum, q) => sum + q.marks, 0)}
                                    </span> marks total
                                  </p>
                                ) : null}
                                <button disabled={isBusy || selectedQuestionIds.length === 0 || !testTitle.trim()} className={btnPrimary} type="submit">
                                  Create test
                                </button>
                              </form>
                            )}
                          </Card>
                        )}
                      </div>
                    ) : (
                      <Card className="text-center py-8">
                        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                          <IconClipboard className="h-5 w-5 text-indigo-400" />
                        </div>
                        <p className="text-sm font-semibold text-indigo-950">
                          {selectedClassId === ALL_CLASSES_VALUE ? "No class selected" : "Access restricted"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {selectedClassId === ALL_CLASSES_VALUE
                            ? "Open a class to manage its tests."
                            : "You need to be a teacher of this class to manage tests."}
                        </p>
                        {selectedClassId === ALL_CLASSES_VALUE ? (
                          <button className={`${btnSecondary} mt-4`} type="button" onClick={() => navigate("classes")}>
                            Go to Classes
                          </button>
                        ) : null}
                      </Card>
                    )}

                    {/* Teacher preview panel */}
                    {selectedTest && role === "teacher" ? (
                      <Card className="border-indigo-300">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Preview</p>
                            <h3 className="mt-0.5 font-semibold text-indigo-950">{selectedTest.title}</h3>
                          </div>
                          <button type="button" onClick={() => setSelectedTest(null)} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 transition-colors duration-150" aria-label="Close preview">
                            <IconX className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {selectedTest.questions.map((q, i) => (
                            <div key={q.question_id} className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
                              <p className="text-xs font-semibold text-indigo-400">Q{i + 1} · {q.marks} mark{q.marks !== 1 ? "s" : ""}</p>
                              <p className="mt-0.5 text-sm text-indigo-900">{q.prompt}</p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}

                    {/* Attempt detail */}
                    {selectedAttemptDetail ? (
                      <Card className="border-indigo-200">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-indigo-950">{selectedAttemptDetail.test_title}</h3>
                              <Badge variant={selectedAttemptDetail.status === "graded" ? "green" : selectedAttemptDetail.status === "submitted" ? "blue" : "gray"}>
                                {selectedAttemptDetail.status}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-400">Student: {selectedAttemptDetail.student_id.slice(0, 12)}…</p>
                            {selectedAttemptDetail.status === "graded" ? (
                              <div className="mt-2 inline-flex items-baseline gap-1">
                                <span className="text-2xl font-extrabold text-indigo-600">{selectedAttemptDetail.total_marks}</span>
                                <span className="text-sm font-medium text-slate-400">/ {selectedAttemptDetail.max_marks}</span>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-amber-700">Not yet graded.</p>
                            )}
                          </div>
                          <button type="button" className={btnSecondary} onClick={() => setSelectedAttemptDetail(null)}>Close</button>
                        </div>
                        <div className="mt-4 space-y-3 border-t border-indigo-100 pt-4">
                          <p className="text-sm font-semibold text-indigo-950">Question breakdown</p>
                          {selectedAttemptDetail.questions.map((question, index) => (
                            <div key={question.question_id} className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-indigo-400">Q{index + 1} · {question.marks} mark{question.marks !== 1 ? "s" : ""}</p>
                                {question.marks_earned != null ? (
                                  <span className={`text-sm font-bold ${question.marks_earned === question.marks ? "text-emerald-600" : question.marks_earned > 0 ? "text-amber-600" : "text-red-500"}`}>
                                    {question.marks_earned}/{question.marks}
                                  </span>
                                ) : <span className="text-sm text-slate-400">—</span>}
                              </div>
                              <p className="mt-1.5 text-sm font-medium text-indigo-950">{question.prompt}</p>
                              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Student answer</p>
                              <pre className="mt-1 whitespace-pre-wrap rounded-md border border-indigo-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700">
                                {question.student_answer || "No answer provided."}
                              </pre>
                              {question.feedback ? (
                                <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
                                  <p className="text-xs text-emerald-800"><span className="font-semibold">Feedback:</span> {question.feedback}</p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}

                    {/* Tests list + submissions — teacher */}
                    {testsInScope.length === 0 && classCanManage ? null : testsInScope.length > 0 ? (
                      <div className="space-y-6">
                        {/* Filter bar for submissions */}
                        <div>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                              Student submissions · {attemptsInScope.length}
                            </h3>
                            <div className="flex gap-1">
                              {(["all", "submitted", "graded"] as const).map((f) => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setSubmissionFilter(f)}
                                  className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 capitalize ${
                                    submissionFilter === f
                                      ? "bg-indigo-600 text-white"
                                      : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                  }`}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>
                          {filteredAttempts.length === 0 ? (
                            <Card className="text-center py-8">
                              <p className="text-sm text-slate-500">
                                {attemptsInScope.length === 0 ? "No submissions yet." : `No ${submissionFilter} submissions.`}
                              </p>
                            </Card>
                          ) : (
                            <div className="space-y-2">
                              {filteredAttempts.map((attempt) => (
                                <Card key={attempt.id} className="hover:border-indigo-200 transition-colors duration-150">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-indigo-950">{attempt.test_title}</p>
                                        <Badge variant={attempt.status === "graded" ? "green" : attempt.status === "submitted" ? "blue" : "gray"}>
                                          {attempt.status}
                                        </Badge>
                                      </div>
                                      <p className="mt-0.5 text-xs text-slate-400">Student: {attempt.student_id.slice(0, 12)}…</p>
                                      {attempt.status === "graded" ? (
                                        <div className="mt-1.5 inline-flex items-baseline gap-1">
                                          <span className="text-lg font-bold text-indigo-600">{attempt.total_marks}</span>
                                          <span className="text-xs text-slate-400">/ {attempt.max_marks}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button className={btnPrimary} type="button" onClick={() => void gradeAttempt(attempt.id)} disabled={isBusy}>
                                        {isBusy ? "Grading…" : "AI Grade"}
                                      </button>
                                      {attempt.status === "graded" ? (
                                        <button className={btnSecondary} type="button" onClick={() => void openAttemptDetail(attempt.id)}>
                                          View result
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                  {/* OCR — collapsed by default */}
                                  <div className="mt-3 border-t border-indigo-100 pt-3">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedOcrAttemptId(expandedOcrAttemptId === attempt.id ? null : attempt.id)}
                                      className="cursor-pointer text-xs font-medium text-indigo-400 hover:text-indigo-600 transition-colors duration-150"
                                    >
                                      {expandedOcrAttemptId === attempt.id ? "Hide" : "Upload handwritten answers (OCR)"}
                                    </button>
                                    {expandedOcrAttemptId === attempt.id ? (
                                      <div className="mt-2 flex flex-wrap items-center gap-3">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          aria-label="Upload handwritten answer sheet images"
                                          className="text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                                          onChange={(e) => {
                                            const files = e.target.files ? Array.from(e.target.files) : [];
                                            setOcrFilesByAttempt((c) => ({ ...c, [attempt.id]: files }));
                                          }}
                                        />
                                        <button className={`${btnSecondary} text-xs py-1.5`} type="button" onClick={() => void runOcrForAttempt(attempt.id)} disabled={isBusy}>
                                          Run OCR
                                        </button>
                                        {ocrFeedback[attempt.id] ? <p className="text-xs text-slate-500">{ocrFeedback[attempt.id]}</p> : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Tests for teacher preview */}
                        <div>
                          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">Tests in this class</h3>
                          <div className="space-y-2">
                            {testsInScope.map((test) => {
                              const ungradedCount = attemptsInScope.filter((a) => a.test_id === test.id && a.status === "submitted").length;
                              const totalSubmissions = attemptsInScope.filter((a) => a.test_id === test.id).length;
                              return (
                                <Card key={test.id} className="hover:border-indigo-200 transition-colors duration-150">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-indigo-950">{test.title}</p>
                                        <Badge variant={test.grades_released ? "green" : "gray"}>
                                          {test.grades_released ? "Released" : "Unreleased"}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-slate-400">
                                        {totalSubmissions} submission{totalSubmissions !== 1 ? "s" : ""}
                                        {ungradedCount > 0 ? ` · ${ungradedCount} ungraded` : ""}
                                      </p>
                                    </div>
                                    <button className={btnSecondary} type="button" onClick={() => void openTestForSubmission(test.id)}>
                                      Preview
                                    </button>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-indigo-100 pt-3">
                                    {ungradedCount > 0 ? (
                                      <button className={btnPrimary} type="button" onClick={() => void batchGradeTest(test.id)} disabled={isBusy}>
                                        {isBusy ? "Grading…" : `Grade all (${ungradedCount})`}
                                      </button>
                                    ) : null}
                                    <button
                                      className={test.grades_released ? btnSecondary : btnPrimary}
                                      type="button"
                                      onClick={() => void updateTestSettings(test.id, { grades_released: !test.grades_released })}
                                      disabled={isBusy}
                                    >
                                      {test.grades_released ? "Unreleased grades" : "Release grades"}
                                    </button>
                                    <button
                                      className={btnSecondary}
                                      type="button"
                                      onClick={() => void updateTestSettings(test.id, { show_ai_feedback: !test.show_ai_feedback })}
                                      disabled={isBusy}
                                    >
                                      Feedback: {test.show_ai_feedback ? "On" : "Off"}
                                    </button>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  /* ── STUDENT TESTS VIEW — merged test + submission per row ── */
                  <>
                    {selectedAttemptDetail ? (
                      <Card className="border-indigo-200">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-indigo-950">{selectedAttemptDetail.test_title}</h3>
                              <Badge variant={selectedAttemptDetail.status === "graded" ? "green" : "blue"}>
                                {selectedAttemptDetail.status}
                              </Badge>
                            </div>
                            {selectedAttemptDetail.status === "graded" ? (
                              <div className="mt-2 inline-flex items-baseline gap-1">
                                <span className="text-2xl font-extrabold text-indigo-600">{selectedAttemptDetail.total_marks}</span>
                                <span className="text-sm font-medium text-slate-400">/ {selectedAttemptDetail.max_marks}</span>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-amber-700">Results not yet released.</p>
                            )}
                          </div>
                          <button type="button" className={btnSecondary} onClick={() => setSelectedAttemptDetail(null)}>Close</button>
                        </div>
                        <div className="mt-4 space-y-3 border-t border-indigo-100 pt-4">
                          <p className="text-sm font-semibold text-indigo-950">Question breakdown</p>
                          {selectedAttemptDetail.questions.map((question, index) => (
                            <div key={question.question_id} className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-indigo-400">Q{index + 1} · {question.marks} mark{question.marks !== 1 ? "s" : ""}</p>
                                {question.marks_earned != null ? (
                                  <span className={`text-sm font-bold ${question.marks_earned === question.marks ? "text-emerald-600" : question.marks_earned > 0 ? "text-amber-600" : "text-red-500"}`}>
                                    {question.marks_earned}/{question.marks}
                                  </span>
                                ) : <span className="text-sm text-slate-400">—</span>}
                              </div>
                              <p className="mt-1.5 text-sm font-medium text-indigo-950">{question.prompt}</p>
                              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Your answer</p>
                              <pre className="mt-1 whitespace-pre-wrap rounded-md border border-indigo-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700">
                                {question.student_answer || "No answer provided."}
                              </pre>
                              {question.feedback ? (
                                <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
                                  <p className="text-xs text-emerald-800"><span className="font-semibold">Feedback:</span> {question.feedback}</p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}

                    {studentTestRows.length === 0 ? (
                      <Card className="text-center py-12">
                        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                          <IconClipboard className="h-6 w-6 text-indigo-400" />
                        </div>
                        <p className="text-sm font-semibold text-indigo-950">No tests yet</p>
                        <p className="mt-1 text-xs text-slate-400">Your teacher hasn{"'"}t assigned any tests yet.</p>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {studentTestRows.map(({ test, attempt }) => (
                          <Card key={test.id} className="hover:border-indigo-200 transition-colors duration-150">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-indigo-950">{test.title}</p>
                                  {attempt ? (
                                    <Badge variant={attempt.status === "graded" ? "green" : "blue"}>
                                      {attempt.status}
                                    </Badge>
                                  ) : (
                                    <Badge variant="gray">Not started</Badge>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-slate-400">{classNameById.get(test.class_id) ?? ""}</p>
                                {attempt?.status === "graded" ? (
                                  <div className="mt-1.5 inline-flex items-baseline gap-1">
                                    <span className="text-lg font-bold text-indigo-600">{attempt.total_marks}</span>
                                    <span className="text-xs text-slate-400">/ {attempt.max_marks}</span>
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex gap-2">
                                {!attempt ? (
                                  <button className={btnPrimary} type="button" onClick={() => void openTestForSubmission(test.id)}>
                                    Start test
                                  </button>
                                ) : attempt.status === "graded" ? (
                                  <button className={btnSecondary} type="button" onClick={() => void openAttemptDetail(attempt.id)}>
                                    View result
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 self-center">Awaiting grade</span>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {/* ── STUDENTS VIEW ─────────────────────────────────────────── */}
            {activeView === "students" && role === "teacher" ? (
              <div className="space-y-6">
                <SectionHeader
                  title="Students"
                  subtitle={
                    activeClass
                      ? `${activeClass.name} · ${studentMembers.length} student${studentMembers.length !== 1 ? "s" : ""}`
                      : "Open a class to view its members."
                  }
                  action={
                    selectedClassId !== ALL_CLASSES_VALUE ? (
                      <button className={btnSecondary} type="button" onClick={() => navigate("classes")}>
                        Manage invite codes
                      </button>
                    ) : undefined
                  }
                />

                {selectedClassId === ALL_CLASSES_VALUE ? (
                  <Card className="text-center py-10">
                    <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                      <IconUsers className="h-5 w-5 text-indigo-400" />
                    </div>
                    <p className="text-sm font-semibold text-indigo-950">No class selected</p>
                    <p className="mt-1 text-xs text-slate-400">Open a class first to view its students.</p>
                    <button type="button" className={`${btnSecondary} mt-4`} onClick={() => navigate("classes")}>
                      Go to Classes
                    </button>
                  </Card>
                ) : classMembers.length === 0 ? (
                  <Card className="text-center py-10">
                    <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                      <IconUsers className="h-5 w-5 text-indigo-400" />
                    </div>
                    <p className="text-sm font-semibold text-indigo-950">No members yet</p>
                    <p className="mt-1 text-xs text-slate-400">Share an invite code with your students to get started.</p>
                    <button type="button" className={`${btnSecondary} mt-4`} onClick={() => navigate("classes")}>
                      Get invite code
                    </button>
                  </Card>
                ) : (
                  <div className="space-y-5">
                    {/* Teachers */}
                    {teacherMembers.length > 0 ? (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">Teachers</h3>
                        <div className="space-y-2">
                          {teacherMembers.map((member) => (
                            <Card key={member.user_id} className="hover:border-indigo-200 transition-colors duration-150">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                                  {(member.full_name ?? member.email ?? "?")[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-indigo-950 truncate">{member.full_name ?? "Unnamed"}</p>
                                  <p className="text-xs text-slate-400 truncate">{member.email ?? "No email"}</p>
                                </div>
                                {member.status === "pending" ? <Badge variant="yellow">Pending</Badge> : null}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Students */}
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                        Students · {studentMembers.length}
                      </h3>
                      {studentMembers.length === 0 ? (
                        <Card className="text-center py-6">
                          <p className="text-sm text-slate-500">No students enrolled yet.</p>
                          <button type="button" className={`${btnSecondary} mt-3`} onClick={() => navigate("classes")}>
                            Share invite code
                          </button>
                        </Card>
                      ) : (
                        <div className="space-y-2">
                          {studentMembers.map((member) => {
                            const stats = attemptsByStudent.get(member.user_id);
                            return (
                              <Card key={member.user_id} className="hover:border-indigo-200 transition-colors duration-150">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                                    {(member.full_name ?? member.email ?? "?")[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-indigo-950 truncate">{member.full_name ?? "Unnamed"}</p>
                                      {member.status === "pending" ? <Badge variant="yellow">Pending</Badge> : null}
                                    </div>
                                    <p className="text-xs text-slate-400 truncate">{member.email ?? "No email"}</p>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    {stats ? (
                                      <>
                                        <p className="text-xs font-semibold text-indigo-950">
                                          {stats.graded > 0 ? (
                                            <span>
                                              <span className="text-indigo-600">{stats.totalScore}</span>
                                              <span className="text-slate-400">/{stats.maxScore}</span>
                                            </span>
                                          ) : "—"}
                                        </p>
                                        <p className="text-xs text-slate-400">{stats.submitted} submission{stats.submitted !== 1 ? "s" : ""}</p>
                                      </>
                                    ) : (
                                      <p className="text-xs text-slate-400">No submissions</p>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
