import Link from "next/link";
import AppHeader from "@/components/shared/AppHeader";
import ClerkSignInButton from "@/components/shared/ClerkSignInButton";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader
        href="/"
        variant="translucent"
        rightSlot={
          <ClerkSignInButton mode="modal">
            <button
              type="button"
              className="cursor-pointer rounded-full bg-pen px-5 py-2 text-sm font-bold text-white shadow-paper transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
            >
              Sign in
            </button>
          </ClerkSignInButton>
        }
      />
      <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
      <footer className="border-t border-line/70 bg-paper/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm text-ink-faint">Graider — for teachers who grade by hand</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink-soft">
            <Link href="/" className="hover:text-pen">
              Home
            </Link>
            <Link href="/support" className="hover:text-pen">
              Support
            </Link>
            <Link href="/privacy" className="hover:text-pen">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
