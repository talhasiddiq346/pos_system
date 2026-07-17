"use client";
import { useState } from "react";
import axios from "axios";
import { api, productImageUrl } from "@/lib/api";
import type { Product, ProductVariant, AddonGroup, AddonOption } from "@/lib/types";

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
  const [editDiscountedPrice, setEditDiscountedPrice] = useState(p.discounted_price || "");
  const [editCategory, setEditCategory] = useState(p.category || "");
  const [editDescription, setEditDescription] = useState(p.description || "");

  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");

  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editVariantName, setEditVariantName] = useState("");
  const [editVariantPrice, setEditVariantPrice] = useState("");

  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newGroupType, setNewGroupType] = useState<"single" | "multiple">("single");
  const [newGroupRequired, setNewGroupRequired] = useState(false);

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupTitle, setEditGroupTitle] = useState("");
  const [editGroupType, setEditGroupType] = useState<"single" | "multiple">("single");
  const [editGroupRequired, setEditGroupRequired] = useState(false);

  const [optionDrafts, setOptionDrafts] = useState<Record<number, { name: string; price: string }>>({});
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editOptionName, setEditOptionName] = useState("");
  const [editOptionPrice, setEditOptionPrice] = useState("");

  const imgSrc = productImageUrl(p.image_url);

  async function handleEditSave() {
    setError("");
    if (editDiscountedPrice.trim() && Number(editDiscountedPrice) >= Number(editPrice)) {
      setError("Discounted price must be lower than the actual price");
      return;
    }
    try {
      await api.patch(`/products/${p.id}`, {
        name: editName,
        price: Number(editPrice),
        discounted_price: editDiscountedPrice.trim() ? Number(editDiscountedPrice) : null,
        category: editCategory || null,
        description: editDescription.trim() || null,
      });
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

  async function handleAddGroup() {
    setError("");
    if (!newGroupTitle.trim()) { setError("Group title is required"); return; }
    try {
      await api.post(`/products/${p.id}/addon-groups`, {
        title: newGroupTitle, selection_type: newGroupType, required: newGroupRequired,
      });
      setNewGroupTitle(""); setNewGroupType("single"); setNewGroupRequired(false);
      onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleEditGroupSave(id: number) {
    try {
      await api.patch(`/products/addon-groups/${id}`, {
        title: editGroupTitle, selection_type: editGroupType, required: editGroupRequired,
      });
      setEditingGroupId(null); onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleDeleteGroup(id: number) {
    if (!confirm("Remove this group and all its options?")) return;
    try { await api.delete(`/products/addon-groups/${id}`); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  async function handleAddOption(groupId: number) {
    setError("");
    const draft = optionDrafts[groupId] || { name: "", price: "" };
    if (!draft.name || !draft.price) { setError("Option name and price required"); return; }
    try {
      await api.post(`/products/addon-groups/${groupId}/options`, { name: draft.name, price: Number(draft.price) });
      setOptionDrafts((prev) => ({ ...prev, [groupId]: { name: "", price: "" } }));
      onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleToggleOption(o: AddonOption) {
    try { await api.patch(`/products/addon-options/${o.id}`, { is_available: !o.is_available }); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  async function handleEditOptionSave(id: number) {
    try {
      await api.patch(`/products/addon-options/${id}`, { name: editOptionName, price: Number(editOptionPrice) });
      setEditingOptionId(null); onRefresh();
    } catch (err) { setError(errMsg(err)); }
  }

  async function handleDeleteOption(id: number) {
    if (!confirm("Remove this option?")) return;
    try { await api.delete(`/products/addon-options/${id}`); onRefresh(); }
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
              <input type="number" step="0.01" placeholder="Price" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-24" />
              <input type="number" step="0.01" placeholder="Discounted price" value={editDiscountedPrice} onChange={(e) => setEditDiscountedPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-32" />
              <input value={editCategory} placeholder="Category" onChange={(e) => setEditCategory(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" />
            </div>
            <input value={editDescription} placeholder="Short description shown to customers" onChange={(e) => setEditDescription(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-full" />
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
                  {p.discounted_price ? (
                    <>
                      <span className="line-through text-[#9B9F98]">Rs {Number(p.price).toFixed(2)}</span>{" "}
                      <span className="text-[#1F6F54] font-semibold">Rs {Number(p.discounted_price).toFixed(2)}</span>
                    </>
                  ) : (
                    <>Base Rs {Number(p.price).toFixed(2)}</>
                  )}
                  {p.variants.length > 0 && ` · ${p.variants.length} variant${p.variants.length > 1 ? "s" : ""}`}
                  {showBranch && ` · ${branchName}`}
                </p>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleToggleAvailable} className={`text-xs px-2 py-0.5 rounded-full ${p.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}>
                {p.is_available ? "Available" : "Unavailable"}
              </button>
              <button onClick={() => { setEditing(true); setEditName(p.name); setEditPrice(p.price); setEditDiscountedPrice(p.discounted_price || ""); setEditCategory(p.category || ""); setEditDescription(p.description || ""); }} className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]">Edit</button>
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

          <div className="pt-3 border-t border-[#E3E5E0]">
            <p className="text-xs font-medium text-[#6B7068] uppercase tracking-wide mb-2">
              Add-on groups <span className="normal-case font-normal">(e.g. "Choose Patty", "Add Cheese")</span>
            </p>

            {p.addon_groups.length === 0 ? (
              <p className="text-xs text-[#494D46] mb-2">No add-on groups yet.</p>
            ) : (
              <div className="space-y-2 mb-2">
                {p.addon_groups.map((g: AddonGroup) => (
                  <div key={g.id} className="bg-white border border-[#D0D3CB] rounded-md p-2.5">
                    {editingGroupId === g.id ? (
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <input value={editGroupTitle} onChange={(e) => setEditGroupTitle(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" />
                        <select value={editGroupType} onChange={(e) => setEditGroupType(e.target.value as "single" | "multiple")} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm">
                          <option value="single">Single select</option>
                          <option value="multiple">Multiple select</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-[#494D46]">
                          <input type="checkbox" checked={editGroupRequired} onChange={(e) => setEditGroupRequired(e.target.checked)} /> Required
                        </label>
                        <button onClick={() => handleEditGroupSave(g.id)} className="text-xs px-2 py-1 rounded-md bg-[#1B1D1E] text-white font-medium">Save</button>
                        <button onClick={() => setEditingGroupId(null)} className="text-xs px-2 py-1 rounded-md border border-[#C9CCC5] font-medium">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-semibold text-[#1B1D1E]">
                          {g.title}
                          <span className="text-xs font-normal text-[#6B7068] ml-1.5">
                            ({g.selection_type === "single" ? "single select" : "multi select"}{g.required ? ", required" : ""})
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingGroupId(g.id); setEditGroupTitle(g.title); setEditGroupType(g.selection_type); setEditGroupRequired(g.required); }} className="text-xs px-2 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]">Edit</button>
                          <button onClick={() => handleDeleteGroup(g.id)} className="text-xs px-2 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]">Remove</button>
                        </div>
                      </div>
                    )}

                    {g.options.length > 0 && (
                      <ul className="space-y-1 mb-2">
                        {g.options.map((o: AddonOption) => (
                          <li key={o.id} className="flex items-center justify-between gap-2 bg-[#FAFAF8] border border-[#EDEFEA] rounded-md px-2.5 py-1">
                            {editingOptionId === o.id ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <input value={editOptionName} onChange={(e) => setEditOptionName(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" />
                                  <input type="number" step="0.01" value={editOptionPrice} onChange={(e) => setEditOptionPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-20" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleEditOptionSave(o.id)} className="text-xs px-2 py-1 rounded-md bg-[#1B1D1E] text-white font-medium">Save</button>
                                  <button onClick={() => setEditingOptionId(null)} className="text-xs px-2 py-1 rounded-md border border-[#C9CCC5] font-medium">Cancel</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-sm text-[#1B1D1E]">
                                  {o.name} <span className="mono-num text-[#494D46]">(+Rs {Number(o.price).toFixed(0)})</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleToggleOption(o)} className={`text-xs px-2 py-0.5 rounded-full ${o.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}>
                                    {o.is_available ? "Available" : "Unavailable"}
                                  </button>
                                  <button onClick={() => { setEditingOptionId(o.id); setEditOptionName(o.name); setEditOptionPrice(o.price); }} className="text-xs px-2 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]">Edit</button>
                                  <button onClick={() => handleDeleteOption(o.id)} className="text-xs px-2 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]">Remove</button>
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Option name"
                        value={optionDrafts[g.id]?.name ?? ""}
                        onChange={(e) => setOptionDrafts((prev) => ({ ...prev, [g.id]: { name: e.target.value, price: prev[g.id]?.price ?? "" } }))}
                        className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm"
                      />
                      <input
                        placeholder="Price"
                        type="number" step="0.01" min="0"
                        value={optionDrafts[g.id]?.price ?? ""}
                        onChange={(e) => setOptionDrafts((prev) => ({ ...prev, [g.id]: { name: prev[g.id]?.name ?? "", price: e.target.value } }))}
                        className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-20"
                      />
                      <button onClick={() => handleAddOption(g.id)} className="text-xs px-2.5 py-1 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">Add option</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <input placeholder="Group title (e.g. Choose Patty)" value={newGroupTitle} onChange={(e) => setNewGroupTitle(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" />
              <select value={newGroupType} onChange={(e) => setNewGroupType(e.target.value as "single" | "multiple")} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm">
                <option value="single">Single select</option>
                <option value="multiple">Multiple select</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-[#494D46]">
                <input type="checkbox" checked={newGroupRequired} onChange={(e) => setNewGroupRequired(e.target.checked)} /> Required
              </label>
              <button onClick={handleAddGroup} className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">Add group</button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}