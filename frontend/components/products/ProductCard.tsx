"use client";
import { useState } from "react";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { api, productImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

type DraftVariant = { id: number; name: string; price: string; is_available: boolean };
type DraftOption = { id: number; name: string; price: string; is_available: boolean };
type DraftGroup = {
  id: number;
  title: string;
  selection_type: "single" | "multiple";
  required: boolean;
  options: DraftOption[];
};

// Negative ids mark not-yet-created drafts (variants/groups/options added locally, not yet saved).
let tempIdCounter = -1;
function nextTempId() {
  return tempIdCounter--;
}

type Branch = { id: number; name: string };

export default function ProductCard({
  product: p,
  showBranch,
  branchName,
  onRefresh,
  isSuperAdmin,
  branches,
}: {
  product: Product;
  showBranch: boolean;
  branchName: string;
  onRefresh: () => void;
  isSuperAdmin?: boolean;
  branches?: Branch[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [copyingToBranchId, setCopyingToBranchId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState(p.name);
  const [editPrice, setEditPrice] = useState(p.price);
  const [editDiscountedPrice, setEditDiscountedPrice] = useState(p.discounted_price || "");
  const [editCategory, setEditCategory] = useState(p.category || "");
  const [editDescription, setEditDescription] = useState(p.description || "");

  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([]);
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([]);

  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newGroupType, setNewGroupType] = useState<"single" | "multiple">("single");
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<Record<number, { name: string; price: string }>>({});

  const imgSrc = productImageUrl(p.image_url);

  function startEditing() {
    setEditName(p.name);
    setEditPrice(p.price);
    setEditDiscountedPrice(p.discounted_price || "");
    setEditCategory(p.category || "");
    setEditDescription(p.description || "");
    setDraftVariants(p.variants.map((v) => ({ id: v.id, name: v.name, price: String(v.price), is_available: v.is_available })));
    setDraftGroups(p.addon_groups.map((g) => ({
      id: g.id,
      title: g.title,
      selection_type: g.selection_type,
      required: g.required,
      options: g.options.map((o) => ({ id: o.id, name: o.name, price: String(o.price), is_available: o.is_available })),
    })));
    setVariantName(""); setVariantPrice("");
    setNewGroupTitle(""); setNewGroupType("single"); setNewGroupRequired(false);
    setOptionDrafts({});
    setError("");
    setEditing(true);
    setExpanded(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError("");
  }

  function addDraftVariant() {
    if (!variantName || !variantPrice) { setError("Variant name and price required"); return; }
    setDraftVariants((prev) => [...prev, { id: nextTempId(), name: variantName, price: variantPrice, is_available: true }]);
    setVariantName(""); setVariantPrice(""); setError("");
  }
  function removeDraftVariant(id: number) {
    setDraftVariants((prev) => prev.filter((v) => v.id !== id));
  }
  function updateDraftVariant(id: number, patch: Partial<DraftVariant>) {
    setDraftVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function addDraftGroup() {
    if (!newGroupTitle.trim()) { setError("Group title is required"); return; }
    setDraftGroups((prev) => [...prev, { id: nextTempId(), title: newGroupTitle, selection_type: newGroupType, required: newGroupRequired, options: [] }]);
    setNewGroupTitle(""); setNewGroupType("single"); setNewGroupRequired(false); setError("");
  }
  function removeDraftGroup(id: number) {
    setDraftGroups((prev) => prev.filter((g) => g.id !== id));
  }
  function updateDraftGroup(id: number, patch: Partial<Omit<DraftGroup, "options">>) {
    setDraftGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function addDraftOption(groupId: number) {
    const draft = optionDrafts[groupId] || { name: "", price: "" };
    if (!draft.name || !draft.price) { setError("Option name and price required"); return; }
    setDraftGroups((prev) => prev.map((g) => (
      g.id === groupId
        ? { ...g, options: [...g.options, { id: nextTempId(), name: draft.name, price: draft.price, is_available: true }] }
        : g
    )));
    setOptionDrafts((prev) => ({ ...prev, [groupId]: { name: "", price: "" } }));
    setError("");
  }
  function removeDraftOption(groupId: number, optionId: number) {
    setDraftGroups((prev) => prev.map((g) => (
      g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g
    )));
  }
  function updateDraftOption(groupId: number, optionId: number, patch: Partial<DraftOption>) {
    setDraftGroups((prev) => prev.map((g) => (
      g.id === groupId
        ? { ...g, options: g.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
        : g
    )));
  }

  async function handleSaveAll() {
    setError("");
    if (editDiscountedPrice.trim() && Number(editDiscountedPrice) >= Number(editPrice)) {
      setError("Discounted price must be lower than the actual price");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/products/${p.id}`, {
        name: editName,
        price: Number(editPrice),
        discounted_price: editDiscountedPrice.trim() ? Number(editDiscountedPrice) : null,
        category: editCategory || null,
        description: editDescription.trim() || null,
      });

      // ── Variants: delete removed, create new, patch changed ──
      const draftVariantIds = new Set(draftVariants.filter((v) => v.id > 0).map((v) => v.id));
      for (const v of p.variants) {
        if (!draftVariantIds.has(v.id)) await api.delete(`/products/variants/${v.id}`);
      }
      for (const v of draftVariants) {
        if (v.id < 0) {
          await api.post(`/products/${p.id}/variants`, { name: v.name, price: Number(v.price) });
        } else {
          const original = p.variants.find((o) => o.id === v.id);
          if (original && (original.name !== v.name || String(original.price) !== v.price || original.is_available !== v.is_available)) {
            await api.patch(`/products/variants/${v.id}`, { name: v.name, price: Number(v.price), is_available: v.is_available });
          }
        }
      }

      // ── Addon groups + options: same delete/create/patch pattern, nested ──
      const draftGroupIds = new Set(draftGroups.filter((g) => g.id > 0).map((g) => g.id));
      for (const g of p.addon_groups) {
        if (!draftGroupIds.has(g.id)) await api.delete(`/products/addon-groups/${g.id}`);
      }
      for (const g of draftGroups) {
        let realGroupId = g.id;
        const original = p.addon_groups.find((o) => o.id === g.id);
        if (g.id < 0) {
          const res = await api.post(`/products/${p.id}/addon-groups`, {
            title: g.title, selection_type: g.selection_type, required: g.required,
          });
          realGroupId = res.data.id;
        } else if (original && (original.title !== g.title || original.selection_type !== g.selection_type || original.required !== g.required)) {
          await api.patch(`/products/addon-groups/${g.id}`, { title: g.title, selection_type: g.selection_type, required: g.required });
        }

        const originalOptions = original?.options || [];
        const draftOptionIds = new Set(g.options.filter((o) => o.id > 0).map((o) => o.id));
        for (const o of originalOptions) {
          if (!draftOptionIds.has(o.id)) await api.delete(`/products/addon-options/${o.id}`);
        }
        for (const o of g.options) {
          if (o.id < 0) {
            await api.post(`/products/addon-groups/${realGroupId}/options`, { name: o.name, price: Number(o.price) });
          } else {
            const originalOpt = originalOptions.find((oo) => oo.id === o.id);
            if (originalOpt && (originalOpt.name !== o.name || String(originalOpt.price) !== o.price || originalOpt.is_available !== o.is_available)) {
              await api.patch(`/products/addon-options/${o.id}`, { name: o.name, price: Number(o.price), is_available: o.is_available });
            }
          }
        }
      }

      setEditing(false);
      onRefresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
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

  async function handleToggleOutOfStock() {
    try { await api.patch(`/products/${p.id}`, { is_out_of_stock: !p.is_out_of_stock }); onRefresh(); }
    catch (err) { setError(errMsg(err)); }
  }

  async function handleCopyToBranch(branchId: number) {
    setCopyingToBranchId(branchId);
    setError("");
    try {
      await api.post(`/products/${p.id}/copy-to-branch`, { branch_id: branchId });
      setShowCopyMenu(false);
      onRefresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setCopyingToBranchId(null);
    }
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
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-55">
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
              <button
                onClick={handleToggleAvailable}
                title={p.is_available ? "Visible on menu — click to hide" : "Hidden from menu — click to show"}
                className={`w-7 h-7 rounded-full flex items-center justify-center ${p.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#F0F1ED] text-[#9B9F98]"}`}
              >
                {p.is_available ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                onClick={handleToggleOutOfStock}
                className={`text-xs px-2 py-0.5 rounded-full ${p.is_out_of_stock ? "bg-[#FBEAE7] text-[#9E3527]" : "bg-[#F5F6F4] text-[#6B7068]"}`}
              >
                {p.is_out_of_stock ? "Out of Stock" : "In Stock"}
              </button>
              {isSuperAdmin && branches && branches.filter((b) => b.id !== p.branch_id).length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowCopyMenu((v) => !v)}
                    className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]"
                  >
                    Copy to...
                  </button>
                  {showCopyMenu && (
                    <div className="absolute right-0 top-8 z-10 bg-white border border-[#D0D3CB] rounded-md shadow-lg py-1 w-44">
                      {branches.filter((b) => b.id !== p.branch_id).map((b) => (
                        <button
                          key={b.id}
                          onClick={() => handleCopyToBranch(b.id)}
                          disabled={copyingToBranchId !== null}
                          className="w-full text-left text-xs px-3 py-1.5 hover:bg-[#F5F6F4] disabled:opacity-50"
                        >
                          {copyingToBranchId === b.id ? "Copying..." : b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={startEditing} className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]">Edit</button>
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

          {editing ? (
            <>
              {/* ── Variants (all local — nothing saved until "Save changes") ── */}
              <div>
                <p className="text-xs font-medium text-[#6B7068] uppercase tracking-wide mb-2">Variants</p>
                {draftVariants.length === 0 ? (
                  <p className="text-xs text-[#494D46] mb-2">No variants — base price applies.</p>
                ) : (
                  <ul className="space-y-1.5 mb-2">
                    {draftVariants.map((v) => (
                      <li key={v.id} className="flex items-center gap-2 bg-white border border-[#D0D3CB] rounded-md px-3 py-1.5">
                        <input value={v.name} onChange={(e) => updateDraftVariant(v.id, { name: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm flex-1 min-w-0" />
                        <input type="number" step="0.01" value={v.price} onChange={(e) => updateDraftVariant(v.id, { price: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-24" />
                        <button onClick={() => updateDraftVariant(v.id, { is_available: !v.is_available })} className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${v.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}>
                          {v.is_available ? "Available" : "Unavailable"}
                        </button>
                        <button onClick={() => removeDraftVariant(v.id)} className="text-xs px-2 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7] shrink-0">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2">
                  <input placeholder="Variant name" value={variantName} onChange={(e) => setVariantName(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" />
                  <input placeholder="Price" type="number" step="0.01" min="0" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm w-24" />
                  <button onClick={addDraftVariant} className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">Add variant</button>
                </div>
              </div>

              {/* ── Addon groups (all local) ── */}
              <div className="pt-3 border-t border-[#E3E5E0]">
                <p className="text-xs font-medium text-[#6B7068] uppercase tracking-wide mb-2">
                  Add-on groups <span className="normal-case font-normal">(e.g. "Choose Patty", "Add Cheese")</span>
                </p>

                {draftGroups.length === 0 ? (
                  <p className="text-xs text-[#494D46] mb-2">No add-on groups yet.</p>
                ) : (
                  <div className="space-y-2 mb-2">
                    {draftGroups.map((g) => (
                      <div key={g.id} className="bg-white border border-[#D0D3CB] rounded-md p-2.5">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <input value={g.title} onChange={(e) => updateDraftGroup(g.id, { title: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm flex-1 min-w-32" />
                          <select value={g.selection_type} onChange={(e) => updateDraftGroup(g.id, { selection_type: e.target.value as "single" | "multiple" })} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm">
                            <option value="single">Single select</option>
                            <option value="multiple">Multiple select</option>
                          </select>
                          <label className="flex items-center gap-1 text-xs text-[#494D46]">
                            <input type="checkbox" checked={g.required} onChange={(e) => updateDraftGroup(g.id, { required: e.target.checked })} /> Required
                          </label>
                          <button onClick={() => removeDraftGroup(g.id)} className="text-xs px-2 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]">Remove group</button>
                        </div>

                        {g.options.length > 0 && (
                          <ul className="space-y-1 mb-2">
                            {g.options.map((o) => (
                              <li key={o.id} className="flex items-center gap-2 bg-[#FAFAF8] border border-[#EDEFEA] rounded-md px-2.5 py-1">
                                <input value={o.name} onChange={(e) => updateDraftOption(g.id, o.id, { name: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm flex-1 min-w-0" />
                                <input type="number" step="0.01" value={o.price} onChange={(e) => updateDraftOption(g.id, o.id, { price: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-20" />
                                <button onClick={() => updateDraftOption(g.id, o.id, { is_available: !o.is_available })} className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${o.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}>
                                  {o.is_available ? "Available" : "Unavailable"}
                                </button>
                                <button onClick={() => removeDraftOption(g.id, o.id)} className="text-xs px-2 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7] shrink-0">Remove</button>
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
                          <button onClick={() => addDraftOption(g.id)} className="text-xs px-2.5 py-1 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">Add option</button>
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
                  <button onClick={addDraftGroup} className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">Add group</button>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#E3E5E0] sticky bottom-0 bg-[#FAFAF8] py-2">
                <button onClick={handleSaveAll} disabled={saving} className="text-xs px-4 py-1.5 rounded-md bg-[#1B1D1E] text-white font-medium disabled:opacity-50">
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button onClick={cancelEditing} disabled={saving} className="text-xs px-4 py-1.5 rounded-md border border-[#C9CCC5] font-medium disabled:opacity-50">Cancel</button>
              </div>
            </>
          ) : (
            <>
              {p.variants.length === 0 ? (
                <p className="text-xs text-[#494D46]">No variants yet — base price applies.</p>
              ) : (
                <ul className="space-y-1.5">
                  {p.variants.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 bg-white border border-[#D0D3CB] rounded-md px-3 py-1.5">
                      <span className="text-sm text-[#1B1D1E]">
                        {v.name}
                        <span className="mono-num text-[#494D46]">
                          {" "}— Rs {(Number(p.price) + Number(v.price)).toFixed(2)}
                          <span className="text-[#9B9F98]"> (+{Number(v.price).toFixed(0)})</span>
                        </span>
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}>
                        {v.is_available ? "Available" : "Unavailable"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {p.addon_groups.length > 0 && (
                <div className="pt-3 border-t border-[#E3E5E0] space-y-2">
                  <p className="text-xs font-medium text-[#6B7068] uppercase tracking-wide">Add-on groups</p>
                  {p.addon_groups.map((g) => (
                    <div key={g.id} className="bg-white border border-[#D0D3CB] rounded-md p-2.5">
                      <span className="text-sm font-semibold text-[#1B1D1E]">
                        {g.title}
                        <span className="text-xs font-normal text-[#6B7068] ml-1.5">
                          ({g.selection_type === "single" ? "single select" : "multi select"}{g.required ? ", required" : ""})
                        </span>
                      </span>
                      {g.options.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {g.options.map((o) => (
                            <li key={o.id} className="flex items-center justify-between text-sm text-[#1B1D1E] bg-[#FAFAF8] border border-[#EDEFEA] rounded-md px-2.5 py-1">
                              <span>{o.name}</span>
                              <span className="mono-num text-[#494D46]">+Rs {Number(o.price).toFixed(0)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={startEditing} className="text-xs px-3 py-1.5 rounded-md border border-[#C9CCC5] bg-white font-medium hover:bg-[#F5F6F4]">
                Edit variants & add-ons
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
