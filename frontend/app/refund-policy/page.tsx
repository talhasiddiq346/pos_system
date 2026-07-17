"use client";
import { useSiteSettings } from "@/lib/useSiteSettings";
import StaticPageShell from "@/components/website/StaticPageShell";

export default function RefundPolicyPage() {
  const site = useSiteSettings();

  return (
    <StaticPageShell title="Refund Policy">
      <p>
        Because {site.brandName} prepares food fresh to order, refunds and cancellations are handled
        on a case-by-case basis as outlined below.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Cancellations</h3>
      <p>
        Orders can be cancelled free of charge before the branch begins preparing them. Once
        preparation has started, cancellations may not be possible — contact the branch directly as
        soon as possible using the number on your order confirmation.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Incorrect or Missing Items</h3>
      <p>
        If your order arrives incomplete, incorrect, or not as described, contact us within 24 hours
        with your order code and details (photos help). We'll arrange a replacement, store credit, or
        refund for the affected item(s).
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Quality Issues</h3>
      <p>
        If food quality doesn't meet expectations, let us know right away — we stand behind what we
        serve and will make it right.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Refund Method</h3>
      <p>
        Approved refunds are issued to the original payment method for online payments, or as store
        credit/cash adjustment for cash-on-delivery orders, typically within 3–7 business days.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">How to Request a Refund</h3>
      <p>
        Use your order code (from your confirmation or the order tracker) and reach out via our{" "}
        <a href="/contact" className="underline font-medium">Contact page</a>.
      </p>
    </StaticPageShell>
  );
}
