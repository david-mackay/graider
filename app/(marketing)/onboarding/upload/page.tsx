"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import PageStagingGrid from "@/components/shared/PageStagingGrid";
import { Card, FormField, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconX } from "@/components/shared/icons";
import { getVault, setVault } from "@/lib/onboarding/vault";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";
import {
  ONBOARDING_MAX_STUDENTS,
  hasAnswerKey,
  normalizeAnswerKeys,
  normalizeRoster,
  type OnboardingAnswerKey,
  type OnboardingPaper,
  type OnboardingSampleGrade,
  type OnboardingStudentSubmission,
} from "@/lib/onboarding/types";
import type { SampleGradeResponse } from "@/lib/types";

const MAX_BYTES = 8 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  return new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
    type: mimeType || "image/png",
  });
}

function paperToFile(paper: OnboardingPaper): File {
  const blob = base64ToBlob(paper.base64, paper.mimeType);
  return new File([blob], paper.filename || "page.png", { type: paper.mimeType || "image/png" });
}

export default function OnboardingUploadPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<OnboardingAnswerKey[]>([]);
  const [students, setStudents] = useState<OnboardingStudentSubmission[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"photo" | "typed">("photo");
  const [name, setName] = useState("Student 1");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [initialPhotoFiles, setInitialPhotoFiles] = useState<File[]>([]);
  const [stagingKey, setStagingKey] = useState(0);
  const [typedAnswers, setTypedAnswers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [gradingProgress, setGradingProgress] = useState<string | null>(null);

  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.PAPER_UPLOAD);
    const vault = getVault();
    if (!hasAnswerKey(vault)) {
      router.replace("/onboarding/answer-key");
      return;
    }
    const nextKeys = normalizeAnswerKeys(vault);
    const roster = normalizeRoster(vault);
    setKeys(nextKeys);
    setStudents(roster);
    setName(`Student ${roster.length + 1}`);
    setTypedAnswers(nextKeys.map(() => ""));
  }, [router]);

  function resetCaptureForm(nextStudents: OnboardingStudentSubmission[]) {
    setEditingId(null);
    setPhotoFiles([]);
    setInitialPhotoFiles([]);
    setStagingKey((k) => k + 1);
    setMode("photo");
    setTypedAnswers(keys.map(() => ""));
    setName(`Student ${nextStudents.length + 1}`);
    setError(null);
  }

  function startEdit(student: OnboardingStudentSubmission) {
    setEditingId(student.id);
    setName(student.name);
    setMode(student.source);
    setError(null);
    if (student.source === "typed") {
      setTypedAnswers(keys.map((_, i) => student.typedAnswers?.[i] ?? ""));
      setPhotoFiles([]);
      setInitialPhotoFiles([]);
      setStagingKey((k) => k + 1);
    } else {
      const files = (student.papers ?? []).map(paperToFile);
      setTypedAnswers(keys.map(() => ""));
      setPhotoFiles(files);
      setInitialPhotoFiles(files);
      setStagingKey((k) => k + 1);
    }
  }

  function cancelEdit() {
    resetCaptureForm(students);
  }

  const draftReady =
    mode === "photo"
      ? photoFiles.length > 0
      : typedAnswers.some((a) => a.trim().length > 0);

  /** Persist the open form into the roster. Returns the updated list, or null on validation error. */
  async function commitCurrentForm(): Promise<OnboardingStudentSubmission[] | null> {
    const trimmedName =
      name.trim() ||
      (editingId
        ? students.find((s) => s.id === editingId)?.name ?? "Student"
        : `Student ${students.length + 1}`);
    setError(null);

    let submission: Pick<OnboardingStudentSubmission, "source" | "papers" | "typedAnswers">;

    if (mode === "photo") {
      if (photoFiles.length === 0) {
        setError("Add at least one photo.");
        return null;
      }
      for (const f of photoFiles) {
        if (f.size > MAX_BYTES) {
          setError("Each photo must be under 8 MB.");
          return null;
        }
      }
      const papers: OnboardingPaper[] = [];
      for (const file of photoFiles) {
        const base64 = await readFileAsBase64(file);
        papers.push({ mimeType: file.type || "image/png", base64, filename: file.name });
      }
      submission = { source: "photo", papers };
    } else {
      const trimmedAnswers = typedAnswers.map((a) => a.trim());
      if (!trimmedAnswers.some((a) => a.length > 0)) {
        setError("Type at least one answer.");
        return null;
      }
      submission = { source: "typed", typedAnswers: trimmedAnswers };
    }

    if (editingId) {
      return students.map((s) =>
        s.id === editingId
          ? { ...s, name: trimmedName, ...submission, grade: undefined }
          : s,
      );
    }
    return [
      ...students,
      { id: crypto.randomUUID(), name: trimmedName, ...submission },
    ];
  }

  async function saveStudent() {
    const nextStudents = await commitCurrentForm();
    if (!nextStudents) return;
    setStudents(nextStudents);
    setVault({ students: nextStudents, completedAt: undefined });
    resetCaptureForm(nextStudents);
  }

  function removeStudent(id: string) {
    const nextStudents = students.filter((s) => s.id !== id);
    setStudents(nextStudents);
    setVault({ students: nextStudents, completedAt: undefined });
    if (editingId === id) {
      resetCaptureForm(nextStudents);
    } else {
      setName(`Student ${nextStudents.length + 1}`);
    }
  }

  async function gradeOne(
    student: OnboardingStudentSubmission,
  ): Promise<OnboardingSampleGrade> {
    const formData = new FormData();
    formData.append("answerKeys", JSON.stringify(keys));
    formData.append(
      "answerKey",
      JSON.stringify({
        prompt: keys[0].prompt,
        correctAnswer: keys[0].correctAnswer,
        marks: keys[0].marks,
      }),
    );

    if (student.source === "typed" && student.typedAnswers) {
      formData.append("typedAnswers", JSON.stringify(student.typedAnswers));
    } else if (student.papers?.length) {
      for (const paper of student.papers) {
        formData.append("image", base64ToBlob(paper.base64, paper.mimeType), paper.filename);
      }
    } else {
      throw new Error(`No answers for ${student.name}.`);
    }

    const res = await fetch("/api/onboarding/sample-grade", { method: "POST", body: formData });
    if (res.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    const payload = (await res.json()) as SampleGradeResponse & { error?: string };
    if (!res.ok) {
      throw new Error(payload.error ?? `Couldn't grade ${student.name}.`);
    }
    return {
      marksEarned: payload.marksEarned,
      maxMarks: payload.maxMarks,
      feedback: payload.feedback,
      ocrAnswerText: payload.ocrAnswerText,
      questions: payload.questions,
    };
  }

  async function gradeClass() {
    // Include whoever is on the open form — no need to tap "Add student" first.
    let roster = students;
    if (editingId || draftReady) {
      const next = await commitCurrentForm();
      if (!next) return;
      roster = next;
      setStudents(next);
      setVault({ students: next, completedAt: undefined });
      resetCaptureForm(next);
    }
    if (roster.length === 0) {
      setError("Add at least one student first.");
      return;
    }

    setError(null);
    setIsBusy(true);
    try {
      const graded: OnboardingStudentSubmission[] = [];
      for (let i = 0; i < roster.length; i++) {
        const student = roster[i];
        setGradingProgress(`Grading ${student.name} (${i + 1}/${roster.length})…`);
        if (
          student.grade &&
          Number.isInteger(student.grade.marksEarned) &&
          Number.isInteger(student.grade.maxMarks)
        ) {
          graded.push(student as OnboardingStudentSubmission & { grade: OnboardingSampleGrade });
          continue;
        }
        const grade = await gradeOne(student);
        graded.push({ ...student, grade });
      }
      setStudents(graded);
      setVault({ students: graded, completedAt: new Date().toISOString() });
      router.push("/onboarding/result");
    } catch (err) {
      if (err instanceof Error && err.message === "RATE_LIMITED") {
        setRateLimited(true);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "We're having trouble grading right now — please try again.",
        );
      }
    } finally {
      setIsBusy(false);
      setGradingProgress(null);
    }
  }

  const atCap = students.length >= ONBOARDING_MAX_STUDENTS;
  const isEditing = Boolean(editingId);
  const showNewForm = !isEditing && !atCap;
  const gradeCount = students.length + (draftReady && !isEditing ? 1 : 0);
  const canGrade = gradeCount > 0 && !isBusy && !rateLimited;

  function renderStudentForm(opts: { forEdit: boolean }) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
          {opts.forEdit ? "Editing student" : "New student"}
        </p>
        <FormField label="Student name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isBusy}
            className={inputClass}
          />
        </FormField>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("photo")}
            disabled={isBusy}
            className={mode === "photo" ? btnPrimary : btnSecondary}
          >
            Photo
          </button>
          <button
            type="button"
            onClick={() => setMode("typed")}
            disabled={isBusy}
            className={mode === "typed" ? btnPrimary : btnSecondary}
          >
            Type answer
          </button>
        </div>

        {mode === "photo" ? (
          <PageStagingGrid
            key={stagingKey}
            onFilesChange={setPhotoFiles}
            initialFiles={initialPhotoFiles}
            maxPages={10}
            disabled={isBusy}
            dropLabel="Drop this student's pages here, or click to choose"
            onError={setError}
          />
        ) : (
          <div className="space-y-4">
            {keys.map((key, index) => (
              <FormField
                key={`${index}-${key.prompt.slice(0, 24)}`}
                label={keys.length === 1 ? "Student answer" : `Answer for Q${index + 1}`}
                hint={key.prompt}
              >
                <textarea
                  value={typedAnswers[index] ?? ""}
                  onChange={(e) => {
                    const next = [...typedAnswers];
                    next[index] = e.target.value;
                    setTypedAnswers(next);
                  }}
                  disabled={isBusy}
                  rows={keys.length === 1 ? 3 : 2}
                  className={inputClass}
                />
              </FormField>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {opts.forEdit ? (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isBusy}
              className={`${btnSecondary} justify-center`}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void saveStudent()}
            disabled={isBusy}
            className={`${btnSecondary} justify-center`}
          >
            {opts.forEdit ? "Save changes" : "Add student"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnboardingShell step={4} backHref="/onboarding/answer-key">
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">Build your class</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Add each student and their paper.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Collect the whole stack first. Tap any student to edit. We&rsquo;ll grade everyone when
          you&rsquo;re ready.
        </p>
      </div>

      {students.length > 0 ? (
        <div className="mt-8 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
            {students.length} student{students.length === 1 ? "" : "s"} ready
          </p>
          {students.map((s) => {
            const active = editingId === s.id;
            if (active) {
              return (
                <Card key={s.id} className="space-y-4 border-pen ring-2 ring-pen/20">
                  {renderStudentForm({ forEdit: true })}
                </Card>
              );
            }
            return (
              <Card key={s.id} className="flex items-center justify-between gap-3 py-3">
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  disabled={isBusy || isEditing}
                  className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-default disabled:opacity-60"
                >
                  <p className="truncate text-sm font-bold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-faint">
                    {s.source === "photo"
                      ? `${s.papers?.length ?? 1} photo${(s.papers?.length ?? 1) === 1 ? "" : "s"}`
                      : "Typed"}
                    {isEditing ? "" : " · tap to edit"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => removeStudent(s.id)}
                  disabled={isBusy || isEditing}
                  className="cursor-pointer rounded-lg p-1.5 text-ink-faint transition-colors duration-150 hover:bg-pen-wash hover:text-pen disabled:opacity-40"
                  aria-label={`Remove ${s.name}`}
                >
                  <IconX className="h-4 w-4" />
                </button>
              </Card>
            );
          })}
        </div>
      ) : null}

      {atCap && !isEditing ? (
        <Card className="mt-8">
          <p className="text-sm font-semibold text-ink">
            That&rsquo;s the free demo limit ({ONBOARDING_MAX_STUDENTS} students).
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Tap a student above to edit, or sign up to grade a full class.
          </p>
        </Card>
      ) : null}

      {showNewForm ? (
        <Card className="mt-8 space-y-4">{renderStudentForm({ forEdit: false })}</Card>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-pen-soft/60 bg-pen-wash px-3.5 py-2.5 text-sm font-bold text-pen-deep"
        >
          {error}
        </p>
      ) : null}

      {rateLimited ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-marigold/30 bg-marigold-wash px-3.5 py-2.5 text-sm font-bold text-marigold-deep"
        >
          We&rsquo;ve hit our free demo quota. Sign up for unlimited grading.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={!canGrade}
          onClick={() => void gradeClass()}
          className={`${btnPrimary} w-full justify-center py-3 sm:w-auto`}
        >
          {isBusy
            ? gradingProgress ?? "Grading…"
            : `Grade my class${gradeCount > 0 ? ` (${gradeCount})` : ""}`}
        </button>
      </div>
    </OnboardingShell>
  );
}
