"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { openPrintableReceipt } from "@/lib/receipt";
import type { Product, OrderWithItems, User } from "@/lib/types";
import MenuGrid from "./MenuGrid";
import CartPanel, { CartItem } from "./CartPanel";
import { useSocket } from "@/components/shared/useSocket";
import { triggerToast } from "@/components/shared/NotificationToast";

type Branch = { id: number; name: string };

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function POSScreen({ user }: { user: User }) {
  const isSuperAdmin = user.role === "super_admin";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">(
    isSuperAdmin ? "" : (user.branch_id ?? "")
  );
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Branch[]>("/branches").then((res) => { setBranches(res.data); setLoading(false); });
    } else {
      api.get<Branch>("/branches/me").then((res) => { setSelectedBranchName(res.data.name); setLoading(false); });
    }
  }, []);
  // Cashier ko new orders aur ready notifications milein
  useSocket(user.branch_id, user.role, {
    new_order: (data) => {
      triggerToast(`New order #${data.id} — ${data.source.replace("_", " ")}`, "order");
    },
    order_ready: (data) => {
      triggerToast(`Order #${data.id} is ready!`, "ready");
    },
  });


  useEffect(() => {
    if (!selectedBranchId) { setProducts([]); return; }
    setLoadingProducts(true);
    setCart([]);
    setExpandedId(null);
    api.get<Product[]>("/products", {
      params: isSuperAdmin ? { branch_id: selectedBranchId } : {},
    }).then((res) => { setProducts(res.data); setLoadingProducts(false); });
  }, [selectedBranchId]);

  function handleBranchSelect(id: number) {
    setSelectedBranchId(id);
    setSelectedBranchName(branches.find((b) => b.id === id)?.name ?? "");
  }

  function addToCart(p: Product, variantId: number | null, variantName: string | null, price: number) {
    const key = `${p.id}-${variantId ?? "base"}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { key, product_id: p.id, product_name: p.name, variant_id: variantId, variant_name: variantName, unit_price: price, quantity: 1 }];
    });
  }

  async function handleCheckout() {
    if (cart.length === 0 || !selectedBranchId) return;
    setError("");
    setCheckingOut(true);
    try {
      const res = await api.post<OrderWithItems>("/orders", {
        items: cart.map((c) => ({ product_id: c.product_id, variant_id: c.variant_id, quantity: c.quantity })),
        customer_name: customerName || null,
        payment_method: paymentMethod,
        branch_id: isSuperAdmin ? selectedBranchId : undefined,
      });
      openPrintableReceipt(res.data, selectedBranchName, user.name);
      setCart([]);
      setCustomerName("");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <p className="text-sm text-[#494D46]">Loading...</p>;

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-4">
          <label className="text-xs font-medium text-[#494D46] uppercase tracking-wide block mb-1.5">Select branch to order for</label>
          <select value={selectedBranchId} onChange={(e) => handleBranchSelect(Number(e.target.value))} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm">
            <option value="">— Pick a branch —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {!selectedBranchId && isSuperAdmin ? (
        <p className="text-sm text-[#494D46]">Select a branch above to load its menu.</p>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            {error && <p className="mb-4 text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}
            {loadingProducts ? (
              <p className="text-sm text-[#494D46]">Loading menu...</p>
            ) : (
              <MenuGrid
                products={products}
                expandedId={expandedId}
                onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                onAddToCart={addToCart}
              />
            )}
          </div>
          <div className="w-full lg:w-80 shrink-0">
            <CartPanel
              cart={cart}
              branchName={selectedBranchName}
              customerName={customerName}
              paymentMethod={paymentMethod}
              checkingOut={checkingOut}
              onChangeQuantity={(key, delta) => setCart((prev) => prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0))}
              onRemove={(key) => setCart((prev) => prev.filter((c) => c.key !== key))}
              onCustomerNameChange={setCustomerName}
              onPaymentMethodChange={setPaymentMethod}
              onCheckout={handleCheckout}
            />
          </div>
        </div>
      )}
    </div>
  );
}