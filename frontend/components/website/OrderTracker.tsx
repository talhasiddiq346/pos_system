"use client";
import { useState, useEffect } from "react";
import axios from "axios";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";

const STEPS = [
  { status: "pending",    label: "Order received",  icon: "📋", desc: "We got your order" },
  { status: "preparing",  label: "Being prepared",  icon: "👨‍🍳", desc: "Kitchen is on it" },
  { status: "ready",      label: "Ready",            icon: "✅", desc: "Waiting for rider" },
  { status: "dispatched", label: "On the way",       icon: "🛵", desc: "Rider heading to you" },
  { status: "delivered",  label: "Delivered",        icon: "🎉", desc: "Enjoy your meal!" },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0, preparing: 1, ready: 2, dispatched: 3, delivered: 4,
};

export default function OrderTracker({
  initialCode, onBack,
}: {
  initialCode?: string;
  onBack: () => void;
}) {
  const [code, setCode] = useState(initialCode || "");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialCode) fetchOrder(initialCode);
  }, [initialCode]);

  async function fetchOrder(c: string) {
    if (!c.trim()) return;
    setError(""); setLoading(true);
    try {
      const res = await axios.get(`${API}/public/track/${c.trim().toUpperCase()}`);
      setOrder(res.data);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || "Order not found");
      else setError("Something went wrong");
      setOrder(null);
    } finally { setLoading(false); }
  }

  const currentStep = order ? (STATUS_ORDER[order.status] ?? 0) : -1;

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F5", fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <nav style={{ background: "#1A1613", padding: "0 16px", height: "60px", display: "flex", alignItems: "center", gap: "12px", position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#A89F94" }}>←</button>
        <div style={{ width: "34px", height: "34px", background: "#E8542F", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🔥</div>
        <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>Track order</span>
      </nav>

      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "32px 16px" }}>

        <div style={{ background: "#fff", border: "1px solid #EDE8E1", borderRadius: "20px", padding: "22px", marginBottom: "20px" }}>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "#A89F94", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "12px" }}>
            Enter your order ID
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              placeholder="ORD-XXXXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && fetchOrder(code)}
              style={{ flex: 1, border: "1px solid #EDE8E1", borderRadius: "12px", padding: "13px 16px", fontSize: "17px", fontFamily: "monospace", outline: "none", color: "#1A1613", letterSpacing: "0.04em", minWidth: 0 }}
            />
            <button onClick={() => fetchOrder(code)} disabled={loading || !code.trim()}
              style={{ background: "#E8542F", color: "#fff", border: "none", borderRadius: "12px", padding: "13px 22px", fontSize: "15px", fontWeight: 700, cursor: loading || !code.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading || !code.trim() ? 0.5 : 1, flexShrink: 0 }}>
              {loading ? "..." : "Track"}
            </button>
          </div>
          {error && <p style={{ fontSize: "13px", color: "#E8542F", marginTop: "10px" }}>⚠ {error}</p>}
        </div>

        {order !== null && order.status !== "cancelled" && (
          <>
            <div style={{ background: "#1A1613", borderRadius: "24px", padding: "24px", marginBottom: "14px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: "-40px", top: "-40px", width: "180px", height: "180px", background: "#E8542F", opacity: 0.1, borderRadius: "50%" }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", gap: "12px" }}>
                  <div>
                    <p style={{ color: "#4A423B", fontSize: "12px", marginBottom: "4px" }}>Order ID</p>
                    <p style={{ color: "#fff", fontSize: "20px", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.03em" }}>
                      {order.order_code}
                    </p>
                  </div>
                  <span style={{
                    background: order.status === "delivered" ? "#16A34A" : order.status === "dispatched" ? "#2563EB" : "#E8542F",
                    color: "#fff", fontSize: "12px", fontWeight: 700, padding: "7px 14px", borderRadius: "20px", whiteSpace: "nowrap"
                  }}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {STEPS.map((step, i) => {
                    const done = i <= currentStep;
                    const active = i === currentStep;
                    return (
                      <div key={step.status} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{
                          width: "42px", height: "42px", borderRadius: "13px", flexShrink: 0,
                          background: done ? "#E8542F" : "rgba(255,255,255,0.05)",
                          border: active ? "2px solid #E8542F" : done ? "none" : "1px solid rgba(255,255,255,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px",
                        }}>
                          {done ? step.icon : <span style={{ color: "#4A423B", fontSize: "16px" }}>○</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "15px", fontWeight: active ? 700 : 500, color: done ? "#fff" : "#4A423B" }}>
                            {step.label}
                          </p>
                          {active && <p style={{ fontSize: "12px", color: "#F0A93B", marginTop: "2px" }}>{step.desc}</p>}
                        </div>
                        {active && (
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E8542F", flexShrink: 0, animation: "tandoor-pulse 1.5s infinite" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {order.status === "dispatched" && order.rider_name && (
              <div style={{ background: "#EAF1FB", border: "1px solid #BAD0F5", borderRadius: "20px", padding: "20px", marginBottom: "14px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#1D5A99", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>
                  🛵 Your rider is on the way
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "17px", fontWeight: 700, color: "#1A1613", marginBottom: "3px" }}>{order.rider_name}</p>
                    {order.rider_phone && <p style={{ fontSize: "14px", color: "#4A423B" }}>{order.rider_phone}</p>}
                  </div>
                  {order.rider_phone && (
                    <a href={`tel:${order.rider_phone}`}
                      style={{ background: "#1D5A99", color: "#fff", textDecoration: "none", borderRadius: "14px", padding: "12px 22px", fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "7px", flexShrink: 0 }}>
                      📞 Call
                    </a>
                  )}
                </div>
              </div>
            )}

            {order.status === "delivered" && (
              <div style={{ background: "#F0FFF4", border: "1px solid #BBF7D0", borderRadius: "20px", padding: "28px", textAlign: "center", marginBottom: "14px" }}>
                <p style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</p>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#16A34A", marginBottom: "6px" }}>Delivered!</p>
                <p style={{ fontSize: "14px", color: "#4A423B" }}>Enjoy your meal. Come back soon!</p>
              </div>
            )}

            <button onClick={() => fetchOrder(code)}
              style={{ width: "100%", background: "#fff", border: "1px solid #EDE8E1", borderRadius: "14px", padding: "14px", fontSize: "14px", fontWeight: 600, color: "#6B6259", cursor: "pointer", fontFamily: "inherit" }}>
              Refresh status
            </button>
          </>
        )}

        {order !== null && order.status === "cancelled" && (
          <div style={{ background: "#FFF0EE", border: "1px solid #FCD9C8", borderRadius: "20px", padding: "36px", textAlign: "center" }}>
            <p style={{ fontSize: "48px", marginBottom: "14px" }}>❌</p>
            <p style={{ fontSize: "20px", fontWeight: 700, color: "#C0392B", marginBottom: "6px" }}>Order cancelled</p>
            <p style={{ fontSize: "14px", color: "#4A423B" }}>Please contact us for assistance.</p>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes tandoor-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}