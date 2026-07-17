"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Branch = { id: number; name: string };
type Category = { name: string; count: number; image_url: string | null; sort_order: number };

export default function CategoriesPanel() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const branchesRes = await api.get<Branch[]>("/branches");
      setBranches(branchesRes.data);
      const targetBranchId = branchId || branchesRes.data[0]?.id || "";
      if (!branchId && branchesRes.data.length > 0) setBranchId(branchesRes.data[0].id);

      if (targetBranchId) {
        const catRes = await api.get<Category[]>(`/products/categories/${targetBranchId}`);
        setCategories([...catRes.data].sort((a, b) => a.sort_order - b.sort_order));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [branchId]);

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= categories.length) return;
    setCategories((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    moveTo(dragIndex, targetIndex);
    setDragIndex(null);
  }

  async function saveOrder() {
    if (!branchId) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/products/categories/${branchId}/reorder`, {
        names: categories.map((c) => c.name),
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save category order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0]">
          <h2 className="font-medium text-[#1B1D1E]">Category order</h2>
          <p className="text-xs text-[#6B7068] mt-0.5">
            Drag categories (or use the arrows) to control the order they appear on the website menu
            and category tabs — e.g. move "Beverages" to the top.
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
          <button
            onClick={saveOrder}
            disabled={saving || loading || categories.length === 0}
            className="ml-auto bg-[#2F7D6B] text-white text-sm font-medium px-4 py-1.5 rounded-md disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save order"}
          </button>
        </div>

        {error && (
          <div className="px-5 py-2 bg-[#FBECEC] text-[#B3261E] text-xs border-b border-[#F0F1EE]">
            {error}
          </div>
        )}

        {loading ? (
          <p className="px-5 py-6 text-sm text-[#6B7068]">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#6B7068]">No categories in this branch yet.</p>
        ) : (
          <ul className="divide-y divide-[#F0F1EE]">
            {categories.map((c, i) => {
              const imgSrc = c.image_url;
              return (
                <li
                  key={c.name}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(i)}
                  className={`flex items-center gap-3 px-5 py-3 cursor-grab active:cursor-grabbing transition-colors ${
                    dragIndex === i ? "bg-[#F5F6F4]" : "hover:bg-[#FAFBF9]"
                  }`}
                >
                  <span className="text-[#B9BEB5] text-sm select-none" title="Drag to reorder">⠿</span>
                  <div className="w-9 h-9 rounded-md bg-[#F5F6F4] flex items-center justify-center overflow-hidden shrink-0">
                    {imgSrc ? (
                      <img src={imgSrc} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base">🍽️</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1B1D1E] truncate">{c.name}</p>
                    <p className="text-xs text-[#6B7068]">{c.count} item{c.count === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveTo(i, i - 1)}
                      disabled={i === 0}
                      className="w-7 h-7 rounded-md border border-[#E3E5E0] text-[#6B7068] disabled:opacity-30 hover:bg-[#F5F6F4]"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveTo(i, i + 1)}
                      disabled={i === categories.length - 1}
                      className="w-7 h-7 rounded-md border border-[#E3E5E0] text-[#6B7068] disabled:opacity-30 hover:bg-[#F5F6F4]"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
