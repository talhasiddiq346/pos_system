"use client";
import StatusBadge from "@/components/shared/StatusBadge";
import { api } from "@/lib/api";
import type { Order, Role } from "@/lib/types";

type Branch = { id: number; name: string };

// Cancel sirf yeh statuses pe allowed nahi
const NO_CANCEL = ["dispatched", "delivered", "completed", "cancelled"];

// Dispatch sirf delivery riders aur admins karein
const CAN_DISPATCH = ["delivery", "branch_admin", "super_admin"];

// Cancel sirf admin levels
const CAN_CANCEL = ["cashier", "branch_admin", "super_admin"];

export default function OrdersTable({
  orders,
  branches,
  isSuperAdmin,
  viewerRole,
  onView,
  onRefresh,
}: {
  orders: Order[];
  branches: Branch[];
  isSuperAdmin: boolean;
  viewerRole: Role;
  onView: (id: number) => void;
  onRefresh: () => void;
}) {
  async function handleStatusUpdate(id: number, status: string) {
    await api.patch(`/orders/${id}/status`, { status });
    onRefresh();
  }

  if (orders.length === 0) {
    return <p className="px-5 py-6 text-sm text-[#494D46]">No orders yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[#494D46] border-b border-[#D0D3CB]">
          <th className="px-5 py-2 font-normal mono-num">Order</th>
          <th className="px-5 py-2 font-normal">Customer</th>
          <th className="px-5 py-2 font-normal">Source</th>
          <th className="px-5 py-2 font-normal">Type</th>
          <th className="px-5 py-2 font-normal">Status</th>
          <th className="px-5 py-2 font-normal mono-num">Total</th>
          {isSuperAdmin && <th className="px-5 py-2 font-normal">Branch</th>}
          <th className="px-5 py-2 font-normal">When</th>
          <th className="px-5 py-2 font-normal text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const bName = isSuperAdmin
            ? branches.find((b) => b.id === o.branch_id)?.name ?? `Branch #${o.branch_id}`
            : "";

          const showDispatch = CAN_DISPATCH.includes(viewerRole) && o.status === "ready" && o.order_type === "delivery";
          const showCancel = CAN_CANCEL.includes(viewerRole) && !NO_CANCEL.includes(o.status);

          return (
            <tr key={o.id} className="border-b border-[#EDEFEA] last:border-0">
              <td className="px-5 py-3 mono-num text-[#1B1D1E]">#{o.id}</td>
              <td className="px-5 py-3 text-[#494D46]">
                {o.customer_name || "Walk-in"}
                {o.customer_phone && (
                  <span className="block text-xs">{o.customer_phone}</span>
                )}
              </td>
              <td className="px-5 py-3 text-[#494D46] capitalize">
                {o.source.replace("_", " ")}
              </td>
              <td className="px-5 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  o.order_type === "delivery"
                    ? "bg-[#EAF1FB] text-[#1D5A99]"
                    : "bg-[#F0F1ED] text-[#494D46]"
                }`}>
                  {o.order_type === "delivery" ? "🛵 Delivery" : "🥡 Takeaway"}
                </span>
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-5 py-3 mono-num text-[#1B1D1E]">
                Rs {Number(o.total).toFixed(2)}
              </td>
              {isSuperAdmin && (
                <td className="px-5 py-3 text-[#494D46]">{bName}</td>
              )}
              <td className="px-5 py-3 text-[#494D46]">
                {new Date(o.created_at).toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onView(o.id)}
                    className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] text-[#1B1D1E] font-medium hover:bg-[#F5F6F4]"
                  >
                    View
                  </button>

                  {showDispatch && (
                    <button
                      onClick={() => handleStatusUpdate(o.id, "dispatched")}
                      className="text-xs px-2.5 py-1 rounded-md bg-[#E6F2EF] text-[#1F6F54] font-medium hover:bg-[#D0EAE4]"
                    >
                      Dispatch ✓
                    </button>
                  )}

                  {showCancel && (
                    <button
                      onClick={() => handleStatusUpdate(o.id, "cancelled")}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}