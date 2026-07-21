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

function joinLinkForCode(code: string): string {
  if (typeof window === "undefined") return `/s?join=${encodeURIComponent(code)}`;
  return `${window.location.origin}/s?join=${encodeURIComponent(code)}`;
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
  const [inviteSingleUse, setInviteSingleUse] = useState(true);
  const [copiedId, setCopiedId] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState("");

  async function generateInvite(role: "student" | "teacher") {
    setBusy(true);
    try {
      const expiresInDays = Number(inviteExpiry) || undefined;
      await handleJson(
        await fetch(`/api/classes/${classId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invited_email: null,
            role,
            expires_in_days: expiresInDays,
            single_use: inviteSingleUse,
          }),
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

  async function copyJoinLink(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(joinLinkForCode(code));
      setCopiedLinkId(id);
      onStatus("Join link copied to clipboard.");
      window.setTimeout(() => setCopiedLinkId((c) => (c === id ? "" : c)), 2000);
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    }
  }

  return (
    <div className="mt-3 space-y-4 border-t border-line-soft pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-ink-soft">Expiry</label>
          <select
            className="mt-0.5 block w-full cursor-pointer rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-pen/50 transition-colors duration-150"
            value={inviteExpiry}
            onChange={(e) => setInviteExpiry(e.target.value)}
          >
            <option value="0">No expiry</option>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink-soft hover:border-ink-faint transition-colors duration-150">
          <input
            type="checkbox"
            checked={inviteSingleUse}
            onChange={(e) => setInviteSingleUse(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-pen"
          />
          <span>Single-use</span>
        </label>
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
        <p className="text-xs text-ink-faint">No invite codes yet. Generate one above.</p>
      ) : (
        <div className="space-y-1.5">
          {invitations.map((inv) => {
            const derivedStatus = getInviteStatus(inv);
            return (
              <div
                key={inv.id}
                className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  derivedStatus === "accepted"
                    ? "border-line-soft bg-cream/50"
                    : derivedStatus === "expired"
                      ? "border-pen-soft/40 bg-pen-wash/30"
                      : "border-line-soft bg-paper"
                }`}
              >
                <code className="font-mono font-semibold text-pen-deep">{inv.code}</code>
                <Badge variant={inv.role === "teacher" ? "blue" : "gray"}>{inv.role}</Badge>
                <Badge variant={derivedStatus === "active" ? "green" : derivedStatus === "expired" ? "yellow" : "gray"}>
                  {derivedStatus}
                </Badge>
                <Badge variant="gray">{inv.single_use === false ? "Reusable" : "Single-use"}</Badge>
                <span className="text-ink-faint">
                  {derivedStatus === "accepted" && inv.accepted_by_name
                    ? inv.accepted_by_name
                    : formatExpiry(inv)}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {derivedStatus === "active" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void copyJoinLink(inv.id, inv.code)}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-ink-soft hover:bg-cream hover:text-pen-deep transition-colors duration-150"
                        title="Copy join link"
                        aria-label="Copy join link"
                      >
                        {copiedLinkId === inv.id ? (
                          <>
                            <IconCheck className="h-3 w-3 text-moss" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide">Copied</span>
                          </>
                        ) : (
                          <>
                            <IconCopy className="h-3 w-3" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide">Link</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyCode(inv.id, inv.code)}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ink-soft hover:bg-cream hover:text-pen-deep transition-colors duration-150"
                        title="Copy code"
                        aria-label="Copy invite code"
                      >
                        {copiedId === inv.id ? (
                          <IconCheck className="h-3 w-3 text-moss" />
                        ) : (
                          <IconCopy className="h-3 w-3" />
                        )}
                      </button>
                    </>
                  ) : null}
                  {derivedStatus !== "accepted" ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void deleteInvite(inv.id)}
                      className="cursor-pointer rounded-md px-1.5 py-0.5 text-ink-faint hover:bg-pen-wash hover:text-pen transition-colors duration-150"
                      title="Delete invite"
                      aria-label="Delete invite"
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
