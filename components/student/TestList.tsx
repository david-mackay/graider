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

export default function TestList({ rows, classNameById, onStart, onViewResult }: TestListProps) {
  if (rows.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
          <IconClipboard className="h-6 w-6 text-indigo-400" />
        </div>
        <p className="text-sm font-semibold text-indigo-950">No tests yet</p>
        <p className="mt-1 text-xs text-slate-400">Your teacher hasn{"’"}t assigned any tests yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ test, attempt }) => (
        <Card key={test.id} className="hover:border-indigo-200 transition-colors duration-150">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-indigo-950">{test.title}</p>
                {attempt ? (
                  <Badge variant={attempt.status === "graded" ? "green" : "blue"}>{attempt.status}</Badge>
                ) : (
                  <Badge variant="gray">Not started</Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{classNameById.get(test.class_id) ?? ""}</p>
              {attempt?.status === "graded" ? (
                <div className="mt-1.5 inline-flex items-baseline gap-1">
                  <span className="text-lg font-bold text-indigo-600">{attempt.total_marks}</span>
                  <span className="text-xs text-slate-400">/ {attempt.max_marks}</span>
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              {!attempt ? (
                <button className={btnPrimary} type="button" onClick={() => onStart(test.id)}>
                  Start test
                </button>
              ) : attempt.status === "graded" ? (
                <button className={btnSecondary} type="button" onClick={() => onViewResult(attempt.id)}>
                  View result
                </button>
              ) : (
                <span className="text-xs text-slate-400 self-center">Awaiting grade</span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
