"use client";

import { useId, useState } from "react";

type CopyableErrorProps = {
  message: string;
  className?: string;
};

/** Selectable + one-click copy error surface for wizard / upload failures. */
export default function CopyableError({ message, className = "" }: CopyableErrorProps) {
  const textId = useId();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.getElementById(textId);
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  return (
    <div
      role="alert"
      className={`rounded-xl border border-pen-soft/60 bg-pen-wash px-3.5 py-2.5 ${className}`}
    >
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-pen-deep/80">Error</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 cursor-pointer rounded-md px-2 py-0.5 text-xs font-bold text-pen-deep underline-offset-2 hover:underline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        id={textId}
        className="select-text whitespace-pre-wrap break-words font-mono text-xs font-normal leading-relaxed text-pen-deep"
      >
        {message}
      </pre>
    </div>
  );
}
