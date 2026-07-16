"use client";
import { useState, FormEvent } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { Role } from "@/lib/types";
import CategorySelect from "./CategorySelect";

type Branch = { id: number; name: string };

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function AddProductForm({
  viewerRole,
  viewerBranchId,
  branches,
  branchFilter,
  onAdded,
}: {
  viewerRole: Role;
  viewerBranchId: number | null;
  branches: Branch[];
  branchFilter: number | "";
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addToAll, setAddToAll] = useState(false);

  const isSuperAdmin = viewerRole === "super_admin";

  // For category dropdown — in bulk mode use first branch as reference
  const categoryBranchId = addToAll
    ? branches[0]?.id ?? null
    : isSuperAdmin
      ? typeof branchFilter === "number" ? branchFilter : null
      : viewerBranchId;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (isSuperAdmin && !addToAll && !branchFilter) {
      setError("Select a branch first, or check 'Add to all branches'");
      return;
    }
    if (addToAll && branches.length === 0) {
      setError("No branches available");
      return;
    }
    if (!category.trim()) {
      setError("Category is required");
      return;
    }

    setSubmitting(true);
    try {
      // ═══════════════════════════════════════════════
      // BULK MODE — Add to all branches at once
      // ═══════════════════════════════════════════════
      if (addToAll) {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("price", String(Number(price)));
        formData.append("category", category.trim());
        formData.append("branch_ids", JSON.stringify(branches.map((b) => b.id)));
        if (imageFile) formData.append("image", imageFile);

        const res = await api.post("/products/bulk", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setSuccess(`✅ Added to ${res.data.count} branch${res.data.count > 1 ? "es" : ""}`);
        setName("");
        setPrice("");
        setCategory("");
        setImageFile(null);
        (document.getElementById("product-image-input") as HTMLInputElement | null)?.value && ((document.getElementById("product-image-input") as HTMLInputElement).value = "");
        onAdded();
        return;
      }

      // ═══════════════════════════════════════════════
      // SINGLE BRANCH MODE — Original flow
      // ═══════════════════════════════════════════════
      const res = await api.post("/products", {
        name,
        price: Number(price),
        category: category.trim(),
        branch_id: isSuperAdmin ? branchFilter : undefined,
      });
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        await api.post(`/products/${res.data.id}/image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setName("");
      setPrice("");
      setCategory("");
      setImageFile(null);
      const fileInput = document.getElementById("product-image-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setSuccess("✅ Product added");
      onAdded();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#D0D3CB]">
        <h2 className="font-medium text-[#1B1D1E]">Add product</h2>
        {isSuperAdmin && !addToAll && !branchFilter && (
          <p className="text-xs text-[#494D46] mt-0.5">
            Select a branch above, or check "Add to all branches" below.
          </p>
        )}
      </div>

      {error && (
        <p className="mx-5 mt-3 text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="mx-5 mt-3 text-sm text-[#1F6F54] bg-[#E6F2EF] border border-[#C7E2DA] rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
        {/* Add to all branches — super_admin only */}
        {isSuperAdmin && branches.length > 1 && (
          <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2.5 rounded-md bg-[#FFF8ED] border border-[#F0D99A] hover:bg-[#FEF3D5] transition-colors">
            <input
              type="checkbox"
              checked={addToAll}
              onChange={(e) => setAddToAll(e.target.checked)}
              className="w-4 h-4 accent-[#E8542F]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#8A6D1F]">
                🏪 Add to all branches ({branches.length})
              </p>
              <p className="text-xs text-[#8A6D1F]/80 mt-0.5">
                {addToAll
                  ? `Product will be created in: ${branches.map((b) => b.name).join(", ")}`
                  : "Same name, price, and category across all branches"}
              </p>
            </div>
          </label>
        )}

        {/* Form fields */}
        <div className="flex flex-wrap items-start gap-2">
          <input
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
            required
          />
          <input
            placeholder="Base price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm w-28"
            required
          />
          <div className="min-w-[220px]">
            <CategorySelect
              branchId={categoryBranchId}
              value={category}
              onChange={setCategory}
            />
          </div>
        </div>

        {addToAll && category && (
          <p className="text-xs text-[#8A6D1F] bg-[#FFF8ED] border border-[#F0D99A] rounded-md px-3 py-1.5">
            💡 Category <strong>"{category}"</strong> will be applied to all {branches.length} branches (will be created where it doesn't exist)
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <input
            id="product-image-input"
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-sm text-[#494D46]"
          />
          {addToAll && imageFile && (
            <span className="text-xs text-[#494D46] bg-[#F5F6F4] px-2 py-1 rounded">
              📷 Same image for all branches
            </span>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50 ml-auto"
          >
            {submitting
              ? "Adding..."
              : addToAll
                ? `Add to ${branches.length} branches`
                : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}