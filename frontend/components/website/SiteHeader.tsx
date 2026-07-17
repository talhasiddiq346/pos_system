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
    <header className="sticky top-0 z-30 bg-white border-b border-[#E8DFD0] shadow-sm">
      <div className={`${maxWidth} mx-auto px-3 md:px-6 h-20 flex items-center justify-between gap-2 relative`}>
        <div className="flex items-center gap-2 min-w-0">{left}</div>

        <div className="absolute left-1/2 -translate-x-1/2">
          {logoUrl ? (
            <div className="h-16 py-1.5 flex items-center justify-center overflow-hidden">
              <img src={logoUrl} alt={brandName} className="h-full w-auto object-contain" />
            </div>
          ) : (
            <span className="text-2xl font-extrabold text-[#1A1613] whitespace-nowrap tracking-tight">{brandName}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 min-w-0 justify-end">{right}</div>
      </div>
    </header>
  );
}
