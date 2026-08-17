import type { Metadata } from "next";
import LegalDoc, { LegalSection } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Support — Graider",
  description: "Get help with Graider grading, account, and billing questions.",
};

const SUPPORT_EMAIL = "davidmackay808@gmail.com";

export default function SupportPage() {
  return (
    <LegalDoc eyebrow="Help" title="Support">
      <p>
        Need a hand with grading, your account, or something broken in the app? Email us and we will
        get back as soon as we can.
      </p>

      <LegalSection title="Email">
        <p>
          <a
            className="text-lg font-bold text-pen underline"
            href={`mailto:${SUPPORT_EMAIL}?subject=Graider%20support`}
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="text-sm text-ink-faint">
          Please include your account email, device (iPhone / Android / web), and a short description
          of what went wrong. Screenshots help.
        </p>
      </LegalSection>

      <LegalSection title="Common topics">
        <ul className="list-disc space-y-2 pl-5">
          <li>Sign-in with email, Google, or Apple</li>
          <li>Camera / photo upload for grading papers</li>
          <li>Answer keys, marks, and feedback that look wrong</li>
          <li>Saving an onboarding class to your account</li>
          <li>Subscriptions, restore purchases, and billing</li>
          <li>Deleting your account and data</li>
        </ul>
      </LegalSection>

      <LegalSection title="Legal">
        <p>
          <a className="font-semibold text-pen underline" href="/privacy">
            Privacy Policy
          </a>
          {" · "}
          <a className="font-semibold text-pen underline" href="/terms">
            Terms of Use
          </a>
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
