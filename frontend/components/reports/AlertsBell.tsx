"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Role } from "@/lib/types";

type Alert = {
  id: number;
  branch_id: number | null;
  branch_name: string | null;
  type: "positive" | "warning" | "info";
  title: string;
  message: string;
  icon: string | null;
  is_read: boolean;
  created_at: string;
};

export default function AlertsBell({ viewerRole, viewerBranchId }: { viewerRole: Role; viewerBranchId: number | null }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function loadAlerts() {
    api.get<Alert[]>("/alerts", { params: { limit: 20 } }).then((r) => setAlerts(r.data));
    api.get<{ count: number }>("/alerts/unread-count").then((r) => setUnreadCount(r.data.count));
  }

  useEffect(() => {
    loadAlerts();
    const socket = getSocket();
    if (socket) {
      socket.on("new_alert", (alert: Alert) => {
        // Only show if applies to this user
        if (viewerRole === "super_admin" || alert.branch_id === viewerBranchId || alert.branch_id === null) {
          setAlerts((prev) => [alert, ...prev].slice(0, 20));
          setUnreadCount((c) => c + 1);
          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(alert.title, { body: alert.message, icon: "/favicon.ico" });
          }
        }
      });
    }
    return () => { socket?.off("new_alert"); };
  }, [viewerRole, viewerBranchId]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAsRead(id: number) {
    await api.patch(`/alerts/${id}/read`);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await api.patch("/alerts/read-all");
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    setUnreadCount(0);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-xl bg-[#F5F1EB] flex items-center justify-center hover:bg-[#EDE8E1] transition">
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#E8542F] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-[#EDE8E1] rounded-2xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[#EDE8E1] flex items-center justify-between">
            <p className="font-bold text-[#1A1613]">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="text-xs font-semibold text-[#E8542F] hover:underline">Mark all read</button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-[#A89F94]">No notifications yet</p>
              </div>
            ) : (
              alerts.map((a) => (
                <button key={a.id} onClick={() => markAsRead(a.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#F7F4F1] hover:bg-[#FAF8F5] transition ${
                    !a.is_read ? "bg-[#FFF8F0]" : ""
                  }`}>
                  <div className="flex gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                      a.type === "positive" ? "bg-[#DCFCE7]"
                      : a.type === "warning" ? "bg-[#FEE2E2]"
                      : "bg-[#DBEAFE]"
                    }`}>{a.icon || (a.type === "positive" ? "🎉" : a.type === "warning" ? "⚠️" : "ℹ️")}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!a.is_read ? "font-semibold text-[#1A1613]" : "font-medium text-[#6B6259]"}`}>
                        {a.title}
                      </p>
                      <p className="text-xs text-[#A89F94] mt-0.5 leading-snug">{a.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[#A89F94]">{timeAgo(a.created_at)}</span>
                        {a.branch_name && (
                          <>
                            <span className="text-[10px] text-[#EDE8E1]">·</span>
                            <span className="text-[10px] text-[#A89F94]">{a.branch_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!a.is_read && <span className="w-2 h-2 rounded-full bg-[#E8542F] mt-2 flex-shrink-0" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}