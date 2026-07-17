"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { openPrintableReceipt } from "@/lib/receipt";
import type { Product, User } from "@/lib/types";
import MenuGrid from "./MenuGrid";
import ProductOptionsModal, { PosSelection } from "./ProductOptionsModal";

type Branch = { id: number; name: string };
type RestaurantTable = {
  id: number;
  branch_id: number;
  name: string;
  seats: number | null;
  open_order_id: number | null;
  open_subtotal: string | null;
  open_since: string | null;
};
type OpenOrderItem = {
  id: number;
  product_name: string;
  variant_name: string | null;
  unit_price: string;
  quantity: number;
  selected_addons?: { name: string; price: number }[];
};
type OpenOrder = {
  id: number;
  subtotal: string;
  items: OpenOrderItem[];
};

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function DineInScreen({ user }: { user: User }) {
  const isSuperAdmin = user.role === "super_admin";
  const canManageTables = user.role === "super_admin" || user.role === "branch_admin";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">(
    isSuperAdmin ? "" : (user.branch_id ?? "")
  );
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableSeats, setNewTableSeats] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [openOrder, setOpenOrder] = useState<OpenOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productModal, setProductModal] = useState<Product | null>(null);

  const [showFinalize, setShowFinalize] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Branch[]>("/branches").then((res) => { setBranches(res.data); setLoading(false); });
    } else {
      api.get<Branch>("/branches/me").then((res) => { setSelectedBranchName(res.data.name); setLoading(false); });
    }
  }, []);

  async function loadTables() {
    if (!selectedBranchId) return;
    setLoadingTables(true);
    const res = await api.get<RestaurantTable[]>("/tables", {
      params: isSuperAdmin ? { branch_id: selectedBranchId } : {},
    });
    setTables(res.data);
    setLoadingTables(false);
  }

  useEffect(() => {
    loadTables();
    if (isSuperAdmin && selectedBranchId) {
      setSelectedBranchName(branches.find((b) => b.id === selectedBranchId)?.name ?? "");
    }
  }, [selectedBranchId]);

  async function loadProducts() {
    if (!selectedBranchId) return;
    const res = await api.get<Product[]>("/products", {
      params: isSuperAdmin ? { branch_id: selectedBranchId } : {},
    });
    setProducts(res.data);
  }

  async function openTable(table: RestaurantTable) {
    setError("");
    setSelectedTable(table);
    await loadProducts();
    const res = await api.get<OpenOrder | null>(`/tables/${table.id}/order`);
    setOpenOrder(res.data);
  }

  async function refreshOpenOrder() {
    if (!selectedTable) return;
    const res = await api.get<OpenOrder | null>(`/tables/${selectedTable.id}/order`);
    setOpenOrder(res.data);
  }

  async function handleCreateTable() {
    if (!newTableName.trim() || !selectedBranchId) return;
    setCreatingTable(true);
    setError("");
    try {
      await api.post("/tables", {
        name: newTableName.trim(),
        seats: newTableSeats ? Number(newTableSeats) : null,
        branch_id: isSuperAdmin ? selectedBranchId : undefined,
      });
      setNewTableName("");
      setNewTableSeats("");
      await loadTables();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setCreatingTable(false);
    }
  }

  async function handleDeleteTable(id: number) {
    if (!confirm("Remove this table?")) return;
    try {
      await api.delete(`/tables/${id}`);
      await loadTables();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function addItemToTable(product: Product, selection: PosSelection) {
    if (!selectedTable) return;
    try {
      await api.post(`/tables/${selectedTable.id}/items`, {
        items: [{
          product_id: product.id, variant_id: selection.variant_id,
          quantity: selection.quantity, addon_option_ids: selection.addon_option_ids,
        }],
      });
      setProductModal(null);
      await refreshOpenOrder();
      await loadTables();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function removeItem(itemId: number) {
    if (!selectedTable) return;
    try {
      await api.delete(`/tables/${selectedTable.id}/items/${itemId}`);
      await refreshOpenOrder();
      await loadTables();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleFinalize() {
    if (!selectedTable) return;
    setFinalizing(true);
    setError("");
    try {
      const res = await api.post(`/tables/${selectedTable.id}/finalize`, {
        payment_method: paymentMethod,
        voucher_code: voucherCode.trim() || null,
      });
      openPrintableReceipt(res.data, selectedBranchName, user.name);
      setShowFinalize(false);
      setVoucherCode("");
      setSelectedTable(null);
      setOpenOrder(null);
      await loadTables();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) return <p className="text-sm text-[#494D46]">Loading...</p>;

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-4">
          <label className="text-xs font-medium text-[#494D46] uppercase tracking-wide block mb-1.5">Select branch</label>
          <select
            value={selectedBranchId}
            onChange={(e) => { setSelectedBranchId(Number(e.target.value)); setSelectedTable(null); setOpenOrder(null); }}
            className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
          >
            <option value="">— Pick a branch —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}

      {!selectedBranchId && isSuperAdmin ? (
        <p className="text-sm text-[#494D46]">Select a branch above to manage its tables.</p>
      ) : !selectedTable ? (
        <div className="space-y-4">
          {canManageTables && (
            <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-4 flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-xs font-medium text-[#494D46] uppercase tracking-wide block mb-1">Table name</label>
                <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="e.g. Table 1" className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#494D46] uppercase tracking-wide block mb-1">Seats</label>
                <input value={newTableSeats} onChange={(e) => setNewTableSeats(e.target.value)} type="number" min="1" placeholder="4" className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm w-20" />
              </div>
              <button onClick={handleCreateTable} disabled={creatingTable || !newTableName.trim()} className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50">
                {creatingTable ? "Adding..." : "+ Add table"}
              </button>
            </div>
          )}

          {loadingTables ? (
            <p className="text-sm text-[#494D46]">Loading tables...</p>
          ) : tables.length === 0 ? (
            <p className="text-sm text-[#494D46]">
              No tables configured yet. {canManageTables ? "Add one above." : "Ask your admin to set up tables."}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {tables.map((t) => {
                const occupied = !!t.open_order_id;
                return (
                  <div
                    key={t.id}
                    className={`relative rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                      occupied ? "border-[#F0A93B] bg-[#FFF8ED]" : "border-[#D0D3CB] bg-white hover:border-[#2F7D6B]"
                    }`}
                    onClick={() => openTable(t)}
                  >
                    <p className="font-semibold text-[#1B1D1E]">{t.name}</p>
                    {t.seats && <p className="text-xs text-[#6B7068]">{t.seats} seats</p>}
                    <p className={`text-xs font-medium mt-2 ${occupied ? "text-[#92610A]" : "text-[#1F6F54]"}`}>
                      {occupied ? `Occupied · Rs ${Number(t.open_subtotal).toFixed(0)}` : "Empty"}
                    </p>
                    {canManageTables && !occupied && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTable(t.id); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-[#9E3527] hover:bg-[#FBEAE7] flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => { setSelectedTable(null); setOpenOrder(null); }} className="text-sm text-[#2F7D6B] font-medium hover:underline">
              ← Back to tables
            </button>
            <span className="font-medium text-[#1B1D1E]">{selectedTable.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <MenuGrid products={products} onOpenProduct={setProductModal} />
            </div>
            <div className="w-full lg:w-80 shrink-0">
              <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden sticky top-6">
                <div className="px-4 py-3 border-b border-[#D0D3CB]">
                  <h2 className="font-medium text-[#1B1D1E]">{selectedTable.name} — Running Tab</h2>
                </div>
                {!openOrder || openOrder.items.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#494D46]">No items yet — add from the menu.</p>
                ) : (
                  <ul className="divide-y divide-[#EDEFEA] max-h-96 overflow-y-auto">
                    {openOrder.items.map((it) => (
                      <li key={it.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-[#1B1D1E] truncate">{it.quantity}× {it.product_name}</p>
                          {it.variant_name && <p className="text-xs text-[#494D46]">{it.variant_name}</p>}
                          {it.selected_addons && it.selected_addons.length > 0 && (
                            <p className="text-[11px] text-[#6B7068]">+ {it.selected_addons.map((a) => a.name).join(", ")}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="mono-num text-sm text-[#1B1D1E]">Rs {(Number(it.unit_price) * it.quantity).toFixed(2)}</span>
                          <button onClick={() => removeItem(it.id)} className="text-xs text-[#9E3527]">×</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="px-4 py-3 border-t border-[#D0D3CB] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1B1D1E]">Subtotal</span>
                    <span className="mono-num text-lg font-medium text-[#1B1D1E]">
                      Rs {openOrder ? Number(openOrder.subtotal).toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowFinalize(true)}
                    disabled={!openOrder || openOrder.items.length === 0}
                    className="w-full text-sm px-4 py-2.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50"
                  >
                    Generate Bill
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {productModal && (
        <ProductOptionsModal
          product={productModal}
          onClose={() => setProductModal(null)}
          onConfirm={(selection) => addItemToTable(productModal, selection)}
        />
      )}

      {showFinalize && openOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowFinalize(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1B1D1E] mb-3">Generate Bill — {selectedTable?.name}</h3>
            <div className="space-y-2.5">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card")} className="w-full border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
              <input
                placeholder="Voucher code (optional)"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="w-full border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-[#1B1D1E]">Subtotal</span>
                <span className="mono-num text-lg font-medium text-[#1B1D1E]">Rs {Number(openOrder.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleFinalize} disabled={finalizing} className="flex-1 text-sm px-4 py-2 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50">
                  {finalizing ? "Processing..." : "Confirm & Print"}
                </button>
                <button onClick={() => setShowFinalize(false)} className="text-sm px-4 py-2 rounded-md border border-[#D0D3CB] font-medium">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
