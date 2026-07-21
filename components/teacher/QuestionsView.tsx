"use client";

import { FormEvent, useState } from "react";
import { Badge, Card, FormField, SectionHeader, btnDanger, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconBook } from "@/components/shared/icons";
import PdfImportPanel from "@/components/shared/PdfImportPanel";
import { handleJson, normalizeTopic } from "@/lib/dashboard-client";
import type { DashboardQuestion } from "@/lib/dashboard-types";

type QuestionsViewProps = {
  classId: string | null;
  className: string | null;
  classCanManage: boolean;
  questions: DashboardQuestion[];
  onChanged: () => void | Promise<void>;
  onStatus: (message: string, type?: "info" | "error") => void;
  onGoToClasses: () => void;
  isBusy: boolean;
  setBusy: (value: boolean) => void;
};

export default function QuestionsView({
  classId,
  className,
  classCanManage,
  questions,
  onChanged,
  onStatus,
  onGoToClasses,
  isBusy,
  setBusy,
}: QuestionsViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [groupBy, setGroupBy] = useState<"test" | "topic">("test");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [testFilter, setTestFilter] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [topic, setTopic] = useState("");
  const [marks, setMarks] = useState("2");
  const [questionType, setQuestionType] = useState<"open" | "mcq">("open");

  const [editId, setEditId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editMarks, setEditMarks] = useState("2");
  const [editQuestionType, setEditQuestionType] = useState<"open" | "mcq">("open");

  type QuestionGroup = { key: string; label: string; items: DashboardQuestion[] };

  const groupedByTopic: QuestionGroup[] = (() => {
    const map = new Map<string, DashboardQuestion[]>();
    for (const q of questions) {
      const t = normalizeTopic(q.topic);
      map.set(t, [...(map.get(t) ?? []), q]);
    }
    return Array.from(map.entries())
      .map(([t, items]) => ({ key: t, label: t, items }))
      .sort((a, b) => a.label.localeCompare(b.label));
  })();

  const groupedByTest: QuestionGroup[] = (() => {
    const map = new Map<string, { label: string; items: DashboardQuestion[] }>();
    const unassigned: DashboardQuestion[] = [];
    for (const q of questions) {
      const links = q.tests ?? [];
      if (links.length === 0) {
        unassigned.push(q);
        continue;
      }
      for (const test of links) {
        const existing = map.get(test.id);
        if (existing) {
          if (!existing.items.some((item) => item.id === q.id)) existing.items.push(q);
        } else {
          map.set(test.id, { label: test.title, items: [q] });
        }
      }
    }
    const groups = Array.from(map.entries())
      .map(([key, value]) => ({ key, label: value.label, items: value.items }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (unassigned.length > 0) {
      groups.push({ key: "__unassigned__", label: "Not in a test", items: unassigned });
    }
    return groups;
  })();

  const grouped = groupBy === "test" ? groupedByTest : groupedByTopic;
  const activeFilter = groupBy === "test" ? testFilter : topicFilter;
  const filteredGroups = activeFilter ? grouped.filter((g) => g.key === activeFilter) : grouped;
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) {
      onStatus("Select a class first.", "error");
      return;
    }
    setBusy(true);
    try {
      await handleJson(
        await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_id: classId,
            prompt,
            correct_answer: answer,
            marks: Number(marks),
            topic,
            question_type: questionType,
          }),
        }),
      );
      setPrompt(""); setAnswer(""); setTopic(""); setMarks("2"); setQuestionType("open");
      setShowAddForm(false);
      onStatus("Question added.");
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(q: DashboardQuestion) {
    setEditId(q.id);
    setEditPrompt(q.prompt);
    setEditAnswer(q.correct_answer);
    setEditTopic(q.topic ?? "");
    setEditMarks(String(q.marks));
    setEditQuestionType(q.question_type === "mcq" ? "mcq" : "open");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId || !classId) return;
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/questions/${editId}?classId=${classId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_id: classId,
            prompt: editPrompt,
            correct_answer: editAnswer,
            marks: Number(editMarks),
            topic: editTopic,
            question_type: editQuestionType,
          }),
        }),
      );
      setEditId(null);
      onStatus("Question updated.");
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!classId) return;
    if (!confirm("Delete this question?")) return;
    try {
      await handleJson(await fetch(`/api/questions/${questionId}?classId=${classId}`, { method: "DELETE" }));
      onStatus("Question deleted.");
      await onChanged();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Question Bank"
        subtitle={
          className
            ? `${className} · ${questions.length} question${questions.length !== 1 ? "s" : ""} · ${totalMarks} marks total`
            : "Select a class from the sidebar to manage questions."
        }
        action={
          classCanManage ? (
            <button
              className={showAddForm ? btnSecondary : btnPrimary}
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
            >
              {showAddForm ? "Cancel" : "+ Add question"}
            </button>
          ) : undefined
        }
      />

      {!classCanManage ? (
        <Card className="text-center py-10">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cream">
            <IconBook className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="text-sm font-semibold text-ink">{!classId ? "No class selected" : "Access restricted"}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {!classId
              ? "Open a class from the Classes tab to manage its questions."
              : "You need to be a teacher of this class to manage questions."}
          </p>
          {!classId ? (
            <button className={`${btnSecondary} mt-4`} type="button" onClick={onGoToClasses}>
              Go to Classes
            </button>
          ) : null}
        </Card>
      ) : (
        <>
          {classId ? (
            <PdfImportPanel
              classId={classId}
              kind="question_bank"
              onComplete={onChanged}
              onStatus={onStatus}
              disabled={isBusy}
            />
          ) : null}

          {showAddForm ? (
            <Card className="border-ink-faint">
              <h3 className="mb-4 text-sm font-semibold text-ink">New question</h3>
              <form onSubmit={createQuestion} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Type">
                    <select
                      className={inputClass}
                      value={questionType}
                      onChange={(e) => {
                        const next = e.target.value === "mcq" ? "mcq" : "open";
                        setQuestionType(next);
                        if (next === "mcq") setMarks("1");
                      }}
                    >
                      <option value="open">Open-ended</option>
                      <option value="mcq">Multiple choice</option>
                    </select>
                  </FormField>
                  <FormField label="Topic" hint="Groups questions by subject area (e.g. Cell Biology)">
                    <input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" autoFocus />
                  </FormField>
                  <FormField label="Marks">
                    <input className={inputClass} type="number" min={0} value={marks} onChange={(e) => setMarks(e.target.value)} required />
                  </FormField>
                </div>
                <FormField label="Question">
                  <textarea
                    className={`${inputClass} min-h-[100px] resize-y`}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Write the question that students will see…"
                    required
                  />
                </FormField>
                <FormField
                  label={questionType === "mcq" ? "Correct letter" : "Answer key"}
                  hint={
                    questionType === "mcq"
                      ? "Letter only (A–E). Graded by exact match."
                      : "The model answer AI uses for grading — be specific and detailed. Students won't see this."
                  }
                >
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-y`}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={questionType === "mcq" ? "B" : "Write the ideal answer. More detail = better AI grading accuracy."}
                    required
                  />
                </FormField>
                <div className="flex gap-2">
                  <button disabled={isBusy} className={btnPrimary} type="submit">
                    Add question
                  </button>
                  <button className={btnSecondary} type="button" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          ) : null}

          {grouped.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 flex rounded-full border border-line bg-paper p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setGroupBy("test");
                    setTopicFilter(null);
                  }}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    groupBy === "test" ? "bg-pen text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  By test
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupBy("topic");
                    setTestFilter(null);
                  }}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    groupBy === "topic" ? "bg-pen text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  By topic
                </button>
              </div>
              {grouped.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => (groupBy === "test" ? setTestFilter(null) : setTopicFilter(null))}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                      activeFilter === null ? "bg-pen text-white" : "bg-cream text-pen hover:bg-cream-deep"
                    }`}
                  >
                    All
                  </button>
                  {grouped.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => {
                        if (groupBy === "test") {
                          setTestFilter(g.key === testFilter ? null : g.key);
                        } else {
                          setTopicFilter(g.key === topicFilter ? null : g.key);
                        }
                      }}
                      className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                        activeFilter === g.key ? "bg-pen text-white" : "bg-cream text-pen hover:bg-cream-deep"
                      }`}
                    >
                      {g.label} <span className="opacity-60">{g.items.length}</span>
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}

          {questions.length === 0 ? (
            <Card className="text-center py-10">
              <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cream">
                <IconBook className="h-5 w-5 text-ink-faint" />
              </div>
              <p className="text-sm font-semibold text-ink">No questions yet</p>
              <p className="mt-1 text-xs text-ink-faint">Import a PDF above, or click “+ Add question” to type one.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <div key={group.key}>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    <span className="flex-1 border-t border-line-soft" />
                    {group.label}
                    <span className="text-line font-normal normal-case tracking-normal">{group.items.length}</span>
                    <span className="flex-1 border-t border-line-soft" />
                  </h3>
                  <div className="space-y-2">
                    {group.items.map((q) => (
                      <Card key={`${group.key}-${q.id}`} className="group hover:border-line transition-colors duration-150">
                        {editId === q.id ? (
                          <form onSubmit={saveEdit} className="space-y-3">
                            <p className="text-xs font-semibold text-pen uppercase tracking-wide">Editing question</p>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <FormField label="Type">
                                <select
                                  className={inputClass}
                                  value={editQuestionType}
                                  onChange={(e) =>
                                    setEditQuestionType(e.target.value === "mcq" ? "mcq" : "open")
                                  }
                                >
                                  <option value="open">Open-ended</option>
                                  <option value="mcq">Multiple choice</option>
                                </select>
                              </FormField>
                              <FormField label="Topic">
                                <input className={inputClass} value={editTopic} onChange={(e) => setEditTopic(e.target.value)} placeholder="Topic" />
                              </FormField>
                              <FormField label="Marks">
                                <input className={inputClass} type="number" min={0} value={editMarks} onChange={(e) => setEditMarks(e.target.value)} required />
                              </FormField>
                            </div>
                            <FormField label="Question">
                              <textarea className={`${inputClass} min-h-[80px]`} value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} required />
                            </FormField>
                            <FormField
                              label={editQuestionType === "mcq" ? "Correct letter" : "Answer key"}
                              hint={
                                editQuestionType === "mcq"
                                  ? "Letter only (A–E)."
                                  : "Be specific — this is what AI grades against."
                              }
                            >
                              <textarea className={`${inputClass} min-h-[60px]`} value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)} required />
                            </FormField>
                            <div className="flex gap-2">
                              <button className={btnPrimary} type="submit" disabled={isBusy}>Save changes</button>
                              <button className={btnSecondary} type="button" onClick={() => setEditId(null)}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink leading-snug">{q.prompt}</p>
                              <p className="mt-1.5 text-xs text-ink-faint">
                                {q.question_type === "mcq" ? "Correct letter: " : "Answer key: "}
                                <span className="italic">{q.correct_answer}</span>
                              </p>
                              {groupBy === "topic" && (q.tests?.length ?? 0) > 0 ? (
                                <p className="mt-1 text-[11px] text-ink-faint">
                                  In: {q.tests!.map((t) => t.title).join(", ")}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              {q.question_type === "mcq" ? <Badge variant="gray">MCQ</Badge> : null}
                              <Badge variant="gray">{q.marks} mark{q.marks !== 1 ? "s" : ""}</Badge>
                              <button className={`${btnSecondary} py-1.5 px-3 text-xs`} type="button" onClick={() => startEdit(q)}>Edit</button>
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
  );
}
