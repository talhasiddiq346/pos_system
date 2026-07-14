"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { CashSummary } from "@/lib/types";

type Cashier = { id: number; name: string };

function errMsg(err: unknown) {
    if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
    return "Something went wrong";
}

export default function RiderCashPanel({ onSubmitted }: { onSubmitted: () => void }) {
    const [summary, setSummary] = useState<CashSummary | null>(null);
    const [cashiers, setCashiers] = useState<Cashier[]>([]);
    const [cashier, setCashier] = useState<number | "">("");
    const [amount, setAmount] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(true);

    async function load() {
        const [sumRes, cashRes] = await Promise.all([
            api.get<CashSummary>("/riders/cash-summary"),
            api.get<Cashier[]>("/riders/cashiers"),
        ]);
        setSummary(sumRes.data);
        setCashiers(cashRes.data);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    async function submit() {
        setError(""); setSuccess("");
        if (!cashier) { setError("Choose a cashier to hand cash to"); return; }
        const amt = Number(amount);
        if (!amt || amt <= 0) { setError("Enter the amount you're handing over"); return; }
        if (summary && amt > summary.remaining_owed) { setError(`Can't exceed Rs ${summary.remaining_owed.toFixed(0)}`); return; }
        setSubmitting(true);
        try {
            await api.post("/riders/cash-submission", { cashier_id: cashier, amount_given: amt });
            setSuccess("Submitted — waiting for cashier to confirm");
            setAmount("");
            await load();
            onSubmitted();
        } catch (err) { setError(errMsg(err)); }
        finally { setSubmitting(false); }
    }

    if (loading) return <p className="text-sm text-[#6B7068]">Loading…</p>;
    if (!summary) return null;

    const owed = summary.remaining_owed;
    const settled = owed <= 0;

    return (
        <div className="space-y-4">
            {/* Reconciliation breakdown */}
            <div className="rounded-xl border border-[#E3E5E0] bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-[#EDEFEA]">
                    <p className="text-[11px] uppercase tracking-wider text-[#6B7068]">Cash reconciliation</p>
                </div>
                <div className="px-5 py-4 space-y-3">
                    <Row label="Collected today (cash orders)" value={summary.total_cash_collected} />
                    {summary.previous_debt > 0 && (
                        <Row label="Previous debt carried" value={summary.previous_debt} accent="#9E3527" />
                    )}
                    {summary.total_given_today > 0 && (
                        <Row label="Already submitted today" value={-summary.total_given_today} accent="#1F6F54" />
                    )}
                    <div className="h-px bg-[#EDEFEA]" />
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#14171A]">You owe the cashier</p>
                        <p className="mono-num text-2xl font-bold" style={{ color: settled ? "#1F6F54" : "#14171A" }}>
                            Rs {owed.toFixed(0)}
                        </p>
                    </div>
                </div>
            </div>

            {settled ? (
                <div className="rounded-xl border border-[#C7E2DA] bg-[#E6F2EF] px-5 py-6 text-center">
                    <div className="w-11 h-11 rounded-full bg-white mx-auto flex items-center justify-center text-lg">✓</div>
                    <p className="text-sm font-medium text-[#1F6F54] mt-2">All settled</p>
                    <p className="text-xs text-[#3B7A66] mt-0.5">No cash pending. Nice work.</p>
                </div>
            ) : (
                <div className="rounded-xl border border-[#E3E5E0] bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#EDEFEA]">
                        <p className="text-sm font-medium text-[#14171A]">Hand over cash</p>
                        <p className="text-xs text-[#6B7068] mt-0.5">Partial is fine — the rest carries as debt.</p>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        {error && <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-lg px-3 py-2">{error}</p>}
                        {success && <p className="text-sm text-[#1F6F54] bg-[#E6F2EF] border border-[#C7E2DA] rounded-lg px-3 py-2">{success}</p>}

                        <div>
                            <label className="text-xs text-[#6B7068] block mb-1.5">Cashier</label>
                            <select value={cashier} onChange={(e) => setCashier(Number(e.target.value))}
                                className="w-full border border-[#E3E5E0] rounded-lg px-3 py-2.5 text-sm bg-white">
                                <option value="">Select who you're paying</option>
                                {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-[#6B7068] block mb-1.5">Amount handed over</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#9B9F98]">Rs</span>
                                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0" max={owed} min={0}
                                    className="w-full border border-[#E3E5E0] rounded-lg pl-10 pr-3 py-2.5 text-lg mono-num font-semibold" />
                            </div>
                            <div className="flex gap-2 mt-2">
  <button onClick={() => setAmount(owed.toFixed(2))}
    className="text-xs px-3 py-1.5 rounded-lg border border-[#E3E5E0] text-[#494D46] hover:bg-[#F5F6F4]">
    Full · Rs {owed.toFixed(0)}
  </button>
  <button onClick={() => setAmount((owed / 2).toFixed(2))}
    className="text-xs px-3 py-1.5 rounded-lg border border-[#E3E5E0] text-[#494D46] hover:bg-[#F5F6F4]">
    Half · Rs {(owed / 2).toFixed(0)}
  </button>
</div>
                        </div>

                        {amount && Number(amount) < owed && (
                            <p className="text-xs text-[#92610A] bg-[#FEF9E7] rounded-lg px-3 py-2">
                                Rs {(owed - Number(amount)).toFixed(0)} will carry forward as your debt.
                            </p>
                        )}

                        <button onClick={submit} disabled={submitting}
                            className="w-full text-sm font-medium px-4 py-3 rounded-lg bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-50">
                            {submitting ? "Submitting…" : "Submit to cashier"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, accent }: { label: string; value: number; accent?: string }) {
    return (
        <div className="flex items-center justify-between">
            <p className="text-sm text-[#494D46]">{label}</p>
            <p className="mono-num text-sm font-medium" style={{ color: accent || "#14171A" }}>
                {value < 0 ? "−" : ""}Rs {Math.abs(value).toFixed(0)}
            </p>
        </div>
    );
}