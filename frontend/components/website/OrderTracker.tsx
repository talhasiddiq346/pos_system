"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSiteSettings } from "@/lib/useSiteSettings";
import SiteHeader from "./SiteHeader";
import Footer from "./Footer";
const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";

type OrderStatus = "pending" | "preparing" | "ready" | "dispatched" | "delivered" | "completed" | "cancelled";

type OrderData = {
  order_code: string;
  status: OrderStatus;
  order_type: "delivery" | "pickup";
  branch_name: string;
  branch_address?: string;
  branch_phone?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string | null;
  total: number;
  payment_method: string;
  created_at: string;
  rider_name?: string | null;
  rider_phone?: string | null;
  items: { name: string; variant?: string | null; qty: number; price: number }[];
};

const STATUS_STEPS: { key: OrderStatus; label: string; icon: string; description: string }[] = [
  { key: "pending", label: "Order Received", icon: "📥", description: "We've got your order" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳", description: "Chef is cooking fresh" },
  { key: "ready", label: "Ready", icon: "✅", description: "Food is ready to go" },
  { key: "dispatched", label: "On the way", icon: "🛵", description: "Rider is heading to you" },
  { key: "delivered", label: "Delivered", icon: "🎉", description: "Enjoy your meal!" },
];

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 404) return "Order not found — check your code";
    return err.response?.data?.error || "Something went wrong";
  }
  return "Something went wrong";
}

