type BrandMarkProps = { className?: string };

/** A sheet of paper carrying a hand-drawn red check — the graider mark. */
export function BrandMark({ className = "h-8 w-8" }: BrandMarkProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-[26%] border border-line bg-paper shadow-paper ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[62%] w-[62%] -rotate-6">
        <path
          d="M4.5 13.5 C 7 16.5, 8.5 18.5, 9.5 19.5 C 12 14, 15.5 8.5, 20 4.5"
          stroke="var(--color-pen)"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

type WordmarkProps = { className?: string };

export function Wordmark({ className = "text-xl" }: WordmarkProps) {
  return (
    <span className={`font-display font-semibold tracking-tight text-ink ${className}`}>
      gr<em className="not-italic font-bold text-pen">ai</em>der
    </span>
  );
}
