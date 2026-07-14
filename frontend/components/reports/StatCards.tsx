"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Role } from "@/lib/types";

type Overview = {
  revenue: { value: number; growth: number };
  orders: { value: number; growth: number };
  avg_order: { value: number; growth: number };
  branches: number;
  active_staff: number;
};

export default function StatCards({
  filters,
  refreshKey,
  viewerRole,
}: {
  filters: any;
  refreshKey: number;
  viewerRole: Role;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Overview>("/reports/overview", { params: filters })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, filters.source, refreshKey]);

  // Role-based 4th card
  const fourthCard =
    viewerRole === "super_admin"
      ? {
          label: "Active Branches",
          value: data ? `${data.branches}` : "—",
          icon: "🏪",
          color: "#2563EB",
        }
      : {
          label: "Active Staff",
          value: data ? `${data.active_staff ?? 0}` : "—",
          icon: "👥",
          color: "#2563EB",
        };

  const cards = [
    {
      label: "Total Revenue",
      value: data ? `Rs ${Math.round(data.revenue.value).toLocaleString()}` : "—",
      growth: data?.revenue.growth,
      icon: "💰",
      color: "#E8542F",
    },
    {
      label: "Total Orders",
      value: data ? data.orders.value.toString() : "—",
      growth: data?.orders.growth,
      icon: "🛍️",
      color: "#F0A93B",
    },
    {
      label: "Avg Order Value",
      value: data ? `Rs ${Math.round(data.avg_order.value).toLocaleString()}` : "—",
      growth: data?.avg_order.growth,
      icon: "📈",
      color: "#16A34A",
    },
    { ...fourthCard, growth: null },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: c.color + "15" }}
            >
              {c.icon}
            </div>
            {c.growth !== null && c.growth !== undefined && (
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${
                  c.growth > 0
                    ? "bg-[#DCFCE7] text-[#16A34A]"
                    : c.growth < 0
                    ? "bg-[#FEE2E2] text-[#DC2626]"
                    : "bg-[#F5F1EB] text-[#6B6259]"
                }`}
              >
                {c.growth > 0 ? "↑" : c.growth < 0 ? "↓" : "→"} {Math.abs(c.growth)}%
              </span>
            )}
          </div>
          <p className="text-xs text-[#A89F94] font-medium uppercase tracking-wider mb-1">
            {c.label}
          </p>
          <p className="text-2xl font-bold text-[#1A1613] tracking-tight">
            {loading ? (
              <span className="inline-block w-24 h-7 bg-[#EDE8E1] rounded animate-pulse" />
            ) : (
              c.value
            )}
          </p>
          {c.growth !== null && c.growth !== undefined && (
            <p className="text-xs text-[#A89F94] mt-1">vs previous period</p>
          )}
        </div>
      ))}
    </div>
  );
}