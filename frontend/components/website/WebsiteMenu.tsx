"use client";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSiteSettings } from "@/lib/useSiteSettings";
import SiteHeader from "./SiteHeader";
import BannerCarousel from "./BannerCarousel";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";
const IMG = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "");

type Branch = { id: number; name: string; address: string; phone?: string };
type Variant = { id: number; name: string; price: number; is_available?: boolean };
type Product = {
  id: number;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
  description?: string | null;
  is_available?: boolean;
  is_popular?: boolean;
  variants?: Variant[];
};
type CartItem = {
  key: string;
  product_id: number;
  product_name: string;
  variant_id: number | null;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  image_url?: string | null;
};

const CAT_EMOJI: Record<string, string> = {
  "New Arrivals": "✨", "Deals": "🎁", "Kids Deal": "🧒",
  "Starters": "🍟", "Soups": "🍲", "Chinese": "🥡",
  "Fast Food": "🍔", "B.B.Q": "🍢", "BBQ": "🍢",
  "Rice Platter": "🍛", "Live Karahi": "🥘", "Sea Food": "🦐",
  "Pizza": "🍕", "Burgers": "🍔", "Pasta": "🍝",
  "Wraps": "🌯", "Desserts": "🍰", "Drinks": "🥤",
  "Biryani": "🍚", "Karahi": "🥘", "Main Course": "🍛",
  "Other": "🍽️",
};

function getCategoryEmoji(cat: string | null): string {
  if (!cat) return "🍽️";
  return CAT_EMOJI[cat] || "🍽️";
}

function fixImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${IMG}${url}`;
}

export default function WebsiteMenu({
  branch,
  orderType,
  onBack,
  onTrack,
  onCheckout,
}: {
  branch: Branch;
  orderType?: "delivery" | "pickup";
  onBack: () => void;
  onTrack: () => void;
  onCheckout: (cart: CartItem[]) => void;
}) {
  const site = useSiteSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [variantPicker, setVariantPicker] = useState<Product | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});

  useEffect(() => {
    axios.get<Product[]>(`${API}/public/menu/${branch.id}`)
      .then((r) => setProducts(r.data))
      .catch((err) => console.error("Menu fetch failed:", err))
      .finally(() => setLoading(false));

    axios.get<{ name: string; image_url: string }[]>(`${API}/public/categories/${branch.id}`)
      .then((r) => setCategoryImages(Object.fromEntries(r.data.map((c) => [c.name, c.image_url]))))
      .catch(() => setCategoryImages({}));
  }, [branch.id]);

  const categoryGroups = useMemo(() => {
    const filtered = search.trim()
      ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase().trim()))
      : products;

    const groups: Record<string, Product[]> = {};
    for (const p of filtered) {
      const cat = p.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, [products, search]);

  const categoryList = Object.keys(categoryGroups);
  const heroProducts = products.filter((p) => p.image_url).slice(0, 5);
  const curatedPopular = products.filter((p) => p.is_popular && p.is_available !== false);
  const popularItems = (curatedPopular.length > 0 ? curatedPopular : products.filter((p) => p.image_url && p.is_available !== false)).slice(0, 8);

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const discountPct = 0;
  const discountAmt = Math.round(subtotal * (discountPct / 100));
  const total = subtotal - discountAmt;

  function addToCart(product: Product, variant?: Variant) {
    const key = `${product.id}-${variant?.id ?? "base"}`;
    // Backend returns variant.price as ADDITIONAL to product price (same as old code)
    const unitPrice = variant
      ? Number(product.price) + Number(variant.price)
      : Number(product.price);

    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        key,
        product_id: product.id,
        product_name: product.name,
        variant_id: variant?.id ?? null,
        variant_name: variant?.name ?? null,
        unit_price: unitPrice,
        quantity: 1,
        image_url: product.image_url,
      }];
    });
    setVariantPicker(null);
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) => {
      const updated = prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c);
      return updated.filter((c) => c.quantity > 0);
    });
  }

  function handleAddClick(product: Product) {
    if (product.variants && product.variants.length > 0) {
      setVariantPicker(product);
    } else {
      addToCart(product);
    }
  }

  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "'DM Sans','Inter',-apple-system,sans-serif",
        background: site.backgroundColor,
      }}
    >
      <SiteHeader
        left={
          <>
            <button
              onClick={onBack}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-[#E8DFD0] hover:bg-[#FAF8F5] transition-colors"
            >
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-wider text-[#6B6259] font-semibold">
                  {orderType === "pickup" ? "PICKUP" : "DELIVERY"}
                </p>
                <p className="text-xs font-bold text-[#1A1613] leading-tight">{branch.name}</p>
              </div>
              <span style={{ color: site.primaryColor }}>▼</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#FAF8F5]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1613" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {branch.phone && (
              <a
                href={`tel:${branch.phone}`}
                className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-full border border-[#E8DFD0] hover:bg-[#FAF8F5]"
              >
                <span style={{ color: site.primaryColor }}>📞</span>
                <span className="text-xs font-semibold text-[#1A1613]">{branch.phone}</span>
              </a>
            )}
          </>
        }
        right={
          <>
            <button
              onClick={onTrack}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-[#6B6259] hover:bg-[#FAF8F5]"
            >
              📦 Track
            </button>

            <button
              onClick={() => setShowCart(true)}
              className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#FAF8F5]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1613" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {cartCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                  style={{ background: site.primaryColor }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </>
        }
      />

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="mb-6 text-2xl"
            >✕</button>

            <div className="space-y-2">
              <button
                onClick={() => { onBack(); setMobileMenuOpen(false); }}
                className="w-full text-left px-4 py-3 rounded-xl bg-[#FAF8F5] hover:bg-[#F4EBD9]"
              >
                <p className="text-[10px] uppercase text-[#6B6259] font-semibold">
                  {orderType === "pickup" ? "PICKUP FROM" : "DELIVERY FROM"}
                </p>
                <p className="text-sm font-bold text-[#1A1613]">{branch.name}</p>
                <p className="text-xs text-[#6B6259] mt-0.5">Tap to change</p>
              </button>

              <button
                onClick={() => { onTrack(); setMobileMenuOpen(false); }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#FAF8F5]"
              >
                📦 Track my order
              </button>

              {branch.phone && (
                <a
                  href={`tel:${branch.phone}`}
                  className="block px-4 py-3 rounded-xl hover:bg-[#FAF8F5]"
                >
                  📞 {branch.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {site.bannerImages.length > 0 ? (
        <BannerCarousel banners={site.bannerImages} />
      ) : heroProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-3 md:px-6 pt-4 md:pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
            {heroProducts.map((p, i) => {
              const imgSrc = fixImageUrl(p.image_url);
              return (
                <div
                  key={p.id}
                  className={`relative rounded-2xl overflow-hidden bg-[#EDE8E1] ${
                    i === 0 ? "col-span-2 sm:col-span-1" : ""
                  }`}
                  style={{ aspectRatio: i === 0 ? "2/1" : "3/4" }}
                >
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">
                      {getCategoryEmoji(p.category)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs md:text-sm font-bold truncate">{p.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {categoryList.length > 0 && (
        <div className="max-w-7xl mx-auto px-3 md:px-6 mt-6">
          <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-8 lg:grid-cols-11 pb-2 -mx-3 md:mx-0 px-3 md:px-0 no-scrollbar">
            {categoryList.map((cat) => {
              const isActive = activeCategory === cat;
              const imgSrc = categoryImages[cat];
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(isActive ? null : cat);
                    const el = document.getElementById(`cat-${cat}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="flex flex-col items-center gap-1.5 min-w-[72px] group"
                >
                  <div
                    className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-2xl md:text-3xl transition-all border-2 overflow-hidden ${
                      isActive ? "text-white shadow-md" : "bg-white border-transparent"
                    }`}
                    style={isActive ? { background: site.primaryColor, borderColor: site.primaryColor } : undefined}
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt={cat} className="w-full h-full object-cover" />
                    ) : (
                      getCategoryEmoji(cat)
                    )}
                  </div>
                  <p
                    className="text-[10px] md:text-xs font-semibold text-center leading-tight"
                    style={{ color: isActive ? site.primaryColor : "#6B6259" }}
                  >
                    {cat}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-3 md:px-6 mt-6">
        <h2 className="text-center text-lg md:text-xl font-bold text-[#1A1613] mb-3">
          What are you craving today?
        </h2>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl" style={{ color: site.primaryColor }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for anything..."
            className="w-full pl-12 pr-12 py-3.5 rounded-full bg-white border text-sm focus:outline-none shadow-md"
            style={{ borderColor: search ? site.primaryColor : "#E8DFD0" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full text-white flex items-center justify-center"
              style={{ background: site.primaryColor }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {site.activeVoucher && (
        <div className="max-w-3xl mx-auto px-3 md:px-6 mt-3">
          <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-[#E8DFD0]">
            <span
              className="w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: site.primaryColor }}
            >
              %
            </span>
            <span className="text-sm font-bold text-[#1A1613]">
              {site.activeVoucher.discount_type === "percent"
                ? `Flat ${site.activeVoucher.discount_value}% Off`
                : `Rs. ${site.activeVoucher.discount_value} Off`}
            </span>
            <span className="text-xs text-[#6B6259] hidden sm:inline">
              use code <span className="font-mono font-bold">{site.activeVoucher.code}</span>
            </span>
          </div>
        </div>
      )}

      {popularItems.length > 0 && !search && (
        <div className="max-w-7xl mx-auto px-3 md:px-6 mt-8">
          <div className="mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-[#1A1613] flex items-center gap-2">
              🔥 Popular Items
            </h2>
            <p className="text-xs md:text-sm text-[#6B6259] mt-0.5">Most ordered right now</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {popularItems.slice(0, 4).map((p) => (
              <ProductCardPopular key={p.id} product={p} onAdd={handleAddClick} />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 md:px-6 mt-10 pb-32">
        {loading ? (
          <div className="text-center py-20 text-[#6B6259]">Loading menu...</div>
        ) : categoryList.length === 0 ? (
          <div className="text-center py-20 text-[#6B6259]">
            {search ? "No items match your search" : "No items available yet"}
          </div>
        ) : (
          categoryList.map((cat) => {
            const catImg = categoryImages[cat];
            return (
            <div key={cat} id={`cat-${cat}`} className="mb-10 scroll-mt-24">
              <div
                className="relative h-24 md:h-32 rounded-3xl mb-5 overflow-hidden flex items-center justify-center"
                style={!catImg ? { background: `linear-gradient(to right, ${site.primaryColor}, ${site.secondaryColor})` } : undefined}
              >
                {catImg && (
                  <img src={catImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/25" />
                {!catImg && (
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute bottom-0 left-0 right-0 h-full flex items-end gap-1 px-4">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="flex-1 bg-white" style={{ height: `${20 + (i * 7) % 50}%` }} />
                      ))}
                    </div>
                  </div>
                )}
                <h2
                  className="relative text-3xl md:text-5xl font-bold text-white tracking-wide"
                  style={{ fontFamily: "'Playfair Display','DM Sans',serif" }}
                >
                  {cat}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {categoryGroups[cat].map((p) => (
                  <ProductCardMain key={p.id} product={p} onAdd={handleAddClick} />
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>

      {(showCart || cartCount > 0) && (
        <CartSidebar
          cart={cart}
          onUpdateQty={updateQty}
          onClose={() => setShowCart(false)}
          onCheckout={() => onCheckout(cart)}
          subtotal={subtotal}
          discountAmt={discountAmt}
          total={total}
          popularItems={popularItems}
          onAdd={handleAddClick}
          orderType={orderType}
          isOpen={showCart}
          cartCount={cartCount}
        />
      )}

      {variantPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setVariantPicker(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#1A1613] mb-1">Choose a size</h3>
            <p className="text-sm text-[#6B6259] mb-4">{variantPicker.name}</p>
            <div className="space-y-2">
              {variantPicker.variants?.map((v) => {
                const totalPrice = Number(variantPicker.price) + Number(v.price);
                return (
                  <button
                    key={v.id}
                    onClick={() => addToCart(variantPicker, v)}
                    disabled={v.is_available === false}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-[#E8DFD0] hover:border-[#E8542F] active:scale-[0.98] disabled:opacity-40 transition-all"
                  >
                    <span className="font-semibold text-[#1A1613]">{v.name}</span>
                    <span className="font-bold text-[#1E293B]">Rs. {fmt(totalPrice)}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setVariantPicker(null)}
              className="w-full mt-4 py-3 rounded-xl border border-[#E8DFD0] text-[#6B6259] font-semibold hover:bg-[#FAF8F5]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {cartCount > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 right-4 md:hidden z-40 bg-[#E8542F] text-white px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-3 font-semibold active:scale-95 transition-transform"
        >
          <span className="w-6 h-6 rounded-full bg-white text-[#E8542F] flex items-center justify-center text-sm font-bold">
            {cartCount}
          </span>
          <span>View Cart</span>
          <span className="font-bold">Rs. {fmt(total)}</span>
        </button>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function ProductCardMain({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) {
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const hasVariants = product.variants && product.variants.length > 0;
  const basePrice = Number(product.price);
  const minVariantPrice = hasVariants
    ? basePrice + Math.min(...product.variants!.map((v) => Number(v.price)))
    : basePrice;
  const imgSrc = fixImageUrl(product.image_url);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E8DFD0] hover:shadow-md transition-shadow relative">
      {(product as any).is_new && (
        <span className="absolute top-2 right-2 z-10 bg-[#F0A93B] text-[#1A1613] text-[10px] font-bold px-2 py-1 rounded">
          New Arrival
        </span>
      )}

      <div className="flex items-stretch p-3 gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-bold text-[#1A1613] text-sm md:text-base leading-tight">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-[#6B6259] mt-1 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          <div className="mt-auto pt-3">
            <p className="text-[#1E293B] font-bold text-base">
              {hasVariants && <span className="text-xs font-normal text-[#6B6259]">From </span>}
              Rs. {fmt(minVariantPrice)}
            </p>
          </div>
        </div>

        <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden bg-[#F5F1EB] flex-shrink-0">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">
              {getCategoryEmoji(product.category)}
            </div>
          )}
          <button
            onClick={() => onAdd(product)}
            className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[#E8542F] text-white flex items-center justify-center shadow-lg font-bold text-lg active:scale-90 transition-transform"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCardPopular({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) {
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const hasVariants = product.variants && product.variants.length > 0;
  const basePrice = Number(product.price);
  const minVariantPrice = hasVariants
    ? basePrice + Math.min(...product.variants!.map((v) => Number(v.price)))
    : basePrice;
  const imgSrc = fixImageUrl(product.image_url);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E8DFD0]">
      <div className="relative aspect-square bg-[#F5F1EB]">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {getCategoryEmoji(product.category)}
          </div>
        )}
        <button
          onClick={() => onAdd(product)}
          className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-[#E8542F] text-white flex items-center justify-center shadow-lg font-bold text-lg active:scale-90"
        >
          +
        </button>
      </div>
      <div className="p-2.5 md:p-3">
        <h4 className="font-bold text-[#1A1613] text-sm truncate">{product.name}</h4>
        <p className="text-[#1E293B] font-bold text-sm mt-1">
          {hasVariants && <span className="text-xs font-normal text-[#6B6259]">From </span>}
          Rs. {fmt(minVariantPrice)}
        </p>
      </div>
    </div>
  );
}

function CartSidebar({
  cart, onUpdateQty, onClose, onCheckout,
  subtotal, discountAmt, total, popularItems, onAdd,
  orderType, isOpen, cartCount,
}: any) {
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const savedAmt = discountAmt;

  if (!isOpen && cartCount === 0) return null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 bottom-0 z-40 w-full md:w-96 bg-white shadow-2xl overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } transition-transform`}
        style={{ display: isOpen || cartCount > 0 ? "flex" : "none", flexDirection: "column" }}
      >
        <div className="bg-[#E8542F] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <h3 className="font-bold text-lg">Your Cart</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="px-5 py-20 text-center">
              <div className="text-6xl mb-3">🛒</div>
              <p className="text-[#6B6259] text-sm">Your cart is empty</p>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              {cart.map((item: CartItem) => {
                const imgSrc = fixImageUrl(item.image_url);
                return (
                  <div key={item.key} className="bg-white border border-[#E8DFD0] rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-[#F5F1EB] overflow-hidden flex-shrink-0">
                      {imgSrc ? (
                        <img src={imgSrc} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1A1613] truncate">{item.product_name}</p>
                      {item.variant_name && (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FFE8E0] text-[#E8542F] mt-0.5">
                          {item.variant_name}
                        </span>
                      )}
                      <p className="text-sm font-bold text-[#1E293B] mt-1">
                        Rs. {fmt(item.unit_price * item.quantity)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => onUpdateQty(item.key, -item.quantity)}
                        className="w-7 h-7 rounded-full text-[#E8542F] border border-[#E8DFD0] hover:bg-[#FFE8E0] flex items-center justify-center text-xs"
                      >🗑</button>
                      <div className="flex items-center gap-1 border border-[#E8DFD0] rounded-full px-1 py-0.5">
                        <button
                          onClick={() => onUpdateQty(item.key, -1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[#E8542F] font-bold"
                        >−</button>
                        <span className="text-xs font-bold text-[#1A1613] min-w-[16px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQty(item.key, 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[#E8542F] font-bold"
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {popularItems.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1 h-4 bg-[#E8542F] rounded-full" />
                    <h4 className="text-sm font-bold text-[#1A1613]">🔥 Popular with your order</h4>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
                    {popularItems.slice(0, 6).map((p: Product) => {
                      const imgSrc = fixImageUrl(p.image_url);
                      return (
                        <div key={p.id} className="w-28 flex-shrink-0 bg-white border border-[#E8DFD0] rounded-xl overflow-hidden">
                          <div className="relative aspect-square bg-[#F5F1EB]">
                            {imgSrc ? (
                              <img src={imgSrc} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl">
                                {getCategoryEmoji(p.category)}
                              </div>
                            )}
                            <button
                              onClick={() => onAdd(p)}
                              className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-[#E8542F] text-white flex items-center justify-center text-xs font-bold"
                            >+</button>
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-bold text-[#1E293B]">Rs. {fmt(Number(p.price))}</p>
                            <p className="text-[10px] text-[#6B6259] truncate">{p.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-[#FFF5F1] border border-[#FFD5C7] rounded-2xl p-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-[#1A1613]">
                    <span>🧮</span> Total
                  </div>
                  <span className="font-bold text-[#1A1613]">Rs. {fmt(subtotal)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-[#16A34A]">
                      <span>%</span> Discount
                    </div>
                    <span className="font-bold text-[#16A34A]">− Rs. {fmt(discountAmt)}</span>
                  </div>
                )}
                <div className="h-px bg-[#FFD5C7] my-3" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1A1613] text-base">Grand Total</span>
                  <span className="font-bold text-[#E8542F] text-xl">Rs. {fmt(total)}</span>
                </div>
              </div>

              {savedAmt > 0 && (
                <div className="bg-[#E6F2EF] border border-[#C7E2DA] rounded-2xl px-4 py-2.5 flex items-center gap-2 mt-3">
                  <span className="w-6 h-6 rounded-full bg-[#16A34A] text-white flex items-center justify-center text-xs">%</span>
                  <span className="text-sm text-[#16A34A] font-semibold">
                    Yay! You saved Rs. {fmt(savedAmt)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-[#E8DFD0] p-4 sticky bottom-0 bg-white">
            <button
              onClick={onCheckout}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#E8542F] to-[#D64822] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
            >
              Checkout <span>→</span>
            </button>
            <p className="text-center text-xs text-[#6B6259] mt-3">
              Your order will be ready for{" "}
              <span className="font-semibold text-[#1A1613]">
                {orderType === "pickup" ? "pickup" : "delivery"}
              </span>{" "}
              in <span className="font-semibold text-[#E8542F]">45 minutes</span>
            </p>
          </div>
        )}
      </div>
    </>
  );
}