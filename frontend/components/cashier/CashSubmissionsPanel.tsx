"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { useSocket } from "@/components/shared/useSocket";
import { triggerToast } from "@/components/shared/NotificationToast";
import { getSocket } from "@/lib/socket";
import type { CashSubmission, User } from "@/lib/types";

function errMsg(err: unknown) {
    if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
    return "Something went wrong";
}

export default function CashSubmissionsPanel({ user }: { user: User }) {
    const [submissions, setSubmissions] = useState<CashSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState<number | null>(null);
    const [error, setError] = useState("");

    async function load() {
        const res = await api.get<CashSubmission[]>("/cashier/submissions");
        setSubmissions(res.data);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    // Personal cashier room for live submissions
    useEffect(() => {
        const socket = getSocket();
        const join = () => socket.emit("join_cashier", user.id);
        if (socket.connected) join();
        else socket.once("connect", join);
    }, [user.id]);

    useSocket(user.branch_id, "cashier", {
        cash_submission: () => {
            triggerToast("New cash submission from a rider", "order");
            load();
        },
    });

    async function accept(id: number) {
        setError("");
        setAccepting(id);
        try {
            await api.patch(`/cashier/submissions/${id}/accept`);
            await load();
        } catch (err) { setError(errMsg(err)); }
        finally { setAccepting(null); }
    }

    if (loading) return <p className="text-sm text-[#6B7068]">Loading…</p>;

    const pending = submissions.filter((s) => s.status === "pending");
    const accepted = submissions.filter((s) => s.status === "accepted");
    const totalAccepted = accepted.reduce((sum, s) => sum + Number(s.amount_given), 0);
    const pendingTotal = pending.reduce((sum, s) => sum + Number(s.amount_given), 0);

    return (
        <div className="max-w-3xl space-y-5">
            {/* Header snapshot */}
            <div className="rounded-2xl bg-[#14171A] text-white px-6 py-5">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/50">Cash desk · today</p>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-white/40">Collected</p>
                        <p className="mono-num text-2xl font-semibold mt-0.5">Rs {totalAccepted.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-white/40">Awaiting</p>
                        <p className="mono-num text-2xl font-semibold mt-0.5 text-[#FCD34D]">Rs {pendingTotal.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-white/40">Submissions</p>
                        <p className="mono-num text-2xl font-semibold mt-0.5">{accepted.length}<span className="text-sm text-white/40"> done</span></p>
                    </div>
                </div>
            </div>

            {error && (
                <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-4 py-3">{error}</p>
            )}

            {/* Pending — needs action */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-2 w-2">
                        {pending.length > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-[#EAB308] opacity-60 animate-ping" />}
                        <span className={`relative inline-flex h-2 w-2 rounded-full ${pending.length > 0 ? "bg-[#EAB308]" : "bg-[#D6D9D2]"}`} />
                    </span>
                    <h2 className="text-sm font-semibold text-[#14171A]">Pending confirmation</h2>
                    <span className="mono-num text-xs text-[#6B7068]">{pending.length}</span>
                </div>

                {pending.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#D6D9D2] bg-white px-6 py-8 text-center">
                        <p className="text-sm text-[#6B7068]">No riders waiting. You're all caught up.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {pending.map((s) => (
                            <div key={s.id} className="rounded-xl border border-[#F0D99A] bg-[#FEFCF5] overflow-hidden">
                                <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#F5EDD6] flex items-center justify-center text-sm font-semibold text-[#92610A]">
                                            {(s.rider_name || "R").charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-[#14171A]">{s.rider_name}</p>
                                            <p className="text-xs text-[#6B7068] mt-0.5">
                                                Owed Rs {Number(s.total_owed).toFixed(0)}
                                                {(s as any).deliveries_today > 0 && (
                                                    <span> · {(s as any).deliveries_today} deliveries · Rs {Number((s as any).total_cash_today).toFixed(0)} cash collected</span>
                                                )}
                                                {Number(s.debt_carried) > 0 && (
                                                    <span className="text-[#9E3527]"> · Rs {Number(s.debt_carried).toFixed(0)} debt after</span>
                                                )}
                                                {" · "}{new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase tracking-wider text-[#92610A]">Handing over</p>
                                            <p className="mono-num text-xl font-bold text-[#14171A]">Rs {Number(s.amount_given).toFixed(0)}</p>
                                        </div>
                                        <button onClick={() => accept(s.id)} disabled={accepting === s.id}
                                            className="text-sm font-medium px-5 py-2.5 rounded-lg bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-50">
                                            {accepting === s.id ? "…" : "Confirm received"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Accepted — log */}
            {accepted.length > 0 && (
                <section>
                    <h2 className="text-sm font-semibold text-[#14171A] mb-3">Confirmed today</h2>
                    <div className="rounded-xl border border-[#E3E5E0] bg-white overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[#6B7068] border-b border-[#EDEFEA]">
                                    <th className="px-5 py-2.5 font-normal text-xs uppercase tracking-wider">Rider</th>
                                    <th className="px-5 py-2.5 font-normal text-xs uppercase tracking-wider mono-num">Received</th>
                                    <th className="px-5 py-2.5 font-normal text-xs uppercase tracking-wider mono-num">Debt after</th>
                                    <th className="px-5 py-2.5 font-normal text-xs uppercase tracking-wider text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accepted.map((s) => (
                                    <tr key={s.id} className="border-b border-[#EDEFEA] last:border-0">
                                        <td className="px-5 py-3 text-[#14171A] font-medium">{s.rider_name}</td>
                                        <td className="px-5 py-3 mono-num font-semibold text-[#1F6F54]">Rs {Number(s.amount_given).toFixed(0)}</td>
                                        <td className={`px-5 py-3 mono-num ${Number(s.debt_carried) > 0 ? "text-[#9E3527]" : "text-[#9B9F98]"}`}>
                                            {Number(s.debt_carried) > 0 ? `Rs ${Number(s.debt_carried).toFixed(0)}` : "—"}
                                        </td>
                                        <td className="px-5 py-3 text-[#6B7068] text-right text-xs">
                                            {s.accepted_at ? new Date(s.accepted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-[#F7F8F6]">
                                    <td className="px-5 py-3 text-sm font-semibold text-[#14171A]">Total collected</td>
                                    <td className="px-5 py-3 mono-num font-bold text-[#14171A]" colSpan={3}>
                                        Rs {totalAccepted.toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}