import { Badge, Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { IconClipboard } from "@/components/shared/icons";
import type { DashboardAttempt, DashboardTest } from "@/lib/dashboard-types";

type TestRow = { test: DashboardTest; attempt: DashboardAttempt | null };

type TestListProps = {
  rows: TestRow[];
  classNameById: Map<string, string>;
  onStart: (testId: string) => void;
  onViewResult: (attemptId: string) => void;
};

function formatOpensAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Availability =
  | { kind: "start" }
  | { kind: "resume" }
  | { kind: "view_result" }
  | { kind: "awaiting_grade" }
  | { kind: "not_available"; label: string };

function availability(test: DashboardTest, attempt: DashboardAttempt | null): Availability {
  if (attempt?.status === "graded") return { kind: "view_result" };
  if (attempt?.status === "submitted") return { kind: "awaiting_grade" };
  if (attempt?.status === "draft") {
    if (test.available_now || test.allow_late_submit) return { kind: "resume" };
    return { kind: "not_available", label: "Closed" };
  }
  if (test.available_now) return { kind: "start" };
  if (test.status === "scheduled" && test.opens_at) {
    const opensAt = new Date(test.opens_at);
    if (!Number.isNaN(opensAt.getTime()) && opensAt.getTime() > Date.now()) {
      return { kind: "not_available", label: `Opens ${formatOpensAt(test.opens_at)}` };
    }
  }
  if (test.status === "closed") return { kind: "not_available", label: "Closed" };
  return { kind: "not_available", label: "Not available" };
}

function statusBadgeVariant(
  test: DashboardTest,
  attempt: DashboardAttempt | null,
): "blue" | "green" | "gray" | "yellow" {
  if (attempt?.status === "graded") return "green";
  if (attempt?.status === "submitted") return "blue";
  if (attempt?.status === "draft") return "yellow";
  if (test.status === "open" || test.available_now) return "green";
  if (test.status === "scheduled") return "blue";
  return "gray";
}

function statusBadgeLabel(test: DashboardTest, attempt: DashboardAttempt | null): string {
  if (attempt?.status === "graded") return "Graded";
  if (attempt?.status === "submitted") return "Submitted";
  if (attempt?.status === "draft") return "In progress";
  if (test.available_now) return "Open";
  if (test.status === "scheduled") return "Scheduled";
  if (test.status === "closed") return "Closed";
  return "Not started";
}

export default function TestList({ rows, classNameById, onStart, onViewResult }: TestListProps) {
  if (rows.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cream">
          <IconClipboard className="h-6 w-6 text-ink-faint" />
        </div>
        <p className="text-sm font-semibold text-ink">No tests yet</p>
        <p className="mt-1 text-xs text-ink-faint">Your teacher hasn{"’"}t assigned any tests yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ test, attempt }) => {
        const avail = availability(test, attempt);
        return (
          <Card key={test.id} className="hover:border-line transition-colors duration-150">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-base font-semibold text-ink">{test.title}</p>
                  <Badge variant={statusBadgeVariant(test, attempt)}>
                    {statusBadgeLabel(test, attempt)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">{classNameById.get(test.class_id) ?? ""}</p>
                {attempt?.status === "graded" ? (
                  <p className="mt-1 font-hand -rotate-2 text-2xl font-bold text-pen">
                    {attempt.total_marks}/{attempt.max_marks}
                  </p>
                ) : null}
                {avail.kind === "not_available" && avail.label ? (
                  <p className="mt-1 text-xs text-ink-soft">{avail.label}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {(() => {
                  switch (avail.kind) {
                    case "start":
                      return (
                        <button className={btnPrimary} type="button" onClick={() => onStart(test.id)}>
                          Start test
                        </button>
                      );
                    case "resume":
                      return (
                        <button className={btnPrimary} type="button" onClick={() => onStart(test.id)}>
                          Resume
                        </button>
                      );
                    case "view_result":
                      return attempt ? (
                        <button className={btnSecondary} type="button" onClick={() => onViewResult(attempt.id)}>
                          View result
                        </button>
                      ) : null;
                    case "awaiting_grade":
                      return <span className="text-xs text-ink-faint self-center">Awaiting grade</span>;
                    case "not_available":
                      return (
                        <button className={btnSecondary} type="button" disabled>
                          {avail.label || "Not available"}
                        </button>
                      );
                    default:
                      return null;
                  }
                })()}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
