"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import StatusBadge from "@/components/shared/StatusBadge";
import type { OrderWithItems } from "@/lib/types";
import AssignRiderDropdown from "./AssignRiderDropdown";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function KitchenCard({
  order,
  onRefresh,
}: {
  order: OrderWithItems;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAssign, setShowAssign] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [hasRiders, setHasRiders] = useState<boolean | null>(null);

  const orderType = order.order_type;
  const isDelivery = orderType === "delivery";
  const isDineIn = orderType === "dine_in";
  const assignment = (order as any).assignment;

  // Agar order ready + delivery hai, check karo rider available hai ya nahi
  useEffect(() => {
    if (order.status === "ready" && isDelivery && !assignment) {
      api.get<any[]>("/riders/branch-riders").then((res) => {
        const available = res.data.some(
          (r) => ["available", "busy"].includes(r.rider_status) && Number(r.active_orders) < 5
        );
        setHasRiders(available);
      });
    }
  }, [order.status]);

  async function updateStatus(status: string) {
    setError("");
    setLoading(true);
    try {
      await api.patch(`/orders/${order.id}/status`, { status });
      onRefresh();
    } catch (err) { setError(errMsg(err)); }
    finally { setLoading(false); }
  }

  const timeAgo = () => {
    const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    return `${mins} mins ago`;
  };

  const accent =
    order.status === "pending" ? "#F0C9C2" :
    order.status === "preparing" ? "#BAD0F5" : "#C7E2DA";

  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: accent }}>
      <div className="px-4 py-3 border-b border-[#EDEFEA] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="mono-num text-sm font-semibold text-[#14171A]">#{order.id}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              isDelivery ? "bg-[#E0E7FF] text-[#3730A3]" : isDineIn ? "bg-[#FDEBD3] text-[#92610A]" : "bg-[#F0F1ED] text-[#494D46]"
            }`}>
              {isDelivery ? "🛵 DELIVERY" : isDineIn ? `🍽️ DINE IN${order.restaurant_table_name ? ` · ${order.restaurant_table_name}` : ""}` : "🥡 TAKEAWAY"}
            </span>
          </div>
          {order.customer_name && (
            <p className="text-xs text-[#6B7068] mt-0.5 truncate">{order.customer_name} · {timeAgo()}</p>
          )}
        </div>
        <StatusBadge status={order.status} />
      </div>

      <ul className="px-4 py-3 space-y-1.5">
        {order.items.map((it) => (
          <li key={it.id} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#14171A]">
                {it.product_name}
                {it.variant_name && <span className="text-[#6B7068]"> · {it.variant_name}</span>}
              </span>
              <span className="mono-num text-[#6B7068] font-medium">×{it.quantity}</span>
            </div>
            {it.selected_addons && it.selected_addons.length > 0 && (
              <p className="text-xs text-[#8A6D1F] mt-0.5">+ {it.selected_addons.map((a) => a.name).join(", ")}</p>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="mx-4 mb-2 text-xs text-[#9E3527]">{error}</p>}

      <div className="px-4 pb-3">
        {order.status === "pending" && (
          <button onClick={() => updateStatus("preparing")} disabled={loading}
            className="w-full text-sm py-2 rounded-lg bg-[#EAF1FB] text-[#1D5A99] font-medium hover:bg-[#D5E6FA] disabled:opacity-50">
            Start preparing
          </button>
        )}

        {order.status === "preparing" && (
          <button onClick={() => updateStatus("ready")} disabled={loading}
            className="w-full text-sm py-2 rounded-lg bg-[#E6F2EF] text-[#1F6F54] font-medium hover:bg-[#D0EAE4] disabled:opacity-50">
            Mark ready
          </button>
        )}

        {/* Delivery ready */}
        {order.status === "ready" && isDelivery && !assignedTo && (
          <>
            {hasRiders === false ? (
              <div className="text-center text-xs text-[#92610A] py-2.5 bg-[#FEF9E7] rounded-lg">
                ⏳ No rider available — waiting in queue
                <span className="block text-[10px] text-[#B5924A] mt-0.5">A rider will accept it when free</span>
              </div>
            ) : (
              <button onClick={() => setShowAssign(!showAssign)}
                className="w-full text-sm py-2 rounded-lg bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">
                {showAssign ? "Close" : "🛵 Assign rider"}
              </button>
            )}
          </>
        )}

        {order.status === "ready" && !isDelivery && (
          <div className="text-center text-xs text-[#1F6F54] py-2 bg-[#E6F2EF] rounded-lg">
            ✓ Ready for customer pickup
          </div>
        )}

        {assignedTo && (
          <div className="text-center text-sm text-[#1F6F54] py-2 bg-[#E6F2EF] rounded-lg font-medium">
            ✓ Assigned to {assignedTo}
          </div>
        )}
      </div>

      {showAssign && isDelivery && !assignedTo && (
        <div className="px-4 pb-4">
          <AssignRiderDropdown
            orderId={order.id}
            onAssigned={(name) => {
              setAssignedTo(name);
              setShowAssign(false);
              setTimeout(onRefresh, 1200);
            }}
            onCancel={() => setShowAssign(false)}
          />
        </div>
      )}
    </div>
  );
}