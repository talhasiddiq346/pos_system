"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { openPrintableReceipt } from "@/lib/receipt";
import type { Product, OrderWithItems, User } from "@/lib/types";
import MenuGrid from "./MenuGrid";
import CartPanel, { CartItem } from "./CartPanel";
import ProductOptionsModal, { PosSelection } from "./ProductOptionsModal";
import { useSocket } from "@/components/shared/useSocket";
import { triggerToast } from "@/components/shared/NotificationToast";

type Branch = { id: number; name: string; is_open?: boolean };

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
  const [branchOpen, setBranchOpen] = useState(true);
  const [togglingBranchStatus, setTogglingBranchStatus] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());
  const [taxRate, setTaxRate] = useState(0);

  const [productModal, setProductModal] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherError, setVoucherError] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Branch[]>("/branches").then((res) => { setBranches(res.data); setLoading(false); });
    } else {
      api.get<Branch>("/branches/me").then((res) => {
        setSelectedBranchName(res.data.name);
        setBranchOpen(res.data.is_open !== false);
        setLoading(false);
      });
    }
    api.get("/settings").then((res) => setTaxRate(Number(res.data.tax_rate) || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
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
    api.get<Product[]>("/products", {
      params: isSuperAdmin ? { branch_id: selectedBranchId } : {},
    }).then((res) => { setProducts(res.data); setLoadingProducts(false); });
    if (isSuperAdmin) {
      setBranchOpen(branches.find((b) => b.id === selectedBranchId)?.is_open !== false);
    }
  }, [selectedBranchId]);

  function handleBranchSelect(id: number) {
    setSelectedBranchId(id);
    setSelectedBranchName(branches.find((b) => b.id === id)?.name ?? "");
  }

  async function handleToggleBranchStatus() {
    if (!selectedBranchId) return;
    setTogglingBranchStatus(true);
    try {
      const res = await api.patch<Branch>(`/branches/${selectedBranchId}/status`, { is_open: !branchOpen });
      setBranchOpen(res.data.is_open !== false);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setTogglingBranchStatus(false);
    }
  }

  function addToCart(p: Product, selection: PosSelection) {
    const addonKey = [...selection.addon_option_ids].sort((a, b) => a - b).join(",");
    const key = `${p.id}-${selection.variant_id ?? "base"}-${addonKey}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + selection.quantity } : c);
      return [...prev, {
        key, product_id: p.id, product_name: p.name,
        variant_id: selection.variant_id, variant_name: selection.variant_name,
        unit_price: selection.unit_price, quantity: selection.quantity,
        addon_option_ids: selection.addon_option_ids, addon_summary: selection.addon_summary,
      }];
    });
    setProductModal(null);
  }

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);

  async function handleApplyVoucher() {
    setVoucherError("");
    if (!voucherCode.trim() || subtotal <= 0) return;
    try {
      const res = await api.post<{ discount_amount: number }>("/settings/vouchers/validate", {
        code: voucherCode.trim(), order_amount: subtotal,
      });
      setDiscountAmount(res.data.discount_amount);
    } catch (err) {
      setDiscountAmount(0);
      setVoucherError(errMsg(err));
    }
  }

  async function handleCheckout() {
    if (cart.length === 0 || !selectedBranchId) return;
    setError("");
    setCheckingOut(true);
    try {
      const res = await api.post<OrderWithItems>("/orders", {
        items: cart.map((c) => ({
          product_id: c.product_id, variant_id: c.variant_id, quantity: c.quantity,
          addon_option_ids: c.addon_option_ids || [],
        })),
        customer_name: customerName || null,
        payment_method: paymentMethod,
        branch_id: isSuperAdmin ? selectedBranchId : undefined,
        order_type: "takeaway",
        voucher_code: discountAmount > 0 ? voucherCode.trim() : null,
      });
      openPrintableReceipt(res.data, selectedBranchName, user.name);
      setCart([]);
      setCustomerName("");
      setVoucherCode("");
      setDiscountAmount(0);
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
        <>
          <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#1B1D1E]">{selectedBranchName}</span>
              <button
                onClick={handleToggleBranchStatus}
                disabled={togglingBranchStatus}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  branchOpen ? "bg-[#E6F2EF] text-[#1F6F54] hover:bg-[#D6ECE5]" : "bg-[#FBEAE7] text-[#9E3527] hover:bg-[#F5D9D3]"
                }`}
              >
                {branchOpen ? "● Open" : "● Closed"}
              </button>
            </div>
            <span className="text-sm text-[#6B7068] mono-num">
              {now.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {" · "}
              {now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              {error && <p className="mb-4 text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}
              {loadingProducts ? (
                <p className="text-sm text-[#494D46]">Loading menu...</p>
              ) : (
                <MenuGrid products={products} onOpenProduct={setProductModal} />
              )}
            </div>
            <div className="w-full lg:w-80 shrink-0">
              <CartPanel
                cart={cart}
                branchName={selectedBranchName}
                customerName={customerName}
                paymentMethod={paymentMethod}
                voucherCode={voucherCode}
                voucherError={voucherError}
                discountAmount={discountAmount}
                taxRate={taxRate}
                checkingOut={checkingOut}
                onChangeQuantity={(key, delta) => setCart((prev) => prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0))}
                onRemove={(key) => setCart((prev) => prev.filter((c) => c.key !== key))}
                onCustomerNameChange={setCustomerName}
                onPaymentMethodChange={setPaymentMethod}
                onVoucherCodeChange={(v) => { setVoucherCode(v); setVoucherError(""); setDiscountAmount(0); }}
                onApplyVoucher={handleApplyVoucher}
                onCheckout={handleCheckout}
              />
            </div>
          </div>
        </>
      )}

      {productModal && (
        <ProductOptionsModal
          product={productModal}
          onClose={() => setProductModal(null)}
          onConfirm={(selection) => addToCart(productModal, selection)}
        />
      )}
    </div>
  );
}
