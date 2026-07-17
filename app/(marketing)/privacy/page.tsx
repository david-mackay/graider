import type { Metadata } from "next";
import LegalDoc, { LegalSection } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy — Graider",
  description: "How Graider collects, uses, and stores teacher and student grading data.",
};

const SUPPORT_EMAIL = "davidmackay808@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalDoc eyebrow="Legal" title="Privacy Policy">
      <p className="text-sm text-ink-faint">Last updated: July 17, 2026</p>

      <p>
        Graider (“we”, “us”) helps teachers photograph and grade handwritten papers. This policy
        explains what we collect, why we collect it, and the choices you have. Graider is operated
        by David Mackay.
      </p>

      <LegalSection title="Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink">Account data</span> — name and email from your
            sign-in provider (email, Google, or Apple) via Clerk.
          </li>
          <li>
            <span className="font-semibold text-ink">Class and grading data</span> — classes, tests,
            answer keys, rosters, paper photos you upload, OCR text, marks, and feedback.
          </li>
          <li>
            <span className="font-semibold text-ink">Device data</span> — optional push notification
            tokens so we can alert you when a grading job finishes.
          </li>
          <li>
            <span className="font-semibold text-ink">Subscription data</span> — purchase status from
            Apple / Google via RevenueCat (we do not store your full payment card details).
          </li>
          <li>
            <span className="font-semibold text-ink">Usage and diagnostics</span> — basic logs needed
            to run the service and fix errors (for example API failures).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide grading, class management, and result sharing features you request.</li>
          <li>
            Process paper images and text with AI models solely to produce marks and feedback
            against the answer key and rubric you supply.
          </li>
          <li>Authenticate you, secure the service, and prevent abuse.</li>
          <li>Send optional push notifications about grading progress.</li>
          <li>Manage subscriptions and respond to support requests.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Sharing">
        <p>We share data only with processors who help us run Graider, including:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Clerk (authentication)</li>
          <li>Hosting and database providers for the app and API</li>
          <li>AI model providers used to grade papers you submit</li>
          <li>RevenueCat and Apple / Google for in-app purchases</li>
          <li>Expo for push delivery when you enable notifications</li>
        </ul>
        <p>
          We do not sell your personal information. We do not use student papers for advertising.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>
          We keep account and grading data while your account is active. You can delete your account
          in the app (Account → Delete account), which removes associated Graider data from our
          systems. Some backup or legal logs may persist for a limited time.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Graider is designed for teachers. Student work may be uploaded by teachers; we do not
          knowingly market the service to children under 13. Teachers are responsible for using the
          product in line with their school’s policies.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Update profile details through your sign-in provider or in-app account settings.</li>
          <li>Turn off push notifications in system settings.</li>
          <li>Delete your account and data from Account settings.</li>
          <li>
            Contact us at{" "}
            <a className="font-semibold text-pen underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            for privacy questions.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update this policy as Graider evolves. We will post the new date at the top of this
          page. Continued use after changes means you accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Privacy questions:{" "}
          <a className="font-semibold text-pen underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p>
          Support:{" "}
          <a className="font-semibold text-pen underline" href="/support">
            graider.vercel.app/support
          </a>
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
