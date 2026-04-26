import { Badge, Card, btnSecondary } from "@/components/shared/ui";
import type { GradedAttemptDetail } from "@/lib/dashboard-types";

type AttemptDetailCardProps = {
  attempt: GradedAttemptDetail;
  onClose: () => void;
};

export default function AttemptDetailCard({ attempt, onClose }: AttemptDetailCardProps) {
  return (
    <Card className="border-indigo-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-indigo-950">{attempt.test_title}</h3>
            <Badge variant={attempt.status === "graded" ? "green" : "blue"}>{attempt.status}</Badge>
          </div>
          {attempt.status === "graded" ? (
            <div className="mt-2 inline-flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-indigo-600">{attempt.total_marks}</span>
              <span className="text-sm font-medium text-slate-400">/ {attempt.max_marks}</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-amber-700">Results not yet released.</p>
          )}
        </div>
        <button type="button" className={btnSecondary} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-4 space-y-3 border-t border-indigo-100 pt-4">
        <p className="text-sm font-semibold text-indigo-950">Question breakdown</p>
        {attempt.questions.map((question, index) => (
          <div key={question.question_id} className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-indigo-400">
                Q{index + 1} · {question.marks} mark{question.marks !== 1 ? "s" : ""}
              </p>
              {question.marks_earned != null ? (
                <span
                  className={`text-sm font-bold ${
                    question.marks_earned === question.marks
                      ? "text-emerald-600"
                      : question.marks_earned > 0
                        ? "text-amber-600"
                        : "text-red-500"
                  }`}
                >
                  {question.marks_earned}/{question.marks}
                </span>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>
            <p className="mt-1.5 text-sm font-medium text-indigo-950">{question.prompt}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Your answer</p>
            <pre className="mt-1 whitespace-pre-wrap rounded-md border border-indigo-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700">
              {question.student_answer || "No answer provided."}
            </pre>
            {question.feedback ? (
              <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-xs text-emerald-800">
                  <span className="font-semibold">Feedback:</span> {question.feedback}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
