"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Row = { category: string; orders: number; revenue: number };

const COLORS = ["#E8542F", "#F0A93B", "#16A34A", "#2563EB", "#8B5CF6", "#EC4899", "#A89F94"];

export default function CategoryChart({ filters, refreshKey }: { filters: any; refreshKey: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Row[]>("/reports/by-category", { params: filters })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, refreshKey]);

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const chartData = data.map((d) => ({ name: d.category, value: d.revenue, orders: d.orders }));

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#1A1613]">Category Performance</h2>
        <p className="text-xs text-[#A89F94] mt-0.5">Revenue split by category</p>
      </div>

      {loading ? (
        <div className="h-[220px] bg-[#F5F1EB] rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-[#A89F94]">No data</div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-shrink-0">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={chartData} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1A1613", border: "none", borderRadius: "12px", color: "#fff" }}
                  formatter={(v: any) => `Rs ${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs text-[#A89F94]">Total</p>
              <p className="text-lg font-bold text-[#1A1613]">Rs {Math.round(total/1000)}k</p>
            </div>
          </div>
          <div className="flex-1 w-full space-y-2">
            {data.slice(0, 7).map((d, i) => {
              const pct = total > 0 ? Math.round((d.revenue / total) * 100) : 0;
              return (
                <div key={d.category} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium text-[#1A1613] flex-1 truncate">{d.category}</span>
                  <span className="text-sm font-mono text-[#6B6259]">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}