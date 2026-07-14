"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Row = { method: string; orders: number; revenue: number };

export default function PaymentChart({ filters, refreshKey }: { filters: any; refreshKey: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Row[]>("/reports/payment-methods", { params: filters })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, filters.source, refreshKey]);

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const chartData = data.map((d) => ({
    name: d.method === "cash" ? "Cash" : d.method === "card" ? "Card" : d.method,
    value: d.revenue,
    orders: d.orders,
  }));

  const COLORS: Record<string, string> = { Cash: "#F0A93B", Card: "#2563EB" };

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#1A1613]">Payment Methods</h2>
        <p className="text-xs text-[#A89F94] mt-0.5">Cash vs Card breakdown</p>
      </div>

      {loading ? (
        <div className="h-[220px] bg-[#F5F1EB] rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-[#A89F94]">No data</div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-4">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie data={chartData} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={COLORS[d.name] || "#A89F94"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1A1613", border: "none", borderRadius: "12px", color: "#fff" }}
                formatter={(v: any) => `Rs ${Number(v).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 w-full space-y-3">
            {data.map((d) => {
              const pct = total > 0 ? Math.round((d.revenue / total) * 100) : 0;
              const label = d.method === "cash" ? "💵 Cash" : "💳 Card";
              return (
                <div key={d.method} className="bg-[#FAF8F5] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#1A1613]">{label}</span>
                    <span className="text-lg font-bold text-[#1A1613]">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#A89F94]">
                    <span>{d.orders} orders</span>
                    <span className="font-mono">Rs {Math.round(d.revenue).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}