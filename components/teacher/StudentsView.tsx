import { Badge, Card, SectionHeader, btnSecondary } from "@/components/shared/ui";
import { IconUsers } from "@/components/shared/icons";
import type { ClassMember, DashboardAttempt } from "@/lib/dashboard-types";

type StudentsViewProps = {
  classId: string | null;
  className: string | null;
  members: ClassMember[];
  attemptsInScope: DashboardAttempt[];
  onGoToClasses: () => void;
};

export default function StudentsView({
  classId,
  className,
  members,
  attemptsInScope,
  onGoToClasses,
}: StudentsViewProps) {
  const teachers = members.filter((m) => m.role === "teacher");
  const students = members.filter((m) => m.role === "student");

  const attemptsByStudent = new Map<string, { submitted: number; graded: number; totalScore: number; maxScore: number }>();
  for (const a of attemptsInScope) {
    const existing = attemptsByStudent.get(a.student_id) ?? { submitted: 0, graded: 0, totalScore: 0, maxScore: 0 };
    existing.submitted += 1;
    if (a.status === "graded") {
      existing.graded += 1;
      existing.totalScore += a.total_marks ?? 0;
      existing.maxScore += a.max_marks ?? 0;
    }
    attemptsByStudent.set(a.student_id, existing);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Students"
        subtitle={
          className
            ? `${className} · ${students.length} student${students.length !== 1 ? "s" : ""}`
            : "Open a class to view its members."
        }
        action={
          classId ? (
            <button className={btnSecondary} type="button" onClick={onGoToClasses}>
              Manage invite codes
            </button>
          ) : undefined
        }
      />

      {!classId ? (
        <Card className="text-center py-10">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cream">
            <IconUsers className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="text-sm font-semibold text-ink">No class selected</p>
          <p className="mt-1 text-xs text-ink-faint">Open a class first to view its students.</p>
          <button type="button" className={`${btnSecondary} mt-4`} onClick={onGoToClasses}>
            Go to Classes
          </button>
        </Card>
      ) : members.length === 0 ? (
        <Card className="text-center py-10">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cream">
            <IconUsers className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="text-sm font-semibold text-ink">No members yet</p>
          <p className="mt-1 text-xs text-ink-faint">Share an invite code with your students to get started.</p>
          <button type="button" className={`${btnSecondary} mt-4`} onClick={onGoToClasses}>
            Get invite code
          </button>
        </Card>
      ) : (
        <div className="space-y-5">
          {teachers.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Teachers</h3>
              <div className="space-y-2">
                {teachers.map((member) => (
                  <Card key={member.user_id} className="hover:border-line transition-colors duration-150">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-pen text-sm font-bold text-white">
                        {(member.full_name ?? member.email ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{member.full_name ?? "Unnamed"}</p>
                        <p className="text-xs text-ink-faint truncate">{member.email ?? "No email"}</p>
                      </div>
                      {member.status === "pending" ? <Badge variant="yellow">Pending</Badge> : null}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Students · {students.length}
            </h3>
            {students.length === 0 ? (
              <Card className="text-center py-6">
                <p className="text-sm text-ink-soft">No students enrolled yet.</p>
                <button type="button" className={`${btnSecondary} mt-3`} onClick={onGoToClasses}>
                  Share invite code
                </button>
              </Card>
            ) : (
              <div className="space-y-2">
                {students.map((member) => {
                  const stats = attemptsByStudent.get(member.user_id);
                  return (
                    <Card key={member.user_id} className="hover:border-line transition-colors duration-150">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-cream-deep text-sm font-bold text-pen-deep">
                          {(member.full_name ?? member.email ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-ink truncate">{member.full_name ?? "Unnamed"}</p>
                            {member.status === "pending" ? <Badge variant="yellow">Pending</Badge> : null}
                          </div>
                          <p className="text-xs text-ink-faint truncate">{member.email ?? "No email"}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {stats ? (
                            <>
                              <p className="text-xs font-semibold text-ink">
                                {stats.graded > 0 ? (
                                  <span>
                                    <span className="text-pen">{stats.totalScore}</span>
                                    <span className="text-ink-faint">/{stats.maxScore}</span>
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </p>
                              <p className="text-xs text-ink-faint">{stats.submitted} submission{stats.submitted !== 1 ? "s" : ""}</p>
                            </>
                          ) : (
                            <p className="text-xs text-ink-faint">No submissions</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
