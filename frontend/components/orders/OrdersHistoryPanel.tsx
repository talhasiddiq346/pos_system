"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Order, OrderWithItems, Role, User } from "@/lib/types";
import OrdersTable from "./OrdersTable";
import OrderModal from "./OrderModal";
import { useSocket } from "@/components/shared/useSocket";
import { triggerToast } from "@/components/shared/NotificationToast";

type Branch = { id: number; name: string };

export default function OrdersHistoryPanel({
  viewerRole,
  user,
}: {
  viewerRole: Role;
  user: User;
}) {
  const isSuperAdmin = viewerRole === "super_admin";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openOrder, setOpenOrder] = useState<OrderWithItems | null>(null);

  useSocket(user.branch_id, viewerRole, {
    new_order: (data) => {
      triggerToast(`New order #${data.id} received`, "order");
      loadOrders();
    },
    order_ready: (data) => {
      triggerToast(`Order #${data.id} is ready!`, "ready");
      loadOrders();
    },
  });

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Branch[]>("/branches").then((res) => {
        setBranches(res.data);
        loadOrders();
      });
    } else {
      loadOrders();
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) loadOrders();
  }, [branchFilter]);

  async function loadOrders() {
    setLoading(true);
    const res = await api.get<Order[]>("/orders", {
      params: isSuperAdmin && branchFilter ? { branch_id: branchFilter } : {},
    });
    setOrders(res.data);
    setLoading(false);
  }

  async function handleView(id: number) {
    const res = await api.get<OrderWithItems>(`/orders/${id}`);
    setOpenOrder(res.data);
  }

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-4">
          <label className="text-xs font-medium text-[#494D46] uppercase tracking-wide block mb-1.5">
            Filter by branch
          </label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : "")}
            className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
          >
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D0D3CB] flex items-center justify-between">
          <h2 className="font-medium text-[#1B1D1E]">Orders</h2>
          <button
            onClick={loadOrders}
            className="text-xs px-3 py-1.5 rounded-md border border-[#C9CCC5] text-[#1B1D1E] font-medium hover:bg-[#F5F6F4]"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-[#494D46]">Loading...</p>
        ) : (
          <OrdersTable
            orders={orders}
            branches={branches}
            isSuperAdmin={isSuperAdmin}
            viewerRole={viewerRole}
            onView={handleView}
            onRefresh={loadOrders}
          />
        )}
      </div>

      {openOrder && (
        <OrderModal
          order={openOrder}
          branches={branches}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setOpenOrder(null)}
        />
      )}
    </div>
  );
}