"use client";
import { useState } from "react";
import { useSiteSettings } from "@/lib/useSiteSettings";
import StaticPageShell from "@/components/website/StaticPageShell";

const FAQS = [
  {
    q: "How do I track my order?",
    a: "Use the \"Track order\" link in the header or footer and enter your order code — you'll see live status updates from preparation to delivery.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept cash on delivery and online payment where available, shown as options at checkout.",
  },
  {
    q: "Can I apply a discount code?",
    a: "Yes — enter your voucher code at checkout. It will be validated and the discount applied automatically if it's active and you meet the minimum order amount.",
  },
  {
    q: "How long does delivery take?",
    a: "Estimated delivery/pickup time is shown at checkout and after placing your order. It can vary based on your location and order volume.",
  },
  {
    q: "What if something is wrong with my order?",
    a: "Contact us within 24 hours with your order code — see our Refund Policy for details on replacements and refunds.",
  },
];

export default function FaqPage() {
  const site = useSiteSettings();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <StaticPageShell title="Frequently Asked Questions">
      <div className="not-prose space-y-2">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q} className="bg-white border border-[#E8DFD0] rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-semibold text-sm text-[#1A1613]">{item.q}</span>
                <span style={{ color: site.primaryColor }}>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <p className="px-4 pb-3 text-sm text-[#6B6259] leading-relaxed">{item.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </StaticPageShell>
  );
}
