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

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white border border-[#E3E5E0] h-48 animate-pulse" />
        <div className="rounded-2xl bg-white border border-[#E3E5E0] h-64 animate-pulse" />
      </div>
    );
  }
  if (!summary) return null;

  const owed = summary.remaining_owed;
  const settled = owed <= 0;

  return (
    <div className="space-y-3">
      {/* Reconciliation card */}
      <div className="rounded-2xl border border-[#E3E5E0] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EDEFEA] flex items-center justify-between">
          <p className="text-sm font-semibold text-[#14171A]">💰 Cash Reconciliation</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Row label="Collected today" value={summary.total_cash_collected} />
          {summary.previous_debt > 0 && (
            <Row label="Previous debt carried" value={summary.previous_debt} accent="#9E3527" />
          )}
          {summary.total_given_today > 0 && (
            <Row label="Already submitted" value={-summary.total_given_today} accent="#1F6F54" />
          )}
          <div className="h-px bg-[#EDEFEA]" />
          <div className="flex items-center justify-between pt-1">
            <p className="text-base font-bold text-[#14171A]">You owe</p>
            <p className="mono-num text-3xl font-bold" style={{ color: settled ? "#1F6F54" : "#E8542F" }}>
              Rs {owed.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {settled ? (
        <div className="rounded-2xl border border-[#C7E2DA] bg-[#E6F2EF] px-6 py-10 text-center">
          <div className="w-16 h-16 rounded-full bg-white mx-auto flex items-center justify-center text-3xl shadow-sm">✓</div>
          <p className="text-lg font-bold text-[#1F6F54] mt-4">All Settled</p>
          <p className="text-sm text-[#3B7A66] mt-1">No cash pending. Great work!</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E3E5E0] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EDEFEA]">
            <p className="text-base font-semibold text-[#14171A]">Hand over cash</p>
            <p className="text-xs text-[#6B7068] mt-0.5">Partial is fine — the rest carries as debt.</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {error && (
              <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-3 py-2.5">{error}</p>
            )}
            {success && (
              <p className="text-sm text-[#1F6F54] bg-[#E6F2EF] border border-[#C7E2DA] rounded-xl px-3 py-2.5">{success}</p>
            )}

            {/* Cashier picker */}
            <div>
              <label className="text-xs font-medium text-[#6B7068] uppercase tracking-wider block mb-2">Cashier</label>
              <select
                value={cashier}
                onChange={(e) => setCashier(Number(e.target.value))}
                className="w-full h-12 border border-[#E3E5E0] rounded-xl px-3 text-base bg-white focus:outline-none focus:border-[#E8542F]"
              >
                <option value="">Select who you're paying</option>
                {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Amount input — big, numeric */}
            <div>
              <label className="text-xs font-medium text-[#6B7068] uppercase tracking-wider block mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#9B9F98] font-medium">Rs</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  max={owed}
                  min={0}
                  className="w-full h-14 border border-[#E3E5E0] rounded-xl pl-12 pr-4 text-2xl mono-num font-bold focus:outline-none focus:border-[#E8542F]"
                />
              </div>

              {/* Quick amount buttons — bigger */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => setAmount(owed.toFixed(2))}
                  className="h-12 rounded-xl border border-[#E3E5E0] text-sm font-semibold text-[#14171A] hover:bg-[#F5F6F4] active:scale-[0.98] transition-all"
                >
                  Full · Rs {owed.toFixed(0)}
                </button>
                <button
                  onClick={() => setAmount((owed / 2).toFixed(2))}
                  className="h-12 rounded-xl border border-[#E3E5E0] text-sm font-semibold text-[#494D46] hover:bg-[#F5F6F4] active:scale-[0.98] transition-all"
                >
                  Half · Rs {(owed / 2).toFixed(0)}
                </button>
              </div>
            </div>

            {amount && Number(amount) < owed && (
              <div className="text-sm text-[#92610A] bg-[#FEF9E7] border border-[#F0D99A] rounded-xl px-3 py-2.5">
                Rs {(owed - Number(amount)).toFixed(0)} will carry as debt
              </div>
            )}

            {/* Submit — big, full width */}
            <button
              onClick={submit}
              disabled={submitting || !amount || !cashier}
              className="w-full h-14 rounded-xl bg-[#E8542F] text-white font-semibold text-base hover:bg-[#D64822] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
            >
              {submitting ? "Submitting..." : "Submit to cashier"}
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
      <p className="mono-num text-base font-semibold" style={{ color: accent || "#14171A" }}>
        {value < 0 ? "−" : ""}Rs {Math.abs(value).toFixed(0)}
      </p>
    </div>
  );
}