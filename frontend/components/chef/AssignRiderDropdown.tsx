"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { RiderForAssignment } from "@/lib/types";

const STATUS_META: Record<string, { label: string; dot: string }> = {
    available: { label: "Available", dot: "#22C55E" },
    busy: { label: "Busy", dot: "#EAB308" },
    out_for_delivery: { label: "Out for delivery", dot: "#3B82F6" },
    offline: { label: "Offline", dot: "#94A3B8" },
};

function errMsg(err: unknown) {
    if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
    return "Something went wrong";
}

export default function AssignRiderDropdown({
    orderId,
    onAssigned,
    onCancel,
}: {
    orderId: number;
    onAssigned: (riderName: string) => void;
    onCancel: () => void;
}) {
    const [riders, setRiders] = useState<RiderForAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<number | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get<RiderForAssignment[]>("/riders/branch-riders").then((res) => {
            setRiders(res.data);
            setLoading(false);
        });
    }, []);

    const eligible = (r: RiderForAssignment) =>
        ["available", "busy"].includes(r.rider_status) && Number(r.active_orders) < 5;

    // Recommended = eligible rider with fewest active orders (available beats busy)
    const recommended = [...riders]
        .filter(eligible)
        .sort((a, b) => {
            const aAvail = a.rider_status === "available" ? 0 : 1;
            const bAvail = b.rider_status === "available" ? 0 : 1;
            if (aAvail !== bAvail) return aAvail - bAvail;
            return Number(a.active_orders) - Number(b.active_orders);
        })[0];

    async function assign(riderId: number, riderName: string) {
        setError("");
        setAssigning(riderId);
        try {
            await api.patch(`/orders/${orderId}/assign`, { rider_id: riderId });
            onAssigned(riderName);
        } catch (err) {
            const msg = errMsg(err);
            setError(msg);
            setAssigning(null);
            // Agar already assigned hai to card refresh karo (stale state)
            if (axios.isAxiosError(err) && err.response?.status === 409) {
                setTimeout(() => onCancel(), 1500);
            }
        }
    }

    if (loading) {
        return <div className="mt-3 rounded-lg border border-[#E3E5E0] bg-white px-4 py-3 text-xs text-[#6B7068]">Loading riders…</div>;
    }

    return (
        <div className="mt-3 rounded-lg border border-[#E3E5E0] bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F7F8F6] border-b border-[#EDEFEA] flex items-center justify-between">
                <p className="text-xs font-semibold text-[#14171A]">Assign a rider</p>
                <button onClick={onCancel} className="text-xs text-[#6B7068] hover:text-[#14171A]">Cancel</button>
            </div>

            {error && <p className="px-4 py-2 text-xs text-[#9E3527] bg-[#FBEAE7]">{error}</p>}

            {riders.length === 0 ? (
                <p className="px-4 py-4 text-xs text-[#6B7068]">No riders in this branch.</p>
            ) : (
                <ul className="divide-y divide-[#EDEFEA]">
                    {riders.map((r) => {
                        const canAssign = eligible(r);
                        const isRec = recommended && r.id === recommended.id;
                        const meta = STATUS_META[r.rider_status] || STATUS_META.offline;
                        const count = Number(r.active_orders);

                        return (
                            <li key={r.id}
                                className={`flex items-center justify-between px-4 py-2.5 ${isRec ? "bg-[#F3F9F7]" : ""} ${canAssign ? "" : "opacity-45"}`}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="inline-flex h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.dot }} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-[#14171A] truncate">{r.name}</span>
                                            {isRec && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#2F7D6B] text-white shrink-0">
                                                    ⭐ Best pick
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-[#9B9F98] mono-num">{count}/5 orders · {meta.label}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => canAssign && assign(r.id, r.name)}
                                    disabled={!canAssign || assigning !== null}
                                    className={`text-xs font-medium px-3.5 py-1.5 rounded-lg shrink-0 ${canAssign
                                            ? isRec
                                                ? "bg-[#2F7D6B] text-white hover:bg-[#27695A]"
                                                : "border border-[#E3E5E0] text-[#14171A] hover:bg-[#F5F6F4]"
                                            : "bg-[#F0F1ED] text-[#B5B8B0] cursor-not-allowed"
                                        } disabled:opacity-60`}
                                >
                                    {assigning === r.id ? "…" : canAssign ? "Assign" : count >= 5 ? "Full" : "Off"}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}