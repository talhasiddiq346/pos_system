"use client";
import { useSiteSettings } from "@/lib/useSiteSettings";
import StaticPageShell from "@/components/website/StaticPageShell";

export default function PrivacyPolicyPage() {
  const site = useSiteSettings();

  return (
    <StaticPageShell title="Privacy Policy">
      <p>
        {site.brandName} respects your privacy. This policy explains what information we collect when
        you order with us, and how it's used.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Information We Collect</h3>
      <p>
        When you place an order, we collect your name, phone number, delivery address, and — if you
        choose to provide it — your email address, so we can fulfil and confirm your order and keep
        you updated on its status.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">How We Use It</h3>
      <p>
        Your information is used solely to process your order, coordinate delivery or pickup, send
        order confirmations/updates (only if you provided an email), and improve our service. We do
        not sell your personal information to third parties.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Data Retention</h3>
      <p>
        Order records are retained for accounting and customer support purposes. You may contact us
        to request that your data be updated or removed, subject to any legal record-keeping
        requirements.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Contact</h3>
      <p>
        Questions about how your data is handled? Reach out via our{" "}
        <a href="/contact" className="underline font-medium">Contact page</a>.
      </p>
    </StaticPageShell>
  );
}
