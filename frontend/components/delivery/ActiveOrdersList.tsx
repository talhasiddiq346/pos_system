"use client";
import { useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { DeliveryAssignment } from "@/lib/types";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function ActiveOrdersList({
  orders,
  onRefresh,
}: {
  orders: DeliveryAssignment[];
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function markDelivered(assignmentId: number) {
    setError("");
    setLoading(assignmentId);
    try {
      await api.patch(`/riders/assignments/${assignmentId}/delivered`);
      onRefresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-8 text-center">
        <p className="text-sm text-[#494D46]">No active orders right now.</p>
        <p className="text-xs text-[#9B9F98] mt-1">Mark yourself available to receive orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {orders.map((o) => (
        <div key={o.id} className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EDEFEA] flex items-center justify-between">
            <p className="text-sm font-medium mono-num text-[#1B1D1E]">
              Order #{o.order_id}
            </p>
            <span className="text-xs text-[#494D46]">
              {new Date(o.order_time).toLocaleTimeString()}
            </span>
          </div>

          <div className="px-4 py-3 space-y-2">
            <div>
              <p className="text-sm font-medium text-[#1B1D1E]">
                {o.customer_name || "Customer"}
              </p>
              {o.customer_phone && (
                <p className="text-xs text-[#494D46]">📞 {o.customer_phone}</p>
              )}
              {o.customer_address && (
                <p className="text-xs text-[#494D46]">📍 {o.customer_address}</p>
              )}
            </div>

            {o.items && o.items.length > 0 && (
              <ul className="space-y-0.5 border-t border-[#EDEFEA] pt-2">
                {o.items.map((it, i) => (
                  <li key={i} className="text-xs text-[#494D46]">
                    {it.name}{it.variant ? ` (${it.variant})` : ""} × {it.qty}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="mono-num text-sm font-medium text-[#1B1D1E]">
                Rs {Number(o.total).toFixed(2)}
              </p>
              <button
                onClick={() => markDelivered(o.id)}
                disabled={loading === o.id}
                className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50"
              >
                {loading === o.id ? "..." : "✓ Delivered"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}