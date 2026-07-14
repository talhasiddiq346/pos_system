"use client";
import { useEffect, useState } from "react";

type Toast = {
  id: number;
  message: string;
  type: "order" | "ready" | "dispatched";
};

let toastId = 0;
let addToastFn: ((t: Toast) => void) | null = null;

export function triggerToast(message: string, type: Toast["type"] = "order") {
  addToastFn?.({ id: ++toastId, message, type });
}

const TYPE_STYLE = {
  order:      { bg: "#FBF3E5", text: "#8A6D1F", border: "#F0D99A" },
  ready:      { bg: "#E6F2EF", text: "#1F6F54", border: "#C7E2DA" },
  dispatched: { bg: "#EAF1FB", text: "#1D5A99", border: "#BAD0F5" },
};

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToastFn = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 5000);
    };
    return () => { addToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((t) => {
        const s = TYPE_STYLE[t.type];
        return (
          <div
            key={t.id}
            className="px-4 py-3 rounded-lg shadow-md text-sm font-medium flex items-center gap-2 min-w-[280px]"
            style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
          >
            <span className="w-2 h-2 rounded-full inline-block animate-pulse"
              style={{ backgroundColor: s.text }} />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}