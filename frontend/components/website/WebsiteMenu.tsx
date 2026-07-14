"use client";
import { useEffect, useState } from "react";
import axios from "axios";

type Variant = { id: number; name: string; price: string };
type Product = {
  id: number; name: string; price: string;
  category: string | null; image_url: string | null;
  variants: Variant[];
};
type CartItem = {
  key: string; product_id: number; product_name: string;
  variant_id: number | null; variant_name: string | null;
  unit_price: number; quantity: number;
};

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";
const IMG = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "");

const CAT_EMOJI: Record<string, string> = {
  "Burgers": "🍔", "Burger": "🍔",
  "BBQ": "🍗", "Grills": "🍢",
  "Curries": "🥘", "Curry": "🥘",
  "Pizza": "🍕", "Pizzas": "🍕",
  "Drinks": "🥤", "Beverages": "🥤",
  "Desserts": "🍰", "Dessert": "🍰",
  "Biryani": "🍛", "Rice": "🍚",
  "Broast": "🍗", "Chicken": "🍗",
  "Sandwiches": "🥪", "Sandwich": "🥪",
  "Salads": "🥗", "Salad": "🥗",
  "Pasta": "🍝", "pasta": "🍝",
  "Wraps": "🌯", "Rolls": "🌯",
  "Soup": "🍲", "Soups": "🍲",
  "Other": "🍽️",
};

const CARD_BG = [
  "linear-gradient(135deg,#FFF0E8,#FFE4D6)",
  "linear-gradient(135deg,#FEF3E0,#FDE8C8)",
  "linear-gradient(135deg,#F0F9FF,#E0F2FE)",
  "linear-gradient(135deg,#F0FFF4,#DCFCE7)",
  "linear-gradient(135deg,#FDF4FF,#FAE8FF)",
];

function getCategoryEmoji(cat: string): string {
  if (CAT_EMOJI[cat]) return CAT_EMOJI[cat];
  const lower = cat.toLowerCase();
  for (const key of Object.keys(CAT_EMOJI)) {
    if (key.toLowerCase() === lower) return CAT_EMOJI[key];
  }
  return "🍽️";
}

