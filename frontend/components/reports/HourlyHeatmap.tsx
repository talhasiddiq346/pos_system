"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Row = { dow: number; hour: number; orders: number };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HourlyHeatmap({ filters, refreshKey }: { filters: any; refreshKey: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Row[]>("/reports/hourly-heatmap", { params: filters })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filters.from, filters.to, filters.branch_id, filters.source, refreshKey]);

  const map: Record<string, number> = {};
  let max = 0;
  data.forEach((d) => {
    const k = `${d.dow}-${d.hour}`;
    map[k] = d.orders;
    if (d.orders > max) max = d.orders;
  });

  function color(v: number) {
    if (v === 0) return "#F5F1EB";
    const intensity = v / max;
    if (intensity < 0.25) return "#FEE4D6";
    if (intensity < 0.5) return "#FCD9C8";
    if (intensity < 0.75) return "#FA9B7A";
    return "#E8542F";
  }

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#1A1613]">Peak Hours</h2>
        <p className="text-xs text-[#A89F94] mt-0.5">Busiest times of the week</p>
      </div>

      {loading ? (
        <div className="h-[220px] bg-[#F5F1EB] rounded-lg animate-pulse" />
      ) : (
        <>
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[400px]">
              <div className="flex gap-0.5 mb-1 pl-8">
                {[0, 4, 8, 12, 16, 20].map((h) => (
                  <span key={h} className="text-[10px] text-[#A89F94] font-medium" style={{ width: "16.6%" }}>
                    {h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`}
                  </span>
                ))}
              </div>
              {DAYS.map((d, dow) => (
                <div key={d} className="flex items-center gap-0.5 mb-0.5">
                  <span className="text-[10px] text-[#A89F94] font-medium w-8">{d}</span>
                  {HOURS.map((h) => {
                    const v = map[`${dow}-${h}`] || 0;
                    return (
                      <div key={h} className="flex-1 aspect-square rounded-sm relative group"
                        style={{ background: color(v), minWidth: "10px" }}>
                        {v > 0 && (
                          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#1A1613] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                            {d} {h}:00 · {v} orders
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-3">
            <span className="text-[10px] text-[#A89F94]">Less</span>
            {["#F5F1EB", "#FEE4D6", "#FCD9C8", "#FA9B7A", "#E8542F"].map((c) => (
              <span key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />
            ))}
            <span className="text-[10px] text-[#A89F94]">More</span>
          </div>
        </>
      )}
    </div>
  );
}