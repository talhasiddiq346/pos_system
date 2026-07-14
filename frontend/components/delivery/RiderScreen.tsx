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

// Tab icons — SVG inline (no icon lib dependency)
const TabIcon = ({ tab, active }: { tab: Tab; active: boolean }) => {
  const stroke = active ? "#E8542F" : "#94A3B8";
  const width = 24;
  const height = 24;
  const props = { width, height, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (tab === "orders") return (
    <svg {...props}><path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>
  );
  if (tab === "waiting") return (
    <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  );
  if (tab === "cash") return (
    <svg {...props}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>
  );
  return (
    <svg {...props}><path d="M3 12a9 9 0 1 0 9-9M3 4v5h5"/></svg>
  );
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <div className="rounded-2xl bg-[#14171A] h-40 animate-pulse" />
        <div className="rounded-xl bg-[#ECEEE9] h-24 animate-pulse" />
        <div className="rounded-xl bg-[#ECEEE9] h-24 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F4] md:bg-transparent -mx-6 -my-6 md:mx-0 md:my-0">
      {/* Scrollable content area — bottom padding for nav clearance */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 md:pb-6">
        {/* Hero — rider identity + status + today snapshot */}
        <div className="rounded-2xl bg-[#14171A] text-white overflow-hidden mb-4 shadow-sm">
          <div className="px-5 pt-5 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/50">Rider</p>
                <h1 className="text-xl font-semibold mt-0.5 truncate">{user.name}</h1>
              </div>
              <div
                className="flex items-center gap-2 rounded-full px-3 py-2 shrink-0"
                style={{ backgroundColor: `${meta.dot}1A` }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: meta.dot }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: meta.dot }} />
                </span>
                <span className="text-xs font-medium whitespace-nowrap" style={{ color: meta.dot }}>{meta.label}</span>
              </div>
            </div>

            {/* Stats grid — bigger, mobile-optimized */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="bg-white/[0.06] rounded-xl px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Active</p>
                <p className="mono-num text-2xl font-bold mt-1">
                  {activeOrders.length}
                  <span className="text-sm text-white/40 font-normal">/5</span>
                </p>
              </div>
              <div className="bg-white/[0.06] rounded-xl px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Cash</p>
                <p className="mono-num text-2xl font-bold mt-1">
                  {todayCash >= 1000 ? `${(todayCash / 1000).toFixed(1)}k` : todayCash.toLocaleString()}
                </p>
              </div>
              <div className="bg-white/[0.06] rounded-xl px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Debt</p>
                <p
                  className="mono-num text-2xl font-bold mt-1"
                  style={{ color: todayDebt > 0 ? "#FCA5A5" : "#86EFAC" }}
                >
                  {todayDebt >= 1000 ? `${(todayDebt / 1000).toFixed(1)}k` : todayDebt.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab content */}
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

      {/* Bottom navigation — fixed, safe-area aware, thumb reach */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E7EB] md:relative md:mt-4 md:border md:rounded-2xl md:max-w-2xl md:mx-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <nav className="grid grid-cols-4 gap-1 px-2 py-2">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all min-h-[56px] ${
                  active ? "bg-[#FFF0E8]" : "hover:bg-[#F5F6F4] active:bg-[#ECEEE9]"
                }`}
                aria-label={t.label}
              >
                <div className="relative">
                  <TabIcon tab={t.key} active={active} />
                  {t.badge != null && (
                    <span className="absolute -top-1.5 -right-2.5 mono-num text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#E8542F] text-white shadow">
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    active ? "text-[#E8542F]" : "text-[#6B7068]"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}