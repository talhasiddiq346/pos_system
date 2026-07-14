"use client";
import { useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { DeliveryAssignment } from "@/lib/types";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

function mapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function RiderTripPanel({
  activeOrders,
  riderStatus,
  onStatusChange,
  onRefresh,
}: {
  activeOrders: DeliveryAssignment[];
  riderStatus: string;
  onStatusChange: (s: string) => void;
  onRefresh: () => void;
}) {
  const [delivering, setDelivering] = useState<number | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [error, setError] = useState("");

  async function handleDeliver(assignmentId: number) {
    setDelivering(assignmentId);
    setError("");
    try {
      await api.patch(`/riders/assignments/${assignmentId}/delivered`);
      onRefresh();
    } catch (err) { setError(errMsg(err)); }
    finally { setDelivering(null); }
  }

  async function changeStatus(status: string) {
    setError("");
    setChangingStatus(true);
    try {
      await api.patch("/riders/status", { status });
      onStatusChange(status);
    } catch (err) { setError(errMsg(err)); }
    finally { setChangingStatus(false); }
  }

  const outForDelivery = riderStatus === "out_for_delivery";
  const cashTotal = activeOrders.filter((o) => o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0);
  const grandTotal = activeOrders.reduce((s, o) => s + Number(o.total), 0);
  const deliveredProgress = 0; // active are all undelivered

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Primary action bar */}
      <div className="rounded-xl border border-[#E3E5E0] bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#6B7068]">Trip control</p>
          <p className="text-sm text-[#14171A] mt-0.5">
            {outForDelivery ? "You're on the road — deliver each order below"
              : activeOrders.length > 0 ? "Ready to head out?"
              : "No active orders yet"}
          </p>
        </div>

        <div className="flex gap-2">
          {riderStatus === "offline" && (
            <button onClick={() => changeStatus("available")} disabled={changingStatus}
              className="text-sm px-4 py-2 rounded-lg bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50">
              Go online
            </button>
          )}
          {(riderStatus === "available" || riderStatus === "busy" || riderStatus === "offline") && activeOrders.length > 0 && !outForDelivery && (
            <button onClick={() => changeStatus("out_for_delivery")} disabled={changingStatus}
              className="text-sm px-4 py-2 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4FD7] disabled:opacity-50">
              🛵 Start delivery
            </button>
          )}
          {(riderStatus === "available" || riderStatus === "busy") && (
            <button onClick={() => changeStatus("offline")} disabled={changingStatus}
              className="text-sm px-4 py-2 rounded-lg border border-[#E3E5E0] text-[#494D46] font-medium hover:bg-[#F5F6F4] disabled:opacity-50">
              Go offline
            </button>
          )}
        </div>
      </div>

      {/* Orders */}
      {activeOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D6D9D2] bg-white px-6 py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F0F1ED] mx-auto flex items-center justify-center text-xl">📦</div>
          <p className="text-sm font-medium text-[#14171A] mt-3">No orders assigned</p>
          <p className="text-xs text-[#6B7068] mt-1">
            {riderStatus === "offline" ? "Go online to start receiving orders" : "New assignments will appear here instantly"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((o, i) => (
            <div key={o.id} className="rounded-xl border border-[#E3E5E0] bg-white overflow-hidden">
              <div className="flex items-stretch">
                {/* Left index rail */}
                <div className="w-12 shrink-0 bg-[#F7F8F6] border-r border-[#EDEFEA] flex flex-col items-center justify-center">
                  <span className="mono-num text-xs text-[#9B9F98]">{String(i + 1).padStart(2, "0")}</span>
                </div>

                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="mono-num text-xs text-[#9B9F98]">#{o.order_id}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          o.payment_method === "cash" ? "bg-[#FEF3C7] text-[#92610A]" : "bg-[#E0E7FF] text-[#3730A3]"
                        }`}>
                          {o.payment_method === "cash" ? "CASH" : "CARD"}
                        </span>
                      </div>
                      <p className="text-[15px] font-semibold text-[#14171A] mt-1 truncate">{o.customer_name || "Customer"}</p>
                      {o.customer_address && (
                        <p className="text-xs text-[#6B7068] mt-0.5 leading-relaxed">{o.customer_address}</p>
                      )}
                    </div>
                    <p className="mono-num text-lg font-semibold text-[#14171A] shrink-0">Rs {Number(o.total).toFixed(0)}</p>
                  </div>

                  {/* Items */}
                  {o.items && o.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {o.items.map((it, idx) => (
                        <span key={idx} className="text-[11px] text-[#494D46] bg-[#F0F1ED] rounded-md px-2 py-1">
                          {it.name}{it.variant ? ` · ${it.variant}` : ""} ×{it.qty}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3.5">
                    {o.customer_phone && (
                      <a href={`tel:${o.customer_phone}`}
                        className="flex-1 text-center text-xs font-medium px-3 py-2 rounded-lg border border-[#E3E5E0] text-[#494D46] hover:bg-[#F5F6F4]">
                        📞 Call
                      </a>
                    )}
                    {o.customer_address && (
                      <a href={mapsLink(o.customer_address)} target="_blank" rel="noreferrer"
                        className="flex-1 text-center text-xs font-medium px-3 py-2 rounded-lg border border-[#E3E5E0] text-[#494D46] hover:bg-[#F5F6F4]">
                        🗺 Navigate
                      </a>
                    )}
                    {outForDelivery ? (
                      <button onClick={() => handleDeliver(o.id)} disabled={delivering === o.id}
                        className="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-50">
                        {delivering === o.id ? "…" : "✓ Delivered"}
                      </button>
                    ) : (
                      <span className="flex-1 text-center text-xs text-[#9B9F98] px-3 py-2">Start delivery to complete</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Trip summary footer */}
          <div className="rounded-xl bg-[#14171A] text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Trip total · {activeOrders.length} stop{activeOrders.length > 1 ? "s" : ""}</p>
              <p className="mono-num text-xl font-semibold mt-0.5">Rs {grandTotal.toLocaleString()}</p>
            </div>
            {cashTotal > 0 && (
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-white/40">Cash to collect</p>
                <p className="mono-num text-lg font-semibold mt-0.5 text-[#FCD34D]">Rs {cashTotal.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}