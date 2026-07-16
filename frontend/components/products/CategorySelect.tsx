"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";

type Category = { name: string; count: number; image_url?: string | null };
type Mode = "select" | "new" | "manage" | "rename" | "confirmDelete";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function CategorySelect({
  branchId,
  value,
  onChange,
  error,
}: {
  branchId: number | null;
  value: string;
  onChange: (val: string) => void;
  error?: string;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState<File | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [mgmtError, setMgmtError] = useState("");
  const [pictureTargetName, setPictureTargetName] = useState<string | null>(null);

  async function loadCategories() {
    if (!branchId) { setCategories([]); return; }
    setLoading(true);
    try {
      const res = await api.get<Category[]>(`/products/categories/${branchId}`);
      setCategories(res.data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCategories(); }, [branchId]);

  function handleNewCategoryChange(val: string) {
    setNewCategory(val);
    const exists = categories.find(c => c.name.toLowerCase().trim() === val.toLowerCase().trim());
    if (exists && val.trim()) setDuplicateWarning(`"${exists.name}" already exists`);
    else setDuplicateWarning("");
    onChange(val);
  }

  async function handleSaveNew() {
    if (!newCategory.trim() || duplicateWarning) return;
    const name = newCategory.trim();
    onChange(name);

    if (newCategoryImage && branchId) {
      setBusy(true);
      try {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("image", newCategoryImage);
        await api.post(`/products/categories/${branchId}/image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch {
        // Non-fatal — category still gets created without the picture.
      } finally {
        setBusy(false);
      }
    }

    setCategories(prev => [...prev, { name, count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setMode("select"); setNewCategory(""); setNewCategoryImage(null); setDuplicateWarning("");
    await loadCategories();
  }

  function handleCancelNew() {
    setMode("select"); setNewCategory(""); setNewCategoryImage(null); setDuplicateWarning(""); onChange("");
  }

  function openRename(cat: Category) {
    setSelectedCat(cat); setRenameValue(cat.name); setMgmtError(""); setMode("rename");
  }

  async function saveRename() {
    if (!selectedCat || !branchId) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === selectedCat.name) { setMode("manage"); return; }
    const dup = categories.find(c => c.name !== selectedCat.name && c.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) { setMgmtError(`"${dup.name}" already exists`); return; }

    setBusy(true); setMgmtError("");
    try {
      await api.patch(`/products/categories/${branchId}/rename`, {
        old_name: selectedCat.name,
        new_name: trimmed,
      });
      if (value === selectedCat.name) onChange(trimmed);
      await loadCategories();
      setSelectedCat(null); setRenameValue(""); setMode("manage");
    } catch (err) {
      setMgmtError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function openConfirmDelete(cat: Category) {
    setSelectedCat(cat); setMgmtError(""); setMode("confirmDelete");
  }

  async function confirmDelete() {
    if (!selectedCat || !branchId) return;
    setBusy(true); setMgmtError("");
    try {
      await api.delete(`/products/categories/${branchId}/${encodeURIComponent(selectedCat.name)}`);
      if (value === selectedCat.name) onChange("");
      await loadCategories();
      setSelectedCat(null); setMode("manage");
    } catch (err) {
      setMgmtError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePictureUpload(cat: Category, file: File) {
    if (!branchId) return;
    setBusy(true); setMgmtError("");
    try {
      const formData = new FormData();
      formData.append("name", cat.name);
      formData.append("image", file);
      await api.post(`/products/categories/${branchId}/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadCategories();
    } catch (err) {
      setMgmtError(errMsg(err));
    } finally {
      setBusy(false);
      setPictureTargetName(null);
    }
  }

  async function handlePictureRemove(cat: Category) {
    if (!branchId) return;
    setBusy(true); setMgmtError("");
    try {
      await api.delete(`/products/categories/${branchId}/${encodeURIComponent(cat.name)}/image`);
      await loadCategories();
    } catch (err) {
      setMgmtError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (!branchId) {
    return (
      <div className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm text-[#9B9F98] bg-[#F5F6F4]">
        Select branch first
      </div>
    );
  }

  if (mode === "new") {
    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            autoFocus
            placeholder="Type new category"
            value={newCategory}
            onChange={(e) => handleNewCategoryChange(e.target.value)}
            className={`border rounded-md px-2.5 py-1.5 text-sm flex-1 ${duplicateWarning ? "border-[#F0C9C2]" : "border-[#D0D3CB]"}`}
          />
          <button type="button" onClick={handleSaveNew} disabled={!newCategory.trim() || !!duplicateWarning || busy}
            className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-40">
            {busy ? "..." : "Save"}
          </button>
          <button type="button" onClick={handleCancelNew}
            className="text-xs px-3 py-1.5 rounded-md border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4]">
            Cancel
          </button>
        </div>
        {duplicateWarning && <p className="text-xs text-[#9E3527]">⚠ {duplicateWarning}</p>}

        <label className="flex items-center gap-2 text-xs text-[#6B7068] cursor-pointer">
          <span>🖼️ Category picture (optional):</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setNewCategoryImage(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
        </label>
        {newCategoryImage && <p className="text-[11px] text-[#2F7D6B]">Selected: {newCategoryImage.name}</p>}
      </div>
    );
  }

  if (mode === "manage") {
    return (
      <div className="border border-[#D0D3CB] rounded-md overflow-hidden bg-white">
        <div className="px-3 py-2 border-b border-[#D0D3CB] flex items-center justify-between bg-[#F5F6F4]">
          <span className="text-xs font-semibold text-[#1B1D1E] uppercase tracking-wider">Manage categories</span>
          <button type="button" onClick={() => { setMode("select"); setMgmtError(""); }}
            className="text-xs text-[#494D46] hover:text-[#1B1D1E]">✕ Close</button>
        </div>
        {mgmtError && (
          <div className="mx-3 mt-2 text-xs text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-2 py-1.5">
            {mgmtError}
          </div>
        )}
        {categories.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[#6B7068] text-center">No categories yet</p>
        ) : (
          <div className="max-h-80 overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#F5F6F4]">
                <tr className="text-left text-[10px] text-[#6B7068] uppercase tracking-wide border-b border-[#E3E5E0]">
                  <th className="px-3 py-2 font-medium w-9"></th>
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Products</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.name} className="border-b border-[#F0F1EE] last:border-0">
                    <td className="px-3 py-2">
                      <div className="w-8 h-8 rounded-md bg-[#F5F6F4] border border-[#E3E5E0] overflow-hidden shrink-0 flex items-center justify-center">
                        {cat.image_url ? (
                          <img src={cat.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm">🍽️</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[#1B1D1E] whitespace-nowrap">{cat.name}</td>
                    <td className="px-2 py-2 text-[#6B7068] whitespace-nowrap">
                      {cat.count} product{cat.count !== 1 ? "s" : ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 items-center justify-end">
                        {pictureTargetName === cat.name ? (
                          <input
                            autoFocus
                            type="file"
                            accept="image/*"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePictureUpload(cat, f); }}
                            onBlur={() => setPictureTargetName(null)}
                            className="text-[11px] w-28"
                          />
                        ) : (
                          <button type="button" onClick={() => setPictureTargetName(cat.name)} title="Set picture" disabled={busy}
                            className="text-xs px-2 py-1 rounded border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4] disabled:opacity-40">🖼️</button>
                        )}
                        {cat.image_url && (
                          <button type="button" onClick={() => handlePictureRemove(cat)} title="Remove picture" disabled={busy}
                            className="text-xs px-2 py-1 rounded border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4] disabled:opacity-40">🚫</button>
                        )}
                        <button type="button" onClick={() => openRename(cat)} title="Rename" disabled={busy}
                          className="text-xs px-2 py-1 rounded border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4] disabled:opacity-40">✏️</button>
                        <button type="button" onClick={() => openConfirmDelete(cat)} title="Delete" disabled={busy}
                          className="text-xs px-2 py-1 rounded border border-[#F0C9C2] text-[#9E3527] hover:bg-[#FBEAE7] disabled:opacity-40">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (mode === "rename" && selectedCat) {
    return (
      <div className="border border-[#D0D3CB] rounded-md overflow-hidden bg-white p-3 space-y-2">
        <p className="text-xs text-[#6B7068]">
          Rename <strong className="text-[#1B1D1E]">"{selectedCat.name}"</strong> ({selectedCat.count} products)
        </p>
        <div className="flex gap-2">
          <input autoFocus value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setMgmtError(""); }}
            className={`border rounded-md px-2.5 py-1.5 text-sm flex-1 ${mgmtError ? "border-[#F0C9C2]" : "border-[#D0D3CB]"}`} />
          <button type="button" onClick={saveRename} disabled={busy || !renameValue.trim()}
            className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-40">
            {busy ? "..." : "Save"}
          </button>
          <button type="button" onClick={() => { setMode("manage"); setSelectedCat(null); setMgmtError(""); }} disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4]">
            Cancel
          </button>
        </div>
        {mgmtError && <p className="text-xs text-[#9E3527]">⚠ {mgmtError}</p>}
      </div>
    );
  }

  if (mode === "confirmDelete" && selectedCat) {
    return (
      <div className="border border-[#F0C9C2] rounded-md overflow-hidden bg-[#FBEAE7] p-3 space-y-2">
        <p className="text-sm text-[#1B1D1E]">Delete <strong>"{selectedCat.name}"</strong>?</p>
        <p className="text-xs text-[#6B7068]">
          {selectedCat.count > 0
            ? `${selectedCat.count} product${selectedCat.count !== 1 ? "s" : ""} will become uncategorized (products themselves stay).`
            : "No products use this category."}
        </p>
        {mgmtError && <p className="text-xs text-[#9E3527]">⚠ {mgmtError}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={confirmDelete} disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md bg-[#9E3527] text-white hover:bg-[#7C2A1E] disabled:opacity-40">
            {busy ? "Deleting..." : "Yes, delete"}
          </button>
          <button type="button" onClick={() => { setMode("manage"); setSelectedCat(null); setMgmtError(""); }} disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md border border-[#D0D3CB] text-[#494D46] hover:bg-white">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__new__") { setMode("new"); onChange(""); }
            else onChange(e.target.value);
          }}
          className={`border rounded-md px-2.5 py-1.5 text-sm flex-1 bg-white ${error ? "border-[#F0C9C2]" : "border-[#D0D3CB]"}`}
          required
        >
          <option value="">{loading ? "Loading..." : "Select category *"}</option>
          {categories.map((cat) => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
          {categories.length > 0 && <option disabled>─────────</option>}
          <option value="__new__">+ Add new category</option>
        </select>
        {categories.length > 0 && (
          <button type="button" onClick={() => setMode("manage")} title="Manage categories"
            className="text-xs px-2.5 py-1.5 rounded-md border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4] shrink-0">
            ⚙️
          </button>
        )}
      </div>
      {error && <p className="text-xs text-[#9E3527]">{error}</p>}
    </div>
  );
}
