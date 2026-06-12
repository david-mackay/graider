import { Card } from "@/components/shared/ui";

type Testimonial = {
  username: string;
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    username: "mr.barker",
    quote:
      "I used to grade until midnight Sunday. Now I'm done before my kids' bedtime.",
  },
  {
    username: "dmc_teaches",
    quote:
      "the OCR caught a 'mitochondria' that I had as 'mitochondira' on the answer key. embarrassing for me, lifesaver.",
  },
  {
    username: "lina.j",
    quote: "30 students, 1 photo each, 12 minutes total. it's wild.",
  },
];

export default function SocialProofCard() {
  return (
    <Card className="space-y-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
        Teachers using graider
      </p>
      <ul className="space-y-5">
        {TESTIMONIALS.map((t) => (
          <li key={t.username} className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-cream-deep font-display text-sm font-bold text-ink shadow-paper"
              aria-hidden="true"
            >
              {t.username.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink-faint">
                @{t.username}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink">
                &ldquo;{t.quote}&rdquo;
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
