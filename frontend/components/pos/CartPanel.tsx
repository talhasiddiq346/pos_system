"use client";
import { useState } from "react";

export type CartItem = {
  key: string;
  product_id: number;
  product_name: string;
  variant_id: number | null;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  addon_option_ids?: number[];
  addon_summary?: { name: string; price: number }[];
};

export default function CartPanel({
  cart,
  branchName,
  customerName,
  paymentMethod,
  voucherCode,
  voucherError,
  discountAmount,
  taxRate,
  checkingOut,
  onChangeQuantity,
  onRemove,
  onCustomerNameChange,
  onPaymentMethodChange,
  onVoucherCodeChange,
  onApplyVoucher,
  onCheckout,
}: {
  cart: CartItem[];
  branchName: string;
  customerName: string;
  paymentMethod: "cash" | "card";
  voucherCode: string;
  voucherError: string;
  discountAmount: number;
  taxRate: number;
  checkingOut: boolean;
  onChangeQuantity: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onCustomerNameChange: (v: string) => void;
  onPaymentMethodChange: (v: "cash" | "card") => void;
  onVoucherCodeChange: (v: string) => void;
  onApplyVoucher: () => void;
  onCheckout: () => void;
}) {
  const [showVoucherInput, setShowVoucherInput] = useState(false);
  const subtotal = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);
  const afterDiscount = Math.max(subtotal - discountAmount, 0);
  const taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
  const total = afterDiscount + taxAmount;

  return (
    <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden sticky top-6">
      <div className="px-4 py-3 border-b border-[#D0D3CB] flex items-center justify-between">
        <h2 className="font-medium text-[#1B1D1E]">Order Summary</h2>
        {branchName && <span className="text-xs text-[#494D46]">{branchName}</span>}
      </div>

      {cart.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#494D46]">Cart is empty.</p>
      ) : (
        <ul className="divide-y divide-[#EDEFEA] max-h-80 overflow-y-auto">
          {cart.map((c) => (
            <li key={c.key} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-[#1B1D1E] truncate">{c.product_name}</p>
                  {c.variant_name && <p className="text-xs text-[#494D46]">{c.variant_name}</p>}
                  {c.addon_summary && c.addon_summary.length > 0 && (
                    <p className="text-[11px] text-[#6B7068] truncate">+ {c.addon_summary.map((a) => a.name).join(", ")}</p>
                  )}
                </div>
                <button onClick={() => onRemove(c.key)} className="text-xs text-[#9E3527] shrink-0">×</button>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => onChangeQuantity(c.key, -1)} className="w-6 h-6 rounded-md border border-[#D0D3CB] text-sm">−</button>
                  <span className="mono-num text-sm w-5 text-center">{c.quantity}</span>
                  <button onClick={() => onChangeQuantity(c.key, 1)} className="w-6 h-6 rounded-md border border-[#D0D3CB] text-sm">+</button>
                </div>
                <span className="mono-num text-sm text-[#1B1D1E]">Rs {(c.unit_price * c.quantity).toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 py-3 border-t border-[#D0D3CB] space-y-2.5">
        <input
          placeholder="Customer name (optional)"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          className="w-full border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
        />

        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as "cash" | "card")}
          className="w-full border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select>

        {showVoucherInput ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <input
                placeholder="Voucher code"
                value={voucherCode}
                onChange={(e) => onVoucherCodeChange(e.target.value.toUpperCase())}
                className="flex-1 border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
              />
              <button
                onClick={onApplyVoucher}
                disabled={!voucherCode.trim()}
                className="text-xs px-3 py-1.5 rounded-md bg-[#1B1D1E] text-white font-medium disabled:opacity-40"
              >
                Apply
              </button>
            </div>
            {voucherError && <p className="text-xs text-[#9E3527]">{voucherError}</p>}
          </div>
        ) : (
          <button onClick={() => setShowVoucherInput(true)} className="text-xs text-[#2F7D6B] font-medium hover:underline">
            + Add discount code
          </button>
        )}

        <div className="pt-1 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#494D46]">Subtotal</span>
            <span className="mono-num text-[#1B1D1E]">Rs {subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#1F6F54]">Discount</span>
              <span className="mono-num text-[#1F6F54]">− Rs {discountAmount.toFixed(2)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#494D46]">Tax ({taxRate}%)</span>
              <span className="mono-num text-[#1B1D1E]">Rs {taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-medium text-[#1B1D1E]">Total</span>
            <span className="mono-num text-lg font-medium text-[#1B1D1E]">Rs {total.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={onCheckout}
          disabled={cart.length === 0 || checkingOut}
          className="w-full text-sm px-4 py-2.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50"
        >
          {checkingOut ? "Processing..." : "Confirm Payment"}
        </button>
      </div>
    </div>
  );
}
