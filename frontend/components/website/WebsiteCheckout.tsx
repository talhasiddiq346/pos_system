"use client";
import { useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { useSiteSettings } from "@/lib/useSiteSettings";
import SiteHeader from "./SiteHeader";

type Branch = { id: number; name: string; address: string; phone?: string };
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

type PaymentMethod = "cod" | "online";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

function validatePakistaniPhone(val: string): boolean {
  const cleaned = val.replace(/[\s\-()]/g, "");
  return /^03[0-9]{9}$/.test(cleaned) || /^\+923[0-9]{9}$/.test(cleaned) || /^923[0-9]{9}$/.test(cleaned);
}

export default function WebsiteCheckout({
  branch,
  cart,
  orderType = "delivery",
  onBack,
  onOrderPlaced,
}: {
  branch: Branch;
  cart: CartItem[];
  orderType?: "delivery" | "pickup";
  onBack: () => void;
  onOrderPlaced: (orderCode: string, total: number) => void;
}) {
  const site = useSiteSettings();
  const [title, setTitle] = useState("Mr.");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [voucher, setVoucher] = useState("");
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [discountAmt, setDiscountAmt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const fmt = (n: number) => Math.round(n).toLocaleString();
  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const deliveryFee = orderType === "delivery" ? site.deliveryFee : 0;
  const afterDiscount = Math.max(subtotal - discountAmt, 0);
  const taxAmt = Math.round(afterDiscount * (site.taxRate / 100) * 100) / 100;
  const total = afterDiscount + taxAmt + deliveryFee;

  function handlePhoneChange(val: string, setter: (v: string) => void, errSetter?: (e: string) => void) {
    setter(val);
    if (errSetter) {
      if (val && !validatePakistaniPhone(val)) {
        errSetter("Invalid PK number (03XX-XXXXXXX)");
      } else {
        errSetter("");
      }
    }
  }

  const [applyingVoucher, setApplyingVoucher] = useState(false);

  async function applyVoucher() {
    setVoucherError("");
    if (!voucher.trim()) return;

    setApplyingVoucher(true);
    try {
      const res = await api.post<{ discount_amount: number }>("/settings/vouchers/validate", {
        code: voucher.trim(),
        order_amount: subtotal,
      });
      setDiscountAmt(res.data.discount_amount);
      setVoucherApplied(true);
    } catch (err) {
      setVoucherError(errMsg(err));
    } finally {
      setApplyingVoucher(false);
    }
  }

  function removeVoucher() {
    setVoucher("");
    setVoucherApplied(false);
    setDiscountAmt(0);
    setVoucherError("");
  }

  async function handleSubmit() {
    setError("");

    // Validation
    if (!name.trim()) return setError("Full name is required");
    if (!phone.trim()) return setError("Mobile number is required");
    if (!validatePakistaniPhone(phone)) return setError("Invalid mobile number");
    if (orderType === "delivery" && !address.trim()) return setError("Delivery address is required");

    setSubmitting(true);
    try {
      const payload = {
        branch_id: branch.id,
        source: "online",
        order_type: orderType,
        payment_method: payment,
        customer_name: `${title} ${name}`.trim(),
        customer_phone: phone,
        customer_alt_phone: altPhone || null,
        customer_email: email || null,
        customer_address: orderType === "delivery" ? address : null,
        customer_notes: notes || null,
        voucher_code: voucherApplied ? voucher : null,
        discount_amount: discountAmt,
        items: cart.map((c) => ({
          product_id: c.product_id,
          variant_id: c.variant_id,
          product_name: c.product_name,
          variant_name: c.variant_name,
          unit_price: c.unit_price,
          quantity: c.quantity,
          addon_option_ids: c.addon_option_ids || [],
        })),
      };

      const res = await api.post<{ order_code: string; total: number }>("/public/order", payload);
      onOrderPlaced(res.data.order_code, res.data.total ?? total);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isPickup = orderType === "pickup";

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "'DM Sans','Inter',-apple-system,sans-serif",
        background: site.backgroundColor,
        ["--wp" as string]: site.primaryColor,
        ["--ws" as string]: site.secondaryColor,
      }}
    >
      <SiteHeader
        left={
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#6B6259] hover:text-[#1A1613] transition-all hover:-translate-x-1 group"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">←</span> Back to menu
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-3 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* ═══════════════════════════════════════════════════
            LEFT — 2 cards (Order type info + Form + Payment)
            ═══════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order type info card */}
          <div className="bg-white rounded-2xl border border-[#E8DFD0] p-5 animate-fade-in-up">
            <p className="text-sm text-[#6B6259] flex items-center gap-2 flex-wrap">
              This is a{" "}
              <span className="font-bold text-[#1A1613]">
                {isPickup ? "TAKEAWAY ORDER" : "DELIVERY ORDER"}
              </span>
              <span className="text-lg animate-float inline-block">{isPickup ? "🥡" : "🛵"}</span>
            </p>

            {isPickup && (
              <>
                <p className="text-sm text-[#6B6259] mt-3 mb-1">You have to collect your order from</p>
                <p className="font-bold text-[#1A1613] text-lg">{branch.name}</p>
                <p className="text-sm text-[#6B6259] mt-1">
                  <span className="font-semibold">Location:</span> {branch.address}
                </p>
                {branch.phone && (
                  <p className="text-sm text-[#6B6259] mt-1">
                    <span className="font-semibold">Phone:</span> {branch.phone}
                  </p>
                )}
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(branch.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-sm text-[var(--wp)] font-semibold hover-underline transition-transform hover:scale-105"
                >
                  View Location 📍
                </a>
              </>
            )}

            {!isPickup && (
              <>
                <p className="text-sm text-[#6B6259] mt-3 mb-1">Delivering from</p>
                <p className="font-bold text-[#1A1613] text-lg">{branch.name}</p>
                <p className="text-sm text-[#6B6259] mt-1">{branch.address}</p>
              </>
            )}
          </div>

          {/* Info form card */}
          <div className="bg-white rounded-2xl border border-[#E8DFD0] overflow-hidden animate-fade-in-up stagger-1">
            <div className="bg-[#FFF5F1] px-5 py-4 flex items-center gap-3 border-b border-[#FFD5C7]">
              <div className="w-10 h-10 rounded-full bg-[var(--wp)] flex items-center justify-center shrink-0 animate-pulse-soft">
                <span className="text-lg">📝</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1A1613] flex items-center gap-2 flex-wrap">
                  This is a{" "}
                  <span className="bg-[var(--wp)] text-white text-xs font-bold px-2 py-0.5 rounded">
                    {isPickup ? "Pickup Order" : "Delivery Order"}
                  </span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#6B6259] mt-0.5">
                  Just a last step, please fill your information below
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-3 py-2.5">
                  {error}
                </div>
              )}

              {/* Title + Name */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1A1613] block mb-1.5">Title</label>
                  <select
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-11 border border-[#E8DFD0] rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[var(--wp)] transition-colors focus:shadow-sm"
                  >
                    <option>Mr.</option>
                    <option>Mrs.</option>
                    <option>Ms.</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#1A1613]">Full Name</label>
                    <span className="text-[10px] font-semibold text-[var(--wp)] bg-[var(--ws)] px-2 py-0.5 rounded">
                      *Required
                    </span>
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full h-11 border border-[#E8DFD0] rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[var(--wp)] transition-colors focus:shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* Mobile + Alt mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#1A1613]">Mobile Number</label>
                    <span className="text-[10px] font-semibold text-[var(--wp)] bg-[var(--ws)] px-2 py-0.5 rounded">
                      *Required
                    </span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value, setPhone, setPhoneError)}
                    placeholder="03xx-xxxxxxx"
                    className={`w-full h-11 border rounded-xl px-3 text-sm bg-white focus:outline-none ${
                      phoneError ? "border-[#F0C9C2] focus:border-[#9E3527]" : "border-[#E8DFD0] focus:border-[var(--wp)]"
                    }`}
                    required
                  />
                  {phoneError && <p className="text-xs text-[#9E3527] mt-1">{phoneError}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1A1613] block mb-1.5">
                    Alternate Mobile Number
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                    placeholder="03xx-xxxxxxx"
                    className="w-full h-11 border border-[#E8DFD0] rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[var(--wp)] transition-colors focus:shadow-sm"
                  />
                </div>
              </div>

              {/* Delivery address (only for delivery) */}
              {!isPickup && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#1A1613]">Delivery Address</label>
                    <span className="text-[10px] font-semibold text-[var(--wp)] bg-[var(--ws)] px-2 py-0.5 rounded">
                      *Required
                    </span>
                  </div>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House / Street / Area / Landmark"
                    rows={2}
                    className="w-full border border-[#E8DFD0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--wp)] transition-colors focus:shadow-sm resize-none"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-[#1A1613] block mb-1.5">
                  {isPickup ? "Pickup Notes" : "Delivery Notes"}
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions?"
                  className="w-full h-11 border border-[#E8DFD0] rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[var(--wp)] transition-colors focus:shadow-sm"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-[#1A1613] block mb-1.5">
                  Email Address <span className="font-normal text-[#6B6259]">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Get your order confirmation by email"
                  className="w-full h-11 border border-[#E8DFD0] rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[var(--wp)] transition-colors focus:shadow-sm"
                />
              </div>
            </div>

            {/* Payment Information */}
            <div className="px-5 pb-5 border-t border-[#E8DFD0] pt-5">
              <p className="text-sm font-bold text-[#1A1613] mb-3">Payment Information</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPayment("cod")}
                  className={`relative p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                    payment === "cod"
                      ? "border-[var(--wp)] bg-[#FFF5F1] scale-[1.02]"
                      : "border-[#E8DFD0] hover:border-[var(--ws)]"
                  }`}
                >
                  {payment === "cod" && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--wp)] text-white flex items-center justify-center text-xs animate-pop-in">
                      ✓
                    </span>
                  )}
                  <div className="text-3xl mb-2 transition-transform hover:scale-110">💵</div>
                  <p className="text-sm font-bold text-[#1A1613]">Cash on Delivery</p>
                  <p className="text-xs text-[#6B6259] mt-0.5">Pay when you receive</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPayment("online")}
                  className={`relative p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                    payment === "online"
                      ? "border-[var(--wp)] bg-[#FFF5F1] scale-[1.02]"
                      : "border-[#E8DFD0] hover:border-[var(--ws)]"
                  }`}
                >
                  {payment === "online" && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--wp)] text-white flex items-center justify-center text-xs animate-pop-in">
                      ✓
                    </span>
                  )}
                  <div className="flex gap-1 mb-2 text-3xl transition-transform hover:scale-110">💳</div>
                  <p className="text-sm font-bold text-[#1A1613]">Online Payment</p>
                  <p className="text-xs text-[#6B6259] mt-0.5">Card / Wallet</p>
                </button>
              </div>
              {payment === "online" && (
                <p className="text-xs text-[#6B6259] mt-3 bg-[#FFF8ED] border border-[#F0D99A] rounded-lg px-3 py-2 animate-fade-in-down">
                  💡 Online payment gateway will open after placing order (coming soon)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            RIGHT — Order summary (sticky)
            ═══════════════════════════════════════════════════ */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4 animate-fade-in-up stagger-1">
          {/* Items summary */}
          <div className="bg-white rounded-2xl border border-[#E8DFD0] p-4">
            <p className="text-xs font-semibold text-[#6B6259] uppercase tracking-wider mb-3">
              Your order ({cart.length} item{cart.length > 1 ? "s" : ""})
            </p>
            <div className="space-y-3">
              {cart.map((item, i) => (
                <div key={item.key} className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}>
                  <div className="w-12 h-12 rounded-lg bg-[#F5F1EB] overflow-hidden flex-shrink-0 transition-transform hover:scale-105">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1A1613] truncate">
                      <span className="text-[var(--wp)]">{item.quantity}x</span> {item.product_name}
                    </p>
                    {item.variant_name && (
                      <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--ws)] text-[var(--wp)] mt-0.5 mr-1">
                        {item.variant_name}
                      </span>
                    )}
                    {item.addon_summary && item.addon_summary.length > 0 && (
                      <p className="text-[10px] text-[#6B6259] mt-0.5 truncate">
                        + {item.addon_summary.map((a) => a.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#1E293B]">
                    Rs. {fmt(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-[#FFF5F1] border border-[#FFD5C7] rounded-2xl p-4">
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
            {deliveryFee > 0 && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-[#1A1613]">
                  <span>🛵</span> Delivery Fee
                </div>
                <span className="font-bold text-[#1A1613]">Rs. {fmt(deliveryFee)}</span>
              </div>
            )}
            {taxAmt > 0 && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-[#1A1613]">
                  <span>🧾</span> Tax
                </div>
                <span className="font-bold text-[#1A1613]">Rs. {fmt(taxAmt)}</span>
              </div>
            )}
            <div className="h-px bg-[#FFD5C7] my-3" />
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1A1613] text-base">Grand Total</span>
              <span className="font-bold text-[var(--wp)] text-xl">Rs. {fmt(total)}</span>
            </div>
          </div>

          {discountAmt > 0 && (
            <div className="bg-[#E6F2EF] border border-[#C7E2DA] rounded-2xl px-4 py-2.5 flex items-center gap-2 animate-fade-in-down">
              <span className="w-6 h-6 rounded-full bg-[#16A34A] text-white flex items-center justify-center text-xs animate-pop-in">%</span>
              <span className="text-sm text-[#16A34A] font-semibold">
                Yay! You saved Rs. {fmt(discountAmt)}
              </span>
            </div>
          )}

          {/* Voucher */}
          <div className="bg-white rounded-2xl border border-[#E8DFD0] p-4">
            {!voucherApplied ? (
              <>
                <div className="flex gap-2">
                  <input
                    value={voucher}
                    onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                    placeholder="Enter Voucher / Promo code"
                    className="flex-1 h-11 border border-[#E8DFD0] rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[var(--wp)] transition-colors focus:shadow-sm"
                  />
                  <button
                    onClick={applyVoucher}
                    disabled={!voucher.trim() || applyingVoucher}
                    className="px-5 h-11 rounded-xl bg-[var(--wp)] text-white text-sm font-semibold hover:bg-[var(--wp)] disabled:opacity-50 transition-transform hover:scale-105 active:scale-95"
                  >
                    {applyingVoucher ? <span className="animate-pulse-soft">Checking...</span> : "Apply"}
                  </button>
                </div>
                {voucherError && <p className="text-xs text-[#9E3527] mt-2 animate-fade-in-down">⚠ {voucherError}</p>}
              </>
            ) : (
              <div className="flex items-center justify-between animate-scale-in">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#16A34A] text-white flex items-center justify-center text-xs animate-pop-in">✓</span>
                  <span className="text-sm font-bold text-[#16A34A]">{voucher} applied</span>
                </div>
                <button onClick={removeVoucher} className="text-xs text-[#9E3527] font-semibold hover:underline transition-transform hover:scale-105">
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Place Order button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !name || !phone || !!phoneError || (!isPickup && !address)}
            className="w-full py-4 rounded-full bg-gradient-to-r from-[var(--wp)] via-[var(--ws)] to-[var(--wp)] animate-gradient text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span className={submitting ? "animate-shake-loop" : "animate-bounce-loop inline-block"}>🛒</span>
            {submitting ? <span className="animate-pulse-soft">Placing order...</span> : "Place Order"}
          </button>

          {/* Continue link */}
          <button
            onClick={onBack}
            className="w-full text-center text-sm font-semibold text-[var(--wp)] hover-underline flex items-center justify-center gap-1.5 transition-transform hover:-translate-x-0.5"
          >
            ← continue to add more items
          </button>
        </div>
      </div>
    </div>
  );
}