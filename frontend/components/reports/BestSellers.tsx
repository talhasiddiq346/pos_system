"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Row = { name: string; orders: number; revenue: number };

export default function BestSellers({ filters, refreshKey }: { filters: any; refreshKey: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"orders" | "revenue">("orders");

  useEffect(() => {
    setLoading(true);
    api.get<Row[]>("/reports/best-sellers", { params: { ...filters, limit: 10 } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, refreshKey]);

  const sorted = [...data].sort((a, b) => (sortBy === "orders" ? b.orders - a.orders : b.revenue - a.revenue));
  const max = sorted[0]?.[sortBy] || 1;

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#1A1613]">🔥 Best Sellers</h2>
          <p className="text-xs text-[#A89F94] mt-0.5">Top 10 items</p>
        </div>
        <div className="flex gap-1 bg-[#F5F1EB] p-1 rounded-lg">
          <button onClick={() => setSortBy("orders")}
            className={`text-xs font-semibold px-3 py-1 rounded-md ${sortBy === "orders" ? "bg-white text-[#1A1613] shadow-sm" : "text-[#A89F94]"}`}>Orders</button>
          <button onClick={() => setSortBy("revenue")}
            className={`text-xs font-semibold px-3 py-1 rounded-md ${sortBy === "revenue" ? "bg-white text-[#1A1613] shadow-sm" : "text-[#A89F94]"}`}>Revenue</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 bg-[#F5F1EB] rounded animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-[#A89F94] py-8 text-center">No sales data</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((item, i) => {
            const val = item[sortBy];
            const pct = (val / max) * 100;
            return (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#1A1613] truncate max-w-[60%]">
                    <span className="text-[#A89F94] mr-2 font-mono text-xs">#{i + 1}</span>
                    {item.name}
                  </span>
                  <span className="text-sm font-mono font-semibold text-[#1A1613] flex-shrink-0">
                    {sortBy === "orders" ? `${item.orders} orders` : `Rs ${Math.round(item.revenue).toLocaleString()}`}
                  </span>
                </div>
                <div className="h-2 bg-[#F5F1EB] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: i === 0 ? "#E8542F" : i < 3 ? "#F0A93B" : "#EDE8E1" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}