"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Summary = {
  total: number; delivered: number; rejected: number; active: number;
  cash_orders: number; card_orders: number; total_cash: number;
  avg_delivery_time: number; current_debt: number;
};

type HistoryOrder = {
  id: number; order_id: number; status: string;
  customer_name: string | null; customer_address: string | null; customer_phone: string | null;
  total: string; payment_method: string;
  assigned_at: string; accepted_at: string | null; delivered_at: string | null;
  delivery_minutes: number | null;
};

type Submission = {
  id: number; total_owed: string; amount_given: string;
  debt_carried: string; status: string;
  submitted_at: string; accepted_at: string | null;
  cashier_name: string;
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function RiderHistoryPanel() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ orders: HistoryOrder[]; submissions: Submission[]; summary: Summary }>("/riders/today")
      .then((res) => {
        setOrders(res.data.orders);
        setSubmissions(res.data.submissions);
        setSummary(res.data.summary);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-white border border-[#E3E5E0] h-24 animate-pulse" />
          ))}
        </div>
        <div className="rounded-2xl bg-white border border-[#E3E5E0] h-64 animate-pulse" />
      </div>
    );
  }

  const delivered = orders.filter((o) => o.status === "delivered");
  const deliveredTotal = delivered.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-3">
      {/* Stat cards — 2x2 grid, bigger */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Delivered" value={summary.delivered} sub="orders today" tone="green" icon="✓" />
          <Stat label="Cash collected" value={`Rs ${summary.total_cash.toLocaleString()}`} sub={`${summary.cash_orders}c · ${summary.card_orders}r`} icon="💵" />
          <Stat label="Avg time" value={summary.avg_delivery_time > 0 ? `${summary.avg_delivery_time}m` : "—"} sub="per delivery" icon="⏱" />
          <Stat
            label="Debt"
            value={`Rs ${summary.current_debt.toLocaleString()}`}
            sub={summary.current_debt > 0 ? "to submit" : "all clear"}
            tone={summary.current_debt > 0 ? "red" : "green"}
            icon={summary.current_debt > 0 ? "⚠️" : "✓"}
          />
        </div>
      )}

      {/* Deliveries timeline */}
      <div className="rounded-2xl border border-[#E3E5E0] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EDEFEA] flex items-center justify-between">
          <p className="text-base font-semibold text-[#14171A]">📦 Today's deliveries</p>
          <span className="mono-num text-xs font-medium text-[#6B7068] bg-[#F5F6F4] px-2 py-1 rounded-full">
            {delivered.length} done
          </span>
        </div>

        {delivered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F0F1ED] mx-auto flex items-center justify-center text-xl">📭</div>
            <p className="text-sm text-[#6B7068] mt-3">No deliveries completed yet today</p>
          </div>
        ) : (
          <ul>
            {delivered.map((o) => (
              <li key={o.id} className="px-5 py-4 border-b border-[#EDEFEA] last:border-0">
                <div className="space-y-2.5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="mono-num text-xs text-[#9B9F98]">#{o.order_id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          o.payment_method === "cash" ? "bg-[#FEF3C7] text-[#92610A]" : "bg-[#E0E7FF] text-[#3730A3]"
                        }`}>
                          {o.payment_method === "cash" ? "CASH" : "CARD"}
                        </span>
                        {o.delivery_minutes != null && (
                          <span className="text-[10px] font-semibold text-[#1F6F54] bg-[#E6F2EF] px-2 py-0.5 rounded-full">
                            {Math.round(o.delivery_minutes)}m
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#14171A] mt-1 truncate">{o.customer_name || "Customer"}</p>
                    </div>
                    <p className="mono-num text-base font-bold text-[#14171A] shrink-0">Rs {Number(o.total).toFixed(0)}</p>
                  </div>

                  {/* Address */}
                  {o.customer_address && (
                    <p className="text-xs text-[#6B7068] leading-relaxed">📍 {o.customer_address}</p>
                  )}

                  {/* Vertical timeline (mobile friendly) */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-[#EDEFEA]">
                    <TimePill label="Assigned" time={fmt(o.assigned_at)} />
                    <span className="text-[#D6D9D2]">→</span>
                    <TimePill label="Accepted" time={fmt(o.accepted_at)} />
                    <span className="text-[#D6D9D2]">→</span>
                    <TimePill label="Done" time={fmt(o.delivered_at)} highlight />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {delivered.length > 0 && (
          <div className="px-5 py-4 bg-[#F7F8F6] flex items-center justify-between border-t border-[#EDEFEA]">
            <p className="text-sm font-bold text-[#14171A]">Total delivered</p>
            <p className="mono-num text-lg font-bold text-[#14171A]">Rs {deliveredTotal.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Cash submissions log */}
      {submissions.length > 0 && (
        <div className="rounded-2xl border border-[#E3E5E0] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EDEFEA]">
            <p className="text-base font-semibold text-[#14171A]">💰 Cash submissions</p>
          </div>
          <ul>
            {submissions.map((s) => (
              <li key={s.id} className="px-5 py-3.5 border-b border-[#EDEFEA] last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#14171A]">
                      To <span className="font-semibold">{s.cashier_name}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7068] flex-wrap">
                      <span>{fmt(s.submitted_at)}</span>
                      {s.status === "accepted" && s.accepted_at && (
                        <>
                          <span>·</span>
                          <span>Confirmed {fmt(s.accepted_at)}</span>
                        </>
                      )}
                      {Number(s.debt_carried) > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[#9E3527] font-medium">Rs {Number(s.debt_carried).toFixed(0)} carried</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="mono-num text-base font-bold text-[#1F6F54]">Rs {Number(s.amount_given).toFixed(0)}</p>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 ${
                      s.status === "accepted" ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FEF9E7] text-[#92610A]"
                    }`}>
                      {s.status === "accepted" ? "✓ Confirmed" : "⏳ Pending"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone, icon }: {
  label: string; value: string | number; sub: string; tone?: "green" | "red"; icon?: string;
}) {
  const color = tone === "green" ? "#1F6F54" : tone === "red" ? "#9E3527" : "#14171A";
  const bgTone = tone === "green" ? "#E6F2EF" : tone === "red" ? "#FBEAE7" : "#F5F6F4";
  return (
    <div className="rounded-2xl border border-[#E3E5E0] bg-white px-4 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-[#6B7068] font-semibold">{label}</p>
        {icon && (
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
            style={{ backgroundColor: bgTone }}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mono-num text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[11px] text-[#9B9F98] mt-0.5">{sub}</p>
    </div>
  );
}

function TimePill({ label, time, highlight }: { label: string; time: string; highlight?: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-[#9B9F98] font-semibold">{label}</p>
      <p className={`mono-num text-xs font-semibold ${highlight ? "text-[#1F6F54]" : "text-[#14171A]"}`}>
        {time}
      </p>
    </div>
  );
}