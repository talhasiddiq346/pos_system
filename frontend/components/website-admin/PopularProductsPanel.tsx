"use client";
import { useEffect, useState } from "react";
import { api, productImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";

type Branch = { id: number; name: string };

export default function PopularProductsPanel() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [branchesRes, productsRes] = await Promise.all([
      api.get<Branch[]>("/branches"),
      api.get<Product[]>("/products", { params: branchId ? { branch_id: branchId } : {} }),
    ]);
    setBranches(branchesRes.data);
    setProducts(productsRes.data);
    if (!branchId && branchesRes.data.length > 0) setBranchId(branchesRes.data[0].id);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [branchId]);

  async function togglePopular(p: Product) {
    setTogglingId(p.id);
    try {
      await api.patch(`/products/${p.id}`, { is_popular: !p.is_popular });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_popular: !x.is_popular } : x)));
    } finally {
      setTogglingId(null);
    }
  }

  const popularCount = products.filter((p) => p.is_popular).length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0]">
          <h2 className="font-medium text-[#1B1D1E]">Popular products</h2>
          <p className="text-xs text-[#6B7068] mt-0.5">
            Pick which items show in the "Popular Items" section on the website menu. Falls back to
            recently-added photos if none are picked.
          </p>
        </div>

        <div className="px-5 py-3 border-b border-[#F0F1EE] flex items-center gap-3 flex-wrap">
          <label className="text-xs font-medium text-[#6B7068] uppercase tracking-wide">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <span className="text-xs text-[#6B7068] ml-auto">{popularCount} selected</span>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-sm text-[#6B7068]">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#6B7068]">No products in this branch yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-5">
            {products.map((p) => {
              const imgSrc = productImageUrl(p.image_url);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePopular(p)}
                  disabled={togglingId === p.id}
                  className={`relative text-left rounded-lg border-2 overflow-hidden transition-all disabled:opacity-60 ${
                    p.is_popular ? "border-[#2F7D6B]" : "border-[#E3E5E0] hover:border-[#B9BEB5]"
                  }`}
                >
                  <div className="aspect-square bg-[#F5F6F4] flex items-center justify-center overflow-hidden">
                    {imgSrc ? (
                      <img src={imgSrc} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">🍽️</span>
                    )}
                  </div>
                  <div className="px-2 py-1.5 bg-white">
                    <p className="text-xs font-semibold text-[#1B1D1E] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#6B7068]">Rs. {Math.round(Number(p.price)).toLocaleString()}</p>
                  </div>
                  <span
                    className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      p.is_popular ? "bg-[#2F7D6B] text-white" : "bg-white/90 text-[#6B7068] border border-[#E3E5E0]"
                    }`}
                  >
                    {p.is_popular ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
