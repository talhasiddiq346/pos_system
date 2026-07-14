"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Role } from "@/lib/types";

const TABS = [
  { id: "cashier", label: "Cashiers", icon: "💵" },
  { id: "chef", label: "Chefs", icon: "👨‍🍳" },
  { id: "delivery", label: "Riders", icon: "🛵" },
  { id: "call_center", label: "Call Center", icon: "📞" },
];

export default function StaffPerformance({
  filters,
  refreshKey,
  viewerRole,
}: {
  filters: any;
  refreshKey: number;
  viewerRole: Role;
}) {
  const [activeTab, setActiveTab] = useState("cashier");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get<any[]>("/reports/staff-performance", { params: { ...filters, role: activeTab } })
      .then((r) => setData(r.data))
      .catch((err) => {
        console.error("Staff performance error:", err);
        setError("Could not load staff data");
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, activeTab, refreshKey]);

  const showBranch =
    viewerRole === "super_admin" &&
    (filters.branch_id === "all" || filters.branch_id === null);

  function displayName(s: any) {
    if (showBranch && s.branch_name) return `${s.name} (${s.branch_name})`;
    return s.name;
  }

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDE8E1]">
        <h2 className="text-lg font-bold text-[#1A1613]">👥 Staff Performance</h2>
        <p className="text-xs text-[#A89F94] mt-0.5">Leaderboards across roles</p>
      </div>

      <div className="flex gap-1 px-5 pt-4 border-b border-[#EDE8E1] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`text-sm font-semibold px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
              activeTab === t.id
                ? "border-[#E8542F] text-[#E8542F]"
                : "border-transparent text-[#A89F94] hover:text-[#6B6259]"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {error ? (
          <p className="text-sm text-[#DC2626] py-8 text-center">{error}</p>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#F5F1EB] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-[#A89F94] py-8 text-center">
            No {activeTab.replace("_", " ")} data for this period
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-3 bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl p-3"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                    i === 0
                      ? "bg-[#F0A93B]"
                      : i === 1
                      ? "bg-[#A89F94]"
                      : i === 2
                      ? "bg-[#D8B597]"
                      : "bg-[#EDE8E1] text-[#A89F94]"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1613] truncate">{displayName(s)}</p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {activeTab === "delivery" ? (
                      <>
                        <span className="text-xs text-[#6B6259]">
                          🛵 <span className="font-mono font-semibold">{s.deliveries}</span> deliveries
                        </span>
                        <span className="text-xs text-[#6B6259]">
                          ⏱ <span className="font-mono">{Math.round(s.avg_delivery_min || 0)} min</span> avg
                        </span>
                        <span className="text-xs text-[#6B6259]">
                          💵 <span className="font-mono">Rs {Math.round(s.cash_collected || 0).toLocaleString()}</span>
                        </span>
                        {Number(s.rider_debt) > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] font-semibold">
                            Debt: Rs {Math.round(s.rider_debt).toLocaleString()}
                          </span>
                        )}
                      </>
                    ) : activeTab === "chef" ? (
                      // ✅ FIXED — no avg_prep_min; show orders + prepared count
                      <>
                        <span className="text-xs text-[#6B6259]">
                          🍳 <span className="font-mono font-semibold">{s.prepared || 0}</span> prepared
                        </span>
                        <span className="text-xs text-[#6B6259]">
                          🛍️ <span className="font-mono">{s.orders || 0}</span> total orders
                        </span>
                        <span className="text-xs text-[#6B6259]">
                          💰 <span className="font-mono">Rs {Math.round(s.revenue || 0).toLocaleString()}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-[#6B6259]">
                          🛍️ <span className="font-mono font-semibold">{s.orders}</span> orders
                        </span>
                        <span className="text-xs text-[#6B6259]">
                          💰 <span className="font-mono font-semibold">Rs {Math.round(s.revenue || 0).toLocaleString()}</span>
                        </span>
                        <span className="text-xs text-[#6B6259]">
                          📈 <span className="font-mono">Rs {Math.round(s.avg_order || 0).toLocaleString()}</span> avg
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {i === 0 && (
                  <span className="text-xs bg-[#F0A93B] text-white px-2 py-0.5 rounded-full font-semibold">
                    TOP
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}