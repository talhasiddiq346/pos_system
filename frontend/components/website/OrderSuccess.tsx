"use client";
import { useEffect } from "react";
import { useSiteSettings } from "@/lib/useSiteSettings";

export default function OrderSuccess({
  orderCode,
  total,
  onTrack,
  onNewOrder,
}: {
  orderCode: string;
  total: number;
  onTrack: () => void;
  onNewOrder: () => void;
}) {
  const site = useSiteSettings();
  const fmt = (n: number) => Math.round(n).toLocaleString();

  // Auto-copy order code option
  function copyCode() {
    navigator.clipboard?.writeText(orderCode).then(
      () => {}, // silent success
      () => {}
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{
        fontFamily: "'DM Sans','Inter',-apple-system,sans-serif",
        background: `linear-gradient(180deg, ${site.backgroundColor} 0%, #FAF8F5 100%)`,
      }}
    >
      {/* Decorative floating shapes */}
      <div className="absolute top-20 left-8 w-16 h-16 rounded-full blur-xl animate-float" style={{ background: `${site.secondaryColor}66` }} />
      <div className="absolute bottom-32 right-12 w-20 h-20 rounded-full blur-xl animate-float" style={{ background: `${site.primaryColor}33`, animationDelay: "1s" }} />
      <div className="absolute top-1/2 left-1/4 w-12 h-12 rounded-full blur-2xl animate-float" style={{ background: `${site.secondaryColor}44`, animationDelay: "2s" }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="relative animate-pop-in">
            <div className="absolute inset-0 rounded-full bg-[#16A34A] blur-2xl opacity-30 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-4 border-[#16A34A] animate-ring-pop" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#16A34A] to-[#0F7A3A] flex items-center justify-center shadow-2xl">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 48, animation: "drawCheck 0.6s 0.3s ease-out both" }} />
              </svg>
            </div>
          </div>
        </div>

        {/* Message card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 text-center border border-[#E8DFD0] animate-fade-in-up stagger-1">
          <h1 className="text-2xl md:text-3xl font-bold text-[#1A1613] mb-2">
            Order Placed! <span className="inline-block animate-wiggle">🎉</span>
          </h1>
          <p className="text-sm text-[#6B6259] leading-relaxed">
            Thank you for ordering from {site.brandName}.<br />
            Your food is being prepared fresh 🔥
          </p>

          {/* Order code card */}
          <button
            onClick={copyCode}
            className="mt-6 mx-auto w-full border-2 border-dashed rounded-2xl px-5 py-4 transition-all group hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up stagger-2"
            style={{ background: `${site.secondaryColor}33`, borderColor: `${site.primaryColor}66` }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[#6B6259] font-semibold mb-1">
              Order Code
            </p>
            <p className="text-2xl md:text-3xl font-bold font-mono tracking-wider transition-transform group-hover:scale-105" style={{ color: site.primaryColor }}>
              #{orderCode}
            </p>
            <p className="text-[10px] text-[#6B6259] mt-1.5">
              Tap to copy
            </p>
          </button>

          {/* Total */}
          <div className="mt-4 bg-[#FAF8F5] rounded-xl px-5 py-3 flex items-center justify-between animate-fade-in-up stagger-3">
            <span className="text-sm text-[#6B6259]">Total Paid</span>
            <span className="text-xl font-bold text-[#1A1613]">Rs. {fmt(total)}</span>
          </div>

          {/* Estimated time */}
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#1A1613] bg-[#FFF8ED] border border-[#F0D99A] rounded-xl px-4 py-2.5 animate-fade-in-up stagger-4">
            <span className="text-lg animate-pulse-soft">⏱</span>
            <span>Estimated: <strong>30-45 minutes</strong></span>
          </div>

          {/* Track button — primary */}
          <button
            onClick={onTrack}
            className="w-full mt-6 py-3.5 rounded-full text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] hover:shadow-xl hover:-translate-y-0.5 transition-all animate-fade-in-up stagger-5"
            style={{ background: site.primaryColor }}
          >
            <span className="animate-float">📦</span>
            Track Your Order
          </button>

          {/* Secondary button */}
          <button
            onClick={onNewOrder}
            className="w-full mt-3 py-3 rounded-full border-2 border-[#E8DFD0] text-[#6B6259] font-semibold text-sm hover:bg-[#FAF8F5] hover:-translate-y-0.5 transition-all animate-fade-in-up stagger-6"
          >
            🍽️ Place a new order
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[#6B6259] mt-6 leading-relaxed animate-fade-in stagger-7">
          Save the order code above — you'll need it to track your order.<br />
          A confirmation SMS will be sent to your mobile shortly.
        </p>
      </div>
    </div>
  );
}