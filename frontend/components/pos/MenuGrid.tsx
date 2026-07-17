"use client";
import { useMemo, useState } from "react";
import { productImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";

export default function MenuGrid({
  products,
  onOpenProduct,
}: {
  products: Product[];
  onOpenProduct: (p: Product) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      const cat = p.category || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== "All") list = list.filter((p) => (p.category || "Uncategorized") === activeCategory);
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
    return list;
  }, [products, activeCategory, search]);

  if (products.length === 0) {
    return <p className="text-sm text-[#494D46]">No products in this branch's menu yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveCategory("All")}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            activeCategory === "All" ? "bg-[#2F7D6B] text-white" : "bg-white border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4]"
          }`}
        >
          All ({products.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.name}
            onClick={() => setActiveCategory(c.name)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === c.name ? "bg-[#2F7D6B] text-white" : "bg-white border border-[#D0D3CB] text-[#494D46] hover:bg-[#F5F6F4]"
            }`}
          >
            {c.name} ({c.count})
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search menu..."
        className="w-full border border-[#D0D3CB] rounded-md px-3 py-2 text-sm bg-white"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-[#494D46] py-8 text-center">No items match.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const imgSrc = productImageUrl(p.image_url);
            const addonCount = p.addon_groups?.length || 0;
            const hasVariants = p.variants.some((v) => v.is_available);

            return (
              <button
                key={p.id}
                disabled={!p.is_available}
                onClick={() => onOpenProduct(p)}
                className={`text-left bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                  p.is_available ? "border-[#D0D3CB]" : "border-[#F0C9C2] opacity-60"
                }`}
              >
                {imgSrc ? (
                  <img src={imgSrc} alt={p.name} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-[#F0F1ED] flex items-center justify-center text-[#9B9F98] text-[11px]">
                    No image
                  </div>
                )}
                <div className="px-3 py-2.5">
                  <p className="text-sm font-medium text-[#1B1D1E] truncate">{p.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs mono-num text-[#494D46]">
                      {p.is_available ? (
                        p.discounted_price && Number(p.discounted_price) < Number(p.price) ? (
                          <>
                            Rs {Number(p.discounted_price).toFixed(2)}{" "}
                            <span className="line-through text-[#9B9F98]">Rs {Number(p.price).toFixed(2)}</span>
                          </>
                        ) : `Rs ${Number(p.price).toFixed(2)}`
                      ) : "Unavailable"}
                    </p>
                    {(addonCount > 0 || hasVariants) && (
                      <span className="text-[10px] font-medium text-[#2F7D6B] bg-[#E6F2EF] px-1.5 py-0.5 rounded">
                        Addons ({addonCount + (hasVariants ? 1 : 0)})
                      </span>
                    )}
                  </div>
                  <div className="mt-2 w-full text-center text-xs font-semibold text-white bg-[#2F7D6B] rounded-md py-1.5">
                    + Add to Cart
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