export default function OrderTracker({
  initialCode,
  onBack,
}: {
  initialCode?: string;
  onBack: () => void;
}) {
  const site = useSiteSettings();
  const [code, setCode] = useState(initialCode || "");
  const [inputCode, setInputCode] = useState(initialCode || "");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchOrder(orderCode: string) {
    if (!orderCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get<OrderData>(`${API}/public/track/${orderCode.trim().toUpperCase()}`);
      setOrder(res.data);
      setCode(orderCode.trim().toUpperCase());
    } catch (err) {
      setError(errMsg(err));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialCode) fetchOrder(initialCode);
  }, [initialCode]);

  // Auto-refresh every 15s if order not final
  useEffect(() => {
    if (!order || ["delivered", "completed", "cancelled"].includes(order.status)) return;
    const interval = setInterval(() => fetchOrder(code), 15000);
    return () => clearInterval(interval);
  }, [order, code]);

  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "'DM Sans','Inter',-apple-system,sans-serif",
        background: site.backgroundColor,
      }}
    >
      <SiteHeader
        maxWidth="max-w-3xl"
        left={
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#6B6259] hover:text-[#1A1613]"
          >
            ← Back
          </button>
        }
      />

      <div className="max-w-3xl mx-auto px-3 md:px-6 py-6">
        {/* Search card */}
        {!order && (
          <div className="text-center mb-6 animate-fade-in-up">
            <div className="text-6xl mb-3 animate-float">📦</div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1A1613]">Track Your Order</h1>
            <p className="text-sm text-[#6B6259] mt-1">Enter your order code to check status</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E8DFD0] p-5 shadow-sm animate-fade-in-up stagger-1">
          <div className="flex gap-2">
            <input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && fetchOrder(inputCode)}
              onFocus={(e) => (e.currentTarget.style.borderColor = site.primaryColor)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E8DFD0")}
              placeholder="e.g. ORD-A7B3C9"
              className="flex-1 h-12 border-2 border-[#E8DFD0] rounded-xl px-4 text-base font-mono focus:outline-none uppercase transition-colors"
            />
            <button
              onClick={() => fetchOrder(inputCode)}
              disabled={!inputCode.trim() || loading}
              className="px-5 h-12 rounded-xl text-white font-semibold disabled:opacity-50 flex items-center gap-2 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
              style={{ background: site.primaryColor }}
            >
              {loading ? <span className="animate-pulse-soft">...</span> : <><span>🔍</span> Track</>}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-3 py-2 animate-fade-in-down">
              ⚠ {error}
            </p>
          )}
        </div>

        {/* Order details */}
        {order && (
          <>
            {/* Status hero */}
            <div className="mt-6 rounded-3xl p-6 text-white shadow-lg animate-scale-in" style={{ background: `linear-gradient(to bottom right, ${site.primaryColor}, ${site.primaryColor}CC)` }}>
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="min-w-0">
                  <p className="text-xs opacity-80 uppercase tracking-wider">Order</p>
                  <p className="text-2xl font-bold font-mono mt-0.5">#{order.order_code}</p>
                </div>
                <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap">
                  {order.order_type === "pickup" ? "🥡 Pickup" : "🛵 Delivery"}
                </span>
              </div>

              <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4">
                <div key={order.status} className="text-4xl animate-pop-in">
                  {order.status === "cancelled"
                    ? "❌"
                    : STATUS_STEPS.find((s) => s.key === order.status)?.icon || "⏳"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs opacity-80 uppercase tracking-wider">Current Status</p>
                  <p className="text-xl font-bold">
                    {order.status === "cancelled"
                      ? "Cancelled"
                      : STATUS_STEPS.find((s) => s.key === order.status)?.label || order.status}
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    {order.status === "cancelled"
                      ? "This order was cancelled"
                      : STATUS_STEPS.find((s) => s.key === order.status)?.description}
                  </p>
                </div>
              </div>

              {/* Rider info — shown once a rider has actually picked up the order */}
              {order.rider_name && (
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mt-3 flex items-center gap-3 animate-fade-in-up">
                  <span className="text-2xl">🛵</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs opacity-80 uppercase tracking-wider">Your Rider</p>
                    <p className="text-base font-bold truncate">{order.rider_name}</p>
                  </div>
                  {order.rider_phone && (
                    <a
                      href={`tel:${order.rider_phone}`}
                      className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors rounded-full px-3 py-2 text-xs font-semibold flex items-center gap-1.5"
                    >
                      📞 Call
                    </a>
                  )}
                </div>
              )}

              {/* Auto refresh indicator */}
              {!["delivered", "completed", "cancelled"].includes(order.status) && (
                <p className="text-xs opacity-80 mt-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Auto-updating every 15 seconds
                </p>
              )}
            </div>

            {/* Timeline */}
            {order.status !== "cancelled" && (
              <div className="mt-4 bg-white rounded-2xl border border-[#E8DFD0] p-5 animate-fade-in-up stagger-1">
                <h3 className="text-sm font-bold text-[#1A1613] mb-4">Progress</h3>
                <div className="space-y-4">
                  {STATUS_STEPS.map((step, i) => {
                    const currentIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);
                    const isDone = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const isPending = i > currentIdx;
                    const isPickup = order.order_type === "pickup";
                    // Skip "dispatched" for pickup
                    if (isPickup && step.key === "dispatched") return null;
                    if (isPickup && step.key === "delivered") {
                      step = { ...step, label: "Picked Up", description: "Enjoy your food!", icon: "🥡" };
                    }

                    return (
                      <div key={step.key} className="flex gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                              isDone
                                ? "bg-[#16A34A] text-white animate-pop-in"
                                : isCurrent
                                ? "text-white scale-110 animate-pulse-soft"
                                : "bg-[#F5F1EB] text-[#A89F94]"
                            }`}
                            style={isCurrent ? { background: site.primaryColor, boxShadow: `0 0 0 4px ${site.primaryColor}33` } : undefined}
                          >
                            {isDone ? "✓" : step.icon}
                          </div>
                          {i < STATUS_STEPS.length - 1 && !(isPickup && STATUS_STEPS[i + 1].key === "dispatched") && (
                            <div
                              className={`w-0.5 h-8 mt-1 transition-colors ${
                                isDone ? "bg-[#16A34A]" : "bg-[#EDE8E1]"
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <p
                            className={`text-sm font-bold ${
                              isPending ? "text-[#A89F94]" : "text-[#1A1613]"
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className={`text-xs mt-0.5 ${isPending ? "text-[#A89F94]" : "text-[#6B6259]"}`}>
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery/Pickup details */}
            <div className="mt-4 bg-white rounded-2xl border border-[#E8DFD0] p-5 animate-fade-in-up stagger-2">
              <h3 className="text-sm font-bold text-[#1A1613] mb-3 flex items-center gap-2">
                {order.order_type === "pickup" ? "🏪 Pickup Details" : "🛵 Delivery Details"}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-[#6B6259] min-w-[80px]">Branch:</span>
                  <span className="text-[#1A1613] font-semibold">{order.branch_name}</span>
                </div>
                {order.branch_address && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#6B6259] min-w-[80px]">Location:</span>
                    <span className="text-[#1A1613]">{order.branch_address}</span>
                  </div>
                )}
                {order.customer_address && order.order_type === "delivery" && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#6B6259] min-w-[80px]">Deliver to:</span>
                    <span className="text-[#1A1613]">{order.customer_address}</span>
                  </div>
                )}
                {order.branch_phone && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#6B6259] min-w-[80px]">Phone:</span>
                    <a href={`tel:${order.branch_phone}`} className="font-semibold" style={{ color: site.primaryColor }}>
                      {order.branch_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Order items */}
            <div className="mt-4 bg-white rounded-2xl border border-[#E8DFD0] overflow-hidden animate-fade-in-up stagger-3">
              <div className="px-5 py-3 border-b border-[#E8DFD0]">
                <h3 className="text-sm font-bold text-[#1A1613]">🍽️ Order Items</h3>
              </div>
              <div className="divide-y divide-[#EDE8E1]">
                {order.items?.map((item, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1613]">
                        <span style={{ color: site.primaryColor }}>{item.qty}x</span> {item.name}
                        {item.variant && (
                          <span
                            className="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                            style={{ background: site.secondaryColor, color: site.primaryColor }}
                          >
                            {item.variant}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#1E293B]">
                      Rs. {fmt(item.price * item.qty)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t flex items-center justify-between" style={{ background: `${site.secondaryColor}55`, borderColor: `${site.primaryColor}33` }}>
                <span className="font-bold text-[#1A1613]">Total</span>
                <span className="font-bold text-xl" style={{ color: site.primaryColor }}>Rs. {fmt(order.total)}</span>
              </div>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchOrder(code)}
              disabled={loading}
              className="w-full mt-4 py-3 rounded-full border-2 border-[#E8DFD0] text-[#6B6259] font-semibold text-sm hover:bg-white hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 animate-fade-in-up stagger-4"
            >
              {loading ? <span className="animate-pulse-soft">Refreshing...</span> : <>🔄 Refresh status</>}
            </button>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}