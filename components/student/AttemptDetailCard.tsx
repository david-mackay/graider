import { Badge, Card, btnSecondary } from "@/components/shared/ui";
import type { GradedAttemptDetail } from "@/lib/dashboard-types";

type AttemptDetailCardProps = {
  attempt: GradedAttemptDetail;
  onClose: () => void;
};

export default function AttemptDetailCard({ attempt, onClose }: AttemptDetailCardProps) {
  return (
    <Card className="border-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold text-ink">{attempt.test_title}</h3>
            <Badge variant={attempt.status === "graded" ? "green" : "blue"}>{attempt.status}</Badge>
          </div>
          {attempt.status === "graded" ? (
            <p className="mt-2 font-hand -rotate-2 text-3xl font-bold text-pen">
              {attempt.total_marks}/{attempt.max_marks}
            </p>
          ) : (
            <p className="mt-1 text-sm text-marigold-deep">Results not yet released.</p>
          )}
        </div>
        <button type="button" className={btnSecondary} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-4 space-y-3 border-t border-line-soft pt-4">
        <p className="text-sm font-semibold text-ink">Question breakdown</p>
        {attempt.questions.map((question, index) => (
          <div key={question.question_id} className="rounded-lg border border-line-soft bg-cream p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink-faint">
                Q{index + 1} · {question.marks} mark{question.marks !== 1 ? "s" : ""}
              </p>
              {question.marks_earned != null ? (
                <span
                  className={`text-sm font-bold ${
                    question.marks_earned === question.marks
                      ? "text-moss"
                      : question.marks_earned > 0
                        ? "text-marigold"
                        : "text-pen"
                  }`}
                >
                  {question.marks_earned}/{question.marks}
                </span>
              ) : (
                <span className="text-sm text-ink-faint">—</span>
              )}
            </div>
            <p className="mt-1.5 text-sm font-medium text-ink">{question.prompt}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Your answer</p>
            <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line-soft bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
              {question.student_answer || "No answer provided."}
            </pre>
            {question.feedback ? (
              <p className="mt-3 border-l-2 border-pen-soft pl-3 font-hand text-lg leading-snug text-pen-deep">
                {question.feedback}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
