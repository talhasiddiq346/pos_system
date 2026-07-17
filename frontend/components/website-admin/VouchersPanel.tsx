"use client";
import { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import { api } from "@/lib/api";

type DiscountType = "percent" | "fixed";
type Voucher = {
  id: number;
  code: string;
  label: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_cap: number | null;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

type FormState = {
  code: string;
  label: string;
  discount_type: DiscountType;
  discount_value: string;
  max_discount_cap: string;
  min_order_amount: string;
  max_uses: string;
  expires_at: string;
};

function emptyForm(): FormState {
  return {
    code: "", label: "", discount_type: "percent", discount_value: "",
    max_discount_cap: "", min_order_amount: "", max_uses: "", expires_at: "",
  };
}

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

function fmtMoney(n: number) {
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#6B7068] uppercase tracking-wide block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#2F7D6B]";

const todayStr = new Date().toISOString().slice(0, 10);

export default function VouchersPanel() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<Voucher[]>("/settings/vouchers");
    setVouchers(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toPayload(f: FormState) {
    return {
      code: f.code.trim(),
      label: f.label.trim() || null,
      discount_type: f.discount_type,
      discount_value: Number(f.discount_value),
      max_discount_cap: f.max_discount_cap.trim() ? Number(f.max_discount_cap) : null,
      min_order_amount: f.min_order_amount.trim() ? Number(f.min_order_amount) : 0,
      max_uses: f.max_uses.trim() ? Number(f.max_uses) : null,
      expires_at: f.expires_at || null,
    };
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.expires_at && form.expires_at < todayStr) {
      setError("Expiry date can't be in the past");
      return;
    }
    setCreating(true);
    try {
      await api.post("/settings/vouchers", toPayload(form));
      setForm(emptyForm());
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(v: Voucher) {
    setEditingId(v.id);
    setEditForm({
      code: v.code,
      label: v.label || "",
      discount_type: v.discount_type,
      discount_value: String(v.discount_value),
      max_discount_cap: v.max_discount_cap !== null ? String(v.max_discount_cap) : "",
      min_order_amount: String(v.min_order_amount),
      max_uses: v.max_uses !== null ? String(v.max_uses) : "",
      expires_at: v.expires_at ? v.expires_at.slice(0, 10) : "",
    });
  }

  async function handleEditSave(id: number) {
    setError("");
    const original = vouchers.find((v) => v.id === id);
    const originalExpiry = original?.expires_at ? original.expires_at.slice(0, 10) : "";
    if (editForm.expires_at && editForm.expires_at < todayStr && editForm.expires_at !== originalExpiry) {
      setError("Expiry date can't be in the past");
      return;
    }
    setSavingEdit(true);
    try {
      const { code, ...patch } = toPayload(editForm);
      await api.patch(`/settings/vouchers/${id}`, patch);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleActive(v: Voucher) {
    setError("");
    try {
      await api.patch(`/settings/vouchers/${v.id}`, { is_active: !v.is_active });
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this voucher? This can't be undone.")) return;
    setError("");
    try {
      await api.delete(`/settings/vouchers/${id}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (loading) return <p className="text-sm text-[#6B7068]">Loading vouchers...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[#B3402F] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-medium text-[#1B1D1E] text-lg">Vouchers</h2>
          <p className="text-xs text-[#6B7068] mt-0.5">
            For influencer / promo campaigns — validated and enforced on the server at checkout.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="text-sm px-4 py-2 rounded-md bg-[#2F7D6B] text-white font-medium hover:bg-[#27695A] shadow-sm"
        >
          {showCreate ? "Cancel" : "+ New voucher"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-[#E3E5E0] rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Code">
              <input
                placeholder="INFLUENCER10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className={`${inputCls} font-mono`}
                required
              />
            </Field>
            <Field label="Label (influencer / campaign name)">
              <input
                placeholder="e.g. @foodie_khan"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Discount type">
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as DiscountType })}
                className={inputCls}
              >
                <option value="percent">% Percent</option>
                <option value="fixed">Rs. Fixed</option>
              </select>
            </Field>
            <Field label={form.discount_type === "percent" ? "Discount %" : "Discount Rs."}>
              <input
                type="number" min="0" step="0.01"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Max cap Rs.">
              <input
                placeholder="No cap"
                type="number" min="0" step="0.01"
                value={form.max_discount_cap}
                onChange={(e) => setForm({ ...form, max_discount_cap: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Min order Rs.">
              <input
                placeholder="0"
                type="number" min="0" step="0.01"
                value={form.min_order_amount}
                onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max uses">
              <input
                placeholder="Unlimited"
                type="number" min="1" step="1"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Expiry date">
              <input
                type="date"
                min={todayStr}
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="text-sm px-4 py-2 rounded-md bg-[#1B1D1E] text-white font-medium hover:bg-black disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create voucher"}
          </button>
        </form>
      )}

      {vouchers.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D0D3CB] rounded-lg px-5 py-10 text-center text-sm text-[#6B7068]">
          No vouchers yet — create one to run an influencer or promo campaign.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {vouchers.map((v) => {
            const isEditing = editingId === v.id;
            const isExpired = v.expires_at ? new Date(v.expires_at) < new Date() : false;
            const isMaxedOut = v.max_uses !== null && v.used_count >= v.max_uses;

            if (isEditing) {
              return (
                <div key={v.id} className="lg:col-span-2 bg-white border border-[#2F7D6B] rounded-lg p-5 space-y-3">
                  <p className="font-mono font-semibold text-[#1B1D1E]">{v.code}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Label">
                      <input
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Discount type">
                      <select
                        value={editForm.discount_type}
                        onChange={(e) => setEditForm({ ...editForm, discount_type: e.target.value as DiscountType })}
                        className={inputCls}
                      >
                        <option value="percent">% Percent</option>
                        <option value="fixed">Rs. Fixed</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Discount value">
                      <input
                        type="number" min="0" step="0.01"
                        value={editForm.discount_value}
                        onChange={(e) => setEditForm({ ...editForm, discount_value: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Max cap Rs.">
                      <input
                        type="number" min="0" step="0.01"
                        value={editForm.max_discount_cap}
                        onChange={(e) => setEditForm({ ...editForm, max_discount_cap: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Min order Rs.">
                      <input
                        type="number" min="0" step="0.01"
                        value={editForm.min_order_amount}
                        onChange={(e) => setEditForm({ ...editForm, min_order_amount: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Max uses">
                      <input
                        type="number" min="1" step="1"
                        value={editForm.max_uses}
                        onChange={(e) => setEditForm({ ...editForm, max_uses: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Expiry date">
                    <input
                      type="date"
                      min={todayStr}
                      value={editForm.expires_at}
                      onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                      className={`${inputCls} max-w-50`}
                    />
                  </Field>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleEditSave(v.id)} disabled={savingEdit} className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white font-medium disabled:opacity-50">
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-sm px-4 py-1.5 rounded-md border border-[#E3E5E0]">
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={v.id}
                className={`bg-white border rounded-lg p-4 flex flex-col gap-3 ${
                  v.is_active && !isExpired && !isMaxedOut ? "border-[#E3E5E0]" : "border-[#E3E5E0] opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-[#1B1D1E] text-base tracking-wide">{v.code}</p>
                    {v.label && <p className="text-xs text-[#6B7068] mt-0.5">{v.label}</p>}
                  </div>
                  <button
                    onClick={() => handleToggleActive(v)}
                    className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                      v.is_active
                        ? "bg-[#E6F2EF] text-[#1F6F54] hover:bg-[#D6ECE5]"
                        : "bg-[#F5F6F4] text-[#6B7068] hover:bg-[#EDEEEA]"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${v.is_active ? "bg-[#1F6F54]" : "bg-[#A2A69C]"}`} />
                    {v.is_active ? "Active" : "Hidden"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[#2F7D6B]">
                    {v.discount_type === "percent" ? `${v.discount_value}% OFF` : `${fmtMoney(v.discount_value)} OFF`}
                  </span>
                  {v.max_discount_cap !== null && (
                    <span className="text-[11px] text-[#6B7068] bg-[#F5F6F4] px-2 py-0.5 rounded-full">
                      cap {fmtMoney(v.max_discount_cap)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-[#6B7068]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#A2A69C]">Min order</p>
                    <p className="text-[#1B1D1E] font-medium">{fmtMoney(v.min_order_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#A2A69C]">Expiry</p>
                    <p className={isExpired ? "text-[#B3402F] font-medium" : "text-[#1B1D1E] font-medium"}>
                      {v.expires_at ? new Date(v.expires_at).toLocaleDateString() : "Never"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#A2A69C]">Used</p>
                    <p className={isMaxedOut ? "text-[#B3402F] font-medium" : "text-[#1B1D1E] font-medium"}>
                      {v.used_count}{v.max_uses !== null ? ` / ${v.max_uses}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 border-t border-[#F0F1EE] mt-1">
                  <button onClick={() => startEdit(v)} className="text-xs px-3 py-1.5 rounded-md border border-[#E3E5E0] hover:bg-[#F5F6F4] mt-2">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(v.id)} className="text-xs px-3 py-1.5 rounded-md border border-[#F0C9C2] text-[#B3402F] hover:bg-[#FBEAE7] mt-2">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
