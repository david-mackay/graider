type BadgeProps = { children: React.ReactNode; variant?: "blue" | "green" | "gray" | "yellow" };

export function Badge({ children, variant = "blue" }: BadgeProps) {
  const colors = {
    blue: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    gray: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    yellow: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

type SectionHeaderProps = { title: string; subtitle?: string; action?: React.ReactNode };

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-indigo-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

type CardProps = { children: React.ReactNode; className?: string };

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-xl border border-indigo-100 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

type FormFieldProps = { label: string; children: React.ReactNode; hint?: string };

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-indigo-200 bg-white px-3 py-2.5 text-sm text-indigo-950 placeholder-slate-400 outline-none transition duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export const btnPrimary =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

export const btnDanger =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors duration-150 disabled:opacity-50";
