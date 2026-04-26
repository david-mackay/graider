"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getResumeStep, getVault } from "@/lib/onboarding/vault";

/**
 * Client-only side effect: if a returning visitor has an in-progress vault,
 * push them to the resume step. Renders nothing.
 */
export default function VaultResumeGate() {
  const router = useRouter();

  useEffect(() => {
    const vault = getVault();
    if (!vault) return;
    const step = getResumeStep(vault);
    // "hook" is the entry point — no point redirecting to it from `/`.
    // "completed" means they've already synced; let them stay on the marketing page.
    if (step === "hook" || step === "completed") return;
    router.push(`/onboarding/${step}`);
  }, [router]);

  return null;
}
