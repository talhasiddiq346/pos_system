"use client";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { MapPin, MessageCircle, Menu, ShoppingCart, Package } from "lucide-react";
import { useSiteSettings } from "@/lib/useSiteSettings";
import SiteHeader from "./SiteHeader";
import BannerCarousel from "./BannerCarousel";
import CategoryCarousel from "./CategoryCarousel";
import AnimatedSearchBar from "./AnimatedSearchBar";
import ProductDetailModal, { ProductSelection } from "./ProductDetailModal";
import Footer from "./Footer";
import ScrollToTopButton from "./ScrollToTopButton";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";
const IMG = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "");

type Branch = { id: number; name: string; address: string; phone?: string };
type Variant = { id: number; name: string; price: number; is_available?: boolean };
type AddonOption = { id: number; name: string; price: string; is_available: boolean };
type AddonGroup = {
  id: number;
  title: string;
  selection_type: "single" | "multiple";
  required: boolean;
  options: AddonOption[];
};
type Product = {
  id: number;
  name: string;
  price: number;
  discounted_price?: number | null;
  category: string | null;
  image_url: string | null;
  description?: string | null;
  is_available?: boolean;
  is_popular?: boolean;
  variants?: Variant[];
  addon_groups?: AddonGroup[];
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
  addon_option_ids?: number[];
  addon_summary?: { name: string; price: number }[];
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
  const [productModal, setProductModal] = useState<Product | null>(null);
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

  function addToCart(product: Product, selection: ProductSelection) {
    const addonKey = [...selection.addon_option_ids].sort((a, b) => a - b).join(",");
    const key = `${product.id}-${selection.variant_id ?? "base"}-${addonKey}`;

    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + selection.quantity } : c);
      }
      return [...prev, {
        key,
        product_id: product.id,
        product_name: product.name,
        variant_id: selection.variant_id,
        variant_name: selection.variant_name,
        unit_price: selection.unit_price,
        quantity: selection.quantity,
        image_url: product.image_url,
        addon_option_ids: selection.addon_option_ids,
        addon_summary: selection.addon_summary,
      }];
    });
    setProductModal(null);
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) => {
      const updated = prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c);
      return updated.filter((c) => c.quantity > 0);
    });
  }

  function handleAddClick(product: Product) {
    setProductModal(product);
  }

  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "'DM Sans','Inter',-apple-system,sans-serif",
        backgroundImage: `linear-gradient(to bottom right, ${site.backgroundColor}, #ffffff)`,
      }}
    >
      <SiteHeader
        left={
          <>
            <button
              onClick={onBack}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-md text-black text-sm font-medium whitespace-nowrap transition"
              style={{ background: site.secondaryColor }}
            >
              <MapPin size={16} /> {branch.name}
            </button>

            {branch.phone && (
              <a
                href={`https://wa.me/${branch.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-md text-black text-sm font-medium whitespace-nowrap transition"
                style={{ background: site.secondaryColor }}
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#FAF8F5]"
            >
              <Menu size={20} className="text-[#1A1613]" />
            </button>
          </>
        }
        right={
          <>
            <button
              onClick={onTrack}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-[#6B6259] hover:bg-[#FAF8F5]"
            >
              <Package size={15} /> Track
            </button>

            <button
              onClick={() => setShowCart(true)}
              className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#FAF8F5]"
              style={{ color: site.primaryColor }}
            >
              <ShoppingCart size={20} />
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
                className="w-full text-left px-4 py-3 rounded-xl"
                style={{ background: site.secondaryColor }}
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

      <div className="sticky top-20 z-20" style={{ background: site.backgroundColor }}>
        <CategoryCarousel
          categories={categoryList.map((cat) => ({ name: cat, image_url: categoryImages[cat] }))}
          activeCategory={activeCategory}
          onSelect={(cat) => {
            setActiveCategory(activeCategory === cat ? null : cat);
            const el = document.getElementById(`cat-${cat}`);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          accentColor={site.primaryColor}
          accentTint={site.secondaryColor}
        />
      </div>

      <AnimatedSearchBar
        value={search}
        onChange={setSearch}
        words={categoryList.length > 0 ? categoryList.map((c) => `${c} ...`) : ["Deals ...", "Meals ...", "Combos ..."]}
        accentColor={site.primaryColor}
      />

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
                className="relative h-28 md:h-40 rounded-3xl mb-5 overflow-hidden flex items-center justify-center shadow-lg"
                style={!catImg ? { background: `linear-gradient(135deg, ${site.primaryColor}, ${site.secondaryColor})` } : undefined}
              >
                {catImg && (
                  <img src={catImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                {!catImg && (
                  <>
                    <div className="absolute -top-6 -left-6 w-28 h-28 rounded-full bg-white/15 blur-2xl" />
                    <div className="absolute -bottom-8 -right-4 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
                  </>
                )}
                <h2 className="relative text-3xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                  {cat}
                </h2>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/70" />
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

      <Footer onTrack={onTrack} />
      <ScrollToTopButton />

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

      {productModal && (
        <ProductDetailModal
          product={productModal}
          imgOrigin={IMG}
          accentColor={site.primaryColor}
          categoryEmoji={getCategoryEmoji(productModal.category)}
          onClose={() => setProductModal(null)}
          onConfirm={(selection) => addToCart(productModal, selection)}
        />
      )}

      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-40">
          <button
            onClick={() => setShowCart(true)}
            className="w-full max-w-md mx-auto text-white px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-3 font-semibold active:scale-95 transition-transform"
            style={{ background: site.primaryColor }}
          >
            <span className="relative shrink-0">
              <ShoppingCart size={20} />
              <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white text-[10px] font-bold flex items-center justify-center" style={{ color: site.primaryColor }}>
                {cartCount}
              </span>
            </span>
            <span>View Cart</span>
            <span className="font-bold ml-auto">Rs. {fmt(total)}</span>
          </button>
        </div>
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
  const site = useSiteSettings();
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const hasVariants = product.variants && product.variants.length > 0;
  const hasDiscount = product.discounted_price != null && Number(product.discounted_price) < Number(product.price);
  const effectivePrice = hasDiscount ? Number(product.discounted_price) : Number(product.price);
  const originalPrice = Number(product.price);
  const minVariantPrice = hasVariants
    ? effectivePrice + Math.min(...product.variants!.map((v) => Number(v.price)))
    : effectivePrice;
  const minOriginalPrice = hasVariants
    ? originalPrice + Math.min(...product.variants!.map((v) => Number(v.price)))
    : originalPrice;
  const discPct = hasDiscount ? Math.round((1 - effectivePrice / originalPrice) * 100) : 0;
  const imgSrc = fixImageUrl(product.image_url);

  return (
    <button
      onClick={() => onAdd(product)}
      className="text-left w-full bg-white rounded-xl border border-[#E8DFD0] shadow-sm hover:shadow-md transition-shadow flex items-stretch gap-3 p-3"
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="font-bold text-[#1A1613] text-sm md:text-base leading-tight">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-[#6B6259] mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
          )}
        </div>
        <p className="mt-2">
          {hasVariants && <span className="text-xs font-normal text-[#6B6259]">From </span>}
          <span className="font-bold text-[#1E293B] text-base">Rs. {fmt(minVariantPrice)}</span>
          {hasDiscount && (
            <span className="ml-1.5 text-xs text-[#9CA3AF] line-through">Rs. {fmt(minOriginalPrice)}</span>
          )}
        </p>
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
        {hasDiscount && (
          <span className="absolute top-1 right-1 bg-[#FBBF24] text-[#1A1613] text-[9px] font-bold px-1.5 py-0.5 rounded">
            {discPct}% OFF
          </span>
        )}
        <span
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
          className="absolute bottom-1 right-1 w-8 h-8 rounded-full text-white flex items-center justify-center shadow-lg font-bold text-lg active:scale-90 transition-transform"
          style={{ background: site.primaryColor }}
        >
          +
        </span>
      </div>
    </button>
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
  const hasDiscount = product.discounted_price != null && Number(product.discounted_price) < Number(product.price);
  const effectivePrice = hasDiscount ? Number(product.discounted_price) : Number(product.price);
  const minVariantPrice = hasVariants
    ? effectivePrice + Math.min(...product.variants!.map((v) => Number(v.price)))
    : effectivePrice;
  const imgSrc = fixImageUrl(product.image_url);
  const site = useSiteSettings();

  return (
    <button
      onClick={() => onAdd(product)}
      className="group text-left bg-white rounded-3xl overflow-hidden shadow-md border border-[#E8DFD0] hover:shadow-xl hover:-translate-y-1 transition-all duration-200 w-full"
    >
      <div className="relative aspect-square bg-[#F5F1EB] overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {getCategoryEmoji(product.category)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        <span
          className="absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm"
          style={{ background: site.primaryColor }}
        >
          🔥 Popular
        </span>
        {hasDiscount && (
          <span className="absolute top-2 right-2 bg-[#FBBF24] text-[#1A1613] text-[9px] font-bold px-2 py-1 rounded-full shadow-sm">
            SALE
          </span>
        )}
        <span
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full text-white flex items-center justify-center shadow-lg font-bold text-xl active:scale-90 transition-transform hover:scale-110"
          style={{ background: site.primaryColor }}
        >
          +
        </span>
      </div>
      <div className="p-3">
        <h4 className="font-bold text-[#1A1613] text-sm truncate">{product.name}</h4>
        <p className="text-[#1E293B] font-bold text-base mt-1">
          {hasVariants && <span className="text-xs font-normal text-[#6B6259]">From </span>}
          Rs. {fmt(minVariantPrice)}
          {hasDiscount && (
            <span className="ml-1 text-[10px] font-normal text-[#9CA3AF] line-through">Rs. {fmt(Number(product.price))}</span>
          )}
        </p>
      </div>
    </button>
  );
}

function CartSidebar({
  cart, onUpdateQty, onClose, onCheckout,
  subtotal, discountAmt, total, popularItems, onAdd,
  orderType, isOpen, cartCount,
}: any) {
  const site = useSiteSettings();
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const savedAmt = discountAmt;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      <div
        className="fixed top-0 right-0 bottom-0 z-40 w-full md:w-96 bg-white shadow-2xl overflow-y-auto translate-x-0 transition-transform"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div className="text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10" style={{ background: site.primaryColor }}>
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
                        <span
                          className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded mt-0.5 mr-1"
                          style={{ background: site.secondaryColor, color: site.primaryColor }}
                        >
                          {item.variant_name}
                        </span>
                      )}
                      {item.addon_summary && item.addon_summary.length > 0 && (
                        <p className="text-[10px] text-[#6B6259] mt-0.5 truncate">
                          + {item.addon_summary.map((a) => a.name).join(", ")}
                        </p>
                      )}
                      <p className="text-sm font-bold text-[#1E293B] mt-1">
                        Rs. {fmt(item.unit_price * item.quantity)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => onUpdateQty(item.key, -item.quantity)}
                        className="w-7 h-7 rounded-full border border-[#E8DFD0] flex items-center justify-center text-xs"
                        style={{ color: site.primaryColor }}
                      >🗑</button>
                      <div className="flex items-center gap-1 border border-[#E8DFD0] rounded-full px-1 py-0.5">
                        <button
                          onClick={() => onUpdateQty(item.key, -1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold"
                          style={{ color: site.primaryColor }}
                        >−</button>
                        <span className="text-xs font-bold text-[#1A1613] min-w-[16px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQty(item.key, 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold"
                          style={{ color: site.primaryColor }}
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {popularItems.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1 h-4 rounded-full" style={{ background: site.primaryColor }} />
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
                              className="absolute bottom-1 right-1 w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold"
                              style={{ background: site.primaryColor }}
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

              <div className="border rounded-2xl p-4 mt-4" style={{ background: site.secondaryColor, borderColor: site.secondaryColor }}>
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
                <div className="h-px bg-white/60 my-3" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1A1613] text-base">Grand Total</span>
                  <span className="font-bold text-xl" style={{ color: site.primaryColor }}>Rs. {fmt(total)}</span>
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
              className="w-full py-3.5 rounded-full text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
              style={{ background: site.primaryColor }}
            >
              Checkout <span>→</span>
            </button>
            <p className="text-center text-xs text-[#6B6259] mt-3">
              Your order will be ready for{" "}
              <span className="font-semibold text-[#1A1613]">
                {orderType === "pickup" ? "pickup" : "delivery"}
              </span>{" "}
              in <span className="font-semibold" style={{ color: site.primaryColor }}>45 minutes</span>
            </p>
          </div>
        )}
      </div>
    </>
  );
}