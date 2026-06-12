import { SignInButton } from "@clerk/nextjs";
import AppHeader from "@/components/shared/AppHeader";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader
        href="/"
        variant="translucent"
        rightSlot={
          <SignInButton mode="modal">
            <button
              type="button"
              className="cursor-pointer rounded-full bg-pen px-5 py-2 text-sm font-bold text-white shadow-paper transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
            >
              Sign in
            </button>
          </SignInButton>
        }
      />
      <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
    </>
  );
}
