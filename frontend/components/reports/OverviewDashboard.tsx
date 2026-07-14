"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/components/shared/useSocket";
import type { Role } from "@/lib/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type DashboardData = {
  stats: {
    revenue: number;
    orders: number;
    avg_order: number;
    cancelled: number;
    secondary: { label: string; value: number };
  };
  trend: { day: string; orders: number; revenue: number }[];
  top_items: { name: string; orders: number; revenue: number }[];
  recent_orders: {
    id: number;
    order_code: string;
    total: number;
    status: string;
    source: string;
    customer_name: string;
    created_at: string;
    branch_name: string;
  }[];
  unread_alerts: number;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FEF3C7", text: "#B45309", label: "Pending" },
  preparing: { bg: "#FEF3C7", text: "#B45309", label: "Preparing" },
  ready: { bg: "#DBEAFE", text: "#1E40AF", label: "Ready" },
  dispatched: { bg: "#DBEAFE", text: "#1E40AF", label: "Dispatched" },
  delivered: { bg: "#DCFCE7", text: "#16A34A", label: "Delivered" },
  completed: { bg: "#DCFCE7", text: "#16A34A", label: "Completed" },
  cancelled: { bg: "#FEE2E2", text: "#DC2626", label: "Cancelled" },
};

const SOURCE_ICONS: Record<string, string> = {
  pos: "💵",
  call_center: "📞",
  online: "🛵",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OverviewDashboard({
  viewerRole,
  viewerBranchId,
  viewerName,
  onGoToSection,
}: {
  viewerRole: Role;
  viewerBranchId: number | null;
  viewerName?: string;
  onGoToSection?: (section: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useSocket(viewerBranchId ?? 0, viewerRole, {
    new_order: () => setRefreshKey((k) => k + 1),
    order_ready: () => setRefreshKey((k) => k + 1),
  });

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardData>("/reports/dashboard-overview")
      .then((r) => setData(r.data))
      .catch((err) => console.error("Overview load error:", err))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 17
      ? "Good afternoon"
      : "Good evening";

  return (
    <div className="space-y-6" style={{ fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      {/* Greeting header */}
      <div className="bg-gradient-to-br from-[#1A1613] to-[#2A231D] rounded-2xl p-6 text-white">
        <p className="text-sm text-[#F0A93B] font-semibold mb-1">
          {greeting}{viewerName ? `, ${viewerName}` : ""} 👋
        </p>
        <h1 className="text-2xl font-bold mb-1">Business overview</h1>
        <p className="text-sm text-[#A89F94]">
          Last 7 days · {viewerRole === "super_admin" ? "All branches" : "Your branch"}
        </p>
        {data && data.unread_alerts > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-[#E8542F]/20 border border-[#E8542F]/40 rounded-lg px-3 py-2">
            <span className="text-lg">🔔</span>
            <span className="text-sm font-semibold">
              {data.unread_alerts} unread alert{data.unread_alerts > 1 ? "s" : ""} — check Reports section
            </span>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Revenue (7d)",
            value: data ? `Rs ${Math.round(data.stats.revenue).toLocaleString()}` : "—",
            icon: "💰",
            color: "#E8542F",
          },
          {
            label: "Orders (7d)",
            value: data ? String(data.stats.orders) : "—",
            icon: "🛍️",
            color: "#F0A93B",
          },
          {
            label: "Avg Order",
            value: data ? `Rs ${Math.round(data.stats.avg_order).toLocaleString()}` : "—",
            icon: "📈",
            color: "#16A34A",
          },
          {
            label: data?.stats.secondary.label ?? "—",
            value: data ? String(data.stats.secondary.value) : "—",
            icon: viewerRole === "super_admin" ? "🏪" : "👥",
            color: "#2563EB",
          },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3"
              style={{ background: c.color + "15" }}
            >
              {c.icon}
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
          </div>
        ))}
      </div>

      {/* Revenue trend + Top items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend chart */}
        <div className="lg:col-span-2 bg-white border border-[#EDE8E1] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A1613]">📈 Revenue trend</h2>
            <span className="text-xs text-[#A89F94]">Last 7 days</span>
          </div>
          {loading ? (
            <div className="h-64 bg-[#F5F1EB] rounded-xl animate-pulse" />
          ) : !data || data.trend.length === 0 ? (
            <p className="text-sm text-[#A89F94] py-16 text-center">No data yet</p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E8542F" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E8542F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en", { weekday: "short" })}
                    stroke="#A89F94"
                    fontSize={11}
                  />
                  <YAxis stroke="#A89F94" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#1A1613",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                    }}
                    formatter={(v: any) => `Rs ${Math.round(v).toLocaleString()}`}
                    labelFormatter={(d) => new Date(d).toLocaleDateString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#E8542F"
                    strokeWidth={2}
                    fill="url(#rev-grad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top items */}
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A1613]">🔥 Top items</h2>
            <span className="text-xs text-[#A89F94]">Last 7 days</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-[#F5F1EB] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !data || data.top_items.length === 0 ? (
            <p className="text-sm text-[#A89F94] py-8 text-center">No items sold yet</p>
          ) : (
            <div className="space-y-2">
              {data.top_items.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3 py-2">
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                      i === 0 ? "bg-[#F0A93B]" : i === 1 ? "bg-[#A89F94]" : i === 2 ? "bg-[#D8B597]" : "bg-[#EDE8E1] text-[#A89F94]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1A1613] truncate">{item.name}</p>
                    <p className="text-xs text-[#A89F94]">
                      {item.orders} sold · Rs {Math.round(item.revenue).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-[#EDE8E1] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE8E1]">
          <div>
            <h2 className="text-lg font-bold text-[#1A1613]">🛒 Recent orders</h2>
            <p className="text-xs text-[#A89F94] mt-0.5">Latest 10 orders across all sources</p>
          </div>
          {onGoToSection && (
            <button
              onClick={() => onGoToSection("receipts")}
              className="text-xs font-semibold text-[#E8542F] hover:underline"
            >
              View all →
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-[#F5F1EB] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data || data.recent_orders.length === 0 ? (
          <p className="text-sm text-[#A89F94] py-12 text-center">No orders yet</p>
        ) : (
          <div className="divide-y divide-[#EDE8E1]">
            {data.recent_orders.map((o) => {
              const status = STATUS_STYLES[o.status] ?? {
                bg: "#F5F1EB",
                text: "#6B6259",
                label: o.status,
              };
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAF8F5] transition"
                >
                  <span className="text-xl flex-shrink-0">{SOURCE_ICONS[o.source] ?? "🛒"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-[#1A1613]">
                        #{o.order_code}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: status.bg, color: status.text }}
                      >
                        {status.label}
                      </span>
                      {viewerRole === "super_admin" && o.branch_name && (
                        <span className="text-xs text-[#A89F94]">· {o.branch_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#A89F94] mt-0.5 truncate">
                      {o.customer_name || "Walk-in"} · {timeAgo(o.created_at)}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#1A1613] flex-shrink-0">
                    Rs {Math.round(Number(o.total)).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      {onGoToSection && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Full reports", icon: "📊", section: "reports", color: "#E8542F" },
            { label: "Products", icon: "🍔", section: "products", color: "#F0A93B" },
            { label: "Staff", icon: "👥", section: "staff", color: "#2563EB" },
            { label: "Cash report", icon: "💵", section: "cash-report", color: "#16A34A" },
          ].map((a) => (
            <button
              key={a.section}
              onClick={() => onGoToSection(a.section)}
              className="bg-white border border-[#EDE8E1] rounded-2xl p-4 hover:border-[#E8542F] transition text-left"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-2"
                style={{ background: a.color + "15" }}
              >
                {a.icon}
              </div>
              <p className="text-sm font-semibold text-[#1A1613]">{a.label}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}