export default function WebsiteMenu({
  branch, onCheckout, onBack, onTrack,
}: {
  branch: { id: number; name: string };
  onCheckout: (cart: CartItem[]) => void;
  onBack: () => void;
  onTrack: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    axios.get(`${API}/public/menu/${branch.id}`).then((r) => {
      setProducts(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [branch.id]);

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category || "Other")))];
  const filtered = activeCategory === "All" ? products : products.filter((p) => (p.category || "Other") === activeCategory);
  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  function addToCart(p: Product, variantId: number | null, variantName: string | null, price: number) {
    const key = `${p.id}-${variantId ?? "base"}`;
    setCart((prev) => {
      const ex = prev.find((c) => c.key === key);
      if (ex) return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { key, product_id: p.id, product_name: p.name, variant_id: variantId, variant_name: variantName, unit_price: price, quantity: 1 }];
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) => prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0));
  }

  const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  function CartContents({ doCheckout }: { doCheckout: () => void }) {
    return cart.length === 0 ? (
      <div style={{ padding: "48px 20px", textAlign: "center" }}>
        <p style={{ fontSize: "44px", marginBottom: "12px" }}>🛒</p>
        <p style={{ fontSize: "15px", color: "#A89F94", fontWeight: 500 }}>Your cart is empty</p>
        <p style={{ fontSize: "13px", color: "#C4BDB7", marginTop: "4px" }}>Add items from the menu</p>
      </div>
    ) : (
      <>
        <div style={{ padding: "8px 20px", maxHeight: "340px", overflowY: "auto" }}>
          {cart.map((c, idx) => (
            <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: idx < cart.length - 1 ? "1px solid #F7F4F1" : "none" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "11px", background: CARD_BG[idx % CARD_BG.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>🍽️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1613" }}>{c.product_name}</p>
                {c.variant_name && <p style={{ fontSize: "12px", color: "#A89F94" }}>{c.variant_name}</p>}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <button onClick={() => changeQty(c.key, -1)} style={{ width: "26px", height: "26px", borderRadius: "8px", border: "1px solid #EDE8E1", background: "#F5F1EB", cursor: "pointer", fontWeight: 700, fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#1A1613" }}>−</button>
                  <span style={{ fontSize: "14px", fontWeight: 700, minWidth: "18px", textAlign: "center" }}>{c.quantity}</span>
                  <button onClick={() => changeQty(c.key, 1)} style={{ width: "26px", height: "26px", borderRadius: "8px", border: "1px solid #EDE8E1", background: "#F5F1EB", cursor: "pointer", fontWeight: 700, fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#1A1613" }}>+</button>
                </div>
              </div>
              <span style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace", color: "#1A1613", flexShrink: 0 }}>Rs {(c.unit_price * c.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div style={{ margin: "0 20px 12px", background: "#FFF8F0", border: "1px dashed #FCD9C8", borderRadius: "12px", padding: "11px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🏷️</span>
          <input placeholder="Promo code" style={{ flex: 1, border: "none", background: "transparent", fontSize: "14px", fontFamily: "inherit", outline: "none", color: "#1A1613", minWidth: 0 }} />
          <button style={{ color: "#E8542F", fontWeight: 700, fontSize: "13px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Apply</button>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #F0EBE4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#6B6259", marginBottom: "6px" }}>
            <span>Subtotal</span><span style={{ fontFamily: "monospace" }}>Rs {total.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#6B6259", marginBottom: "14px" }}>
            <span>Delivery fee</span><span style={{ color: "#16A34A", fontWeight: 600 }}>Free</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "19px", fontWeight: 800, color: "#1A1613", paddingTop: "12px", borderTop: "1px solid #EDE8E1", marginBottom: "16px" }}>
            <span>Total</span><span style={{ fontFamily: "monospace" }}>Rs {total.toLocaleString()}</span>
          </div>
        </div>

        <button onClick={doCheckout}
          style={{ margin: "0 20px 12px", width: "calc(100% - 40px)", background: "#E8542F", color: "#fff", border: "none", borderRadius: "14px", padding: "15px 20px", fontSize: "15px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
          <span>Place order →</span>
          <span style={{ fontFamily: "monospace", opacity: 0.85 }}>Rs {total.toLocaleString()}</span>
        </button>
        <p style={{ textAlign: "center", fontSize: "12px", color: "#A89F94", paddingBottom: "16px" }}>💵 Cash on delivery · No card needed</p>
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F5", fontFamily: "'DM Sans',-apple-system,sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #EDE8E1", padding: "0 16px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6B6259", paddingRight: "4px" }}>←</button>
          <div style={{ width: "34px", height: "34px", background: "#E8542F", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>🔥</div>
          <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.03em", color: "#1A1613" }}>Tandoor</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#F5F1EB", padding: "8px 12px", borderRadius: "10px", fontSize: "13px", fontWeight: 500, color: "#4A423B", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📍 {branch.name}
          </div>
          <span className="tm-hide-mobile" style={{ fontSize: "13px", fontWeight: 600, color: "#6B6259", cursor: "pointer", padding: "8px 4px" }} onClick={onTrack}>
            Track order
          </span>
          <button onClick={() => setShowCart(true)}
            style={{ background: "#1A1613", border: "none", borderRadius: "12px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#fff", fontSize: "14px", fontWeight: 700, position: "relative" }}>
            <span>🛍️</span>
            {itemCount > 0 && (
              <span style={{ background: "#E8542F", color: "#fff", fontSize: "11px", fontWeight: 700, width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{itemCount}</span>
            )}
          </button>
        </div>
      </nav>

      {/* HERO BANNER */}
      <div style={{ background: "#1A1613", padding: "clamp(32px,5vw,56px) 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-60px", top: "-60px", width: "320px", height: "320px", background: "#E8542F", opacity: 0.1, borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: "120px", bottom: "-80px", width: "240px", height: "240px", background: "#F0A93B", opacity: 0.07, borderRadius: "50%" }} />

        <div style={{ position: "relative", maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(240,169,59,0.15)", padding: "7px 14px", borderRadius: "20px", marginBottom: "18px" }}>
              <span style={{ width: "7px", height: "7px", background: "#4ADE80", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ color: "#F0A93B", fontSize: "12px", fontWeight: 600 }}>Open now · 30 min delivery</span>
            </div>
            <h1 style={{ color: "#fff", fontSize: "clamp(26px,4.5vw,42px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "14px" }}>
              Authentic desi<br /><span style={{ color: "#E8542F" }}>flavours</span>, delivered
            </h1>
            <p style={{ color: "#A89F94", fontSize: "15px", lineHeight: 1.6 }}>
              Hot, fresh, and at your door in minutes
            </p>
          </div>

          {/* Right — floating product cards (desktop only) */}
          {products.length > 0 && (
            <div className="tm-hide-mobile" style={{ display: "flex", gap: "14px", flexShrink: 0 }}>
              {products.slice(0, 2).map((p, idx) => (
                <div key={p.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "18px", width: "150px", textAlign: "center", marginTop: idx === 1 ? "28px" : "0" }}>
                  <div style={{ width: "72px", height: "72px", background: CARD_BG[idx % CARD_BG.length], borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", margin: "0 auto 12px", overflow: "hidden" }}>
                    {p.image_url ? (
                      <img src={p.image_url.startsWith("http") ? p.image_url : `${IMG}${p.image_url}`}
                        alt={p.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : <span>🍽️</span>}
                  </div>
                  <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{p.name}</p>
                  <p style={{ color: "#E8542F", fontSize: "14px", fontWeight: 700, fontFamily: "monospace", marginBottom: "12px" }}>Rs {Number(p.price).toLocaleString()}</p>
                  <button onClick={() => addToCart(p, null, null, Number(p.price))}
                    style={{ width: "100%", background: "#E8542F", color: "#fff", border: "none", borderRadius: "9px", padding: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    + Add to cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background: "#fff", borderBottom: "1px solid #EDE8E1" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", overflowX: "auto", padding: "0 20px" }}>
          {[
            ["🏪", "3", "Branches"],
            ["⚡", "30 min", "Avg delivery"],
            ["🍽️", `${products.length}+`, "Menu items"],
            ["⭐", "4.8", "Rating"],
          ].map(([icon, num, label]) => (
            <div key={String(label)} style={{ padding: "14px 22px", display: "flex", alignItems: "center", gap: "10px", borderRight: "1px solid #F0EBE4", whiteSpace: "nowrap", flexShrink: 0 }}>
              <span style={{ fontSize: "18px" }}>{icon}</span>
              <div>
                <p style={{ fontSize: "17px", fontWeight: 800, color: "#1A1613", letterSpacing: "-0.02em" }}>{num}</p>
                <p style={{ fontSize: "11px", color: "#A89F94", fontWeight: 500 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="tm-layout" style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px", display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>

        {/* LEFT — MENU */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", marginBottom: "24px" }}>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ display: "flex", alignItems: "center", gap: "7px", padding: "10px 16px", borderRadius: "12px", border: activeCategory === cat ? "none" : "1px solid #EDE8E1", background: activeCategory === cat ? "#1A1613" : "#fff", color: activeCategory === cat ? "#fff" : "#6B6259", fontSize: "14px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>
                <span>{cat === "All" ? "🍔" : getCategoryEmoji(cat)}</span> {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="tm-grid" style={{ display: "grid", gap: "12px" }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: "220px", background: "#EDE8E1", borderRadius: "18px", opacity: 0.5 }} />
              ))}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #EDE8E1", borderRadius: "20px", padding: "48px 24px", textAlign: "center" }}>
              <p style={{ fontSize: "44px", marginBottom: "12px" }}>🍽️</p>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#1A1613" }}>No items in this category</p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items], catIdx) => (
              <div key={cat} style={{ marginBottom: "36px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1613", letterSpacing: "-0.01em" }}>
                    {getCategoryEmoji(cat)} {cat}
                  </h2>
                  <span style={{ fontSize: "13px", color: "#E8542F", fontWeight: 600 }}>{items.length} items</span>
                </div>

                {catIdx === 0 ? (
                  <div className="tm-grid" style={{ display: "grid", gap: "12px" }}>
                    {items.map((p, idx) => (
                      <div key={p.id} style={{ background: "#fff", borderRadius: "18px", border: "1px solid #EDE8E1", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <div style={{ height: "130px", background: p.image_url ? "#F5F1EB" : CARD_BG[idx % CARD_BG.length], display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                          {p.image_url ? (
                            <img src={p.image_url.startsWith("http") ? p.image_url : `${IMG}${p.image_url}`}
                              alt={p.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = "none";
                                const parent = img.parentElement;
                                if (parent) {
                                  parent.style.background = CARD_BG[idx % CARD_BG.length];
                                  const span = document.createElement("span");
                                  span.textContent = "🍽️";
                                  span.style.fontSize = "52px";
                                  parent.appendChild(span);
                                }
                              }} />
                          ) : <span style={{ fontSize: "52px" }}>🍽️</span>}
                          {idx === 0 && <span style={{ position: "absolute", top: "10px", left: "10px", background: "#E8542F", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "4px 9px", borderRadius: "7px", letterSpacing: "0.03em" }}>BESTSELLER</span>}
                          {idx === 1 && <span style={{ position: "absolute", top: "10px", left: "10px", background: "#1A1613", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "4px 9px", borderRadius: "7px" }}>NEW</span>}
                        </div>
                        <div style={{ padding: "14px", flex: 1, display: "flex", flexDirection: "column" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                            <span style={{ color: "#F0A93B", fontSize: "12px" }}>★★★★★</span>
                            <span style={{ fontSize: "11px", color: "#A89F94" }}>4.8</span>
                          </div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1613", marginBottom: "10px", flex: 1 }}>{p.name}</p>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <span style={{ fontSize: "15px", fontWeight: 700, color: "#1A1613", fontFamily: "monospace" }}>Rs {Number(p.price).toLocaleString()}</span>
                            {p.variants.length === 0 ? (
                              <button onClick={() => addToCart(p, null, null, Number(p.price))}
                                style={{ width: "32px", height: "32px", background: "#1A1613", border: "none", borderRadius: "9px", color: "#fff", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                            ) : (
                              <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                style={{ background: "#FFF0E8", color: "#E8542F", border: "1px solid #FCD9C8", borderRadius: "9px", padding: "6px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Options</button>
                            )}
                          </div>
                          {expandedId === p.id && p.variants.length > 0 && (
                            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                              {p.variants.map((v) => {
                                const tp = Number(p.price) + Number(v.price);
                                return (
                                  <button key={v.id} onClick={() => { addToCart(p, v.id, v.name, tp); setExpandedId(null); }}
                                    style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "#FAF8F5", border: "1px solid #EDE8E1", borderRadius: "9px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                                    <span style={{ color: "#1A1613", fontWeight: 500 }}>{v.name}</span>
                                    <span style={{ color: "#E8542F", fontWeight: 700, fontFamily: "monospace" }}>Rs {tp.toLocaleString()}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {items.map((p, idx) => (
                      <div key={p.id} style={{ background: "#fff", borderRadius: "18px", border: "1px solid #EDE8E1", padding: "14px", display: "flex", gap: "14px" }}>
                        <div style={{ width: "80px", height: "80px", borderRadius: "14px", background: p.image_url ? "#F5F1EB" : CARD_BG[idx % CARD_BG.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", flexShrink: 0, overflow: "hidden" }}>
                          {p.image_url ? (
                            <img src={p.image_url.startsWith("http") ? p.image_url : `${IMG}${p.image_url}`}
                              alt={p.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" }}
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = "none";
                                const parent = img.parentElement;
                                if (parent) {
                                  parent.style.background = CARD_BG[idx % CARD_BG.length];
                                  const span = document.createElement("span");
                                  span.textContent = "🍽️";
                                  span.style.fontSize = "36px";
                                  parent.appendChild(span);
                                }
                              }} />
                          ) : <span>🍽️</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                            <p style={{ fontSize: "15px", fontWeight: 600, color: "#1A1613" }}>{p.name}</p>
                            {idx === 0 && <span style={{ fontSize: "10px", fontWeight: 700, color: "#16A34A", background: "#DCFCE7", padding: "3px 8px", borderRadius: "6px", whiteSpace: "nowrap" }}>SPICY</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "10px" }}>
                            <span style={{ color: "#F0A93B", fontSize: "12px" }}>★★★★★</span>
                            <span style={{ fontSize: "12px", color: "#A89F94" }}>4.9</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <span style={{ fontSize: "16px", fontWeight: 700, color: "#1A1613", fontFamily: "monospace" }}>Rs {Number(p.price).toLocaleString()}</span>
                            {p.variants.length === 0 ? (
                              <button onClick={() => addToCart(p, null, null, Number(p.price))}
                                style={{ background: "#FFF0E8", color: "#E8542F", border: "1px solid #FCD9C8", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                                + Add
                              </button>
                            ) : (
                              <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                style={{ background: "#FFF0E8", color: "#E8542F", border: "1px solid #FCD9C8", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                {expandedId === p.id ? "Close" : "Choose"}
                              </button>
                            )}
                          </div>
                          {expandedId === p.id && p.variants.length > 0 && (
                            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                              {p.variants.map((v) => {
                                const tp = Number(p.price) + Number(v.price);
                                return (
                                  <button key={v.id} onClick={() => { addToCart(p, v.id, v.name, tp); setExpandedId(null); }}
                                    style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#FAF8F5", border: "1px solid #EDE8E1", borderRadius: "10px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                                    <span style={{ color: "#1A1613", fontWeight: 500 }}>{v.name}</span>
                                    <span style={{ color: "#E8542F", fontWeight: 700, fontFamily: "monospace" }}>Rs {tp.toLocaleString()}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* RIGHT — DESKTOP CART */}
        <div className="tm-sidebar" style={{ position: "sticky", top: "76px" }}>
          <div style={{ background: "#fff", borderRadius: "20px", border: "1px solid #EDE8E1", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #F0EBE4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 700 }}>🛍️ Your order</h3>
              <span style={{ fontSize: "12px", color: "#A89F94" }}>{branch.name}</span>
            </div>
            <CartContents doCheckout={() => onCheckout(cart)} />
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BAR */}
      {itemCount > 0 && (
        <div className="tm-mobile-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "rgba(250,248,245,0.96)", backdropFilter: "blur(12px)", borderTop: "1px solid #EDE8E1", zIndex: 40 }}>
          <button onClick={() => setShowCart(true)}
            style={{ width: "100%", background: "#1A1613", color: "#fff", border: "none", borderRadius: "16px", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: "#E8542F", color: "#fff", fontSize: "12px", fontWeight: 700, width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{itemCount}</span>
              <span style={{ fontSize: "15px", fontWeight: 600 }}>View order</span>
            </div>
            <span style={{ fontSize: "16px", fontWeight: 800, fontFamily: "monospace" }}>Rs {total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MOBILE DRAWER */}
      {showCart && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setShowCart(false)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "relative", background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: "520px", margin: "0 auto", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F0EBE4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>🛍️ Your order</h3>
              <button onClick={() => setShowCart(false)} style={{ background: "#F5F1EB", border: "none", borderRadius: "9px", padding: "7px 14px", fontSize: "14px", cursor: "pointer", fontFamily: "inherit", color: "#6B6259" }}>Close</button>
            </div>
            <CartContents doCheckout={() => { setShowCart(false); onCheckout(cart); }} />
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .tm-hide-mobile { display: flex; }
        .tm-layout { grid-template-columns: 1fr 340px; }
        .tm-sidebar { display: block; }
        .tm-mobile-bar { display: none; }
        .tm-grid { grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 640px) {
          .tm-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 900px) {
          .tm-hide-mobile { display: none !important; }
          .tm-layout { grid-template-columns: 1fr !important; padding-bottom: 100px !important; }
          .tm-sidebar { display: none !important; }
          .tm-mobile-bar { display: block !important; }
        }
      `}</style>
    </div>
  ); 
}