"use client";
import Link from "next/link";
import { useSiteSettings } from "@/lib/useSiteSettings";
import Footer from "./Footer";

export default function StaticPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const site = useSiteSettings();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: site.backgroundColor, fontFamily: "'DM Sans','Inter',-apple-system,sans-serif" }}>
      <header className="sticky top-0 z-30 bg-white border-b border-[#E8DFD0] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/order" className="text-sm font-semibold text-[#6B6259] hover:text-[#1A1613]">
            ← Back to menu
          </Link>
          {site.logoUrl ? (
            <img src={site.logoUrl} alt={site.brandName} className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-lg font-extrabold text-[#1A1613]">{site.brandName}</span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-10 w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-[#1A1613] mb-6">{title}</h1>
        <div className="prose-sm text-sm text-[#3D3833] leading-relaxed space-y-4">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
