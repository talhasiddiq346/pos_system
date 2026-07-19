"use client";
import type { ReactNode } from "react";
import { useSiteSettings } from "@/lib/useSiteSettings";

export default function SiteHeader({
  left,
  right,
  maxWidth = "max-w-7xl",
}: {
  left?: ReactNode;
  right?: ReactNode;
  maxWidth?: string;
}) {
  const { brandName, logoUrl } = useSiteSettings();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E8DFD0] shadow-sm animate-fade-in-down">
      <div className={`${maxWidth} mx-auto px-3 md:px-6 h-28 flex items-center justify-between gap-2 relative`}>
        <div className="flex items-center gap-2 min-w-0">{left}</div>

        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 transition-transform hover:scale-105">
          {logoUrl ? (
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 shadow-md" style={{ borderColor: "#E8DFD0" }}>
              <img src={logoUrl} alt={brandName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <span className="text-3xl font-extrabold text-[#1A1613] whitespace-nowrap tracking-tight">{brandName}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 min-w-0 justify-end">{right}</div>
      </div>
    </header>
  );
}
