"use client";

import { useState } from "react";
import { Badge, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { IconCheck, IconCopy, IconX } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import type { Invitation } from "@/lib/dashboard-types";

type InvitesPanelProps = {
  classId: string;
  invitations: Invitation[];
  onChange: () => void | Promise<void>;
  onStatus: (message: string, type?: "info" | "error") => void;
  isBusy: boolean;
  setBusy: (value: boolean) => void;
};

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

export default function InvitesPanel({
  classId,
  invitations,
  onChange,
  onStatus,
  isBusy,
  setBusy,
}: InvitesPanelProps) {
  const [inviteExpiry, setInviteExpiry] = useState("0");
  const [copiedId, setCopiedId] = useState("");

  async function generateInvite(role: "student" | "teacher") {
    setBusy(true);
    try {
      const expiresInDays = Number(inviteExpiry) || undefined;
      await handleJson(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invited_email: null, role, expires_in_days: expiresInDays }),
        }),
      );
      onStatus(`New ${role} invite code generated.`);
      await onChange();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvite(invitationId: string) {
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitationId }),
        }),
      );
      onStatus("Invite code deleted.");
      await onChange();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? "" : c)), 2000);
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    }
  }

  return (
    <div className="mt-3 space-y-4 border-t border-indigo-100 pt-3">
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
          onClick={() => void generateInvite("student")}
          className={`${btnPrimary} py-1.5 px-3 text-xs`}
        >
          + Student code
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void generateInvite("teacher")}
          className={`${btnSecondary} py-1.5 px-3 text-xs`}
        >
          + Teacher code
        </button>
      </div>

      {invitations.length === 0 ? (
        <p className="text-xs text-slate-400">No invite codes yet. Generate one above.</p>
      ) : (
        <div className="space-y-1.5">
          {invitations.map((inv) => {
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
                <Badge variant={inv.role === "teacher" ? "blue" : "gray"}>{inv.role}</Badge>
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
                      onClick={() => void copyCode(inv.id, inv.code)}
                      className="cursor-pointer flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150"
                    >
                      {copiedId === inv.id ? (
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
                      onClick={() => void deleteInvite(inv.id)}
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
  );
}
