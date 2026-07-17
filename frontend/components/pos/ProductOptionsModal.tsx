"use client";
import { useMemo, useState } from "react";
import { productImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";

export type PosSelection = {
  variant_id: number | null;
  variant_name: string | null;
  addon_option_ids: number[];
  addon_summary: { name: string; price: number }[];
  quantity: number;
  unit_price: number;
};

export default function ProductOptionsModal({
  product,
  onClose,
  onConfirm,
}: {
  product: Product;
  onClose: () => void;
  onConfirm: (selection: PosSelection) => void;
}) {
  const variantGroup = useMemo(() => {
    const available = product.variants.filter((v) => v.is_available);
    if (available.length === 0) return null;
    return {
      id: -1,
      title: "Choose an option",
      selection_type: "single" as const,
      required: true,
      options: available.map((v) => ({ id: v.id, name: v.name, price: v.price, is_available: true })),
    };
  }, [product.variants]);

  const addonGroups = product.addon_groups || [];
  const allGroups = variantGroup ? [variantGroup, ...addonGroups] : addonGroups;

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
          if (g.id === -1) { vId = opt.id; vName = opt.name; }
          else { summary.push({ name: opt.name, price: Number(opt.price) }); optionIds.push(opt.id); }
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

  const imgSrc = productImageUrl(product.image_url);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#D0D3CB]">
          {imgSrc ? (
            <img src={imgSrc} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-[#D0D3CB]" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#F0F1ED] border border-[#D0D3CB]" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#1B1D1E]">{product.name}</p>
            <p className="text-xs text-[#494D46] mono-num">
              Base Rs {basePrice.toFixed(2)}
              {hasDiscount && <span className="line-through text-[#9B9F98] ml-1">Rs {Number(product.price).toFixed(2)}</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#F5F6F4] flex items-center justify-center text-[#494D46]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {allGroups.length === 0 ? (
            <p className="text-sm text-[#494D46]">No options for this item.</p>
          ) : (
            allGroups.map((g) => (
              <div key={g.id} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xs font-semibold text-[#1B1D1E] uppercase tracking-wide">{g.title}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${g.required ? "bg-[#FBEAE7] text-[#9E3527]" : "bg-[#E6F2EF] text-[#1F6F54]"}`}>
                    {g.required ? "Required" : "Optional"}
                  </span>
                </div>
                <div className="space-y-1.5">
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${
                          isSelected ? "border-[#2F7D6B] bg-[#E6F2EF]" : "border-[#D0D3CB] hover:bg-[#F5F6F4]"
                        }`}
                      >
                        <span className="text-[#1B1D1E]">{o.name}</span>
                        <span className="mono-num text-[#494D46]">
                          {Number(o.price) > 0 ? `+Rs ${Number(o.price).toFixed(0)}` : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[#D0D3CB] p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border border-[#D0D3CB]">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center font-bold text-[#1B1D1E]">−</button>
              <span className="w-7 text-center text-sm font-semibold mono-num">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="w-8 h-8 flex items-center justify-center font-bold text-[#1B1D1E]">+</button>
            </div>
            <button
              onClick={() => onConfirm({
                variant_id: variantId, variant_name: variantName,
                addon_option_ids: addonOptionIds, addon_summary: addonSummary,
                quantity, unit_price: unitPrice,
              })}
              disabled={missingRequired}
              className="flex-1 bg-[#2F7D6B] text-white font-medium py-2.5 rounded-md hover:bg-[#27695A] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between px-4"
            >
              <span className="mono-num">Rs {(unitPrice * quantity).toFixed(2)}</span>
              <span>Add to Cart</span>
            </button>
          </div>
          {missingRequired && <p className="text-xs text-[#9E3527] mt-2 text-center">Make your required selections above.</p>}
        </div>
      </div>
    </div>
  );
}
