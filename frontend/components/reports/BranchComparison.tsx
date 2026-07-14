"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Row = { id: number; name: string; orders: number; revenue: number; avg_order: number; best_item: string };

export default function BranchComparison({ filters, refreshKey }: { filters: any; refreshKey: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Row[]>("/reports/by-branch", { params: filters })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, refreshKey]);

  const chartData = data.map((d) => ({
    name: d.name,
    Revenue: Math.round(d.revenue),
  }));

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#1A1613]">Branches</h2>
        <p className="text-xs text-[#A89F94] mt-0.5">Performance by branch</p>
      </div>

      {loading ? (
        <div className="h-[220px] bg-[#F5F1EB] rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-[#A89F94]">No data</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE4" horizontal={false} />
              <XAxis type="number" stroke="#A89F94" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? (v/1000).toFixed(0) + "k" : v} />
              <YAxis dataKey="name" type="category" stroke="#A89F94" fontSize={11} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={{ background: "#1A1613", border: "none", borderRadius: "12px", color: "#fff" }}
                formatter={(v: any) => `Rs ${Number(v).toLocaleString()}`} />
              <Bar dataKey="Revenue" fill="#E8542F" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EDE8E1]">
                  <th className="text-left py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider">Branch</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider">Orders</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider">Revenue</th>
                  <th className="text-left py-2 text-xs font-semibold text-[#A89F94] uppercase tracking-wider pl-4">Best item</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={r.id} className="border-b border-[#F7F4F1]">
                    <td className="py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white ${
                          i === 0 ? "bg-[#F0A93B]" : i === 1 ? "bg-[#A89F94]" : "bg-[#EDE8E1]"
                        }`}>{i + 1}</span>
                        <span className="font-medium text-[#1A1613]">{r.name}</span>
                      </span>
                    </td>
                    <td className="text-right py-3 font-mono text-[#1A1613]">{r.orders}</td>
                    <td className="text-right py-3 font-mono font-semibold text-[#1A1613]">
                      Rs {Math.round(r.revenue).toLocaleString()}
                    </td>
                    <td className="py-3 pl-4 text-[#6B6259] text-xs">{r.best_item || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}