"use client";

import { IconCheck, IconSend, IconStopSquare } from "@/components/shared/icons";
import type { StudentSendStatus } from "@/lib/student-grade";

type SendStopButtonProps = {
  status: StudentSendStatus;
  disabled?: boolean;
  onSend: () => void;
  onCancel: () => void;
  /** Accessible name when idle / ready for send */
  label?: string;
  size?: "md" | "lg";
};

/**
 * Idle: paper-plane send.
 * Sending: flat stop square with a circular loader ring — tap to cancel.
 * Ready: checkmark (non-interactive).
 * Error: send again.
 */
export default function SendStopButton({
  status,
  disabled = false,
  onSend,
  onCancel,
  label = "Send pages",
  size = "lg",
}: SendStopButtonProps) {
  const dim = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const icon = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  if (status === "ready") {
    return (
      <div
        className={`inline-flex ${dim} items-center justify-center rounded-full bg-moss text-white`}
        title="Pages ready"
        aria-label="Pages ready"
      >
        <IconCheck className={icon} />
      </div>
    );
  }

  if (status === "sending") {
    return (
      <button
        type="button"
        onClick={onCancel}
        className={`relative inline-flex ${dim} cursor-pointer items-center justify-center rounded-full bg-pen text-white shadow-paper transition-opacity duration-150 hover:opacity-90`}
        aria-label="Stop sending"
        title="Stop"
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/25 border-t-white animate-spin"
          aria-hidden="true"
        />
        <IconStopSquare className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSend}
      disabled={disabled}
      className={`inline-flex ${dim} cursor-pointer items-center justify-center rounded-full bg-pen text-white shadow-paper transition-colors duration-150 hover:bg-pen-deep disabled:cursor-not-allowed disabled:opacity-40`}
      aria-label={status === "error" ? "Retry send" : label}
      title={status === "error" ? "Retry" : "Send"}
    >
      <IconSend className={icon} />
    </button>
  );
}
