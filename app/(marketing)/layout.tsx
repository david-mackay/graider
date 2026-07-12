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
    </>
  );
}
