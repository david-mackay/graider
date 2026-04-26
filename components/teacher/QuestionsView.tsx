"use client";

import { FormEvent, useState } from "react";
import { Badge, Card, FormField, SectionHeader, btnDanger, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconBook } from "@/components/shared/icons";
import { handleJson, normalizeTopic } from "@/lib/dashboard-client";
import type { DashboardQuestion, GroupedQuestions } from "@/lib/dashboard-types";

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
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [topic, setTopic] = useState("");
  const [marks, setMarks] = useState("2");

  const [editId, setEditId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editMarks, setEditMarks] = useState("2");

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

  const filteredGroups = topicFilter ? grouped.filter((g) => g.topic === topicFilter) : grouped;
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
          }),
        }),
      );
      setPrompt(""); setAnswer(""); setTopic(""); setMarks("2");
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
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <IconBook className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-indigo-950">{!classId ? "No class selected" : "Access restricted"}</p>
          <p className="mt-1 text-xs text-slate-400">
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
          {showAddForm ? (
            <Card className="border-indigo-300">
              <h3 className="mb-4 text-sm font-semibold text-indigo-950">New question</h3>
              <form onSubmit={createQuestion} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                <FormField label="Answer key" hint="The model answer AI uses for grading — be specific and detailed. Students won't see this.">
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-y`}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Write the ideal answer. More detail = better AI grading accuracy."
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

          {grouped.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTopicFilter(null)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  topicFilter === null ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                }`}
              >
                All topics
              </button>
              {grouped.map((g) => (
                <button
                  key={g.topic}
                  type="button"
                  onClick={() => setTopicFilter(g.topic === topicFilter ? null : g.topic)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    topicFilter === g.topic ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                  }`}
                >
                  {g.topic} <span className="opacity-60">{g.items.length}</span>
                </button>
              ))}
            </div>
          ) : null}

          {questions.length === 0 ? (
            <Card className="text-center py-10">
              <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <IconBook className="h-5 w-5 text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-indigo-950">No questions yet</p>
              <p className="mt-1 text-xs text-slate-400">Click “+ Add question” above to build your question bank.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => (
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
                        {editId === q.id ? (
                          <form onSubmit={saveEdit} className="space-y-3">
                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Editing question</p>
                            <div className="grid gap-3 sm:grid-cols-2">
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
                            <FormField label="Answer key" hint="Be specific — this is what AI grades against.">
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
                              <p className="text-sm font-medium text-indigo-950 leading-snug">{q.prompt}</p>
                              <p className="mt-1.5 text-xs text-slate-400">Answer key: <span className="italic">{q.correct_answer}</span></p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
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
