"use client";

import { useMemo, useState } from "react";
import { Badge, Card, FormField, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { handleJson } from "@/lib/dashboard-client";
import type { TestStatus } from "@/lib/types";
import type { DashboardTest } from "@/lib/dashboard-types";

type Mode = "window" | "window_time";

type Props = {
  test: DashboardTest;
  onUpdated: () => void | Promise<void>;
  onStatus: (message: string, type?: "info" | "error") => void;
  isBusy: boolean;
  setBusy: (b: boolean) => void;
};

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function statusVariant(status: TestStatus): "blue" | "green" | "gray" | "yellow" {
  switch (status) {
    case "open":
      return "green";
    case "scheduled":
      return "blue";
    case "closed":
      return "gray";
    case "draft":
    default:
      return "yellow";
  }
}

function statusLabel(status: TestStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "scheduled":
      return "Scheduled";
    case "closed":
      return "Closed";
    case "draft":
    default:
      return "Draft";
  }
}

export default function TestAdministerPanel({ test, onUpdated, onStatus, isBusy, setBusy }: Props) {
  const initialMode: Mode = useMemo(
    () => (test.duration_minutes && test.duration_minutes > 0 ? "window_time" : "window"),
    [test.duration_minutes],
  );

  const [mode, setMode] = useState<Mode>(initialMode);
  const [opensAt, setOpensAt] = useState(() => isoToLocalInput(test.opens_at));
  const [closesAt, setClosesAt] = useState(() => isoToLocalInput(test.closes_at));
  const [duration, setDuration] = useState<string>(
    test.duration_minutes && test.duration_minutes > 0 ? String(test.duration_minutes) : "60",
  );
  const [allowLate, setAllowLate] = useState<boolean>(test.allow_late_submit);

  async function patchTest(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/tests/${test.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      await onUpdated();
    } catch (error) {
      if (error instanceof Error) onStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    const opens = localInputToIso(opensAt);
    const closes = localInputToIso(closesAt);
    if (!opens) {
      onStatus("Set an opens-at time to schedule this test.", "error");
      return;
    }
    if (opens && closes && new Date(closes) <= new Date(opens)) {
      onStatus("Closes-at must be after opens-at.", "error");
      return;
    }
    const durationMinutes =
      mode === "window_time" ? Math.max(1, Math.floor(Number(duration) || 0)) : null;
    if (mode === "window_time" && (!durationMinutes || durationMinutes <= 0)) {
      onStatus("Enter a positive time limit in minutes.", "error");
      return;
    }
    await patchTest({
      action: "schedule",
      opens_at: opens,
      closes_at: closes,
      duration_minutes: durationMinutes,
      allow_late_submit: allowLate,
    });
    onStatus("Test scheduled.");
  }

  async function openNow() {
    const closes = localInputToIso(closesAt);
    const durationMinutes =
      mode === "window_time" ? Math.max(1, Math.floor(Number(duration) || 0)) : null;
    if (mode === "window_time" && (!durationMinutes || durationMinutes <= 0)) {
      onStatus("Enter a positive time limit in minutes.", "error");
      return;
    }
    await patchTest({
      action: "open_now",
      closes_at: closes,
      duration_minutes: durationMinutes,
      allow_late_submit: allowLate,
    });
    onStatus("Test is now open.");
  }

  async function closeNow() {
    await patchTest({ action: "close_now" });
    onStatus("Test closed.");
  }

  return (
    <Card className="border-line">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Administer</p>
          <Badge variant={statusVariant(test.status)}>{statusLabel(test.status)}</Badge>
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Mode</p>
        <div
          role="radiogroup"
          aria-label="Test administration mode"
          className="inline-flex rounded-full border border-line bg-cream p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "window"}
            onClick={() => setMode("window")}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
              mode === "window" ? "bg-paper text-ink shadow-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            Window only
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "window_time"}
            onClick={() => setMode("window_time")}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
              mode === "window_time" ? "bg-paper text-ink shadow-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            Window + time limit
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Opens at" hint="Local time">
          <input
            type="datetime-local"
            className={inputClass}
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
          />
        </FormField>
        <FormField label="Closes at" hint="Optional">
          <input
            type="datetime-local"
            className={inputClass}
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
        </FormField>
        {mode === "window_time" ? (
          <FormField label="Time limit (minutes)" hint="Per-student attempt duration">
            <input
              type="number"
              min={1}
              step={1}
              className={inputClass}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </FormField>
        ) : null}
      </div>

      <label className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-ink-faint text-pen focus:ring-pen"
          checked={allowLate}
          onChange={(e) => setAllowLate(e.target.checked)}
        />
        Allow late submissions
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => void saveSchedule()}
          disabled={isBusy}
        >
          Schedule
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => void openNow()}
          disabled={isBusy || test.status === "open"}
        >
          Open now
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => void closeNow()}
          disabled={isBusy || test.status === "closed" || test.status === "draft"}
        >
          Close now
        </button>
      </div>
    </Card>
  );
}
