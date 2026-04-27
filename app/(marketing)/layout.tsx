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
              className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors duration-150"
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
