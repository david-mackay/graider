import { Card } from "@/components/shared/ui";

type Testimonial = {
  username: string;
  quote: string;
  accent: string; // tailwind bg gradient
};

const TESTIMONIALS: Testimonial[] = [
  {
    username: "mr.barker",
    quote:
      "I used to grade until midnight Sunday. Now I'm done before my kids' bedtime.",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    username: "dmc_teaches",
    quote:
      "the OCR caught a 'mitochondria' that I had as 'mitochondira' on the answer key. embarrassing for me, lifesaver.",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    username: "lina.j",
    quote: "30 students, 1 photo each, 12 minutes total. it's wild.",
    accent: "from-violet-500 to-fuchsia-500",
  },
];

export default function SocialProofCard() {
  return (
    <Card className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
        Teachers using grAIder
      </p>
      <ul className="space-y-5">
        {TESTIMONIALS.map((t) => (
          <li key={t.username} className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.accent} text-sm font-bold text-white shadow-sm`}
              aria-hidden="true"
            >
              {t.username.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-400">
                @{t.username}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-indigo-950">
                &ldquo;{t.quote}&rdquo;
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
