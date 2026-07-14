"use client";
import { productImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";

export default function MenuGrid({
  products,
  expandedId,
  onToggleExpand,
  onAddToCart,
}: {
  products: Product[];
  expandedId: number | null;
  onToggleExpand: (id: number) => void;
  onAddToCart: (p: Product, variantId: number | null, variantName: string | null, price: number) => void;
}) {
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  if (products.length === 0) {
    return <p className="text-sm text-[#494D46]">No products in this branch's menu yet.</p>;
  }

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-medium text-[#494D46] uppercase tracking-wide mb-2">
            {category}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((p) => {
              const imgSrc = productImageUrl(p.image_url);
              const isExpanded = expandedId === p.id;
              const availableVariants = p.variants.filter((v) => v.is_available);

              return (
                <div
                  key={p.id}
                  className={`bg-white border rounded-lg overflow-hidden ${
                    p.is_available
                      ? "border-[#D0D3CB]"
                      : "border-[#F0C9C2] opacity-60"
                  }`}
                >
                  <button
                    disabled={!p.is_available}
                    onClick={() => {
                      if (!p.is_available) return;
                      if (availableVariants.length > 0) onToggleExpand(p.id);
                      else onAddToCart(p, null, null, Number(p.price));
                    }}
                    className="w-full text-left"
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={p.name}
                        className="w-full h-24 object-cover"
                      />
                    ) : (
                      <div className="w-full h-24 bg-[#F0F1ED] flex items-center justify-center text-[#9B9F98] text-[11px]">
                        No image
                      </div>
                    )}
                    <div className="px-3 py-2">
                      <p className="text-sm text-[#1B1D1E] font-medium">{p.name}</p>
                      <p className="text-xs mono-num text-[#494D46]">
                        {p.is_available
                          ? `Rs ${Number(p.price).toFixed(2)}`
                          : "Unavailable"}
                      </p>
                    </div>
                  </button>

                  {isExpanded && availableVariants.length > 0 && (
                    <div className="px-3 pb-3 space-y-1.5 border-t border-[#EDEFEA] pt-2">
                      {availableVariants.map((v) => {
                        const totalPrice = Number(p.price) + Number(v.price);
                        return (
                          <button
                            key={v.id}
                            onClick={() => onAddToCart(p, v.id, v.name, totalPrice)}
                            className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-md border border-[#D0D3CB] hover:bg-[#F5F6F4]"
                          >
                            <span className="text-[#1B1D1E]">{v.name}</span>
                            <span className="mono-num text-[#494D46]">
                              Rs {totalPrice.toFixed(2)}
                              <span className="text-[#9B9F98] ml-1">
                                (+{Number(v.price).toFixed(0)})
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}