"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Row = { source: string; orders: number; revenue: number; avg_order: number; cancelled: number; cancel_rate: number };

const LABELS: Record<string, { name: string; icon: string; color: string }> = {
  pos: { name: "POS/Cashier", icon: "💵", color: "#E8542F" },
  call_center: { name: "Call Center", icon: "📞", color: "#F0A93B" },
  online: { name: "Website", icon: "🛵", color: "#16A34A" },
};

export default function SourceComparison({ filters, refreshKey }: { filters: any; refreshKey: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Row[]>("/reports/by-source", { params: filters })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, refreshKey]);

  const chartData = data.map((d) => ({
    name: LABELS[d.source]?.name || d.source,
    Orders: d.orders,
    Revenue: Math.round(d.revenue),
  }));

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#1A1613]">Order Sources</h2>
        <p className="text-xs text-[#A89F94] mt-0.5">Compare POS, Call Center &amp; Website</p>
      </div>

      {loading ? (
        <div className="h-[220px] bg-[#F5F1EB] rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-[#A89F94]">No data</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE4" vertical={false} />
              <XAxis dataKey="name" stroke="#A89F94" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#A89F94" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? (v/1000).toFixed(0) + "k" : v} />
              <Tooltip contentStyle={{ background: "#1A1613", border: "none", borderRadius: "12px", color: "#fff" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Orders" fill="#F0A93B" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Revenue" fill="#E8542F" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EDE8E1]">
                  <th className="text-left py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider">Source</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider">Orders</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider">Revenue</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider">Avg</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const l = LABELS[r.source] || { name: r.source, icon: "🍽️", color: "#A89F94" };
                  return (
                    <tr key={r.source} className="border-b border-[#F7F4F1]">
                      <td className="py-3">
                        <span className="mr-2">{l.icon}</span>
                        <span className="font-medium text-[#1A1613]">{l.name}</span>
                      </td>
                      <td className="text-right py-3 font-mono text-[#1A1613]">{r.orders}</td>
                      <td className="text-right py-3 font-mono font-semibold text-[#1A1613]">
                        Rs {Math.round(r.revenue).toLocaleString()}
                      </td>
                      <td className="text-right py-3 font-mono text-[#6B6259]">
                        Rs {Math.round(r.avg_order).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}