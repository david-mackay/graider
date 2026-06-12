"use client";

import { FormEvent, useState } from "react";
import { Badge, Card, FormField, SectionHeader, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconHome } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import type { DashboardClass, DashboardTest, Invitation } from "@/lib/dashboard-types";
import InvitesPanel from "@/components/teacher/InvitesPanel";

type TeacherClassesViewProps = {
  classes: DashboardClass[];
  tests: DashboardTest[];
  attemptsGradedCountByClass: Map<string, number>;
  invitesByClass: Record<string, Invitation[]>;
  loadInvites: (classId: string) => Promise<void>;
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
  invitesByClass,
  loadInvites,
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
  const [expandedInviteClassId, setExpandedInviteClassId] = useState<string | null>(null);

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
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-lg font-semibold text-ink">{entry.name}</h4>
                      <Badge variant={entry.role_in_class === "teacher" ? "blue" : "gray"}>
                        {entry.role_in_class ?? "member"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">
                      {classTests.length} test{classTests.length !== 1 ? "s" : ""}
                      {gradedCount > 0 ? ` · ${gradedCount} graded` : ""}
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
                          className="cursor-pointer text-xs font-medium text-pen hover:text-pen-deep transition-colors duration-150"
                        >
                          {expandedInviteClassId === entry.id ? "Hide invites" : "Manage invites"}
                        </button>

                        {expandedInviteClassId === entry.id ? (
                          <InvitesPanel
                            classId={entry.id}
                            invitations={invitesByClass[entry.id] ?? []}
                            onChange={() => loadInvites(entry.id)}
                            onStatus={onStatus}
                            isBusy={isBusy}
                            setBusy={setBusy}
                          />
                        ) : null}
                      </div>
                    ) : null}
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
        <h3 className="mb-3 text-sm font-semibold text-ink">Join a class</h3>
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
