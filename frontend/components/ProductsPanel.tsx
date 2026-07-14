"use client";
import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import axios from "axios";
import { api, productImageUrl } from "@/lib/api";
import type { Product, ProductVariant } from "@/lib/types";

type Branch = { id: number; name: string };

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function ProductsPanel({
  viewerRole,
  viewerBranchId,
}: {
  viewerRole: string;
  viewerBranchId: number | null;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [branchFilter, setBranchFilter] = useState<number | "">("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");

  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editVariantName, setEditVariantName] = useState("");
  const [editVariantPrice, setEditVariantPrice] = useState("");

  async function load() {
    setLoading(true);
    let result;
    if (viewerRole === "super_admin") {
      const [branchesRes, productsRes] = await Promise.all([
        api.get<Branch[]>("/branches"),
        api.get<Product[]>("/products", { params: branchFilter ? { branch_id: branchFilter } : {} }),
      ]);
      setBranches(branchesRes.data);
      result = productsRes.data;
    } else {
      const productsRes = await api.get<Product[]>("/products");
      result = productsRes.data;
    }
    setProducts(result);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [branchFilter]);

  function branchName(id: number) {
    return branches.find((b) => b.id === id)?.name ?? `Branch #${id}`;
  }

  function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    setImageFile(e.target.files?.[0] ?? null);
  }

  async function uploadImage(productId: number, file: File) {
    const formData = new FormData();
    formData.append("image", file);
    await api.post(`/products/${productId}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (viewerRole === "super_admin" && !branchFilter) {
      setError("Select a branch first to add a product to it");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<Product>("/products", {
        name,
        price: Number(price),
        category: category || null,
        branch_id: viewerRole === "super_admin" ? branchFilter : undefined,
      });
      if (imageFile) {
        await uploadImage(res.data.id, imageFile);
      }
      setName("");
      setPrice("");
      setCategory("");
      setImageFile(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReplaceImage(productId: number, file: File) {
    setError("");
    try {
      await uploadImage(productId, file);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleRemoveImage(productId: number) {
    setError("");
    try {
      await api.delete(`/products/${productId}/image`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleToggleAvailable(p: Product) {
    setError("");
    try {
      await api.patch(`/products/${p.id}`, { is_available: !p.is_available });
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleEditSave(id: number) {
    setError("");
    try {
      await api.patch(`/products/${id}`, { name: editName, price: Number(editPrice), category: editCategory || null });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this product and all its variants?")) return;
    setError("");
    try {
      await api.delete(`/products/${id}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleAddVariant(productId: number) {
    setError("");
    if (!variantName || variantPrice === "") {
      setError("Variant name and price are required");
      return;
    }
    try {
      await api.post(`/products/${productId}/variants`, { name: variantName, price: Number(variantPrice) });
      setVariantName("");
      setVariantPrice("");
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleToggleVariantAvailable(v: ProductVariant) {
    setError("");
    try {
      await api.patch(`/products/variants/${v.id}`, { is_available: !v.is_available });
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleEditVariantSave(id: number) {
    setError("");
    try {
      await api.patch(`/products/variants/${id}`, { name: editVariantName, price: Number(editVariantPrice) });
      setEditingVariantId(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleDeleteVariant(id: number) {
    if (!confirm("Remove this variant?")) return;
    setError("");
    try {
      await api.delete(`/products/variants/${id}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (loading) return <p className="text-sm text-[#494D46]">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}

      {viewerRole === "super_admin" && (
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
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D0D3CB]">
          <h2 className="font-medium text-[#1B1D1E]">Add product</h2>
          {viewerRole === "super_admin" && !branchFilter && (
            <p className="text-xs text-[#494D46] mt-0.5">Select a branch above to add a product to it.</p>
          )}
        </div>
        <form onSubmit={handleAdd} className="px-5 py-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input placeholder="Item name (e.g. Zinger Burger)" value={name} onChange={(e) => setName(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" required />
            <input placeholder="Base price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm w-28" required />
            <input placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={handleImageSelect} className="text-sm text-[#494D46]" />
            <button type="submit" disabled={submitting} className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] disabled:opacity-50">
              {submitting ? "Adding..." : "Add product"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D0D3CB]">
          <h2 className="font-medium text-[#1B1D1E]">Menu</h2>
          <p className="text-xs text-[#494D46] mt-0.5">
            Click an item to add variants like "With cheese" or "Without fries". No variants means the base price applies.
          </p>
        </div>

        {products.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#494D46]">No products yet.</p>
        ) : (
          <ul>
            {products.map((p) => {
              const isExpanded = expandedId === p.id;
              const isEditing = editingId === p.id;
              const imgSrc = productImageUrl(p.image_url);

              return (
                <li key={p.id} className="border-b border-[#EDEFEA] last:border-0">
                  <div className="px-5 py-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" />
                          <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm w-24" />
                          <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="border border-[#D0D3CB] rounded-md px-2 py-1 text-sm" placeholder="Category" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditSave(p.id)} className="text-xs px-2.5 py-1 rounded-md bg-[#1B1D1E] text-white font-medium">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] text-[#1B1D1E] font-medium">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                          {imgSrc ? (
                            <img src={imgSrc} alt={p.name} className="w-12 h-12 rounded-md object-cover border border-[#D0D3CB]" />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-[#F0F1ED] border border-[#D0D3CB] flex items-center justify-center text-[#9B9F98] text-[10px]">
                              No image
                            </div>
                          )}
                          <button onClick={() => setExpandedId(isExpanded ? null : p.id)} className="text-left">
                            <p className="text-sm text-[#1B1D1E] font-medium">
                              {isExpanded ? "▾" : "▸"} {p.name}
                              {p.category && <span className="text-[#494D46] font-normal"> · {p.category}</span>}
                            </p>
                            <p className="text-xs text-[#494D46] mono-num mt-0.5">
                              Base Rs {Number(p.price).toFixed(2)}
                              {p.variants.length > 0 && ` · ${p.variants.length} variant${p.variants.length > 1 ? "s" : ""}`}
                              {viewerRole === "super_admin" && !branchFilter && ` · ${branchName(p.branch_id)}`}
                            </p>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleAvailable(p)}
                            className={`text-xs px-2 py-0.5 rounded-full ${p.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}
                          >
                            {p.is_available ? "Available" : "Unavailable"}
                          </button>
                          <button onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(p.price); setEditCategory(p.category || ""); }} className="text-xs px-2.5 py-1 rounded-md border border-[#C9CCC5] text-[#1B1D1E] font-medium hover:bg-[#F5F6F4]">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="text-xs px-2.5 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]">
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4 pl-9 space-y-3 bg-[#FAFAF8]">
                      <div className="flex items-center gap-2">
                        <label className="text-xs px-3 py-1.5 rounded-md border border-[#C9CCC5] bg-white cursor-pointer hover:bg-[#F5F6F4]">
                          {imgSrc ? "Change image" : "Add image"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReplaceImage(p.id, file);
                            }}
                          />
                        </label>
                        {imgSrc && (
                          <button onClick={() => handleRemoveImage(p.id)} className="text-xs px-3 py-1.5 rounded-md border border-[#F0C9C2] text-[#9E3527] hover:bg-[#FBEAE7]">
                            Remove image
                          </button>
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
                                    {v.name} <span className="mono-num text-[#494D46]">— Rs {Number(v.price).toFixed(2)}</span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleToggleVariantAvailable(v)}
                                      className={`text-xs px-2 py-0.5 rounded-full ${v.is_available ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FBEAE7] text-[#9E3527]"}`}
                                    >
                                      {v.is_available ? "Available" : "Unavailable"}
                                    </button>
                                    <button onClick={() => { setEditingVariantId(v.id); setEditVariantName(v.name); setEditVariantPrice(v.price); }} className="text-xs px-2 py-1 rounded-md border border-[#C9CCC5] font-medium hover:bg-[#F5F6F4]">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDeleteVariant(v.id)} className="text-xs px-2 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] font-medium hover:bg-[#FBEAE7]">
                                      Remove
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          placeholder="Variant name (e.g. With cheese)"
                          value={variantName}
                          onChange={(e) => setVariantName(e.target.value)}
                          className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
                        />
                        <input
                          placeholder="Price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={variantPrice}
                          onChange={(e) => setVariantPrice(e.target.value)}
                          className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm w-24"
                        />
                        <button onClick={() => handleAddVariant(p.id)} className="text-xs px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A]">
                          Add variant
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}