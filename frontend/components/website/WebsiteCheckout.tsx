"use client";
import { useState } from "react";
import axios from "axios";

type CartItem = {
  key: string; product_id: number; product_name: string;
  variant_id: number | null; variant_name: string | null;
  unit_price: number; quantity: number;
};

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";
const CITIES = ["Karachi","Lahore","Islamabad","Rawalpindi","Faisalabad","Multan","Hyderabad","Quetta","Peshawar","Sialkot"];

function validatePhone(phone: string) {
  const c = phone.replace(/[\s\-\(\)]/g, "");
  return /^03[0-9]{9}$/.test(c) || /^\+923[0-9]{9}$/.test(c) || /^923[0-9]{9}$/.test(c);
}

export default function WebsiteCheckout({
  branch, cart, onBack, onOrderPlaced,
}: {
  branch: { id: number; name: string };
  cart: CartItem[];
  onBack: () => void;
  onOrderPlaced: (orderCode: string, total: number) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [email, setEmail] = useState("");
  const [flatNo, setFlatNo] = useState("");
  const [building, setBuilding] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("Karachi");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const address = [flatNo, building, area, city].filter(Boolean).join(", ");

  function handlePhone(val: string) {
    setPhone(val);
    if (val && !validatePhone(val)) setPhoneError("Valid Pakistani number (e.g. 0300-1234567)");
    else setPhoneError("");
  }

  async function handleSubmit() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (!phone.trim() || !validatePhone(phone)) { setError("Valid Pakistani phone required"); return; }
    if (!area.trim()) { setError("Area is required"); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/public/order`, {
        branch_id: branch.id,
        items: cart.map((c) => ({ product_id: c.product_id, variant_id: c.variant_id, quantity: c.quantity })),
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        customer_address: address,
        payment_method: "cash",
      });
      onOrderPlaced(res.data.order_code, Number(res.data.total));
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || "Order failed");
      else setError("Something went wrong");
    } finally { setSubmitting(false); }
  }

  const inp: React.CSSProperties = {
    width: "100%", border: "1px solid #EDE8E1", borderRadius: "12px",
    padding: "12px 14px", fontSize: "15px", fontFamily: "inherit",
    outline: "none", color: "#1A1613", background: "#fff", boxSizing: "border-box",
  };
  const card: React.CSSProperties = {
    background: "#fff", border: "1px solid #EDE8E1",
    borderRadius: "20px", overflow: "hidden", marginBottom: "16px",
  };
  const label: React.CSSProperties = {
    fontSize: "11px", fontWeight: 700, color: "#A89F94",
    textTransform: "uppercase", letterSpacing: "0.1em",
    display: "block", marginBottom: "7px",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F5", fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <nav style={{ background: "#fff", borderBottom: "1px solid #EDE8E1", padding: "0 16px", height: "60px", display: "flex", alignItems: "center", gap: "12px", position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6B6259" }}>←</button>
        <div style={{ width: "34px", height: "34px", background: "#E8542F", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🔥</div>
        <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.03em", color: "#1A1613" }}>Checkout</span>
      </nav>

      <div className="co-layout" style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px 120px", display: "grid", gridTemplateColumns: "1fr 360px", gap: "24px", alignItems: "start" }}>

        <div style={{ minWidth: 0 }}>
          {error && (
            <div style={{ background: "#FFF0EE", border: "1px solid #FCD9C8", borderRadius: "14px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px", color: "#C0392B" }}>
              ⚠ {error}
            </div>
          )}

          <div style={card}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #F0EBE4" }}>
              <p style={{ fontSize: "17px", fontWeight: 700, color: "#1A1613" }}>Your details</p>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={label}>Full name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ali Hassan" style={inp} />
              </div>
              <div>
                <label style={label}>Phone *</label>
                <div style={{ display: "flex", border: `1px solid ${phoneError ? "#FCD9C8" : "#EDE8E1"}`, borderRadius: "12px", overflow: "hidden" }}>
                  <span style={{ padding: "12px 14px", background: "#F5F1EB", borderRight: "1px solid #EDE8E1", fontSize: "16px", flexShrink: 0 }}>🇵🇰</span>
                  <input value={phone} onChange={(e) => handlePhone(e.target.value)} placeholder="0300-1234567" type="tel"
                    style={{ ...inp, border: "none", borderRadius: 0, flex: 1, width: "auto" }} />
                </div>
                {phoneError && <p style={{ fontSize: "12px", color: "#E8542F", marginTop: "5px" }}>{phoneError}</p>}
                {!phoneError && phone && <p style={{ fontSize: "12px", color: "#16A34A", marginTop: "5px" }}>✓ Valid number</p>}
              </div>
              <div>
                <label style={label}>Email <span style={{ color: "#C4BDB7", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — for order confirmation)</span></label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" style={inp} />
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #F0EBE4" }}>
              <p style={{ fontSize: "17px", fontWeight: 700, color: "#1A1613" }}>Delivery address</p>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="addr-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={label}>Flat / House #</label>
                  <input value={flatNo} onChange={(e) => setFlatNo(e.target.value)} placeholder="A-12 / Flat 3" style={inp} />
                </div>
                <div>
                  <label style={label}>Building / Street</label>
                  <input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="Rose Tower / St. 5" style={inp} />
                </div>
              </div>
              <div className="addr-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={label}>Area / Locality *</label>
                  <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="DHA Phase 5, Gulshan..." style={inp} />
                </div>
                <div>
                  <label style={label}>City</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)} style={{ ...inp, appearance: "none" as any }}>
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {address && (
                <div style={{ background: "#F5F1EB", borderRadius: "12px", padding: "12px 16px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>📍</span>
                  <p style={{ fontSize: "14px", color: "#4A423B", lineHeight: 1.5 }}>{address}</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", background: "#FFF0E8", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>💵</div>
              <div>
                <p style={{ fontSize: "16px", fontWeight: 600, color: "#1A1613", marginBottom: "2px" }}>Cash on delivery</p>
                <p style={{ fontSize: "13px", color: "#A89F94" }}>Pay when your order arrives — no card needed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="co-summary" style={{ position: "sticky", top: "76px" }}>
          <div style={{ background: "#fff", border: "1px solid #EDE8E1", borderRadius: "20px", overflow: "hidden", marginBottom: "14px" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #F0EBE4" }}>
              <p style={{ fontSize: "17px", fontWeight: 700, color: "#1A1613" }}>Order summary</p>
              <p style={{ fontSize: "13px", color: "#A89F94", marginTop: "2px" }}>{branch.name}</p>
            </div>
            <div style={{ padding: "10px 20px", maxHeight: "280px", overflowY: "auto" }}>
              {cart.map((c) => (
                <div key={c.key} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F7F4F1", fontSize: "14px", gap: "10px" }}>
                  <span style={{ color: "#1A1613", flex: 1 }}>
                    {c.product_name}
                    {c.variant_name && <span style={{ color: "#A89F94" }}> ({c.variant_name})</span>}
                    <span style={{ color: "#A89F94" }}> × {c.quantity}</span>
                  </span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1A1613", flexShrink: 0 }}>Rs {(c.unit_price * c.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid #F0EBE4" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#6B6259", marginBottom: "7px" }}>
                <span>Delivery fee</span><span style={{ color: "#16A34A", fontWeight: 600 }}>Free</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "19px", fontWeight: 800, color: "#1A1613", paddingTop: "12px", borderTop: "1px solid #EDE8E1" }}>
                <span>Total</span><span style={{ fontFamily: "monospace" }}>Rs {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: "100%", background: submitting ? "#C4BDB7" : "#E8542F", color: "#fff", border: "none", borderRadius: "16px", padding: "16px 20px", fontSize: "16px", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
            <span>{submitting ? "Placing order..." : "Place order →"}</span>
            <span style={{ fontFamily: "monospace", opacity: 0.85 }}>Rs {total.toLocaleString()}</span>
          </button>
        </div>
      </div>

      <div className="co-mobile-btn" style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "rgba(250,248,245,0.96)", backdropFilter: "blur(12px)", borderTop: "1px solid #EDE8E1", zIndex: 40 }}>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: "100%", background: submitting ? "#C4BDB7" : "#E8542F", color: "#fff", border: "none", borderRadius: "14px", padding: "15px 20px", fontSize: "15px", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
          <span>{submitting ? "Placing..." : "Place order →"}</span>
          <span style={{ fontFamily: "monospace" }}>Rs {total.toLocaleString()}</span>
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @media (max-width: 900px) {
          .co-layout { grid-template-columns: 1fr !important; }
          .co-summary { display: none !important; }
          .addr-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 901px) {
          .co-mobile-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}