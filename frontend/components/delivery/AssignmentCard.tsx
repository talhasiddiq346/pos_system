"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { DeliveryAssignment } from "@/lib/types";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function AssignmentCard({
  assignment,
  onResponded,
}: {
  assignment: DeliveryAssignment;
  onResponded: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(35);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  async function respond(action: "accept" | "reject") {
    setError("");
    setLoading(true);
    try {
      await api.patch(`/riders/assignments/${assignment.id}`, { action });
      onResponded();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  const urgency = timeLeft <= 10 ? "#9E3527" : timeLeft <= 20 ? "#8A6D1F" : "#1F6F54";

  return (
    <div className="bg-white border-2 border-[#2F7D6B] rounded-lg overflow-hidden animate-pulse-border">
      <div className="px-5 py-3 bg-[#2F7D6B] flex items-center justify-between">
        <p className="text-white font-medium text-sm">
          🔔 New delivery assignment!
        </p>
        <span
          className="mono-num font-bold text-lg"
          style={{ color: timeLeft <= 10 ? "#FBEAE7" : "#E6F2EF" }}
        >
          {timeLeft}s
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div>
          <p className="text-xs text-[#494D46] uppercase tracking-wide mb-1">Customer</p>
          <p className="text-sm font-medium text-[#1B1D1E]">{assignment.customer_name || "—"}</p>
          {assignment.customer_phone && (
            <p className="text-xs text-[#494D46]">📞 {assignment.customer_phone}</p>
          )}
          {assignment.customer_address && (
            <p className="text-xs text-[#494D46]">📍 {assignment.customer_address}</p>
          )}
        </div>

        {assignment.items && assignment.items.length > 0 && (
          <div>
            <p className="text-xs text-[#494D46] uppercase tracking-wide mb-1">Items</p>
            <ul className="space-y-0.5">
              {assignment.items.map((it, i) => (
                <li key={i} className="text-sm text-[#1B1D1E]">
                  {it.name}{it.variant ? ` (${it.variant})` : ""} × {it.qty}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="mono-num text-sm font-medium">
            Rs {Number(assignment.total).toFixed(2)}
          </p>
          <p className="text-xs text-[#494D46] capitalize">
            {assignment.source.replace("_", " ")}
          </p>
        </div>

        {error && <p className="text-xs text-[#9E3527]">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => respond("accept")}
            disabled={loading || timeLeft === 0}
            className="flex-1 py-2 rounded-md bg-[#2F7D6B] text-white text-sm font-medium hover:bg-[#27695A] disabled:opacity-50"
          >
            ✓ Accept
          </button>
          <button
            onClick={() => respond("reject")}
            disabled={loading || timeLeft === 0}
            className="flex-1 py-2 rounded-md border border-[#F0C9C2] text-[#9E3527] text-sm font-medium hover:bg-[#FBEAE7] disabled:opacity-50"
          >
            ✗ Reject
          </button>
        </div>
      </div>
    </div>
  );
}