"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, FormField, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconClipboard } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import type { DashboardClass } from "@/lib/dashboard-types";
import type { TestSummary } from "@/lib/types";

type StepPickTestProps = {
  onSelect: (test: TestSummary) => void;
};

type GroupedTests = {
  classId: string;
  className: string;
  tests: TestSummary[];
};

export default function StepPickTest({ onSelect }: StepPickTestProps) {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [loadError, setLoadError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError("");
      try {
        const [testsPayload, classesPayload] = await Promise.all([
          handleJson<{ tests: TestSummary[] }>(
            await fetch("/api/tests", { cache: "no-store" }),
          ),
          handleJson<{ classes: DashboardClass[] }>(
            await fetch("/api/classes", { cache: "no-store" }),
          ),
        ]);
        if (cancelled) return;
        setTests(testsPayload.tests ?? []);
        setClasses(classesPayload.classes ?? []);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load tests.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped: GroupedTests[] = useMemo(() => {
    const classNameById = new Map(classes.map((c) => [c.id, c.name] as const));
    const filter = search.trim().toLowerCase();
    const map = new Map<string, GroupedTests>();
    for (const test of tests) {
      if (filter) {
        const className = classNameById.get(test.class_id) ?? "";
        const haystack = `${test.title} ${className}`.toLowerCase();
        if (!haystack.includes(filter)) continue;
      }
      const className = classNameById.get(test.class_id) ?? "Unknown class";
      const existing = map.get(test.class_id);
      if (existing) {
        existing.tests.push(test);
      } else {
        map.set(test.class_id, {
          classId: test.class_id,
          className,
          tests: [test],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [tests, classes, search]);

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pen border-t-transparent" />
        </div>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-pen-soft/60 bg-pen-wash">
        <p className="text-sm font-bold text-pen-deep">{loadError}</p>
      </Card>
    );
  }

  if (tests.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pen-wash">
            <IconClipboard className="h-7 w-7 text-pen" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">The desk is clear</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Create a class and a test first, then come back to grade a stack of papers.
            </p>
          </div>
          <Link href="/t" className={btnPrimary}>
            Go to dashboard
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <FormField label="Find a test" hint="Search by test or class name.">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Photosynthesis quiz"
            className={inputClass}
          />
        </FormField>
      </Card>

      {grouped.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft">No tests match &ldquo;{search}&rdquo;.</p>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.classId}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                {group.className}
              </h3>
              <span className="text-xs text-ink-faint">
                {group.tests.length} test{group.tests.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-line-soft">
              {group.tests.map((test) => (
                <li
                  key={test.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-semibold text-ink">
                      {test.title}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {test.grades_released ? "Grades released" : "Grades not yet released"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(test)}
                    className={btnPrimary}
                  >
                    Grade this test
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <div className="flex justify-end">
        <Link href="/t" className={btnSecondary}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
