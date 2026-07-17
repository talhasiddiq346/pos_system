"use client";
import { useSiteSettings } from "@/lib/useSiteSettings";

export default function Footer({ onTrack }: { onTrack?: () => void }) {
  const site = useSiteSettings();
  const year = new Date().getFullYear();

  const linkCols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "FAQs", href: "/faq" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms & Conditions", href: "/terms" },
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Refund Policy", href: "/refund-policy" },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-[#E8DFD0] bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            {site.logoUrl ? (
              <img src={site.logoUrl} alt={site.brandName} className="h-9 w-auto object-contain" />
            ) : (
              <span className="text-xl font-extrabold text-[#1A1613]">{site.brandName}</span>
            )}
          </div>
          <p className="text-xs text-[#6B6259] leading-relaxed max-w-[220px]">
            Fresh food, delivered fast. Order online or track your delivery in real time.
          </p>
          {onTrack && (
            <button
              onClick={onTrack}
              className="mt-3 text-xs font-semibold hover:underline"
              style={{ color: site.primaryColor }}
            >
              📦 Track your order →
            </button>
          )}
          <div className="flex items-center gap-2.5 mt-4">
            {[
              { label: "Facebook", icon: "f" },
              { label: "Instagram", icon: "◎" },
              { label: "WhatsApp", icon: "☏" },
            ].map((s) => (
              <span
                key={s.label}
                title={s.label}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default"
                style={{ background: site.secondaryColor, color: site.primaryColor }}
              >
                {s.icon}
              </span>
            ))}
          </div>
        </div>

        {linkCols.map((col) => (
          <div key={col.title}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#1A1613] mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm text-[#6B6259] hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#1A1613] mb-3">Need Help?</h4>
          <p className="text-sm text-[#6B6259]">Have a question about an order, refund, or delivery?</p>
          <a href="/contact" className="inline-block mt-2 text-sm font-semibold hover:underline" style={{ color: site.primaryColor }}>
            Contact support →
          </a>
        </div>
      </div>

      <div className="border-t border-[#F0EAE0]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#8A8074]">
          <p>© {year} {site.brandName}. All rights reserved.</p>
          <p>Cash on delivery &amp; online payments accepted</p>
        </div>
      </div>
    </footer>
  );
}
