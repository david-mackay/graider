export type GradedQuestionRow = {
  prompt: string;
  studentAnswer: string;
  feedback?: string;
  marksEarned: number;
  maxMarks: number;
};

type GradedQuestionBreakdownProps = {
  questions: GradedQuestionRow[];
};

/** Per-question prompt / student answer / feedback — same pattern as teacher attempt detail. */
export default function GradedQuestionBreakdown({ questions }: GradedQuestionBreakdownProps) {
  if (questions.length === 0) return null;

  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <div
          key={`${index}-${question.prompt.slice(0, 24)}`}
          className="rounded-lg border border-line-soft bg-cream p-4 text-left"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-faint">
              Q{index + 1} · {question.maxMarks} mark{question.maxMarks !== 1 ? "s" : ""}
            </p>
            <span
              className={`text-sm font-bold ${
                question.marksEarned === question.maxMarks
                  ? "text-moss"
                  : question.marksEarned > 0
                    ? "text-marigold"
                    : "text-pen"
              }`}
            >
              {question.marksEarned}/{question.maxMarks}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-ink">{question.prompt}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Student answer
          </p>
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line-soft bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
            {question.studentAnswer.trim() || "No answer provided."}
          </pre>
          {question.feedback?.trim() ? (
            <p className="mt-3 border-l-2 border-pen-soft pl-3 font-hand text-lg leading-snug text-pen-deep">
              {question.feedback}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
