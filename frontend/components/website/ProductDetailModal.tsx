"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Share2 } from "lucide-react";

type AddonOption = { id: number; name: string; price: string; is_available: boolean };
type AddonGroup = {
  id: number;
  title: string;
  selection_type: "single" | "multiple";
  required: boolean;
  options: AddonOption[];
};
type Variant = { id: number; name: string; price: number; is_available?: boolean };
type Product = {
  id: number;
  name: string;
  price: number;
  discounted_price?: number | null;
  description?: string | null;
  image_url: string | null;
  variants?: Variant[];
  addon_groups?: AddonGroup[];
};

export type ProductSelection = {
  variant_id: number | null;
  variant_name: string | null;
  addon_option_ids: number[];
  addon_summary: { name: string; price: number }[];
  quantity: number;
  unit_price: number;
};

function fixImageUrl(url: string | null | undefined, imgOrigin: string): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${imgOrigin}${url}`;
}

export default function ProductDetailModal({
  product,
  imgOrigin,
  accentColor,
  onClose,
  onConfirm,
  categoryEmoji,
}: {
  product: Product;
  imgOrigin: string;
  accentColor: string;
  onClose: () => void;
  onConfirm: (selection: ProductSelection) => void;
  categoryEmoji: string;
}) {
  const variantGroup: AddonGroup | null = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return null;
    return {
      id: -1,
      title: "Choose an Option",
      selection_type: "single",
      required: true,
      options: product.variants.map((v) => ({
        id: v.id, name: v.name, price: String(v.price), is_available: v.is_available !== false,
      })),
    };
  }, [product.variants]);

  const allGroups = variantGroup ? [variantGroup, ...(product.addon_groups || [])] : (product.addon_groups || []);

  const [singleSelections, setSingleSelections] = useState<Record<number, number | null>>(() => {
    const initial: Record<number, number | null> = {};
    for (const g of allGroups) {
      if (g.selection_type === "single") {
        initial[g.id] = g.required && g.options.length > 0 ? g.options[0].id : null;
      }
    }
    return initial;
  });
  const [multiSelections, setMultiSelections] = useState<Record<number, number[]>>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function toggleMulti(groupId: number, optionId: number) {
    setMultiSelections((prev) => {
      const current = prev[groupId] || [];
      const isSelected = current.includes(optionId);
      return { ...prev, [groupId]: isSelected ? current.filter((id) => id !== optionId) : [...current, optionId] };
    });
  }

  const hasDiscount = product.discounted_price != null && Number(product.discounted_price) < Number(product.price);
  const basePrice = hasDiscount ? Number(product.discounted_price) : Number(product.price);

  const { unitPrice, addonSummary, addonOptionIds, variantId, variantName } = useMemo(() => {
    let total = basePrice;
    const summary: { name: string; price: number }[] = [];
    const optionIds: number[] = [];
    let vId: number | null = null;
    let vName: string | null = null;

    for (const g of allGroups) {
      if (g.selection_type === "single") {
        const selectedId = singleSelections[g.id];
        const opt = g.options.find((o) => o.id === selectedId);
        if (opt) {
          total += Number(opt.price);
          if (g.id === -1) {
            vId = opt.id;
            vName = opt.name;
          } else {
            summary.push({ name: opt.name, price: Number(opt.price) });
            optionIds.push(opt.id);
          }
        }
      } else {
        for (const optId of multiSelections[g.id] || []) {
          const opt = g.options.find((o) => o.id === optId);
          if (opt) {
            total += Number(opt.price);
            summary.push({ name: opt.name, price: Number(opt.price) });
            optionIds.push(opt.id);
          }
        }
      }
    }
    return { unitPrice: total, addonSummary: summary, addonOptionIds: optionIds, variantId: vId, variantName: vName };
  }, [allGroups, singleSelections, multiSelections, basePrice]);

  const missingRequired = allGroups.some((g) => {
    if (!g.required) return false;
    if (g.selection_type === "single") return singleSelections[g.id] == null;
    return (multiSelections[g.id] || []).length === 0;
  });

  const fmt = (n: number) => Math.round(n).toLocaleString();
  const imgSrc = fixImageUrl(product.image_url, imgOrigin);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-4xl sm:rounded-2xl rounded-t-3xl shadow-2xl h-[92vh] sm:h-auto sm:max-h-[92vh] flex flex-col lg:flex-row overflow-hidden min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image column */}
        <div className="lg:w-[40%] shrink-0 p-4 sm:p-6 flex flex-col">
          <div className="w-full h-[26vh] sm:h-auto sm:aspect-square rounded-xl overflow-hidden bg-[#F5F1EB] flex items-center justify-center">
            {imgSrc ? (
              <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-6xl">{categoryEmoji}</span>
            )}
          </div>
        </div>

        {/* Details column */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col lg:border-l border-[#E8DFD0]">
          <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6">
            <h2 className="text-2xl font-bold text-[#1A1613]">{product.name}</h2>
            <div className="flex items-center gap-2 shrink-0">
              <button className="w-9 h-9 rounded-full border border-[#E8DFD0] flex items-center justify-center hover:bg-[#FAF8F5]">
                <Share2 size={16} />
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full border border-[#E8DFD0] flex items-center justify-center hover:bg-[#FAF8F5]"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {product.description && (
            <p className="text-sm text-[#6B6259] mt-2 leading-relaxed px-5 sm:px-6">{product.description}</p>
          )}
          <p className="px-5 sm:px-6 mt-2">
            <span className="font-bold text-[#1A1613]">Rs. {fmt(basePrice)}</span>
            {hasDiscount && (
              <span className="ml-1.5 text-sm text-[#9CA3AF] line-through">Rs. {fmt(Number(product.price))}</span>
            )}
          </p>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 pb-2 mt-4">
            {allGroups.map((g) => (
              <div key={g.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-bold text-[#1A1613] uppercase tracking-wide">{g.title}</h3>
                  {g.required ? (
                    <span className="bg-[#FBBF24] text-[#1A1613] text-[10px] font-bold px-2 py-0.5 rounded">Required</span>
                  ) : (
                    <span className="bg-[#5EEAD4] text-[#0F2E2A] text-[10px] font-bold px-2 py-0.5 rounded">Optional</span>
                  )}
                </div>

                {g.id === -1 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {g.options.filter((o) => o.is_available).map((o) => {
                      const isSelected = singleSelections[g.id] === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSingleSelections((prev) => ({ ...prev, [g.id]: o.id }))}
                          className="p-3 rounded-xl border-2 text-left transition-all"
                          style={isSelected ? { borderColor: accentColor } : { borderColor: "#E8DFD0" }}
                        >
                          <span
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mb-2"
                            style={{ borderColor: isSelected ? accentColor : "#D0D3CB" }}
                          >
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full" style={{ background: accentColor }} />}
                          </span>
                          <p className="font-semibold text-[#1A1613] text-sm">{o.name}</p>
                          <p className="text-sm font-bold text-[#1A1613] mt-1">
                            Rs. {fmt(basePrice + Number(o.price))}
                            {hasDiscount && (
                              <span className="ml-1 text-xs font-normal text-[#9CA3AF] line-through">
                                Rs. {fmt(Number(product.price) + Number(o.price))}
                              </span>
                            )}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {g.options.filter((o) => o.is_available).map((o) => {
                      const isSelected = g.selection_type === "single"
                        ? singleSelections[g.id] === o.id
                        : (multiSelections[g.id] || []).includes(o.id);

                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            if (g.selection_type === "single") {
                              setSingleSelections((prev) => ({ ...prev, [g.id]: isSelected && !g.required ? null : o.id }));
                            } else {
                              toggleMulti(g.id, o.id);
                            }
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all hover:border-[#D0D3CB]"
                          style={{ borderColor: "#E8DFD0" }}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 ${g.selection_type === "single" ? "rounded-full" : "rounded"}`}
                              style={{ borderColor: isSelected ? accentColor : "#D0D3CB", background: isSelected && g.selection_type === "multiple" ? accentColor : "transparent" }}
                            >
                              {isSelected && g.selection_type === "single" && (
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: accentColor }} />
                              )}
                              {isSelected && g.selection_type === "multiple" && <span className="text-white text-xs">✓</span>}
                            </span>
                            <span className="font-medium text-[#1A1613] text-left text-sm">{o.name}</span>
                          </span>
                          <span className="font-semibold text-[#1E293B] text-sm">Rs. {fmt(Number(o.price))}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-[#E8DFD0] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-[#F3F4F6]">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 flex items-center justify-center font-bold text-lg text-[#1A1613] rounded-l-lg hover:bg-[#E5E7EB]"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-[#1A1613]">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 flex items-center justify-center font-bold text-lg text-white rounded-r-lg"
                  style={{ background: accentColor }}
                >
                  +
                </button>
              </div>

              <button
                onClick={() => onConfirm({
                  variant_id: variantId,
                  variant_name: variantName,
                  addon_option_ids: addonOptionIds,
                  addon_summary: addonSummary,
                  quantity,
                  unit_price: unitPrice,
                })}
                disabled={missingRequired}
                className="flex-1 text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: accentColor }}
              >
                <span>Rs. {fmt(unitPrice * quantity)}</span>
                <span className="flex items-center gap-2">
                  Add to Cart
                  <span aria-hidden>→</span>
                </span>
              </button>
            </div>
            {missingRequired && (
              <p className="text-xs text-[#9E3527] mt-2 text-center">Please make your required selections above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
