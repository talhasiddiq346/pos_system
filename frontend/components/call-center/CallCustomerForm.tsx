"use client";
import { useState } from "react";

export type OrderType = "takeaway" | "delivery";

function validatePakistaniPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  const patterns = [
    /^03[0-9]{9}$/,
    /^\+923[0-9]{9}$/,
    /^923[0-9]{9}$/,
  ];
  if (patterns.some((p) => p.test(cleaned))) return null;
  return "Valid Pakistani number chahiye (e.g. 0300-1234567)";
}

export default function CallCustomerForm({
  customerName,
  customerPhone,
  customerAddress,
  paymentMethod,
  orderType,
  onNameChange,
  onPhoneChange,
  onAddressChange,
  onPaymentChange,
  onOrderTypeChange,
}: {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: "cash" | "card";
  orderType: OrderType;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onPaymentChange: (v: "cash" | "card") => void;
  onOrderTypeChange: (v: OrderType) => void;
}) {
  const isDelivery = orderType === "delivery";
  const [phoneError, setPhoneError] = useState("");
  const [nameError, setNameError] = useState("");

  // Address fields — combine karke onAddressChange bhejte hain
  const [flatNo, setFlatNo] = useState("");
  const [building, setBuilding] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("Karachi");

  function buildAddress(f: string, b: string, a: string, c: string) {
    return [f, b, a, c].filter(Boolean).join(", ");
  }

  function handleFlat(v: string) {
    setFlatNo(v);
    onAddressChange(buildAddress(v, building, area, city));
  }
  function handleBuilding(v: string) {
    setBuilding(v);
    onAddressChange(buildAddress(flatNo, v, area, city));
  }
  function handleArea(v: string) {
    setArea(v);
    onAddressChange(buildAddress(flatNo, building, v, city));
  }
  function handleCity(v: string) {
    setCity(v);
    onAddressChange(buildAddress(flatNo, building, area, v));
  }

  function handlePhoneChange(val: string) {
    onPhoneChange(val);
    if (val && isDelivery) setPhoneError(validatePakistaniPhone(val) || "");
    else setPhoneError("");
  }

  function handleNameChange(val: string) {
    onNameChange(val);
    if (val.length > 0 && val.length < 3) setNameError("Kam az kam 3 letters chahiye");
    else setNameError("");
  }

  return (
    <div className="bg-white border border-[#E3E5E0] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDEFEA]">
        <h2 className="font-semibold text-[#14171A]">Customer details</h2>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Order type toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F0F1ED]">
          <button type="button" onClick={() => onOrderTypeChange("takeaway")}
            className={`py-2 rounded-lg text-sm font-medium transition-all ${
              !isDelivery ? "bg-white text-[#14171A] shadow-sm" : "text-[#6B7068]"
            }`}>
            🥡 Takeaway
          </button>
          <button type="button" onClick={() => onOrderTypeChange("delivery")}
            className={`py-2 rounded-lg text-sm font-medium transition-all ${
              isDelivery ? "bg-white text-[#14171A] shadow-sm" : "text-[#6B7068]"
            }`}>
            🛵 Delivery
          </button>
        </div>

        {/* Name + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#494D46] uppercase tracking-wider">
              Name <span className="text-[#9E3527]">*</span>
            </label>
            <input
              placeholder="Ali Hassan"
              value={customerName}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F7D6B] transition-all ${
                nameError ? "border-[#F0C9C2]" : "border-[#E3E5E0]"
              }`}
            />
            {nameError && <p className="text-xs text-[#9E3527]">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#494D46] uppercase tracking-wider">
              Phone {isDelivery && <span className="text-[#9E3527]">*</span>}
            </label>
            <div className={`flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#2F7D6B] transition-all ${
              phoneError ? "border-[#F0C9C2]" : "border-[#E3E5E0]"
            }`}>
              <span className="px-3 text-sm py-2.5 bg-[#F7F8F6] border-r border-[#E3E5E0]">🇵🇰</span>
              <input
                placeholder="0300-1234567"
                value={customerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                type="tel"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
            {phoneError && <p className="text-xs text-[#9E3527]">{phoneError}</p>}
            {!phoneError && customerPhone && (
              <p className="text-xs text-[#1F6F54]">✓ Valid number</p>
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#494D46] uppercase tracking-wider">Payment</label>
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "card"] as const).map((method) => (
              <button key={method} type="button" onClick={() => onPaymentChange(method)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  paymentMethod === method
                    ? method === "cash"
                      ? "bg-[#FEF9E7] border-[#F0D99A] text-[#92610A]"
                      : "bg-[#E0E7FF] border-[#A5B4FC] text-[#3730A3]"
                    : "border-[#E3E5E0] text-[#6B7068] hover:bg-[#F5F6F4]"
                }`}>
                {method === "cash" ? "💵 Cash on delivery" : "💳 Card"}
              </button>
            ))}
          </div>
        </div>

        {/* Address — structured fields, sirf delivery pe */}
        {isDelivery && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-[#494D46] uppercase tracking-wider block">
              Delivery address <span className="text-[#9E3527]">*</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-[#9B9F98]">Flat / House #</label>
                <input
                  placeholder="A-12 / Flat 3"
                  value={flatNo}
                  onChange={(e) => handleFlat(e.target.value)}
                  className="w-full border border-[#E3E5E0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F7D6B]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#9B9F98]">Building / Street</label>
                <input
                  placeholder="Rose Tower / St. 5"
                  value={building}
                  onChange={(e) => handleBuilding(e.target.value)}
                  className="w-full border border-[#E3E5E0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F7D6B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-[#9B9F98]">Area / Locality <span className="text-[#9E3527]">*</span></label>
                <input
                  placeholder="DHA Phase 5, Gulshan..."
                  value={area}
                  onChange={(e) => handleArea(e.target.value)}
                  className="w-full border border-[#E3E5E0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F7D6B]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#9B9F98]">City</label>
                <select
                  value={city}
                  onChange={(e) => handleCity(e.target.value)}
                  className="w-full border border-[#E3E5E0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F7D6B] bg-white"
                >
                  <option>Karachi</option>
                  <option>Lahore</option>
                  <option>Islamabad</option>
                  <option>Rawalpindi</option>
                  <option>Faisalabad</option>
                  <option>Multan</option>
                  <option>Hyderabad</option>
                  <option>Quetta</option>
                  <option>Peshawar</option>
                  <option>Sialkot</option>
                  <option>Gujranwala</option>
                  <option>Abbottabad</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            {customerAddress && (
              <div className="bg-[#F7F8F6] rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                <span className="text-sm mt-0.5">📍</span>
                <p className="text-xs text-[#494D46] leading-relaxed">{customerAddress}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}