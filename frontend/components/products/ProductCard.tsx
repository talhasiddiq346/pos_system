"use client";
import { useState } from "react";
import axios from "axios";
import { api, productImageUrl } from "@/lib/api";
import type { Product, ProductVariant } from "@/lib/types";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function ProductCard({
  product: p,
  showBranch,
  branchName,
  onRefresh,
}: {
  product: Product;
  showBranch: boolean;
  branchName: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(p.name);
  const [editPrice, setEditPrice] = useState(p.price);
  const [editCategory, setEditCategory] = useState(p.category || "");

  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");

  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editVariantName, setEditVariantName] = useState("");
  const [editVariantPrice, setEditVariantPrice] = useState("");

  const imgSrc = productImageUrl(p.image_url);

  async function handleEditSave() {
    setError("");
    try {
      await api.patch(`/products/${p.id}`, { name: editName, price: Number(editPrice), category: editCategory || null });
      setEditing(false);
      onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleDelete() {
    if (!confirm("Remove this product and all its variants?")) return;
    try { await api.delete(`/products/${p.id}`); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  async function handleToggleAvailable() {
    try { await api.patch(`/products/${p.id}`, { is_available: !p.is_available }); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  async function handleReplaceImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    try {
      await api.post(`/products/${p.id}/image`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleRemoveImage() {
    try { await api.delete(`/products/${p.id}/image`); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  async function handleAddVariant() {
    setError("");
    if (!variantName || !variantPrice) { setError("Variant name and price required"); return; }
    try {
      await api.post(`/products/${p.id}/variants`, { name: variantName, price: Number(variantPrice) });
      setVariantName(""); setVariantPrice(""); onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleToggleVariant(v: ProductVariant) {
    try { await api.patch(`/products/variants/${v.id}`, { is_available: !v.is_available }); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  async function handleEditVariantSave(id: number) {
    try {
      await api.patch(`/products/variants/${id}`, { name: editVariantName, price: Number(editVariantPrice) });
      setEditingVariantId(null); onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleDeleteVariant(id: number) {
    if (!confirm("Remove this variant?")) return;
    try { await api.delete(`/products/variants/${id}`); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  return (
    <li className="border-b border-[#EDEFEA] last:border-0">
      {error && <p className="mx-5 mt-2 text-xs text-[#9E3527]">{error}</p>}

      <div className="px-5 py-3">
        {editing ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" />
              <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-24" />
              <input value={editCategory} placeholder="Category" onChange={(e) => setEditCategory(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEditSave} className="text-xs px-2.5 py-1 rounded-md bg-[#1B1D1E] text-white font-medium">Save</button>
              <button onClick={() => setEditing(false)} className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] font-medium">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              {imgSrc ? (
                <img src={imgSrc} alt={p.name} className="w-12 h-12 rounded-md object-cover border border-[#D0D3CB]" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-[#F0F1ED] border border-[#D0D3CB] flex items-center justify-center text-[#9B9F98] text-[10px]">No image</div>
              )}
              <button onClick={() => setExpanded(!expanded)} className="text-left">
                <p className="text-sm text-[#1B1D1E] font-medium">
                  {expanded ? "▾" : "▸"} {p.name}
                  {p.category && <span className="text-[#494D46] font-normal"> · {p.category}</span>}
                </p>
                <p className="text-xs text-[#494D46] mono-num mt-0.5">
                  Base Rs {Number(p.price).toFixed(2)}
                  {p.variants.length > 0 && ` · ${p.variants.length} variant${p.variants.length > 1 ? "s" : ""}`}
                  {showBranch && ` · ${branchName}`}
                </p>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleToggleAvailable} className={`text-xs px-2 py-0.5 rounded-full ${p.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}>
                {p.is_available ? "Available" : "Unavailable"}
              </button>
              <button onClick={() => { setEditing(true); setEditName(p.name); setEditPrice(p.price); setEditCategory(p.category || ""); }} className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]">Edit</button>
              <button onClick={handleDelete} className="text-xs px-2.5 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]">Remove</button>
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-4 pl-9 space-y-3 bg-[#FAFAF8]">
          <div className="flex items-center gap-2">
            <label className="text-xs px-3 py-1.5 rounded-md border border-[#C9CCC5] bg-white cursor-pointer hover:bg-[#F5F6F4]">
              {imgSrc ? "Change image" : "Add image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplaceImage(f); }} />
            </label>
            {imgSrc && (
              <button onClick={handleRemoveImage} className="text-xs px-3 py-1.5 rounded-md border border-[#F0C9C2] text-[#9E3527] hover:bg-[#FBEAE7]">Remove image</button>
            )}
          </div>

          {p.variants.length === 0 ? (
            <p className="text-xs text-[#494D46]">No variants yet — base price applies.</p>
          ) : (
            <ul className="space-y-1.5">
              {p.variants.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 bg-white border border-[#D0D3CB] rounded-md px-3 py-1.5">
                  {editingVariantId === v.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <input value={editVariantName} onChange={(e) => setEditVariantName(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" />
                        <input type="number" step="0.01" value={editVariantPrice} onChange={(e) => setEditVariantPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-24" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditVariantSave(v.id)} className="text-xs px-2 py-1 rounded-md bg-[#1B1D1E] text-white font-medium">Save</button>
                        <button onClick={() => setEditingVariantId(null)} className="text-xs px-2 py-1 rounded-md border border-[#C9CCC5] font-medium">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-[#1B1D1E]">
                        {v.name}
                        <span className="mono-num text-[#494D46]">
                          {" "}— Rs {(Number(p.price) + Number(v.price)).toFixed(2)}
                          <span className="text-[#9B9F98]"> (+{Number(v.price).toFixed(0)})</span>
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleVariant(v)} className={`text-xs px-2 py-0.5 rounded-full ${v.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}>
                          {v.is_available ? "Available" : "Unavailable"}
                        </button>
                        <button onClick={() => { setEditingVariantId(v.id); setEditVariantName(v.name); setEditVariantPrice(v.price); }} className="text-xs px-2 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]">Edit</button>
                        <button onClick={() => handleDeleteVariant(v.id)} className="text-xs px-2 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]">Remove</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input placeholder="Variant name" value={variantName} onChange={(e) => setVariantName(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" />
            <input placeholder="Price" type="number" step="0.01" min="0" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm w-24" />
            <button onClick={handleAddVariant} className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">Add variant</button>
          </div>
        </div>
      )}
    </li>
  );
}