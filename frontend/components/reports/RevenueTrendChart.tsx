"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

export default function RevenueTrendChart({ filters, refreshKey }: { filters: any; refreshKey: number }) {
  const [data, setData] = useState<any[]>([]);
  const [groupBy, setGroupBy] = useState("day");
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/reports/revenue-trend", { params: filters })
      .then((r) => {
        setData(r.data.data.map((d: any) => ({
          ...d,
          label: groupBy === "hour"
            ? new Date(d.period).toLocaleTimeString("en", { hour: "numeric", hour12: true })
            : new Date(d.period).toLocaleDateString("en", { month: "short", day: "numeric" }),
        })));
        setGroupBy(r.data.groupBy);
      })
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, filters.source, refreshKey, groupBy]);

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#1A1613]">Revenue Trend</h2>
          <p className="text-xs text-[#A89F94] mt-0.5">
            {groupBy === "hour" ? "Hourly breakdown" : "Daily breakdown"}
          </p>
        </div>
        <div className="flex gap-1 bg-[#F5F1EB] p-1 rounded-lg">
          <button onClick={() => setMetric("revenue")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
              metric === "revenue" ? "bg-white text-[#1A1613] shadow-sm" : "text-[#A89F94]"
            }`}>Revenue</button>
          <button onClick={() => setMetric("orders")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
              metric === "orders" ? "bg-white text-[#1A1613] shadow-sm" : "text-[#A89F94]"
            }`}>Orders</button>
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] bg-[#F5F1EB] rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center flex-col gap-2">
          <p className="text-4xl">📊</p>
          <p className="text-sm text-[#A89F94]">No data for this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8542F" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E8542F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE4" vertical={false} />
            <XAxis dataKey="label" stroke="#A89F94" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#A89F94" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v) => metric === "revenue" ? `Rs ${v >= 1000 ? (v/1000).toFixed(0) + "k" : v}` : v} />
            <Tooltip
              contentStyle={{ background: "#1A1613", border: "none", borderRadius: "12px", color: "#fff" }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#A89F94", marginBottom: "4px" }}
              formatter={(v: any) => metric === "revenue" ? `Rs ${Number(v).toLocaleString()}` : `${v} orders`}
            />
            <Area type="monotone" dataKey={metric} stroke="#E8542F" strokeWidth={3} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}