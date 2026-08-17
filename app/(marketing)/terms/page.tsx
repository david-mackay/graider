import type { Metadata } from "next";
import LegalDoc, { LegalSection } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Use — Graider",
  description: "Terms of Use for Graider, including accounts, grading, and Pro subscriptions.",
};

const SUPPORT_EMAIL = "davidmackay808@gmail.com";
const APPLE_EULA = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export default function TermsPage() {
  return (
    <LegalDoc eyebrow="Legal" title="Terms of Use">
      <p className="text-sm text-ink-faint">Last updated: August 17, 2026</p>

      <p>
        These terms govern your use of Graider, operated by David Mackay. By creating an account or
        using the app, you agree to them. If you do not agree, do not use Graider.
      </p>

      <LegalSection title="The service">
        <p>
          Graider helps teachers photograph handwritten tests and exams, mark them against the
          teacher&apos;s own answer key and rubric, and share results. You are responsible for the
          assessments you upload and for using student work in line with your school&apos;s policies.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You must provide accurate sign-in details and keep your account secure. You can delete your
          account in the app (Account → Delete account). Deletion removes associated Graider data from
          our systems, subject to limited backup or legal retention.
        </p>
      </LegalSection>

      <LegalSection title="Subscriptions">
        <p>
          Graider Pro is an auto-renewable subscription. Free accounts include one class and three
          tests graded per calendar month. Pro unlocks unlimited classes and tests graded while the
          subscription is active.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Monthly Pro: $24.99 USD per month</li>
          <li>Annual Pro: $239.99 USD per year</li>
        </ul>
        <p>
          Payment is charged to your Apple ID (iOS) or the payment method used on the web (Stripe via
          RevenueCat). Subscriptions renew automatically unless you cancel at least 24 hours before
          the end of the current period. On iOS, manage or cancel in Apple ID Settings → Subscriptions.
          On the web, use Billing → Manage subscription. Unused free tests do not roll over.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          Do not use Graider to harm students, violate school or privacy law, attempt to access other
          users&apos; data, or overload or reverse-engineer the service. We may suspend accounts that
          abuse the product.
        </p>
      </LegalSection>

      <LegalSection title="AI grading">
        <p>
          Marks and feedback are generated from the key and rubric you provide. You remain responsible
          for reviewing results before you release them to students. Graider does not guarantee that
          every mark is correct.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer">
        <p>
          Graider is provided as-is. To the extent allowed by law, we are not liable for lost data,
          grading disputes, or school policy issues arising from your use of the service.
        </p>
      </LegalSection>

      <LegalSection title="Other terms">
        <p>
          Purchases on the iOS App Store are also governed by{" "}
          <a className="font-semibold text-pen underline" href={APPLE_EULA}>
            Apple&apos;s Licensed Application End User License Agreement
          </a>
          .
        </p>
        <p>
          Privacy:{" "}
          <a className="font-semibold text-pen underline" href="/privacy">
            graider.vercel.app/privacy
          </a>
        </p>
        <p>
          Questions:{" "}
          <a className="font-semibold text-pen underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
