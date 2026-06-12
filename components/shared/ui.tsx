type BadgeProps = { children: React.ReactNode; variant?: "blue" | "green" | "gray" | "yellow" };

/**
 * Variant names are legacy semantic slots:
 * blue = accent/active, green = done/graded, gray = neutral, yellow = attention.
 */
export function Badge({ children, variant = "blue" }: BadgeProps) {
  const colors = {
    blue: "bg-pen-wash text-pen-deep ring-1 ring-pen-soft/60",
    green: "bg-moss-wash text-moss-deep ring-1 ring-moss/30",
    gray: "bg-cream-deep/60 text-ink-soft ring-1 ring-line",
    yellow: "bg-marigold-wash text-marigold-deep ring-1 ring-marigold/30",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${colors[variant]}`}>
      {children}
    </span>
  );
}

type SectionHeaderProps = { title: string; subtitle?: string; action?: React.ReactNode; overline?: string };

export function SectionHeader({ title, subtitle, action, overline }: SectionHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        {overline ? (
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.18em] text-pen">{overline}</p>
        ) : null}
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">{subtitle}</p> : null}
      </div>
      {action ? <div className="pb-1">{action}</div> : null}
    </div>
  );
}

type CardProps = { children: React.ReactNode; className?: string };

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-2xl border border-line bg-paper p-5 shadow-paper ${className}`}>
      {children}
    </div>
  );
}

type FormFieldProps = { label: string; children: React.ReactNode; hint?: string };

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div>
        <label className="text-sm font-bold text-ink">{label}</label>
        {hint ? <p className="mt-0.5 text-xs text-ink-faint">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint outline-none transition duration-150 focus:border-pen/50 focus:ring-2 focus:ring-pen-wash";

export const btnPrimary =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-pen px-5 py-2.5 text-sm font-bold text-white shadow-paper transition-all duration-150 hover:bg-pen-deep active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

export const btnSecondary =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-bold text-ink shadow-paper transition-all duration-150 hover:border-ink-faint hover:bg-cream active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

export const btnDanger =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-pen-soft/60 bg-pen-wash px-4 py-2 text-sm font-bold text-pen-deep transition-all duration-150 hover:bg-pen-soft/40 active:scale-[0.97] disabled:opacity-50";
