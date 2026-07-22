"use client";

import { FormEvent, useState } from "react";
import { Badge, Card, FormField, SectionHeader, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconCheck, IconHome, IconPen, IconX } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import type { DashboardClass, DashboardTest } from "@/lib/dashboard-types";

type TeacherClassesViewProps = {
  classes: DashboardClass[];
  tests: DashboardTest[];
  attemptsGradedCountByClass: Map<string, number>;
  onCreated: () => void | Promise<void>;
  onJoined: () => void | Promise<void>;
  onOpenClass: (classId: string) => void;
  onStatus: (message: string, type?: "info" | "error") => void;
  isBusy: boolean;
  setBusy: (value: boolean) => void;
};

export default function TeacherClassesView({
  classes,
  tests,
  attemptsGradedCountByClass,
  onCreated,
  onJoined,
  onOpenClass,
  onStatus,
  isBusy,
  setBusy,
}: TeacherClassesViewProps) {
  const [showCreateClassForm, setShowCreateClassForm] = useState(false);
  const [className, setClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [renameClassId, setRenameClassId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function startRename(entry: DashboardClass) {
    setRenameClassId(entry.id);
    setRenameValue(entry.name);
  }

  function cancelRename() {
    setRenameClassId(null);
    setRenameValue("");
  }

  async function submitRename(entry: DashboardClass, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = renameValue.trim();
    if (!nextName || nextName === entry.name) {
      cancelRename();
      return;
    }
    setBusy(true);
    try {
      await handleJson<{ class: DashboardClass }>(
        await fetch(`/api/classes/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        }),
      );
      onStatus(`Class renamed to “${nextName}”.`);
      cancelRename();
      await onCreated();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!className.trim()) return;
    setBusy(true);
    try {
      const payload = await handleJson<{ class: DashboardClass }>(
        await fetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: className }),
        }),
      );
      setClassName("");
      setShowCreateClassForm(false);
      onStatus(`Class “${payload.class.name}” created.`);
      await onCreated();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function joinClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      await handleJson<{ joined: boolean }>(
        await fetch("/api/classes/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: joinCode }),
        }),
      );
      setJoinCode("");
      onStatus("Successfully joined class!");
      await onJoined();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
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
          <h3 className="mb-4 text-sm font-semibold text-ink">Create new class</h3>
          <form onSubmit={createClass} className="space-y-3 sm:flex sm:items-end sm:gap-3 sm:space-y-0">
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
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cream">
            <IconHome className="h-6 w-6 text-ink-faint" />
          </div>
          <p className="text-sm font-semibold text-ink">No classes yet</p>
          <p className="mt-1 text-xs text-ink-faint">Create your first class to get started.</p>
          <button className={`${btnPrimary} mt-4`} type="button" onClick={() => setShowCreateClassForm(true)}>
            Create a class
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          {classes.map((entry) => {
            const classTests = tests.filter((t) => t.class_id === entry.id);
            const gradedCount = attemptsGradedCountByClass.get(entry.id) ?? 0;
            return (
              <Card key={entry.id} className="hover:border-line transition-colors duration-150">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {renameClassId === entry.id ? (
                      <form
                        onSubmit={(event) => void submitRename(entry, event)}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          className={`${inputClass} max-w-xs`}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelRename();
                          }}
                        />
                        <button
                          type="submit"
                          disabled={isBusy}
                          className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-full bg-pen text-white shadow-paper hover:bg-pen-deep transition-colors duration-150 disabled:opacity-50"
                          aria-label="Save class name"
                        >
                          <IconCheck className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-ink-soft hover:bg-cream transition-colors duration-150"
                          aria-label="Cancel rename"
                        >
                          <IconX className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-lg font-semibold text-ink">{entry.name}</h4>
                        <Badge variant={entry.role_in_class === "teacher" ? "blue" : "gray"}>
                          {entry.role_in_class ?? "member"}
                        </Badge>
                        {entry.role_in_class === "teacher" ? (
                          <button
                            type="button"
                            onClick={() => startRename(entry)}
                            className="cursor-pointer inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-faint hover:bg-cream hover:text-pen-deep transition-colors duration-150"
                            aria-label={`Rename ${entry.name}`}
                            title="Rename class"
                          >
                            <IconPen className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-ink-faint">
                      {entry.student_count ?? 0} student
                      {(entry.student_count ?? 0) !== 1 ? "s" : ""}
                      {" · "}
                      {classTests.length} test{classTests.length !== 1 ? "s" : ""}
                      {gradedCount > 0 ? ` · ${gradedCount} graded` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onOpenClass(entry.id)} className={btnPrimary}>
                      Open class
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">Join another class</h3>
        <p className="mb-3 text-xs text-ink-faint">
          Teachers join a colleague’s class with a teacher invite code. Students join from the Students tab invites.
        </p>
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
  );
}
