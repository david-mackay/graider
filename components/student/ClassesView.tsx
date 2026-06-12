"use client";

import { FormEvent } from "react";
import { Card, FormField, SectionHeader, btnPrimary, inputClass } from "@/components/shared/ui";
import { IconHome } from "@/components/shared/icons";
import type { DashboardAttempt, DashboardClass, DashboardTest } from "@/lib/dashboard-types";

type StudentClassesViewProps = {
  classes: DashboardClass[];
  tests: DashboardTest[];
  attempts: DashboardAttempt[];
  joinCode: string;
  setJoinCode: (value: string) => void;
  joinEmail: string;
  setJoinEmail: (value: string) => void;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
  onSelectClass: (classId: string) => void;
  isBusy: boolean;
};

export default function StudentClassesView({
  classes,
  tests,
  attempts,
  joinCode,
  setJoinCode,
  joinEmail,
  setJoinEmail,
  onJoin,
  onSelectClass,
  isBusy,
}: StudentClassesViewProps) {
  return (
    <>
      <SectionHeader title="My Classes" subtitle="Join a class using an invite code." />

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-ink">Join a class</h3>
        <form onSubmit={onJoin} className="space-y-3 sm:flex sm:items-end sm:gap-3 sm:space-y-0">
          <FormField label="Invite code">
            <input
              className={inputClass}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter code from your teacher"
              required
            />
          </FormField>
          <FormField label="Email (if required)">
            <input
              className={inputClass}
              value={joinEmail}
              onChange={(e) => setJoinEmail(e.target.value)}
              placeholder="your@email.com"
              type="email"
            />
          </FormField>
          <button disabled={isBusy} className={`${btnPrimary} flex-shrink-0`} type="submit">
            Join
          </button>
        </form>
      </Card>

      {classes.length === 0 ? (
        <Card className="text-center py-12">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cream">
            <IconHome className="h-6 w-6 text-ink-faint" />
          </div>
          <p className="text-sm font-semibold text-ink">No classes yet</p>
          <p className="mt-1 text-xs text-ink-faint">Ask your teacher for an invite code to get started.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Enrolled classes</h3>
          {classes.map((entry) => {
            const classTests = tests.filter((t) => t.class_id === entry.id);
            const classAttempts = attempts.filter((a) => a.test_class_id === entry.id);
            const gradedCount = classAttempts.filter((a) => a.status === "graded").length;
            return (
              <Card key={entry.id} className="hover:border-line transition-colors duration-150">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-ink">{entry.name}</h4>
                    <p className="mt-1 text-xs text-ink-faint">
                      {classTests.length} test{classTests.length !== 1 ? "s" : ""}
                      {gradedCount > 0 ? ` · ${gradedCount} graded` : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => onSelectClass(entry.id)} className={btnPrimary}>
                    View tests
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
