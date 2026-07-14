"use client";
import { useState } from "react";
import type { Role } from "@/lib/types";

export type DateRange = { label: string; from: Date; to: Date };
type Branch = { id: number; name: string };

const RANGES: DateRange[] = [
  { label: "Today", from: startOfDay(0), to: endOfDay(0) },
  { label: "Yesterday", from: startOfDay(1), to: endOfDay(1) },
  { label: "Last 7 days", from: startOfDay(6), to: endOfDay(0) },
  { label: "Last 30 days", from: startOfDay(29), to: endOfDay(0) },
  { label: "This month", from: firstOfMonth(0), to: endOfDay(0) },
  { label: "Last month", from: firstOfMonth(1), to: lastOfMonth(1) },
];

function startOfDay(daysAgo: number) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(0, 0, 0, 0); return d;
}
function endOfDay(daysAgo: number) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(23, 59, 59, 999); return d;
}
function firstOfMonth(monthsAgo: number) {
  const d = new Date(); d.setMonth(d.getMonth() - monthsAgo, 1); d.setHours(0, 0, 0, 0); return d;
}
function lastOfMonth(monthsAgo: number) {
  const d = new Date(); d.setMonth(d.getMonth() - monthsAgo + 1, 0); d.setHours(23, 59, 59, 999); return d;
}

export default function ReportsFilters({
  viewerRole, branches, dateRange, setDateRange, branchFilter, setBranchFilter, sourceFilter, setSourceFilter,
}: {
  viewerRole: Role;
  branches: Branch[];
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
  branchFilter: number | "all";
  setBranchFilter: (v: number | "all") => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const from = new Date(customFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(customTo); to.setHours(23, 59, 59, 999);
    setDateRange({ label: "Custom", from, to });
    setShowCustom(false);
  }

  return (
    <div className="bg-white border-b border-[#EDE8E1] px-6 py-3 sticky top-[73px] z-20">
      <div className="flex flex-wrap items-center gap-2 max-w-[1400px] mx-auto">
        {/* Date range */}
        <select
          value={dateRange.label}
          onChange={(e) => {
            if (e.target.value === "Custom") setShowCustom(true);
            else {
              const r = RANGES.find((x) => x.label === e.target.value);
              if (r) setDateRange(r);
            }
          }}
          className="border border-[#EDE8E1] rounded-lg px-3 py-2 text-sm font-medium text-[#1A1613] bg-white cursor-pointer"
        >
          {RANGES.map((r) => (
            <option key={r.label} value={r.label}>{r.label}</option>
          ))}
          <option value="Custom">Custom range...</option>
        </select>

        {showCustom && (
          <div className="flex items-center gap-2 bg-[#F5F1EB] rounded-lg px-3 py-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="text-sm bg-transparent outline-none text-[#1A1613]" />
            <span className="text-[#A89F94]">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="text-sm bg-transparent outline-none text-[#1A1613]" />
            <button onClick={applyCustom}
              className="bg-[#E8542F] text-white text-xs font-semibold px-3 py-1 rounded-md">Apply</button>
          </div>
        )}

        {/* Branch filter — super admin only */}
        {viewerRole === "super_admin" && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="border border-[#EDE8E1] rounded-lg px-3 py-2 text-sm font-medium text-[#1A1613] bg-white cursor-pointer"
          >
            <option value="all">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-[#EDE8E1] rounded-lg px-3 py-2 text-sm font-medium text-[#1A1613] bg-white cursor-pointer"
        >
          <option value="all">All sources</option>
          <option value="pos">💵 POS/Cashier</option>
          <option value="call_center">📞 Call Center</option>
          <option value="online">🛵 Website</option>
        </select>

        <div className="flex-1" />

        <div className="text-xs text-[#A89F94] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
          Live updates on
        </div>
      </div>
    </div>
  );
}