"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";

type WaitingOrder = {
  id: number;
  customer_name: string | null;
  customer_address: string | null;
  total: string;
  payment_method: string;
  created_at: string;
  items: { name: string; variant: string | null; qty: number }[];
};

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function WaitingOrdersPanel({ onAccepted }: { onAccepted: () => void }) {
  const [orders, setOrders] = useState<WaitingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await api.get<WaitingOrder[]>("/riders/waiting-orders");
    setOrders(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAccept(orderId: number) {
    setError("");
    setAccepting(orderId);
    try {
      await api.post(`/riders/waiting-orders/${orderId}/accept`);
      onAccepted();
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setAccepting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white border border-[#E3E5E0] h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-4 py-3">{error}</div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6D9D2] bg-white px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F0F1ED] mx-auto flex items-center justify-center text-3xl">⏳</div>
          <p className="text-base font-semibold text-[#14171A] mt-4">No waiting orders</p>
          <p className="text-sm text-[#6B7068] mt-1.5">New orders will appear here when riders are unavailable</p>
        </div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="rounded-2xl border border-[#F0A93B] bg-white overflow-hidden shadow-sm">
            {/* Warning header */}
            <div className="px-4 py-2.5 bg-[#FFF7E5] border-b border-[#F0D99A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <span className="mono-num text-sm font-semibold text-[#8A6D1F]">Order #{o.id}</span>
              </div>
              <span className="text-xs text-[#8A6D1F] font-medium">{timeAgo(o.created_at)}</span>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-3">
              {/* Customer + Total */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[#14171A] truncate">
                    {o.customer_name || "Customer"}
                  </p>
                  {o.customer_address && (
                    <p className="text-sm text-[#6B7068] mt-1 leading-relaxed">📍 {o.customer_address}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="mono-num text-lg font-bold text-[#14171A]">Rs {Number(o.total).toFixed(0)}</p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 ${
                    o.payment_method === "cash" ? "bg-[#FEF3C7] text-[#92610A]" : "bg-[#E0E7FF] text-[#3730A3]"
                  }`}>
                    {o.payment_method === "cash" ? "CASH" : "CARD"}
                  </span>
                </div>
              </div>

              {/* Items */}
              {o.items && o.items.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {o.items.map((it, i) => (
                    <span key={i} className="text-xs text-[#494D46] bg-[#F5F6F4] rounded-lg px-2.5 py-1.5">
                      {it.name}{it.variant ? ` · ${it.variant}` : ""} × <span className="font-semibold">{it.qty}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Accept button — big, full width */}
              <button
                onClick={() => handleAccept(o.id)}
                disabled={accepting === o.id}
                className="w-full h-12 rounded-xl bg-[#E8542F] text-white font-semibold text-sm hover:bg-[#D64822] disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
              >
                {accepting === o.id ? "Accepting..." : "✓ Accept this order"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}