"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { OrderWithItems, User } from "@/lib/types";
import KitchenCard from "./KitchenCard";
import { useSocket } from "@/components/shared/useSocket";
import { triggerToast } from "@/components/shared/NotificationToast";

const ACTIVE_STATUSES = ["pending", "preparing", "ready"];

export default function ChefScreen({ user }: { user: User }) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const res = await api.get<OrderWithItems[]>("/orders");
      const active = res.data
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
        .map(async (o) => {
          const detailed = await api.get<OrderWithItems>(`/orders/${o.id}`);
          return detailed.data;
        });
      setOrders(await Promise.all(active));
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);
  useSocket(user.branch_id, "chef", {
  new_order: (data) => {
    triggerToast(`New order #${data.id}`, "order");
    load();
  },
  order_needs_assignment: (data) => {
    if (data.has_riders) {
      triggerToast(`Order #${data.id} ready — assign a rider`, "ready");
    } else {
      triggerToast(`Order #${data.id} queued — no rider available`, "order");
    }
    load();
  },
  waiting_order_accepted: (data) => {
    triggerToast(`${data.rider_name} accepted order #${data.order_id}`, "ready");
    load();
  },
});


  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const pending   = orders.filter((o) => o.status === "pending");
  const preparing = orders.filter((o) => o.status === "preparing");
  const ready     = orders.filter((o) => o.status === "ready");

  if (loading) return <p className="text-sm text-[#494D46]">Loading kitchen orders...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#494D46]">
          Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString()}
        </p>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-md border border-[#C9CCC5] text-[#1B1D1E] font-medium hover:bg-[#F5F6F4]"
        >
          Refresh now
        </button>
      </div>

      {orders.length === 0 && (
        <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-10 text-center">
          <p className="text-sm text-[#494D46]">No active orders right now.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-[#8A6D1F] uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F0C9C2] inline-block" />
            New orders ({pending.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map((o) => <KitchenCard key={o.id} order={o} onRefresh={load} />)}
          </div>
        </section>
      )}

      {preparing.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-[#1D5A99] uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#BAD0F5] inline-block" />
            In kitchen ({preparing.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {preparing.map((o) => <KitchenCard key={o.id} order={o} onRefresh={load} />)}
          </div>
        </section>
      )}

      {ready.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-[#1F6F54] uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C7E2DA] inline-block" />
            Ready for pickup ({ready.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ready.map((o) => <KitchenCard key={o.id} order={o} onRefresh={load} />)}
          </div>
        </section>
      )}
    </div>
  );
}