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

  if (loading) return <p className="text-sm text-[#6B7068]">Loading…</p>;

  const delivered = orders.filter((o) => o.status === "delivered");
  const deliveredTotal = delivered.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      {/* Performance cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Delivered" value={summary.delivered} sub="orders today" tone="green" />
          <Stat label="Cash collected" value={`Rs ${summary.total_cash.toLocaleString()}`} sub={`${summary.cash_orders} cash · ${summary.card_orders} card`} />
          <Stat label="Avg delivery time" value={summary.avg_delivery_time > 0 ? `${summary.avg_delivery_time} min` : "—"} sub="per order" />
          <Stat
            label="Outstanding debt"
            value={`Rs ${summary.current_debt.toLocaleString()}`}
            sub={summary.current_debt > 0 ? "to submit" : "all clear"}
            tone={summary.current_debt > 0 ? "red" : "green"}
          />
        </div>
      )}

      {/* Delivery timeline */}
      <div className="rounded-xl border border-[#E3E5E0] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EDEFEA] flex items-center justify-between">
          <p className="text-sm font-medium text-[#14171A]">Today's deliveries</p>
          <span className="mono-num text-xs text-[#6B7068]">{delivered.length} completed</span>
        </div>

        {delivered.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#6B7068] text-center">No deliveries completed yet today.</p>
        ) : (
          <ul>
            {delivered.map((o) => (
              <li key={o.id} className="px-5 py-4 border-b border-[#EDEFEA] last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono-num text-xs text-[#9B9F98]">#{o.order_id}</span>
                      <span className="text-sm font-semibold text-[#14171A]">{o.customer_name || "Customer"}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        o.payment_method === "cash" ? "bg-[#FEF3C7] text-[#92610A]" : "bg-[#E0E7FF] text-[#3730A3]"
                      }`}>
                        {o.payment_method === "cash" ? "CASH" : "CARD"}
                      </span>
                    </div>
                    {o.customer_address && (
                      <p className="text-xs text-[#6B7068] mt-0.5">📍 {o.customer_address}</p>
                    )}
                    {o.customer_phone && (
                      <p className="text-xs text-[#6B7068]">📞 {o.customer_phone}</p>
                    )}

                    {/* Timeline */}
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      <TimeStep label="Assigned" time={fmt(o.assigned_at)} />
                      <span className="text-[#D6D9D2] text-xs">→</span>
                      <TimeStep label="Accepted" time={fmt(o.accepted_at)} />
                      <span className="text-[#D6D9D2] text-xs">→</span>
                      <TimeStep label="Delivered" time={fmt(o.delivered_at)} />
                      {o.delivery_minutes != null && (
                        <>
                          <span className="text-[#D6D9D2] text-xs">·</span>
                          <span className="text-[11px] font-medium text-[#2F7D6B] bg-[#E6F2EF] px-2 py-0.5 rounded-full">
                            {Math.round(o.delivery_minutes)} min
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mono-num text-sm font-bold text-[#14171A] shrink-0">
                    Rs {Number(o.total).toFixed(0)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {delivered.length > 0 && (
          <div className="px-5 py-3.5 bg-[#F7F8F6] flex items-center justify-between border-t border-[#EDEFEA]">
            <p className="text-sm font-semibold text-[#14171A]">Total delivered</p>
            <p className="mono-num text-base font-bold text-[#14171A]">Rs {deliveredTotal.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Cash submissions log */}
      {submissions.length > 0 && (
        <div className="rounded-xl border border-[#E3E5E0] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EDEFEA]">
            <p className="text-sm font-medium text-[#14171A]">Cash submissions today</p>
          </div>
          <ul>
            {submissions.map((s) => (
              <li key={s.id} className="px-5 py-3.5 border-b border-[#EDEFEA] last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#14171A]">
                      Submitted to <span className="font-medium">{s.cashier_name}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7068]">
                      <span>Sent: {fmt(s.submitted_at)}</span>
                      {s.status === "accepted" && s.accepted_at && (
                        <span>· Confirmed: {fmt(s.accepted_at)}</span>
                      )}
                      {Number(s.debt_carried) > 0 && (
                        <span className="text-[#9E3527]">· Rs {Number(s.debt_carried).toFixed(0)} carried</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="mono-num text-sm font-bold text-[#1F6F54]">Rs {Number(s.amount_given).toFixed(0)}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      s.status === "accepted" ? "bg-[#E6F2EF] text-[#1F6F54]" : "bg-[#FEF9E7] text-[#92610A]"
                    }`}>
                      {s.status === "accepted" ? "Confirmed" : "Pending"}
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

function Stat({ label, value, sub, tone }: {
  label: string; value: string | number; sub: string; tone?: "green" | "red";
}) {
  const color = tone === "green" ? "#1F6F54" : tone === "red" ? "#9E3527" : "#14171A";
  return (
    <div className="rounded-xl border border-[#E3E5E0] bg-white px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wider text-[#6B7068]">{label}</p>
      <p className="mono-num text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      <p className="text-[11px] text-[#9B9F98] mt-0.5">{sub}</p>
    </div>
  );
}

function TimeStep({ label, time }: { label: string; time: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#9B9F98]">{label}</p>
      <p className="mono-num text-xs font-medium text-[#14171A]">{time}</p>
    </div>
  );
}