"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

type AuthMethodPanelProps = {
  /** Where to go after a successful session is created. */
  redirectTo: string;
  onStarted?: () => void;
  /** Primary CTA framing — onboarding uses "sign up", landing may say "sign in". */
  intent?: "sign-up" | "sign-in";
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.05-1.26 2.77-.94.8-2.01 1.23-3.05 1.16-.05-1.1.4-2.07 1.22-2.8.9-.84 2.03-1.3 3.09-1.13zm3.16 16.16c-.4.93-.87 1.78-1.42 2.56-.74 1.05-1.35 1.78-1.82 2.18-.73.65-1.51.99-2.34 1.01-.59 0-1.31-.17-2.14-.5-.84-.34-1.61-.5-2.32-.5-.74 0-1.53.16-2.38.5-.85.33-1.54.51-2.07.54-.8.05-1.6-.3-2.4-1.05-.51-.45-1.15-1.2-1.91-2.26C1.84 18.07 1 15.85 1 13.52c0-2.3.56-4.18 1.68-5.63 1.12-1.45 2.55-2.18 4.28-2.18.8 0 1.85.28 3.16.82 1.3.55 2.13.82 2.5.82.28 0 1.2-.32 2.75-.97 1.46-.6 2.7-.85 3.71-.74 2.75.22 4.82 1.56 6.2 4-2.47 1.5-2.08 5.4.8 6.55-.22.63-.47 1.23-.76 1.8z" />
    </svg>
  );
}

const btnBase =
  "flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border px-6 py-3.5 text-sm font-bold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

function clerkErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors) &&
    (err as { errors: { longMessage?: string; message?: string }[] }).errors[0]
  ) {
    const first = (err as { errors: { longMessage?: string; message?: string }[] }).errors[0];
    return first.longMessage || first.message || "Something went wrong. Try again.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Try again.";
}

export default function AuthMethodPanel({
  redirectTo,
  onStarted,
  intent = "sign-up",
}: AuthMethodPanelProps) {
  const router = useRouter();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();

  const [mode, setMode] = useState<"chooser" | "email" | "verify">("chooser");
  const [authMode, setAuthMode] = useState<"sign-up" | "sign-in">(
    intent === "sign-in" ? "sign-in" : "sign-up",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clerkReady = hasClerkPublishableKey() && signInLoaded && signUpLoaded;

  async function continueWithOAuth(strategy: "oauth_google" | "oauth_apple") {
    if (!signIn) return;
    onStarted?.();
    setError(null);
    setBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectTo,
      });
    } catch (err) {
      setError(clerkErrorMessage(err));
      setBusy(false);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || !signUp) return;
    onStarted?.();
    setError(null);
    setBusy(true);
    try {
      if (authMode === "sign-in") {
        const result = await signIn.create({ identifier: email.trim(), password });
        if (result.status === "complete" && result.createdSessionId) {
          await setActiveSignIn({ session: result.createdSessionId });
          router.replace(redirectTo);
          return;
        }
        setError("Could not finish signing in. Try Google or Apple instead.");
      } else {
        await signUp.create({ emailAddress: email.trim(), password });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setMode("verify");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError(null);
    setBusy(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === "complete" && result.createdSessionId) {
        await setActiveSignUp({ session: result.createdSessionId });
        router.replace(redirectTo);
        return;
      }
      setError("Verification incomplete. Check the code and try again.");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!hasClerkPublishableKey()) {
    return (
      <div className="space-y-3">
        <a
          href={`/sign-up?redirect_url=${encodeURIComponent(redirectTo)}`}
          className={`${btnBase} border-pen bg-pen text-white hover:bg-pen-deep`}
        >
          Continue with email
        </a>
        <p className="text-center text-xs text-ink-faint">
          Auth isn&rsquo;t configured in this environment.
        </p>
      </div>
    );
  }

  if (mode === "verify") {
    return (
      <form onSubmit={(e) => void submitCode(e)} className="space-y-3">
        <p className="text-sm text-ink-soft">
          Enter the code we sent to <span className="font-semibold text-ink">{email}</span>.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Verification code"
          className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base text-ink outline-none focus:border-pen"
          required
        />
        {error ? (
          <p role="alert" className="text-sm font-bold text-pen-deep">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !clerkReady}
          className={`${btnBase} border-pen bg-pen text-white hover:bg-pen-deep`}
        >
          {busy ? "Verifying…" : "Verify email"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("email");
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-xs font-bold text-ink-soft hover:text-pen"
        >
          Back
        </button>
      </form>
    );
  }

  if (mode === "email") {
    return (
      <form onSubmit={(e) => void submitEmail(e)} className="space-y-3">
        <div className="flex gap-2 rounded-full border border-line bg-cream p-1">
          <button
            type="button"
            onClick={() => setAuthMode("sign-up")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
              authMode === "sign-up" ? "bg-pen text-white" : "text-ink-soft"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("sign-in")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
              authMode === "sign-in" ? "bg-pen text-white" : "text-ink-soft"
            }`}
          >
            Sign in
          </button>
        </div>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base text-ink outline-none focus:border-pen"
          required
        />
        <input
          type="password"
          autoComplete={authMode === "sign-up" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base text-ink outline-none focus:border-pen"
          required
          minLength={8}
        />
        {error ? (
          <p role="alert" className="text-sm font-bold text-pen-deep">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !clerkReady}
          className={`${btnBase} border-pen bg-pen text-white hover:bg-pen-deep`}
        >
          {busy
            ? "Working…"
            : authMode === "sign-up"
              ? "Create account"
              : "Sign in with email"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("chooser");
            setError(null);
          }}
          className="w-full text-center text-xs font-bold text-ink-soft hover:text-pen"
        >
          Other ways to continue
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy || !clerkReady}
        onClick={() => void continueWithOAuth("oauth_google")}
        className={`${btnBase} border-line bg-paper text-ink hover:bg-cream`}
      >
        <GoogleIcon className="h-5 w-5" />
        Continue with Google
      </button>
      <button
        type="button"
        disabled={busy || !clerkReady}
        onClick={() => void continueWithOAuth("oauth_apple")}
        className={`${btnBase} border-ink bg-ink text-white hover:bg-ink/90`}
      >
        <AppleIcon className="h-5 w-5" />
        Continue with Apple
      </button>
      <button
        type="button"
        disabled={busy || !clerkReady}
        onClick={() => {
          setMode("email");
          setError(null);
        }}
        className={`${btnBase} border-pen bg-pen text-white hover:bg-pen-deep`}
      >
        Continue with email
      </button>
      {error ? (
        <p role="alert" className="text-center text-sm font-bold text-pen-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
