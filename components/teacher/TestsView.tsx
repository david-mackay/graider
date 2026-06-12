"use client";

import { FormEvent, useState } from "react";
import { Badge, Card, FormField, SectionHeader, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconClipboard, IconX } from "@/components/shared/icons";
import { handleJson, normalizeTopic } from "@/lib/dashboard-client";
import type { OcrAnswer, TestDetail } from "@/lib/types";
import type {
  ClassMember,
  DashboardAttempt,
  DashboardQuestion,
  DashboardTest,
  GradedAttemptDetail,
  GroupedQuestions,
} from "@/lib/dashboard-types";

type TestsViewProps = {
  classId: string | null;
  className: string | null;
  classCanManage: boolean;
  questions: DashboardQuestion[];
  testsInScope: DashboardTest[];
  attemptsInScope: DashboardAttempt[];
  members: ClassMember[];
  onChanged: () => void | Promise<void>;
  onStatus: (message: string, type?: "info" | "error") => void;
  onGoToClasses: () => void;
  onGoToQuestions: () => void;
  isBusy: boolean;
  setBusy: (value: boolean) => void;
};

export default function TestsView({
  classId,
  className,
  classCanManage,
  questions,
  testsInScope,
  attemptsInScope,
  members,
  onChanged,
  onStatus,
  onGoToClasses,
  onGoToQuestions,
  isBusy,
  setBusy,
}: TestsViewProps) {
  const [testTitle, setTestTitle] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestDetail | null>(null);
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState<GradedAttemptDetail | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState<"all" | "submitted" | "graded">("all");

  const [ocrFilesByAttempt, setOcrFilesByAttempt] = useState<Record<string, File[]>>({});
  const [ocrFeedback, setOcrFeedback] = useState<Record<string, string>>({});
  const [expandedOcrAttemptId, setExpandedOcrAttemptId] = useState<string | null>(null);

  const filteredAttempts =
    submissionFilter === "all" ? attemptsInScope : attemptsInScope.filter((a) => a.status === submissionFilter);

  const memberById = new Map(members.map((m) => [m.user_id, m] as const));
  function studentLabel(studentId: string): string {
    const member = memberById.get(studentId);
    return member?.full_name?.trim() || member?.email || `${studentId.slice(0, 12)}…`;
  }

  const grouped: GroupedQuestions[] = (() => {
    const map = new Map<string, DashboardQuestion[]>();
    for (const q of questions) {
      const t = normalizeTopic(q.topic);
      map.set(t, [...(map.get(t) ?? []), q]);
    }
    return Array.from(map.entries())
      .map(([t, items]) => ({ topic: t, items }))
      .sort((a, b) => a.topic.localeCompare(b.topic));
  })();

  function toggleQuestion(qid: string) {
    setSelectedQuestionIds((current) =>
      current.includes(qid) ? current.filter((id) => id !== qid) : [...current, qid],
    );
  }

  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId || !testTitle.trim() || selectedQuestionIds.length === 0) {
      onStatus("Select a class and at least one question.", "error");
      return;
    }
    setBusy(true);
    try {
      await handleJson(
        await fetch("/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, title: testTitle, questionIds: selectedQuestionIds }),
        }),
      );
      setTestTitle("");
      setSelectedQuestionIds([]);
      onStatus("Test created.");
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function previewTest(testId: string) {
    try {
      const payload = await handleJson<{ test: TestDetail }>(
        await fetch(`/api/tests/${testId}`, { cache: "no-store" }),
      );
      setSelectedTest(payload.test);
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    }
  }

  async function openAttemptDetail(attemptId: string) {
    try {
      const payload = await handleJson<{ attempt: GradedAttemptDetail }>(
        await fetch(`/api/submissions/${attemptId}`, { cache: "no-store" }),
      );
      setSelectedAttemptDetail(payload.attempt);
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    }
  }

  async function gradeAttempt(attemptId: string) {
    setBusy(true);
    try {
      const payload = await handleJson<{ total_marks: number; max_marks: number }>(
        await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId }),
        }),
      );
      onStatus(`Graded: ${payload.total_marks}/${payload.max_marks}`);
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function batchGradeTest(testId: string) {
    setBusy(true);
    try {
      const payload = await handleJson<{ graded_count: number }>(
        await fetch("/api/grade/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId }),
        }),
      );
      onStatus(
        payload.graded_count > 0
          ? `Batch graded ${payload.graded_count} submission${payload.graded_count !== 1 ? "s" : ""}.`
          : "No ungraded submissions found.",
      );
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function updateTestSettings(testId: string, settings: { grades_released?: boolean; show_ai_feedback?: boolean }) {
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/tests/${testId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }),
      );
      if (typeof settings.grades_released === "boolean") {
        onStatus(settings.grades_released ? "Grades released to students." : "Grades hidden from students.");
      }
      if (typeof settings.show_ai_feedback === "boolean") {
        onStatus(settings.show_ai_feedback ? "AI feedback visible to students." : "AI feedback hidden from students.");
      }
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runOcrForAttempt(attemptId: string) {
    const files = ocrFilesByAttempt[attemptId] ?? [];
    if (files.length === 0) {
      onStatus("Select images first.", "error");
      return;
    }
    setBusy(true);
    const formData = new FormData();
    formData.append("attemptId", attemptId);
    for (const file of files) formData.append("images", file);
    try {
      const payload = await handleJson<{ extracted: OcrAnswer[]; matched: number }>(
        await fetch("/api/ocr", { method: "POST", body: formData }),
      );
      setOcrFeedback((c) => ({
        ...c,
        [attemptId]: `Extracted ${payload.extracted.length} answers, matched ${payload.matched}.`,
      }));
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tests"
        subtitle={
          className
            ? `${className} — build tests and grade submissions`
            : "Select a class to manage tests and submissions."
        }
      />

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
            <Card className="border-ink-faint">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">New test</h3>
                <button
                  type="button"
                  className="cursor-pointer text-xs text-ink-faint hover:text-ink"
                  onClick={() => {
                    setTestTitle("");
                    setSelectedQuestionIds([]);
                  }}
                >
                  Cancel
                </button>
              </div>
              {questions.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  No questions in this class yet.{" "}
                  <button
                    className="cursor-pointer text-pen underline hover:no-underline"
                    type="button"
                    onClick={onGoToQuestions}
                  >
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
                    <p className="mb-2 text-sm font-medium text-ink-soft">Select questions</p>
                    <div className="space-y-3">
                      {grouped.map((group) => (
                        <div key={group.topic}>
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                            {group.topic}
                          </p>
                          <div className="space-y-1.5">
                            {group.items.map((q) => (
                              <label
                                key={q.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150 ${
                                  selectedQuestionIds.includes(q.id)
                                    ? "border-ink-faint bg-cream"
                                    : "border-line-soft bg-paper hover:bg-cream"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 rounded border-ink-faint text-pen focus:ring-pen"
                                  checked={selectedQuestionIds.includes(q.id)}
                                  onChange={() => toggleQuestion(q.id)}
                                />
                                <span className="flex-1 text-sm text-ink">
                                  {q.prompt}
                                  <span className="ml-2 text-xs text-ink-faint">
                                    {q.marks} mark{q.marks !== 1 ? "s" : ""}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedQuestionIds.length > 0 ? (
                    <p className="text-xs text-ink-soft">
                      <span className="font-semibold text-pen">{selectedQuestionIds.length}</span> question
                      {selectedQuestionIds.length !== 1 ? "s" : ""} ·{" "}
                      <span className="font-semibold text-pen">
                        {questions.filter((q) => selectedQuestionIds.includes(q.id)).reduce((sum, q) => sum + q.marks, 0)}
                      </span>{" "}
                      marks total
                    </p>
                  ) : null}
                  <button
                    disabled={isBusy || selectedQuestionIds.length === 0 || !testTitle.trim()}
                    className={btnPrimary}
                    type="submit"
                  >
                    Create test
                  </button>
                </form>
              )}
            </Card>
          )}
        </div>
      ) : (
        <Card className="text-center py-8">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cream">
            <IconClipboard className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="text-sm font-semibold text-ink">{!classId ? "No class selected" : "Access restricted"}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {!classId ? "Open a class to manage its tests." : "You need to be a teacher of this class to manage tests."}
          </p>
          {!classId ? (
            <button className={`${btnSecondary} mt-4`} type="button" onClick={onGoToClasses}>
              Go to Classes
            </button>
          ) : null}
        </Card>
      )}

      {selectedTest ? (
        <Card className="border-ink-faint">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Preview</p>
              <h3 className="mt-0.5 font-semibold text-ink">{selectedTest.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTest(null)}
              className="cursor-pointer rounded-lg p-1.5 text-ink-faint hover:bg-cream transition-colors duration-150"
              aria-label="Close preview"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-2">
            {selectedTest.questions.map((q, i) => (
              <div key={q.question_id} className="rounded-lg border border-line-soft bg-cream p-3">
                <p className="text-xs font-semibold text-ink-faint">
                  Q{i + 1} · {q.marks} mark{q.marks !== 1 ? "s" : ""}
                </p>
                <p className="mt-0.5 text-sm text-ink">{q.prompt}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {selectedAttemptDetail ? (
        <Card className="border-line">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">{selectedAttemptDetail.test_title}</h3>
                <Badge
                  variant={
                    selectedAttemptDetail.status === "graded"
                      ? "green"
                      : selectedAttemptDetail.status === "submitted"
                        ? "blue"
                        : "gray"
                  }
                >
                  {selectedAttemptDetail.status}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-faint">
                Student: {studentLabel(selectedAttemptDetail.student_id)}
              </p>
              {selectedAttemptDetail.status === "graded" ? (
                <p className="mt-2 font-hand -rotate-2 text-3xl font-bold text-pen">
                  {selectedAttemptDetail.total_marks}/{selectedAttemptDetail.max_marks}
                </p>
              ) : (
                <p className="mt-1 text-sm text-marigold-deep">Not yet graded.</p>
              )}
            </div>
            <button type="button" className={btnSecondary} onClick={() => setSelectedAttemptDetail(null)}>
              Close
            </button>
          </div>
          <div className="mt-4 space-y-3 border-t border-line-soft pt-4">
            <p className="text-sm font-semibold text-ink">Question breakdown</p>
            {selectedAttemptDetail.questions.map((question, index) => (
              <div key={question.question_id} className="rounded-lg border border-line-soft bg-cream p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink-faint">
                    Q{index + 1} · {question.marks} mark{question.marks !== 1 ? "s" : ""}
                  </p>
                  {question.marks_earned != null ? (
                    <span
                      className={`text-sm font-bold ${
                        question.marks_earned === question.marks
                          ? "text-moss"
                          : question.marks_earned > 0
                            ? "text-marigold"
                            : "text-pen"
                      }`}
                    >
                      {question.marks_earned}/{question.marks}
                    </span>
                  ) : (
                    <span className="text-sm text-ink-faint">—</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm font-medium text-ink">{question.prompt}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Student answer</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line-soft bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
                  {question.student_answer || "No answer provided."}
                </pre>
                {question.feedback ? (
                  <p className="mt-3 border-l-2 border-pen-soft pl-3 font-hand text-lg leading-snug text-pen-deep">
                    {question.feedback}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {testsInScope.length > 0 ? (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Student submissions · {attemptsInScope.length}
              </h3>
              <div className="flex gap-1">
                {(["all", "submitted", "graded"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSubmissionFilter(f)}
                    className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 capitalize ${
                      submissionFilter === f ? "bg-pen text-white" : "bg-cream text-pen hover:bg-cream-deep"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            {filteredAttempts.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-sm text-ink-soft">
                  {attemptsInScope.length === 0 ? "No submissions yet." : `No ${submissionFilter} submissions.`}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredAttempts.map((attempt) => (
                  <Card key={attempt.id} className="hover:border-line transition-colors duration-150">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-display text-base font-semibold text-ink">{attempt.test_title}</p>
                          <Badge
                            variant={
                              attempt.status === "graded"
                                ? "green"
                                : attempt.status === "submitted"
                                  ? "blue"
                                  : "gray"
                            }
                          >
                            {attempt.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-faint">Student: {studentLabel(attempt.student_id)}</p>
                        {attempt.status === "graded" ? (
                          <p className="mt-1 font-hand -rotate-2 text-2xl font-bold text-pen">
                            {attempt.total_marks}/{attempt.max_marks}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={btnPrimary}
                          type="button"
                          onClick={() => void gradeAttempt(attempt.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Grading…" : "AI Grade"}
                        </button>
                        {attempt.status === "graded" ? (
                          <button className={btnSecondary} type="button" onClick={() => void openAttemptDetail(attempt.id)}>
                            View result
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 border-t border-line-soft pt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOcrAttemptId(expandedOcrAttemptId === attempt.id ? null : attempt.id)
                        }
                        className="cursor-pointer text-xs font-medium text-ink-faint hover:text-pen transition-colors duration-150"
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
                            className="text-xs text-ink-soft file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cream file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-pen-deep hover:file:bg-cream-deep"
                            onChange={(e) => {
                              const files = e.target.files ? Array.from(e.target.files) : [];
                              setOcrFilesByAttempt((c) => ({ ...c, [attempt.id]: files }));
                            }}
                          />
                          <button
                            className={`${btnSecondary} text-xs py-1.5`}
                            type="button"
                            onClick={() => void runOcrForAttempt(attempt.id)}
                            disabled={isBusy}
                          >
                            Run OCR
                          </button>
                          {ocrFeedback[attempt.id] ? (
                            <p className="text-xs text-ink-soft">{ocrFeedback[attempt.id]}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">Tests in this class</h3>
            <div className="space-y-2">
              {testsInScope.map((test) => {
                const ungradedCount = attemptsInScope.filter(
                  (a) => a.test_id === test.id && a.status === "submitted",
                ).length;
                const totalSubmissions = attemptsInScope.filter((a) => a.test_id === test.id).length;
                return (
                  <Card key={test.id} className="hover:border-line transition-colors duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-ink">{test.title}</p>
                          <Badge variant={test.grades_released ? "green" : "gray"}>
                            {test.grades_released ? "Released" : "Unreleased"}
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-faint">
                          {totalSubmissions} submission{totalSubmissions !== 1 ? "s" : ""}
                          {ungradedCount > 0 ? ` · ${ungradedCount} ungraded` : ""}
                        </p>
                      </div>
                      <button className={btnSecondary} type="button" onClick={() => void previewTest(test.id)}>
                        Preview
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
                      {ungradedCount > 0 ? (
                        <button
                          className={btnPrimary}
                          type="button"
                          onClick={() => void batchGradeTest(test.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Grading…" : `Grade all (${ungradedCount})`}
                        </button>
                      ) : null}
                      <button
                        className={test.grades_released ? btnSecondary : btnPrimary}
                        type="button"
                        onClick={() =>
                          void updateTestSettings(test.id, { grades_released: !test.grades_released })
                        }
                        disabled={isBusy}
                      >
                        {test.grades_released ? "Unreleased grades" : "Release grades"}
                      </button>
                      <button
                        className={btnSecondary}
                        type="button"
                        onClick={() =>
                          void updateTestSettings(test.id, { show_ai_feedback: !test.show_ai_feedback })
                        }
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
    </div>
  );
}
