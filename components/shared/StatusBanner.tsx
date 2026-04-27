import { IconCheck, IconX } from "@/components/shared/icons";
import type { StatusType } from "@/lib/dashboard-client";

type StatusBannerProps = {
  message: string;
  type: StatusType;
  onDismiss: () => void;
};

export default function StatusBanner({ message, type, onDismiss }: StatusBannerProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
        type === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {type === "error" ? (
        <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ) : (
        <IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
      )}
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="cursor-pointer text-current opacity-60 hover:opacity-100 transition-opacity duration-150"
        aria-label="Dismiss"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}
