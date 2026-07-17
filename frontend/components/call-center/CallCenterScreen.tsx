"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { Product, OrderWithItems, User } from "@/lib/types";
import type { CartItem } from "@/components/pos/CartPanel";
import type { OrderType } from "./CallCustomerForm";
import MenuGrid from "@/components/pos/MenuGrid";
import ProductOptionsModal, { PosSelection } from "@/components/pos/ProductOptionsModal";
import CallCustomerForm from "./CallCustomerForm";
import CallCartPanel from "./CallCartPanel";

type Branch = { id: number; name: string };

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function CallCenterScreen({ user }: { user: User }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [productModal, setProductModal] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    api.get<Branch[]>("/branches").then((res) => {
      setBranches(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedBranchId) { setProducts([]); return; }
    setLoadingProducts(true);
    setCart([]);
    setSuccess("");
    api.get<Product[]>("/products", { params: { branch_id: selectedBranchId } })
      .then((res) => { setProducts(res.data); setLoadingProducts(false); });
  }, [selectedBranchId]);

  function handleBranchSelect(id: number) {
    setSelectedBranchId(id);
    setSelectedBranchName(branches.find((b) => b.id === id)?.name ?? "");
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

  async function handleCheckout() {
    setError("");

    if (!selectedBranchId) { setError("Please select a branch"); return; }
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    if (orderType === "delivery" && !customerPhone.trim()) {
      setError("Phone number is required for delivery orders"); return;
    }
    if (orderType === "delivery" && !customerAddress.trim()) {
      setError("Delivery address is required"); return;
    }
    if (cart.length === 0) { setError("Cart is empty"); return; }

    setCheckingOut(true);
    try {
      const res = await api.post<OrderWithItems>("/orders", {
        items: cart.map((c) => ({
          product_id: c.product_id,
          variant_id: c.variant_id,
          quantity: c.quantity,
          addon_option_ids: c.addon_option_ids || [],
        })),
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_address: orderType === "delivery" ? customerAddress : null,
        payment_method: paymentMethod,
        branch_id: selectedBranchId,
        source: "call_center",
        order_type: orderType,
      });

      const typeLabel = orderType === "delivery" ? "Delivery" : "Takeaway";
      setSuccess(
        `✅ ${typeLabel} order #${res.data.id} placed for ${selectedBranchName}. ` +
        `Total: Rs ${Number(res.data.total).toFixed(2)}`
      );
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <p className="text-sm text-[#494D46]">Loading branches...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-[#1F6F54] bg-[#E6F2EF] border border-[#C7E2DA] rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-4">
        <label className="text-xs font-medium text-[#494D46] uppercase tracking-wide block mb-1.5">
          Customer's branch <span className="text-[#9E3527]">*</span>
        </label>
        <select
          value={selectedBranchId}
          onChange={(e) => handleBranchSelect(Number(e.target.value))}
          className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
        >
          <option value="">— Select branch —</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {!selectedBranchId ? (
        <p className="text-sm text-[#494D46]">Select a branch to load its menu.</p>
      ) : (
        <>
          <CallCustomerForm
            customerName={customerName}
            customerPhone={customerPhone}
            customerAddress={customerAddress}
            paymentMethod={paymentMethod}
            orderType={orderType}
            onNameChange={setCustomerName}
            onPhoneChange={setCustomerPhone}
            onAddressChange={setCustomerAddress}
            onPaymentChange={setPaymentMethod}
            onOrderTypeChange={setOrderType}
          />

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              {loadingProducts ? (
                <p className="text-sm text-[#494D46]">Loading menu...</p>
              ) : (
                <MenuGrid products={products} onOpenProduct={setProductModal} />
              )}
            </div>
            <div className="w-full lg:w-80 shrink-0">
              <CallCartPanel
                cart={cart}
                branchName={selectedBranchName}
                checkingOut={checkingOut}
                onChangeQuantity={(key, delta) =>
                  setCart((prev) =>
                    prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c)
                      .filter((c) => c.quantity > 0)
                  )
                }
                onRemove={(key) => setCart((prev) => prev.filter((c) => c.key !== key))}
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