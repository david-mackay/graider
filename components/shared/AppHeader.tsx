import Link from "next/link";
import { IconSparkle } from "@/components/shared/icons";

type AppHeaderProps = {
  href: string;
  rightSlot: React.ReactNode;
  variant?: "solid" | "translucent";
};

export default function AppHeader({ href, rightSlot, variant = "solid" }: AppHeaderProps) {
  const wrapperClass =
    variant === "translucent"
      ? "sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-indigo-100/60"
      : "sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-indigo-100";

  return (
    <header className={wrapperClass}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href={href} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm shadow-indigo-200/60">
              <IconSparkle className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-indigo-950">
              gr<span className="text-indigo-600">AI</span>der
            </span>
          </Link>
          <div className="flex items-center gap-3">{rightSlot}</div>
        </div>
      </div>
    </header>
  );
}
