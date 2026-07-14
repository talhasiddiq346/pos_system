"use client";

export type CartItem = {
  key: string;
  product_id: number;
  product_name: string;
  variant_id: number | null;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
};

export default function CartPanel({
  cart,
  branchName,
  customerName,
  paymentMethod,
  checkingOut,
  onChangeQuantity,
  onRemove,
  onCustomerNameChange,
  onPaymentMethodChange,
  onCheckout,
}: {
  cart: CartItem[];
  branchName: string;
  customerName: string;
  paymentMethod: "cash" | "card";
  checkingOut: boolean;
  onChangeQuantity: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onCustomerNameChange: (v: string) => void;
  onPaymentMethodChange: (v: "cash" | "card") => void;
  onCheckout: () => void;
}) {
  const total = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);

  return (
    <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden sticky top-6">
      <div className="px-4 py-3 border-b border-[#D0D3CB] flex items-center justify-between">
        <h2 className="font-medium text-[#1B1D1E]">Current order</h2>
        {branchName && <span className="text-xs text-[#494D46]">{branchName}</span>}
      </div>

      {cart.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#494D46]">Cart is empty.</p>
      ) : (
        <ul className="divide-y divide-[#EDEFEA]">
          {cart.map((c) => (
            <li key={c.key} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-[#1B1D1E]">{c.product_name}</p>
                  {c.variant_name && <p className="text-xs text-[#494D46]">{c.variant_name}</p>}
                </div>
                <button onClick={() => onRemove(c.key)} className="text-xs text-[#9E3527]">×</button>
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

      <div className="px-4 py-3 border-t border-[#D0D3CB] space-y-2">
        <input placeholder="Customer name (optional)" value={customerName} onChange={(e) => onCustomerNameChange(e.target.value)} className="w-full border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" />
        <select value={paymentMethod} onChange={(e) => onPaymentMethodChange(e.target.value as "cash" | "card")} className="w-full border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-medium text-[#1B1D1E]">Total</span>
          <span className="mono-num text-lg font-medium text-[#1B1D1E]">Rs {total.toFixed(2)}</span>
        </div>
        <button onClick={onCheckout} disabled={cart.length === 0 || checkingOut} className="w-full text-sm px-4 py-2 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50">
          {checkingOut ? "Processing..." : "Charge & print receipt"}
        </button>
      </div>
    </div>
  );
}