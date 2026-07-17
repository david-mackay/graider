import type { ReactNode } from "react";

/** Shared layout for public legal / help pages on the marketing site. */
export default function LegalDoc({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-pen">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <div className="prose-legal mt-8 space-y-6 text-base leading-relaxed text-ink-soft">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
