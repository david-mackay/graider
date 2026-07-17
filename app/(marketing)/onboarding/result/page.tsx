"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import SocialProofCard from "@/components/marketing/SocialProofCard";
import GradedQuestionBreakdown from "@/components/shared/GradedQuestionBreakdown";
import { Card, btnPrimary } from "@/components/shared/ui";
import { getVault } from "@/lib/onboarding/vault";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";
import {
  normalizeStudents,
  onboardingGradeQuestions,
  type GradedOnboardingStudent,
} from "@/lib/onboarding/types";

export default function OnboardingResultPage() {
  const router = useRouter();
  const [students, setStudents] = useState<GradedOnboardingStudent[] | null>(null);

  // Hydrate from vault on mount. Calling setState here is the intent — we're
  // synchronizing local component state with localStorage.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.FIRST_GRADE_RENDERED);
    const vault = getVault();
    if (!vault) {
      router.replace("/onboarding/hook");
      return;
    }
    const graded = normalizeStudents(vault);
    if (graded.length === 0) {
      router.replace("/onboarding/upload");
      return;
    }
    setStudents(graded);
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!students) {
    return (
      <OnboardingShell step={5} backHref="/onboarding/upload">
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pen border-t-transparent" />
        </div>
      </OnboardingShell>
    );
  }

  const totalEarned = students.reduce((sum, s) => sum + s.grade.marksEarned, 0);
  const totalMax = students.reduce((sum, s) => sum + s.grade.maxMarks, 0);

  return (
    <OnboardingShell step={5} backHref="/onboarding/upload" backLabel="Edit class">
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">Marked and handed back</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your class, graded
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          {students.length} student{students.length === 1 ? "" : "s"} · {totalEarned}/{totalMax} marks
          total
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {students.map((s) => (
          <Card key={s.id} className="animate-rise">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-ink">{s.name}</p>
              <p className="font-hand text-2xl font-bold text-pen">
                {s.grade.marksEarned}/{s.grade.maxMarks}
              </p>
            </div>
            <GradedQuestionBreakdown questions={onboardingGradeQuestions(s.grade)} />
          </Card>
        ))}

        <SocialProofCard />

        <div className="text-center">
          <Link
            href="/onboarding/save"
            className={`${btnPrimary} w-full justify-center py-3 sm:w-auto`}
          >
            Save my class
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
}
