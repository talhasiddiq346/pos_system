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

  // Determine the branchId based on viewer role
  const branchId =
    viewerRole === "super_admin"
      ? typeof branchFilter === "number" ? branchFilter : null
      : viewerBranchId;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (viewerRole === "super_admin" && !branchFilter) {
      setError("Select a branch first");
      return;
    }

    if (!category.trim()) {
      setError("Category is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/products", {
        name,
        price: Number(price),
        category: category.trim(),
        branch_id: viewerRole === "super_admin" ? branchFilter : undefined,
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
        {viewerRole === "super_admin" && !branchFilter && (
          <p className="text-xs text-[#494D46] mt-0.5">
            Select a branch above to add a product to it.
          </p>
        )}
      </div>
      {error && (
        <p className="mx-5 mt-3 text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
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
              branchId={branchId}
              value={category}
              onChange={setCategory}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-sm text-[#494D46]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}