"use client";
import { openPrintableReceipt } from "@/lib/receipt";
import type { OrderWithItems } from "@/lib/types";

type Branch = { id: number; name: string };

export default function OrderModal({
  order,
  branches,
  isSuperAdmin,
  onClose,
}: {
  order: OrderWithItems;
  branches: Branch[];
  isSuperAdmin: boolean;
  onClose: () => void;
}) {
  const branchName = isSuperAdmin
    ? branches.find((b) => b.id === order.branch_id)?.name ?? `Branch #${order.branch_id}`
    : `Branch #${order.branch_id}`;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-[#1B1D1E] mono-num">Order #{order.id}</h3>
          <button onClick={onClose} className="text-[#494D46] text-sm">Close</button>
        </div>
        <p className="text-xs text-[#494D46] mb-3">
          {new Date(order.created_at).toLocaleString()} · {order.payment_method.toUpperCase()}
          {order.customer_name && ` · ${order.customer_name}`}
          {(order as any).customer_phone && ` · ${(order as any).customer_phone}`}
          {(order as any).customer_address && (
            <span className="block mt-0.5">📍 {(order as any).customer_address}</span>
          )}
          {isSuperAdmin && ` · ${branchName}`}
        </p>
        <ul className="space-y-1 text-sm mb-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>{it.product_name}{it.variant_name ? ` (${it.variant_name})` : ""} × {it.quantity}</span>
              <span className="mono-num">Rs {(Number(it.unit_price) * it.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-medium border-t border-[#D0D3CB] pt-2 mb-4">
          <span>Total</span>
          <span className="mono-num">Rs {Number(order.total).toFixed(2)}</span>
        </div>
        <button onClick={() => openPrintableReceipt(order, branchName)} className="w-full text-sm px-4 py-2 rounded-md bg-[#1B1D1E] text-white font-medium">
          Print receipt
        </button>
      </div>
    </div>
  );
}