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

  if (loading) return <p className="text-sm text-[#494D46]">Loading waiting orders...</p>;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}

      {orders.length === 0 ? (
        <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-8 text-center">
          <p className="text-sm text-[#494D46]">No waiting orders right now.</p>
        </div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="bg-white border border-[#F0D99A] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#FBF3E5] border-b border-[#F0D99A] flex items-center justify-between">
              <p className="text-sm font-medium text-[#8A6D1F] mono-num">
                Order #{o.id}
              </p>
              <p className="text-xs text-[#8A6D1F]">
                {new Date(o.created_at).toLocaleTimeString()}
              </p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {o.customer_name && <p className="text-sm font-medium text-[#1B1D1E]">{o.customer_name}</p>}
              {o.customer_address && <p className="text-xs text-[#494D46]">📍 {o.customer_address}</p>}
              {o.items?.map((it, i) => (
                <p key={i} className="text-xs text-[#494D46]">
                  {it.name}{it.variant ? ` (${it.variant})` : ""} × {it.qty}
                </p>
              ))}
              <div className="flex items-center justify-between pt-1">
                <p className="mono-num text-sm font-medium text-[#1B1D1E]">
                  Rs {Number(o.total).toFixed(2)}
                  <span className="text-xs text-[#494D46] ml-1">({o.payment_method})</span>
                </p>
                <button
                  onClick={() => handleAccept(o.id)}
                  disabled={accepting === o.id}
                  className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50"
                >
                  {accepting === o.id ? "..." : "Accept order"}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}