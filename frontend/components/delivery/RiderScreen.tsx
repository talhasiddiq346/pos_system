"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/components/shared/useSocket";
import { triggerToast } from "@/components/shared/NotificationToast";
import type { DeliveryAssignment, User, RiderStatus } from "@/lib/types";
import RiderTripPanel from "./RiderTripPanel";
import RiderHistoryPanel from "./RiderHistoryPanel";
import WaitingOrdersPanel from "./WaitingOrdersPanel";
import RiderCashPanel from "./RiderCashPanel";

type Tab = "orders" | "waiting" | "cash" | "history";

const STATUS_META: Record<RiderStatus, { label: string; dot: string; ring: string }> = {
  available:        { label: "Available",        dot: "#22C55E", ring: "#DCFCE7" },
  busy:             { label: "Busy",             dot: "#EAB308", ring: "#FEF9C3" },
  out_for_delivery: { label: "Out for delivery", dot: "#3B82F6", ring: "#DBEAFE" },
  offline:          { label: "Offline",          dot: "#94A3B8", ring: "#F1F5F9" },
};

export default function RiderScreen({ user }: { user: User }) {
  const [riderStatus, setRiderStatus] = useState<RiderStatus>("offline");
  const [activeOrders, setActiveOrders] = useState<DeliveryAssignment[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [todayCash, setTodayCash] = useState(0);
  const [todayDebt, setTodayDebt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("orders");

  const loadOrders = useCallback(async () => {
    const res = await api.get<DeliveryAssignment[]>("/riders/my-orders");
    setActiveOrders(res.data);
    setLoading(false);
  }, []);

  const loadMeta = useCallback(async () => {
    const [waitRes, todayRes] = await Promise.all([
      api.get<any[]>("/riders/waiting-orders"),
      api.get<any>("/riders/today"),
    ]);
    setWaitingCount(waitRes.data.length);
    setTodayCash(todayRes.data.summary.total_cash);
    setTodayDebt(todayRes.data.summary.current_debt);
  }, []);

  useEffect(() => {
    api.get<any>("/auth/me").then((res) => setRiderStatus(res.data.rider_status || "offline"));
    loadOrders();
    loadMeta();
  }, []);

  useSocket(user.branch_id, "delivery", {
    new_assignment: (d) => { triggerToast(`New order #${d.order_id} assigned`, "order"); loadOrders(); loadMeta(); },
    max_orders_reached: (d) => triggerToast(d.message, "order"),
    timer_expired: (d) => triggerToast(d.message, "ready"),
    trip_complete: () => { setRiderStatus("available"); triggerToast("Trip complete — submit your cash", "ready"); loadOrders(); loadMeta(); },
    waiting_order_available: (d) => { triggerToast(d.message, "order"); loadMeta(); },
    cash_accepted: (d) => { triggerToast(`Cash accepted · debt Rs ${Number(d.debt_remaining).toFixed(0)}`, "ready"); loadMeta(); },
  }, user.id);

  const meta = STATUS_META[riderStatus];

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "orders", label: "Orders", badge: activeOrders.length || undefined },
    { key: "waiting", label: "Waiting", badge: waitingCount || undefined },
    { key: "cash", label: "Cash" },
    { key: "history", label: "History" },
  ];

  if (loading) return <p className="text-sm text-[#6B7068]">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero — rider identity + live status + today snapshot */}
      <div className="rounded-2xl bg-[#14171A] text-white overflow-hidden mb-5">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/50">Rider</p>
              <h1 className="text-xl font-semibold mt-0.5">{user.name}</h1>
            </div>
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ backgroundColor: `${meta.dot}1A` }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: meta.dot }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: meta.dot }} />
              </span>
              <span className="text-xs font-medium" style={{ color: meta.dot }}>{meta.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Active</p>
              <p className="mono-num text-2xl font-semibold mt-0.5">{activeOrders.length}<span className="text-sm text-white/40">/5</span></p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Cash today</p>
              <p className="mono-num text-2xl font-semibold mt-0.5">{todayCash.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Debt</p>
              <p className="mono-num text-2xl font-semibold mt-0.5" style={{ color: todayDebt > 0 ? "#FCA5A5" : "#86EFAC" }}>
                {todayDebt.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#ECEEE9] mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white text-[#14171A] shadow-sm"
                : "text-[#6B7068] hover:text-[#14171A]"
            }`}
          >
            {t.label}
            {t.badge != null && (
              <span className={`mono-num text-[11px] px-1.5 rounded-full ${
                tab === t.key ? "bg-[#2F7D6B] text-white" : "bg-[#D6D9D2] text-[#494D46]"
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <RiderTripPanel
          activeOrders={activeOrders}
          riderStatus={riderStatus}
          onStatusChange={(s) => { setRiderStatus(s as RiderStatus); loadMeta(); }}
          onRefresh={() => { loadOrders(); loadMeta(); }}
        />
      )}
      {tab === "waiting" && (
        <WaitingOrdersPanel onAccepted={() => { loadOrders(); loadMeta(); setTab("orders"); }} />
      )}
      {tab === "cash" && (
        <RiderCashPanel onSubmitted={loadMeta} />
      )}
      {tab === "history" && <RiderHistoryPanel />}
    </div>
  );
}