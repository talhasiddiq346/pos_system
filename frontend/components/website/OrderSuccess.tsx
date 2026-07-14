"use client";
import { useState } from "react";

export default function OrderSuccess({
  orderCode, total, onTrack, onNewOrder,
}: {
  orderCode: string; total: number;
  onTrack: () => void; onNewOrder: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(orderCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1A1613", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Sans',-apple-system,sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: "-80px", top: "-80px", width: "350px", height: "350px", background: "#E8542F", opacity: 0.08, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: "-60px", bottom: "-80px", width: "280px", height: "280px", background: "#F0A93B", opacity: 0.06, borderRadius: "50%" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: "420px", textAlign: "center" }}>
        <div style={{ fontSize: "72px", marginBottom: "20px", lineHeight: 1 }}>🎉</div>
        <h1 style={{ color: "#fff", fontSize: "clamp(26px,5vw,34px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "10px" }}>
          Order placed!
        </h1>
        <p style={{ color: "#A89F94", fontSize: "15px", lineHeight: 1.6, marginBottom: "32px" }}>
          Your food is being prepared. Save your order ID to track it anytime.
        </p>

        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "28px 24px", marginBottom: "16px" }}>
          <p style={{ color: "#6B6259", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>
            Your order ID
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginBottom: "8px", flexWrap: "wrap" }}>
            <span style={{ color: "#fff", fontSize: "clamp(24px,6vw,36px)", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.05em" }}>
              {orderCode}
            </span>
            <button onClick={copy}
              style={{ background: copied ? "#16A34A" : "#E8542F", color: "#fff", border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p style={{ color: "#4A423B", fontSize: "13px" }}>Screenshot this or note it down</p>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "20px", paddingTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#A89F94", fontSize: "14px" }}>Order total</span>
              <span style={{ color: "#fff", fontSize: "16px", fontWeight: 700, fontFamily: "monospace" }}>Rs {total.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#A89F94", fontSize: "14px" }}>Payment</span>
              <span style={{ color: "#F0A93B", fontSize: "14px", fontWeight: 600 }}>💵 Cash on delivery</span>
            </div>
          </div>
        </div>

        <button onClick={onTrack}
          style={{ width: "100%", background: "#E8542F", color: "#fff", border: "none", borderRadius: "16px", padding: "16px", fontSize: "16px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: "10px" }}>
          Track my order →
        </button>
        <button onClick={onNewOrder}
          style={{ width: "100%", background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", padding: "16px", fontSize: "16px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Order again
        </button>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>
    </div>
  );
}