"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSiteSettings } from "@/lib/useSiteSettings";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";

type Branch = { id: number; name: string; address: string | null; phone: string | null; city: string | null };

export default function Footer({ onTrack }: { onTrack?: () => void }) {
  const site = useSiteSettings();
  const year = new Date().getFullYear();
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    axios.get<Branch[]>(`${API}/public/branches`).then((r) => setBranches(r.data)).catch(() => setBranches([]));
  }, []);

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
    <footer className="mt-16 border-t border-[#E8DFD0] bg-white relative">
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${site.primaryColor}, ${site.secondaryColor}, ${site.primaryColor})` }}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            {site.logoUrl ? (
              <img src={site.logoUrl} alt={site.brandName} className="h-9 w-auto object-contain" />
            ) : (
              <span className="text-xl font-extrabold text-[#1A1613]">{site.brandName}</span>
            )}
          </div>
          <p className="text-xs text-[#6B6259] leading-relaxed max-w-60">
            Fresh food, delivered fast. Order online or track your delivery in real time.
          </p>
          {onTrack && (
            <button
              onClick={onTrack}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95"
              style={{ background: site.secondaryColor, color: site.primaryColor }}
            >
              📦 Track your order
            </button>
          )}
          <div className="flex items-center gap-2.5 mt-5">
            {[
              { label: "Facebook", icon: "f" },
              { label: "Instagram", icon: "◎" },
              { label: "WhatsApp", icon: "☏" },
            ].map((s, i) => (
              <span
                key={s.label}
                title={s.label}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default transition-all hover:scale-125 hover:-translate-y-1 hover:shadow-md animate-fade-in-up"
                style={{ background: site.secondaryColor, color: site.primaryColor, animationDelay: `${i * 0.08}s` }}
              >
                {s.icon}
              </span>
            ))}
          </div>
        </div>

        {branches.length > 0 && (
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 animate-fade-in-up stagger-1">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#1A1613] mb-3">Our Locations</h4>
            <ul className="space-y-3.5">
              {branches.map((b) => (
                <li key={b.id} className="text-sm text-[#6B6259]">
                  <p className="font-semibold text-[#1A1613]">{b.name}</p>
                  {b.address && <p className="text-xs mt-0.5">📍 {b.address}{b.city ? `, ${b.city}` : ""}</p>}
                  {b.phone && (
                    <a href={`tel:${b.phone}`} className="text-xs mt-0.5 inline-block hover-underline" style={{ color: site.primaryColor }}>
                      ☎ {b.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {linkCols.map((col, ci) => (
          <div key={col.title} className="animate-fade-in-up" style={{ animationDelay: `${(ci + 2) * 0.08}s` }}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#1A1613] mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm text-[#6B6259] hover-underline transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="animate-fade-in-up stagger-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#1A1613] mb-3">Need Help?</h4>
          <p className="text-sm text-[#6B6259]">Have a question about an order, refund, or delivery?</p>
          <a href="/contact" className="inline-block mt-2 text-sm font-semibold hover-underline" style={{ color: site.primaryColor }}>
            Contact support →
          </a>
          <div className="flex items-center gap-2 mt-5">
            {["Cash", "Card", "Online"].map((m, i) => (
              <span key={m} className="text-[10px] font-semibold px-2 py-1 rounded-md border border-[#E8DFD0] text-[#8A8074] transition-all hover:scale-110 hover:shadow-sm animate-fade-in-up" style={{ animationDelay: `${0.4 + i * 0.06}s` }}>
                {m}
              </span>
            ))}
          </div>
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
