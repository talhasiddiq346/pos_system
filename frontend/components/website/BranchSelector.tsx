"use client";
import { useEffect, useState } from "react";
import axios from "axios";

type Branch = { id: number; name: string; address: string };
const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";

export default function BranchSelector({ onSelect, onTrack }: { onSelect: (b: Branch) => void; onTrack: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/public/branches`).then((r) => {
      setBranches(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F5", fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #EDE8E1", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", background: "#E8542F", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🔥</div>
          <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.03em", color: "#1A1613" }}>Tandoor</span>
        </div>
        <button onClick={onTrack}
          style={{ fontSize: "14px", fontWeight: 600, color: "#6B6259", background: "none", border: "none", cursor: "pointer", padding: "8px 12px" }}>
          Track order
        </button>
      </nav>

      {/* Hero */}
      <div style={{ background: "#1A1613", padding: "clamp(48px,8vw,80px) 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-80px", top: "-80px", width: "380px", height: "380px", background: "#E8542F", opacity: 0.1, borderRadius: "50%" }} />
        <div style={{ position: "absolute", left: "60%", bottom: "-100px", width: "280px", height: "280px", background: "#F0A93B", opacity: 0.07, borderRadius: "50%" }} />
        <div style={{ position: "relative", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(240,169,59,0.15)", padding: "8px 16px", borderRadius: "24px", marginBottom: "24px" }}>
            <span style={{ width: "8px", height: "8px", background: "#4ADE80", borderRadius: "50%", display: "inline-block" }} />
            <span style={{ color: "#F0A93B", fontSize: "13px", fontWeight: 600 }}>Open now · 30 min delivery · Karachi</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: "clamp(32px,6vw,52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "16px" }}>
            Taste the best of<br /><span style={{ color: "#E8542F" }}>desi cuisine</span>, delivered hot
          </h1>
          <p style={{ color: "#A89F94", fontSize: "17px", lineHeight: 1.6, maxWidth: "540px", margin: "0 auto" }}>
            From smoky BBQ to rich karahi — fresh, fast, and at your door in under 30 minutes.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ background: "#fff", borderBottom: "1px solid #EDE8E1" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", overflowX: "auto", padding: "0 24px" }}>
          {[
            ["🏪", `${branches.length || "—"}`, "Branches"],
            ["⚡", "30 min", "Avg delivery"],
            ["🍽️", "50+", "Menu items"],
            ["⭐", "4.8", "Rating"],
          ].map(([icon, num, label]) => (
            <div key={label} style={{ padding: "18px 28px", display: "flex", alignItems: "center", gap: "12px", borderRight: "1px solid #F0EBE4", whiteSpace: "nowrap", flexShrink: 0 }}>
              <span style={{ fontSize: "22px" }}>{icon}</span>
              <div>
                <p style={{ fontSize: "18px", fontWeight: 800, color: "#1A1613", letterSpacing: "-0.02em" }}>{num}</p>
                <p style={{ fontSize: "12px", color: "#A89F94", fontWeight: 500 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Branch list */}
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 20px" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "#A89F94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
          Select your nearest branch
        </p>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: "88px", background: "#EDE8E1", borderRadius: "20px", opacity: 0.6 }} />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #EDE8E1", borderRadius: "20px", padding: "40px", textAlign: "center" }}>
            <p style={{ fontSize: "40px", marginBottom: "12px" }}>🏪</p>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "#1A1613" }}>No branches available</p>
            <p style={{ fontSize: "14px", color: "#A89F94", marginTop: "4px" }}>Please check back later</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {branches.map((b) => (
              <button key={b.id} onClick={() => onSelect(b)}
                style={{ width: "100%", background: "#fff", border: "1px solid #EDE8E1", borderRadius: "20px", padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: "17px", fontWeight: 700, color: "#1A1613", marginBottom: "4px" }}>{b.name}</p>
                  {b.address && <p style={{ fontSize: "13px", color: "#A89F94" }}>📍 {b.address}</p>}
                </div>
                <div style={{ width: "40px", height: "40px", background: "#FFF0E8", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#E8542F", fontSize: "20px", flexShrink: 0 }}>→</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>
    </div>
  );
}