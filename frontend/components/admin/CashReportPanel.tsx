"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Role } from "@/lib/types";

type CashierStat = { id: number; name: string; collected: number; submissions: number };
type RiderStat = {
  id: number; name: string; rider_debt: number; rider_status: string;
  delivered_count: number; rejected_count: number;
  avg_delivery_time: number; cash_collected: number; on_time_rate: number;
};
type BranchReport = {
  branch_id: number; branch_name: string;
  cashiers: CashierStat[]; riders: RiderStat[];
};

const STATUS_DOT: Record<string, string> = {
  available: "#22C55E", busy: "#EAB308", out_for_delivery: "#3B82F6", offline: "#94A3B8",
};

function today() { return new Date().toISOString().split("T")[0]; }

export default function CashReportPanel({ viewerRole }: { viewerRole: Role }) {
  const [report, setReport] = useState<BranchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ from: string; to: string; report: BranchReport[] }>("/reports/cash", {
      params: { from, to },
    });
    setReport(res.data.report);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function setRange(days: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - days);
    setFrom(f.toISOString().split("T")[0]);
    setTo(t.toISOString().split("T")[0]);
  }

  // Company-wide totals (super admin)
  const grandCollected = report.reduce((s, b) => s + b.cashiers.reduce((c, x) => c + Number(x.collected), 0), 0);
  const grandDebt = report.reduce((s, b) => s + b.riders.reduce((r, x) => r + Number(x.rider_debt), 0), 0);
  const grandDelivered = report.reduce((s, b) => s + b.riders.reduce((r, x) => r + Number(x.delivered_count), 0), 0);

  return (
    <div className="space-y-5">
      {/* Date controls */}
      <div className="rounded-xl border border-[#E3E5E0] bg-white px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {[
            { label: "Today", days: 0 },
            { label: "7 days", days: 7 },
            { label: "30 days", days: 30 },
          ].map((r) => {
            const active = r.days === 0 ? from === today() && to === today() : false;
            return (
              <button key={r.label} onClick={() => setRange(r.days)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  active ? "bg-[#14171A] text-white border-[#14171A]" : "border-[#E3E5E0] text-[#494D46] hover:bg-[#F5F6F4]"
                }`}>
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="border border-[#E3E5E0] rounded-lg px-3 py-1.5 text-sm mono-num" />
          <span className="text-[#9B9F98]">→</span>
          <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)}
            className="border border-[#E3E5E0] rounded-lg px-3 py-1.5 text-sm mono-num" />
        </div>
      </div>

      {/* Company totals — super admin only, multi-branch */}
      {viewerRole === "super_admin" && report.length > 1 && (
        <div className="rounded-2xl bg-[#14171A] text-white px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/50">Company totals · {report.length} branches</p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Cash collected</p>
              <p className="mono-num text-2xl font-semibold mt-0.5">Rs {grandCollected.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Outstanding debt</p>
              <p className="mono-num text-2xl font-semibold mt-0.5" style={{ color: grandDebt > 0 ? "#FCA5A5" : "#86EFAC" }}>
                Rs {grandDebt.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Delivered</p>
              <p className="mono-num text-2xl font-semibold mt-0.5">{grandDelivered.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#6B7068]">Loading report…</p>
      ) : report.length === 0 ? (
        <p className="text-sm text-[#6B7068]">No data for this range.</p>
      ) : (
        report.map((branch) => {
          const branchCollected = branch.cashiers.reduce((s, c) => s + Number(c.collected), 0);
          const branchDebt = branch.riders.reduce((s, r) => s + Number(r.rider_debt), 0);

          return (
            <div key={branch.branch_id} className="rounded-2xl border border-[#E3E5E0] bg-white overflow-hidden">
              {/* Branch header */}
              <div className="px-6 py-4 border-b border-[#EDEFEA] flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-[#14171A]">{branch.branch_name}</h2>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7068]">Collected</p>
                    <p className="mono-num text-sm font-semibold text-[#1F6F54]">Rs {branchCollected.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7068]">Debt</p>
                    <p className={`mono-num text-sm font-semibold ${branchDebt > 0 ? "text-[#9E3527]" : "text-[#9B9F98]"}`}>
                      Rs {branchDebt.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#EDEFEA]">
                {/* Cashiers */}
                <div className="px-6 py-5">
                  <p className="text-[11px] uppercase tracking-wider text-[#6B7068] mb-3">Cashier collections</p>
                  {branch.cashiers.length === 0 ? (
                    <p className="text-xs text-[#9B9F98]">No cashiers.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {branch.cashiers.map((c) => (
                        <li key={c.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#E6F2EF] flex items-center justify-center text-xs font-semibold text-[#1F6F54]">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-[#14171A] font-medium">{c.name}</p>
                              <p className="text-[11px] text-[#9B9F98] mono-num">{c.submissions} submission{c.submissions !== 1 ? "s" : ""}</p>
                            </div>
                          </div>
                          <p className="mono-num text-sm font-semibold text-[#1F6F54]">Rs {Number(c.collected).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Riders — performance */}
                <div className="px-6 py-5">
                  <p className="text-[11px] uppercase tracking-wider text-[#6B7068] mb-3">Rider performance</p>
                  {branch.riders.length === 0 ? (
                    <p className="text-xs text-[#9B9F98]">No riders.</p>
                  ) : (
                    <ul className="space-y-3">
                      {branch.riders.map((r) => (
                        <li key={r.id} className="rounded-lg border border-[#EDEFEA] p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_DOT[r.rider_status] || "#94A3B8" }} />
                              <span className="text-sm font-medium text-[#14171A]">{r.name}</span>
                            </div>
                            {Number(r.rider_debt) > 0 ? (
                              <span className="mono-num text-xs font-semibold text-[#9E3527] bg-[#FBEAE7] px-2 py-0.5 rounded-full">
                                Rs {Number(r.rider_debt).toFixed(0)} debt
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-[#1F6F54] bg-[#E6F2EF] px-2 py-0.5 rounded-full">Clear</span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2.5">
                            <Metric label="Delivered" value={r.delivered_count} />
                            <Metric label="Avg time" value={r.avg_delivery_time > 0 ? `${r.avg_delivery_time}m` : "—"} />
                            <Metric label="Cash" value={`Rs ${Number(r.cash_collected).toLocaleString()}`} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#9B9F98]">{label}</p>
      <p className="mono-num text-sm font-semibold text-[#14171A] mt-0.5">{value}</p>
    </div>
  );
}