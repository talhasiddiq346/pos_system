"use client";
import { useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { RiderStatus } from "@/lib/types";

const STATUS_CONFIG: Record<RiderStatus, {
  label: string; emoji: string; bg: string; text: string; border: string;
}> = {
  available:        { label: "Available",        emoji: "🟢", bg: "#E6F2EF", text: "#1F6F54", border: "#C7E2DA" },
  busy:             { label: "Busy",             emoji: "🟡", bg: "#FBF3E5", text: "#8A6D1F", border: "#F0D99A" },
  out_for_delivery: { label: "Out for Delivery", emoji: "🛵", bg: "#EAF1FB", text: "#1D5A99", border: "#BAD0F5" },
  offline:          { label: "Offline",          emoji: "🔴", bg: "#FBEAE7", text: "#9E3527", border: "#F0C9C2" },
};

// Rider khud kya change kar sakta hai
const ALLOWED_TRANSITIONS: Record<RiderStatus, RiderStatus[]> = {
  offline:          ["available"],
  available:        ["offline"],
  busy:             ["out_for_delivery", "offline"],
  out_for_delivery: [], // system change karta hai (sab deliver hone pe)
};

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function RiderStatusBar({
  currentStatus,
  onStatusChange,
}: {
  currentStatus: RiderStatus;
  onStatusChange: (s: RiderStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const config = STATUS_CONFIG[currentStatus];
  const transitions = ALLOWED_TRANSITIONS[currentStatus];

  async function handleChange(newStatus: RiderStatus) {
    setError("");
    setLoading(true);
    try {
      await api.patch("/riders/status", { status: newStatus });
      onStatusChange(newStatus);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-lg px-5 py-4 border"
      style={{ backgroundColor: config.bg, borderColor: config.border }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: config.text }}>
            Your status
          </p>
          <p className="text-lg font-bold mt-0.5" style={{ color: config.text }}>
            {config.emoji} {config.label}
          </p>
        </div>

        {transitions.length > 0 && (
          <div className="flex gap-2">
            {transitions.map((s) => {
              const tc = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => handleChange(s)}
                  disabled={loading}
                  className="text-sm px-4 py-2 rounded-md font-medium border disabled:opacity-50"
                  style={{ backgroundColor: tc.bg, color: tc.text, borderColor: tc.border }}
                >
                  {tc.emoji} {tc.label}
                </button>
              );
            })}
          </div>
        )}

        {currentStatus === "out_for_delivery" && (
          <p className="text-xs" style={{ color: config.text }}>
            Mark orders as delivered to become available again
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-[#9E3527]">{error}</p>}
    </div>
  );
}