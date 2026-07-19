"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSiteSettings } from "@/lib/useSiteSettings";
const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";



type Branch = {
  id: number;
  name: string;
  address: string;
  city?: string;
  phone?: string;
};

type OrderType = "delivery" | "pickup";

export default function BranchSelector({
  onSelect,
  onTrack,
}: {
  onSelect: (branch: Branch, orderType: OrderType) => void;
  onTrack: () => void;
}) {
  const site = useSiteSettings();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [city, setCity] = useState<string>("Karachi");
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");

  useEffect(() => {
    axios.get(`${API}/public/branches`).then((r) => {
      setBranches(r.data);
      if (r.data.length === 1) setSelectedBranchId(r.data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const singleBranch = branches.length === 1;



  // Get unique cities from branches
  const cities = Array.from(new Set(branches.map((b) => b.city).filter(Boolean))) as string[];
  const availableCities = cities.length > 0 ? cities : ["Karachi"];
  const filteredBranches = branches.filter((b) => !b.city || b.city === city);

  function handleSelect() {
    const branch = branches.find((b) => b.id === selectedBranchId);
    if (branch) onSelect(branch, orderType);
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        fontFamily: "'DM Sans','Inter',-apple-system,sans-serif",
        background: site.backgroundColor,
      }}
    >
      {/* Background pattern — subtle theme-colored texture */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `radial-gradient(circle at 20% 30%, ${site.primaryColor}22 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${site.secondaryColor}55 0%, transparent 50%)`,
      }} />

      {/* Food image grid backdrop (decorative — blurred) */}
      <div className="absolute inset-0 opacity-20 grid grid-cols-2 md:grid-cols-5 gap-2 p-4 blur-sm pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-gradient-to-br animate-float"
            style={{
              background: `linear-gradient(${i * 36}deg, ${site.primaryColor}, ${site.secondaryColor})`,
              aspectRatio: "3/4",
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Track order button — top right corner */}
      <button
        onClick={onTrack}
        className="absolute top-4 right-4 z-20 bg-white text-[#1A1613] text-xs font-semibold px-3 py-2 rounded-full border border-[#E8DFD0] hover:bg-[#FAF8F5] shadow-sm flex items-center gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-md animate-fade-in-down"
      >
        📦 Track order
      </button>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        {/* Logo — floating above modal */}
        <div className="mb-[-40px] relative z-20 animate-pop-in">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white overflow-hidden"
            style={{ background: site.logoUrl ? "white" : `linear-gradient(135deg, ${site.primaryColor}, ${site.secondaryColor})` }}
          >
            {site.logoUrl ? (
              <img src={site.logoUrl} alt={site.brandName} className="w-full h-full object-contain" />
            ) : (
              <span className="text-3xl">🔥</span>
            )}
          </div>
        </div>

        {/* Modal card */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in stagger-1">
          {/* Header strip */}
          <div className="h-16" style={{ background: `linear-gradient(90deg, ${site.primaryColor}, ${site.secondaryColor})` }} />

          <div className="px-6 py-6 pt-4">
            {/* Brand name */}
            <div className="text-center mb-6 -mt-2 animate-fade-in-up">
              <h1 className="text-2xl font-bold text-[#1A1613] tracking-tight">{site.brandName}</h1>
              <p className="text-xs text-[#6B6259] mt-0.5">Fresh dairy, lassi & ice cream</p>
            </div>

            <h2 className="text-base font-bold text-[#1A1613] text-center mb-4 animate-fade-in-up stagger-1">
              Select Your Order Type
            </h2>

            {/* Delivery / Pickup toggle */}
            <div className="bg-[#F5F1EB] rounded-full p-1 flex mb-6 animate-fade-in-up stagger-2">
              <button
                onClick={() => setOrderType("delivery")}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
                style={orderType === "delivery" ? { background: site.primaryColor, color: "white" } : { color: "#6B6259" }}
              >
                <span className={orderType === "delivery" ? "inline-block animate-wiggle" : "inline-block"}>🛵</span> Delivery
              </button>
              <button
                onClick={() => setOrderType("pickup")}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
                style={orderType === "pickup" ? { background: site.primaryColor, color: "white" } : { color: "#6B6259" }}
              >
                <span className={orderType === "pickup" ? "inline-block animate-wiggle" : "inline-block"}>🏪</span> Pick-Up
              </button>
            </div>

            {singleBranch ? (
              /* Only one branch — nothing to pick, just show where the order is from. */
              <div className="w-full mb-6 px-4 py-3 rounded-xl text-sm animate-fade-in-up stagger-3" style={{ background: `${site.secondaryColor}55` }}>
                <p className="text-[#6B6259] text-xs">
                  {orderType === "pickup" ? "Pickup from" : "Ordering from"}
                </p>
                <p className="font-semibold text-[#1A1613]">
                  {branches[0]?.name} — {branches[0]?.address}
                </p>
              </div>
            ) : (
              <>
                {/* Location instruction */}
                <p className="text-xs text-[#6B6259] text-center mb-3 animate-fade-in-up stagger-2">Please select your location</p>

                {/* Use current location button (visual only for now) */}
                <button
                  className="w-full mb-4 py-2.5 rounded-full border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2 hover:scale-[1.02] hover:shadow-sm active:scale-95 animate-fade-in-up stagger-3"
                  style={{ borderColor: site.primaryColor, color: site.primaryColor, background: `${site.secondaryColor}55` }}
                  onClick={() => alert("Geolocation feature coming soon!")}
                >
                  <span className="animate-pulse-soft">📍</span> Use Current Location
                </button>

                {/* City select */}
                <label className="block text-xs font-semibold text-[#1A1613] mb-1.5 animate-fade-in-up stagger-4">
                  Please Select City
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onFocus={(e) => (e.currentTarget.style.borderColor = site.primaryColor)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E8DFD0")}
                  className="w-full mb-4 px-4 py-3 border border-[#E8DFD0] rounded-xl text-sm bg-white focus:outline-none transition-all focus:shadow-md animate-fade-in-up stagger-4"
                >
                  {availableCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Branch/Location select */}
                <label className="block text-xs font-semibold text-[#1A1613] mb-1.5 animate-fade-in-up stagger-5">
                  {orderType === "pickup" ? "Please select pickup branch" : "Please select your location"}
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  onFocus={(e) => (e.currentTarget.style.borderColor = site.primaryColor)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E8DFD0")}
                  className="w-full mb-6 px-4 py-3 border border-[#E8DFD0] rounded-xl text-sm bg-white focus:outline-none transition-all focus:shadow-md animate-fade-in-up stagger-5"
                >
                  <option value="">
                    {loading ? "Loading branches..." : "Select branch"}
                  </option>
                  {filteredBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.address}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* Select button */}
            <button
              onClick={handleSelect}
              disabled={!selectedBranchId}
              className={`w-full py-3.5 rounded-full text-white font-semibold text-base transition-all ${
                selectedBranchId ? "shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]" : "cursor-not-allowed"
              }`}
              style={{ background: selectedBranchId ? site.primaryColor : "#F0BFA8" }}
            >
              Select
            </button>

            {/* Footer track link */}
            <p className="text-center text-xs text-[#6B6259] mt-4">
              Already ordered?{" "}
              <button onClick={onTrack} className="font-semibold hover:underline" style={{ color: site.primaryColor }}>
                Track your order →
              </button>
            </p>
          </div>
        </div>

        {/* Powered by strip */}
        <p className="mt-6 text-xs text-[#6B6259]/70">
          Powered by <span className="font-semibold">{site.brandName}</span> · Fresh &amp; cool delivery
        </p>

        {/* Legal / info links */}
        <div className="mt-3 flex items-center gap-x-3 gap-y-1 flex-wrap justify-center text-[11px] text-[#6B6259]/80">
          <a href="/about" className="hover-underline">About</a>
          <span>·</span>
          <a href="/contact" className="hover-underline">Contact</a>
          <span>·</span>
          <a href="/faq" className="hover-underline">FAQs</a>
          <span>·</span>
          <a href="/terms" className="hover-underline">Terms</a>
          <span>·</span>
          <a href="/privacy-policy" className="hover-underline">Privacy</a>
          <span>·</span>
          <a href="/refund-policy" className="hover-underline">Refunds</a>
        </div>
        <p className="mt-2 text-[11px] text-[#6B6259]/60">© {new Date().getFullYear()} {site.brandName}. All rights reserved.</p>
      </div>
    </div>
  );
}