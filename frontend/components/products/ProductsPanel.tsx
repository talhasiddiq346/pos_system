"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Product, User } from "@/lib/types";
import AddProductForm from "./AddProductForm";
import ProductCard from "./ProductCard";

type Branch = { id: number; name: string };

export default function ProductsPanel({ user }: { user: User }) {
  const viewerRole = user.role;
  const viewerBranchId = user.branch_id;
  const isSuperAdmin = viewerRole === "super_admin";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState<number | "">("");

  async function load() {
    setLoading(true);
    if (isSuperAdmin) {
      const [branchesRes, productsRes] = await Promise.all([
        api.get<Branch[]>("/branches"),
        api.get<Product[]>("/products", { params: branchFilter ? { branch_id: branchFilter } : {} }),
      ]);
      setBranches(branchesRes.data);
      setProducts(productsRes.data);
    } else {
      const res = await api.get<Product[]>("/products");
      setProducts(res.data);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [branchFilter]);

  function branchName(id: number) {
    return branches.find((b) => b.id === id)?.name ?? `Branch #${id}`;
  }

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-4">
          <label className="text-xs font-medium text-[#494D46] uppercase tracking-wide block mb-1.5">
            Viewing branch
          </label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : "")}
            className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <AddProductForm
        viewerRole={viewerRole}
        viewerBranchId={viewerBranchId}
        branches={branches}
        branchFilter={branchFilter}
        onAdded={load}
      />

      <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D0D3CB]">
          <h2 className="font-medium text-[#1B1D1E]">Menu</h2>
          <p className="text-xs text-[#494D46] mt-0.5">
            Click an item to manage its image and variants.
          </p>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-[#494D46]">Loading...</p>
        ) : products.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#494D46]">No products yet.</p>
        ) : (
          <ul>
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                showBranch={isSuperAdmin && !branchFilter}
                branchName={branchName(p.branch_id)}
                onRefresh={load}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}