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

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Primary action — full width, big */}
      {riderStatus === "offline" && (
        <button
          onClick={() => changeStatus("available")}
          disabled={changingStatus}
          className="w-full h-14 rounded-2xl bg-[#2F7D6B] text-white font-semibold text-base hover:bg-[#27695A] active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
        >
          {changingStatus ? "..." : "🟢 Go online"}
        </button>
      )}

      {(riderStatus === "available" || riderStatus === "busy") && activeOrders.length > 0 && !outForDelivery && (
        <button
          onClick={() => changeStatus("out_for_delivery")}
          disabled={changingStatus}
          className="w-full h-14 rounded-2xl bg-[#E8542F] text-white font-semibold text-base hover:bg-[#D64822] active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
        >
          {changingStatus ? "..." : `🛵 Start delivery · ${activeOrders.length} stop${activeOrders.length > 1 ? "s" : ""}`}
        </button>
      )}

      {(riderStatus === "available" || riderStatus === "busy") && (
        <button
          onClick={() => changeStatus("offline")}
          disabled={changingStatus}
          className="w-full h-11 rounded-xl border border-[#E3E5E0] text-[#494D46] font-medium hover:bg-[#F5F6F4] disabled:opacity-50 transition-colors"
        >
          Go offline
        </button>
      )}

      {outForDelivery && (
        <div className="bg-[#FFF0E8] border border-[#FDBA9A] rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🛵</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#E8542F]">You're on the road</p>
            <p className="text-xs text-[#B84520] mt-0.5">Tap "Delivered" on each order below</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6D9D2] bg-white px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F0F1ED] mx-auto flex items-center justify-center text-3xl">📦</div>
          <p className="text-base font-semibold text-[#14171A] mt-4">No orders yet</p>
          <p className="text-sm text-[#6B7068] mt-1.5">
            {riderStatus === "offline" ? "Go online to start receiving orders" : "New assignments will appear here instantly"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((o, i) => (
            <div key={o.id} className="rounded-2xl border border-[#E3E5E0] bg-white overflow-hidden shadow-sm">
              {/* Card header */}
              <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="mono-num text-xs font-bold text-white bg-[#14171A] rounded-full w-6 h-6 flex items-center justify-center">{i + 1}</span>
                  <span className="mono-num text-sm text-[#6B7068]">#{o.order_id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    o.payment_method === "cash" ? "bg-[#FEF3C7] text-[#92610A]" : "bg-[#E0E7FF] text-[#3730A3]"
                  }`}>
                    {o.payment_method === "cash" ? "CASH" : "CARD"}
                  </span>
                </div>
                <p className="mono-num text-lg font-bold text-[#14171A] shrink-0">Rs {Number(o.total).toFixed(0)}</p>
              </div>

              {/* Customer info */}
              <div className="px-4 pb-3">
                <p className="text-base font-semibold text-[#14171A] truncate">{o.customer_name || "Customer"}</p>
                {o.customer_address && (
                  <p className="text-sm text-[#6B7068] mt-1 leading-relaxed">📍 {o.customer_address}</p>
                )}
              </div>

              {/* Items */}
              {o.items && o.items.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {o.items.map((it, idx) => (
                      <span key={idx} className="text-xs text-[#494D46] bg-[#F5F6F4] rounded-lg px-2.5 py-1.5">
                        {it.name}{it.variant ? ` · ${it.variant}` : ""} × <span className="font-semibold">{it.qty}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions — call/navigate row (equal split) */}
              <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                <a
                  href={o.customer_phone ? `tel:${o.customer_phone}` : "#"}
                  className={`h-12 flex items-center justify-center gap-2 rounded-xl border border-[#E3E5E0] text-[#494D46] font-medium text-sm active:scale-[0.98] transition-transform ${
                    !o.customer_phone ? "opacity-40 pointer-events-none" : "hover:bg-[#F5F6F4]"
                  }`}
                >
                  📞 Call
                </a>
                <a
                  href={o.customer_address ? mapsLink(o.customer_address) : "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={`h-12 flex items-center justify-center gap-2 rounded-xl border border-[#E3E5E0] text-[#494D46] font-medium text-sm active:scale-[0.98] transition-transform ${
                    !o.customer_address ? "opacity-40 pointer-events-none" : "hover:bg-[#F5F6F4]"
                  }`}
                >
                  🗺 Navigate
                </a>
              </div>

              {/* Delivered button — full width, prominent when active */}
              <div className="px-4 pb-4">
                {outForDelivery ? (
                  <button
                    onClick={() => handleDeliver(o.id)}
                    disabled={delivering === o.id}
                    className="w-full h-12 rounded-xl bg-[#2F7D6B] text-white font-semibold text-sm hover:bg-[#27695A] disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {delivering === o.id ? "Marking..." : "✓ Mark as Delivered"}
                  </button>
                ) : (
                  <div className="w-full h-12 rounded-xl bg-[#F5F6F4] flex items-center justify-center">
                    <span className="text-xs text-[#9B9F98]">Start delivery to complete</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Trip summary — sticky-ish at end */}
          <div className="rounded-2xl bg-gradient-to-br from-[#14171A] to-[#2A2E32] text-white overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Trip total · {activeOrders.length} stop{activeOrders.length > 1 ? "s" : ""}</p>
                <p className="mono-num text-2xl font-bold mt-0.5">Rs {grandTotal.toLocaleString()}</p>
              </div>
              {cashTotal > 0 && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Cash to collect</p>
                  <p className="mono-num text-xl font-bold mt-0.5 text-[#FCD34D]">Rs {cashTotal.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}