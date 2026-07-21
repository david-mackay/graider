"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Card,
  FormField,
  SectionHeader,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/shared/ui";
import { IconCheck, IconCopy, IconPen, IconUsers, IconX } from "@/components/shared/icons";
import { handleJson, type StatusType } from "@/lib/dashboard-client";
import type { ClassMember, DashboardAttempt, Invitation } from "@/lib/dashboard-types";

type StudentsViewProps = {
  classId: string | null;
  className: string | null;
  members: ClassMember[];
  attemptsInScope: DashboardAttempt[];
  invitations: Invitation[];
  onLoadInvites: () => void | Promise<void>;
  onChanged: () => void | Promise<void>;
  onStatus: (message: string, type?: StatusType) => void;
  isBusy: boolean;
  setBusy: (value: boolean) => void;
};

type ComposeMode = "add" | "invite" | null;

function getInviteStatus(invite: Invitation): "active" | "expired" | "accepted" {
  if (invite.status === "accepted") return "accepted";
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return "expired";
  return "active";
}

export default function StudentsView({
  classId,
  className,
  members,
  attemptsInScope,
  invitations,
  onLoadInvites,
  onChanged,
  onStatus,
  isBusy,
  setBusy,
}: StudentsViewProps) {
  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    if (classId) void onLoadInvites();
  }, [classId, onLoadInvites]);

  const teachers = members.filter((m) => m.role === "teacher");
  const students = members.filter((m) => m.role === "student");
  const pendingInvites = invitations.filter(
    (inv) => inv.role === "student" && getInviteStatus(inv) === "active",
  );
  const otherInvites = invitations.filter(
    (inv) => inv.role === "student" && getInviteStatus(inv) !== "active",
  );

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

  function openCompose(mode: ComposeMode) {
    setComposeMode(mode);
    setNewName("");
    setNewEmail("");
  }

  function closeCompose() {
    setComposeMode(null);
    setNewName("");
    setNewEmail("");
  }

  function openEdit(member: ClassMember) {
    setEditingId(member.user_id);
    setEditName(member.full_name ?? "");
    setEditEmail(member.email ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
  }

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
      onStatus("Enter a student name.", "error");
      return;
    }
    setBusy(true);
    try {
      const body: { full_name: string; email?: string } = { full_name: trimmedName };
      const trimmedEmail = newEmail.trim();
      if (trimmedEmail) body.email = trimmedEmail;

      await handleJson(
        await fetch(`/api/classes/${classId}/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      closeCompose();
      onStatus("Student added to roster.");
      await onChanged();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to add student.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function inviteStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
      onStatus("Enter the student’s name for this invite.", "error");
      return;
    }
    setBusy(true);
    try {
      const body: {
        invited_name: string;
        invited_email?: string | null;
        role: "student";
        single_use: true;
      } = {
        invited_name: trimmedName,
        role: "student",
        single_use: true,
      };
      const trimmedEmail = newEmail.trim();
      if (trimmedEmail) body.invited_email = trimmedEmail;

      const created = await handleJson<{ invitation_code: string }>(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      closeCompose();
      onStatus(`Invite created for ${trimmedName}. Code: ${created.invitation_code}`);
      await onLoadInvites();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to create invite.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(member: ClassMember, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      onStatus("Student name is required.", "error");
      return;
    }
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/classes/${classId}/students/${member.user_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: trimmedName,
            email: editEmail.trim() || null,
          }),
        }),
      );
      cancelEdit();
      onStatus("Student updated.");
      await onChanged();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to update student.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(member: ClassMember) {
    if (!classId) return;
    if (!window.confirm(`Remove ${member.full_name ?? "this student"} from the class?`)) return;
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/classes/${classId}/students/${member.user_id}`, {
          method: "DELETE",
        }),
      );
      onStatus("Student removed.");
      await onChanged();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to remove student.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvite(invitationId: string) {
    if (!classId) return;
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitationId }),
        }),
      );
      onStatus("Invite deleted.");
      await onLoadInvites();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to delete invite.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite(invite: Invitation) {
    try {
      const link = `${window.location.origin}/s?join=${invite.code}`;
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      onStatus(`Invite link copied for ${invite.invited_name ?? "student"}.`);
      setTimeout(() => setCopiedId((id) => (id === invite.id ? "" : id)), 2000);
    } catch {
      onStatus("Could not copy invite link.", "error");
    }
  }

  if (!classId) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Students" subtitle="Pick a class to manage its roster and invites." />
        <Card className="py-10 text-center">
          <p className="text-sm text-ink-soft">Select a class from the sidebar to continue.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Students"
        subtitle={
          className
            ? `Roster and invites for ${className}. Students join only with a personal invite code.`
            : "Roster and invites for this class."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled={isBusy} onClick={() => openCompose("invite")}>
              Invite student
            </button>
            <button type="button" className={btnPrimary} disabled={isBusy} onClick={() => openCompose("add")}>
              + Add manually
            </button>
          </div>
        }
      />

      {composeMode ? (
        <Card className="border-ink-faint">
          <form
            onSubmit={(event) => void (composeMode === "invite" ? inviteStudent(event) : addStudent(event))}
            className="space-y-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-pen">
              {composeMode === "invite" ? "Invite student with a code" : "Add student to roster"}
            </p>
            <p className="text-xs text-ink-faint">
              {composeMode === "invite"
                ? "Creates a single-use invite tied to this name. They join Graider with the code or link."
                : "Adds a roster name for paper grading now. They won’t have a login until you invite them."}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name">
                <input
                  className={inputClass}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jamie Smith"
                  required
                  autoFocus
                />
              </FormField>
              <FormField label="Email (optional)">
                <input
                  className={inputClass}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jamie@school.edu"
                  type="email"
                />
              </FormField>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className={btnPrimary} type="submit" disabled={isBusy || !newName.trim()}>
                {composeMode === "invite" ? "Create invite" : "Save student"}
              </button>
              <button className={btnSecondary} type="button" onClick={closeCompose}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {pendingInvites.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Waiting to join · {pendingInvites.length}
          </h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const isLegacy = !invite.invited_name?.trim();
              return (
              <Card
                key={invite.id}
                className={
                  isLegacy
                    ? "border-dashed border-marigold/40 bg-marigold-wash/30"
                    : "border-dashed border-pen/30 bg-pen-wash/20"
                }
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-pen text-sm font-bold text-white">
                    {(invite.invited_name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {invite.invited_name ?? "Legacy invite (no name)"}
                    </p>
                    <p className="truncate text-xs text-ink-faint">
                      Code <span className="font-mono font-semibold text-pen-deep">{invite.code}</span>
                      {invite.invited_email ? ` · ${invite.invited_email}` : ""}
                      {isLegacy
                        ? " · Delete this and create a new named invite"
                        : ""}
                    </p>
                  </div>
                  {isLegacy ? <Badge variant="yellow">Legacy</Badge> : <Badge variant="yellow">Pending</Badge>}
                  {!isLegacy ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => void copyInvite(invite)}
                      aria-label="Copy invite link"
                    >
                      {copiedId === invite.id ? (
                        <span className="inline-flex items-center gap-1">
                          <IconCheck className="h-3.5 w-3.5" /> Copied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <IconCopy className="h-3.5 w-3.5" /> Copy link
                        </span>
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={isLegacy ? btnDanger : "rounded-lg p-1.5 text-ink-faint hover:bg-cream"}
                    disabled={isBusy}
                    onClick={() => void deleteInvite(invite.id)}
                    aria-label="Delete invite"
                  >
                    {isLegacy ? "Delete" : <IconX className="h-4 w-4" />}
                  </button>
                </div>
              </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {students.length === 0 && pendingInvites.length === 0 && !composeMode ? (
        <Card className="py-10 text-center">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cream">
            <IconUsers className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="text-sm font-semibold text-ink">No students yet</p>
          <p className="mt-1 text-xs text-ink-faint">
            Add a roster name for paper grading, or invite a student with a personal code.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className={btnPrimary} onClick={() => openCompose("add")}>
              + Add manually
            </button>
            <button type="button" className={btnSecondary} onClick={() => openCompose("invite")}>
              Invite student
            </button>
          </div>
        </Card>
      ) : null}

      {teachers.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Teachers</h3>
          <div className="space-y-2">
            {teachers.map((member) => (
              <Card key={member.user_id}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-pen text-sm font-bold text-white">
                    {(member.full_name ?? member.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{member.full_name ?? "Unnamed"}</p>
                    <p className="truncate text-xs text-ink-faint">{member.email ?? "No email"}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {students.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Enrolled · {students.length}
          </h3>
          <div className="space-y-2">
            {students.map((member) => {
              const stats = attemptsByStudent.get(member.user_id);
              if (editingId === member.user_id) {
                return (
                  <Card key={member.user_id} className="border-ink-faint">
                    <form onSubmit={(event) => void saveEdit(member, event)} className="space-y-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-pen">Editing student</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Name">
                          <input
                            className={inputClass}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                            autoFocus
                          />
                        </FormField>
                        <FormField label="Email">
                          <input
                            className={inputClass}
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            type="email"
                          />
                        </FormField>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className={btnPrimary} type="submit" disabled={isBusy}>
                          Save
                        </button>
                        <button className={btnSecondary} type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                        <button
                          className={btnDanger}
                          type="button"
                          disabled={isBusy}
                          onClick={() => void removeStudent(member)}
                        >
                          Remove student
                        </button>
                      </div>
                    </form>
                  </Card>
                );
              }

              return (
                <Card key={member.user_id} className="transition-colors duration-150 hover:border-line">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-pen text-sm font-bold text-white">
                      {(member.full_name ?? member.email ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{member.full_name ?? "Unnamed"}</p>
                      <p className="truncate text-xs text-ink-faint">{member.email ?? "No email"}</p>
                      {stats ? (
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {stats.graded}/{stats.submitted} graded
                          {stats.maxScore > 0
                            ? ` · ${stats.totalScore}/${stats.maxScore} marks`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-ink-faint hover:bg-cream hover:text-pen-deep"
                      onClick={() => openEdit(member)}
                      aria-label="Edit student"
                    >
                      <IconPen className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-ink-faint hover:bg-cream"
                      disabled={isBusy}
                      onClick={() => void removeStudent(member)}
                      aria-label="Remove student"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {otherInvites.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Past invites</h3>
          <div className="space-y-2">
            {otherInvites.map((invite) => {
              const status = getInviteStatus(invite);
              return (
                <Card key={invite.id} className="bg-cream/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{invite.invited_name ?? "Invite"}</p>
                    <Badge variant={status === "accepted" ? "green" : "gray"}>{status}</Badge>
                    {invite.accepted_by_name && status === "accepted" ? (
                      <span className="text-xs text-ink-faint">joined as {invite.accepted_by_name}</span>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
