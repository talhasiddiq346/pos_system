"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"select" | "new">("select");
  const [newCategory, setNewCategory] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");

  useEffect(() => {
    if (!branchId) {
      setCategories([]);
      return;
    }
    setLoading(true);
    api.get<string[]>(`/products/categories/${branchId}`)
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, [branchId]);

  function handleNewCategoryChange(val: string) {
    setNewCategory(val);
    const exists = categories.find(
      (c) => c.toLowerCase().trim() === val.toLowerCase().trim()
    );
    if (exists && val.trim()) {
      setDuplicateWarning(`"${exists}" already exists — select from dropdown`);
    } else {
      setDuplicateWarning("");
    }
    onChange(val);
  }

  function handleSaveNew() {
    if (!newCategory.trim() || duplicateWarning) return;
    onChange(newCategory.trim());
    setCategories((prev) => [...prev, newCategory.trim()].sort());
    setMode("select");
    setNewCategory("");
    setDuplicateWarning("");
  }

  function handleCancelNew() {
    setMode("select");
    setNewCategory("");
    setDuplicateWarning("");
    onChange("");
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
            className={`border rounded-md px-2.5 py-1.5 text-sm flex-1 ${
              duplicateWarning ? "border-[#F0C9C2]" : "border-[#D0D3CB]"
            }`}
          />
          <button
            type="button"
            onClick={handleSaveNew}
            disabled={!newCategory.trim() || !!duplicateWarning}
            className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancelNew}
            className="text-xs px-3 py-1.5 rounded-md border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4]"
          >
            Cancel
          </button>
        </div>
        {duplicateWarning && (
          <p className="text-xs text-[#9E3527]">⚠ {duplicateWarning}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === "__new__") {
            setMode("new");
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
        className={`border rounded-md px-2.5 py-1.5 text-sm w-full bg-white ${
          error ? "border-[#F0C9C2]" : "border-[#D0D3CB]"
        }`}
        required
      >
        <option value="">
          {loading ? "Loading..." : "Select category *"}
        </option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
        {categories.length > 0 && <option disabled>─────────</option>}
        <option value="__new__">+ Add new category</option>
      </select>
      {error && <p className="text-xs text-[#9E3527]">{error}</p>}
    </div>
  );
}