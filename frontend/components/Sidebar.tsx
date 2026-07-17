"use client";
import type { Role } from "@/lib/types";

export type SectionKey =
  | "overview"
  | "branches"
  | "staff"
  | "call-center"
  | "delivery"
  | "products"
  | "pos"
  | "dine-in"
  | "receipts"
  | "orders"
  | "kitchen"
  | "passwords"
  | "rider-home"
  | "rider-waiting"
  | "rider-history"
  | "cash-submissions"
  | "cash-report"
  | "reports"
  | "website";

type SectionDef = { key: SectionKey; label: string };

export const SECTIONS_BY_ROLE: Record<Role, SectionDef[]> = {
  super_admin: [
    { key: "overview", label: "Overview" },
    { key: "branches", label: "Branches" },
    { key: "staff", label: "Staff" },
    { key: "call-center", label: "Call center" },
    { key: "products", label: "Products" },
    { key: "pos", label: "POS" },
    { key: "dine-in", label: "Dine In" },
    { key: "receipts", label: "Receipts" },
    { key: "cash-report", label: "Cash report" },
    { key: "reports", label: "Reports" },
    { key: "website", label: "Website" },
    { key: "passwords", label: "Passwords" },
  ],
  branch_admin: [
    { key: "overview", label: "Overview" },
    { key: "staff", label: "Staff" },
    { key: "products", label: "Products" },
    { key: "pos", label: "POS" },
    { key: "dine-in", label: "Dine In" },
    { key: "receipts", label: "Receipts" },
    { key: "cash-report", label: "Cash report" },
    { key: "reports", label: "Reports" },
    { key: "passwords", label: "Passwords" },
  ],
  cashier: [
    { key: "pos", label: "POS" },
    { key: "dine-in", label: "Dine In" },
    { key: "receipts", label: "Receipts" },
    { key: "cash-submissions", label: "Cash submissions" },
    { key: "overview", label: "Overview" },
  ],
  call_center: [
    { key: "orders", label: "Take order" },
  ],
  chef: [
    { key: "kitchen", label: "Kitchen" },
    { key: "receipts", label: "Order history" },
  ],
  delivery: [
    { key: "rider-home", label: "My Orders" },
    { key: "rider-waiting", label: "Waiting" },
    { key: "rider-history", label: "Today" },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  branch_admin: "Branch Admin",
  cashier: "Cashier",
  call_center: "Call Center",
  delivery: "Delivery",
  chef: "Chef",
};

export default function Sidebar({
  role,
  active,
  onSelect,
}: {
  role: Role;
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
}) {
  const sections = SECTIONS_BY_ROLE[role] ?? [{ key: "overview" as SectionKey, label: "Overview" }];

  return (
    <aside className="w-60 shrink-0 bg-[#14171A] text-[#D8D7D1] min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <p className="mono-num text-sm tracking-widest text-[#8FBFAE]">
          POS · {ROLE_LABEL[role] ?? role}
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              active === s.key
                ? "bg-[#2F7D6B] text-white"
                : "text-[#C7CAC3] hover:bg-white/10 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-dashed border-white/10">
        <p className="px-3 text-[11px] mono-num text-[#6B6F68]">v0.2 · phase 2</p>
      </div>
    </aside>
  );
}