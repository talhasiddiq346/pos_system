"use client";
import type { CartItem } from "@/components/pos/CartPanel";

export default function CallCartPanel({
  cart,
  branchName,
  checkingOut,
  onChangeQuantity,
  onRemove,
  onCheckout,
}: {
  cart: CartItem[];
  branchName: string;
  checkingOut: boolean;
  onChangeQuantity: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
}) {
  const total = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);

  return (
    <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden sticky top-6">
      <div className="px-4 py-3 border-b border-[#D0D3CB] flex items-center justify-between">
        <h2 className="font-medium text-[#1B1D1E]">Order</h2>
        {branchName && <span className="text-xs text-[#494D46]">{branchName}</span>}
      </div>

      {cart.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#494D46]">No items added yet.</p>
      ) : (
        <ul className="divide-y divide-[#EDEFEA]">
          {cart.map((c) => (
            <li key={c.key} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-[#1B1D1E]">{c.product_name}</p>
                  {c.variant_name && <p className="text-xs text-[#494D46]">{c.variant_name}</p>}
                  {c.addon_summary && c.addon_summary.length > 0 && (
                    <p className="text-[11px] text-[#6B7068]">+ {c.addon_summary.map((a) => a.name).join(", ")}</p>
                  )}
                </div>
                <button onClick={() => onRemove(c.key)} className="text-xs text-[#9E3527]">×</button>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => onChangeQuantity(c.key, -1)} className="w-6 h-6 rounded-md border border-[#D0D3CB] text-sm">−</button>
                  <span className="mono-num text-sm w-5 text-center">{c.quantity}</span>
                  <button onClick={() => onChangeQuantity(c.key, 1)} className="w-6 h-6 rounded-md border border-[#D0D3CB] text-sm">+</button>
                </div>
                <span className="mono-num text-sm text-[#1B1D1E]">
                  Rs {(c.unit_price * c.quantity).toFixed(2)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 py-3 border-t border-[#D0D3CB] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#1B1D1E]">Total</span>
          <span className="mono-num text-lg font-medium text-[#1B1D1E]">Rs {total.toFixed(2)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={cart.length === 0 || checkingOut}
          className="w-full text-sm px-4 py-2 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50"
        >
          {checkingOut ? "Placing order..." : "Place order"}
        </button>
      </div>
    </div>
  );
}