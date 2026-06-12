import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/shared/Brand";

type AppHeaderProps = {
  href: string;
  rightSlot: React.ReactNode;
  variant?: "solid" | "translucent";
};

export default function AppHeader({ href, rightSlot, variant = "solid" }: AppHeaderProps) {
  const wrapperClass =
    variant === "translucent"
      ? "sticky top-0 z-40 bg-cream/75 backdrop-blur-md border-b border-line/60"
      : "sticky top-0 z-40 bg-paper/90 backdrop-blur-sm border-b border-line";

  return (
    <header className={wrapperClass}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href={href} className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-8" />
            <Wordmark className="text-xl" />
          </Link>
          <div className="flex items-center gap-3">{rightSlot}</div>
        </div>
      </div>
    </header>
  );
}
