"use client";
import { useSiteSettings } from "@/lib/useSiteSettings";
import StaticPageShell from "@/components/website/StaticPageShell";

export default function TermsPage() {
  const site = useSiteSettings();

  return (
    <StaticPageShell title="Terms & Conditions">
      <p>
        These Terms & Conditions govern your use of the {site.brandName} website and ordering
        service. By placing an order with us, you agree to the terms below.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Orders</h3>
      <p>
        All orders are subject to availability. We reserve the right to refuse or cancel any order,
        including in cases of pricing errors, suspected fraud, or item unavailability — you will be
        notified and refunded in full for any cancelled order.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Pricing & Payment</h3>
      <p>
        Menu prices, delivery fees, and applicable taxes are displayed at checkout before you confirm
        your order. Payment can be made via cash on delivery or online payment where available.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Delivery</h3>
      <p>
        Estimated delivery/preparation times are approximate and may vary due to weather, traffic, or
        order volume. We aim to notify you of any significant delays.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Vouchers & Promotions</h3>
      <p>
        Discount codes and promotional offers are subject to the minimum order amount, expiry date,
        and usage limits shown at the time of use, and cannot be combined unless stated otherwise.
      </p>

      <h3 className="font-semibold text-[#1A1613] text-base pt-2">Changes</h3>
      <p>
        We may update these terms from time to time. Continued use of our ordering service after
        changes are posted constitutes acceptance of the revised terms.
      </p>
    </StaticPageShell>
  );
}
