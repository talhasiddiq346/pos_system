"use client";
import { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import RoleBadge from "./RoleBadge";
import UnassignedPanel from "./UnassignedPanel";
import type { UserRow, Role } from "@/lib/types";

type Branch = { id: number; name: string };
type StaffRole = "cashier" | "chef" | "delivery";
type StaffTab = "staff" | "unassigned";

const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  cashier: "Cashier",
  chef: "Chef",
  delivery: "Delivery Rider",
};

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

function validatePakistaniPhone(val: string): boolean {
  const cleaned = val.replace(/[\s\-\(\)]/g, "");
  return (
    /^03[0-9]{9}$/.test(cleaned) ||
    /^\+923[0-9]{9}$/.test(cleaned) ||
    /^923[0-9]{9}$/.test(cleaned)
  );
}

export default function StaffPanel({
  viewerRole,
  viewerBranchId,
}: {
  viewerRole: Role;
  viewerBranchId: number | null;
}) {
  // Sub-tab: only super_admin can see unassigned
  const [activeTab, setActiveTab] = useState<StaffTab>("staff");
  const [unassignedCount, setUnassignedCount] = useState<number>(0);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [branchId, setBranchId] = useState<number | "">(
    viewerRole === "branch_admin" ? viewerBranchId ?? "" : ""
  );
  const [role, setRole] = useState<StaffRole>("cashier");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const calls: Promise<any>[] = [api.get<UserRow[]>("/users")];
    if (viewerRole === "super_admin") calls.push(api.get<Branch[]>("/branches"));
    const results = await Promise.all(calls);
    setUsers(results[0].data);
    if (viewerRole === "super_admin") {
      setBranches(results[1].data);
      // Count unassigned staff for badge
      const unassigned = results[0].data.filter(
        (u: UserRow) =>
          u.branch_id === null &&
          ["cashier", "chef", "delivery"].includes(u.role)
      );
      setUnassignedCount(unassigned.length);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const staff = users.filter((u) =>
    ["branch_admin", "cashier", "chef", "delivery"].includes(u.role)
  );

  function branchName(id: number | null) {
    return branches.find((b) => b.id === id)?.name ?? (id ?? "—");
  }

  function handlePhoneChange(val: string) {
    setPhone(val);
    if (val && !validatePakistaniPhone(val)) {
      setPhoneError("Valid Pakistani number chahiye (e.g. 0300-1234567)");
    } else {
      setPhoneError("");
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (viewerRole === "super_admin" && !branchId) {
      setError("Select a branch first");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    if (!validatePakistaniPhone(phone)) {
      setError("Valid Pakistani number chahiye (e.g. 0300-1234567)");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/users", {
        name,
        email,
        password,
        role,
        phone,
        branch_id: viewerRole === "super_admin" ? branchId : undefined,
      });
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setPhoneError("");
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: number) {
    if (!confirm("Remove this staff member?")) return;
    setError("");
    try {
      await api.delete(`/users/${id}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (loading) return <p className="text-sm text-[#494D46]">Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Sub-tabs — only super_admin sees Unassigned */}
      {viewerRole === "super_admin" && (
        <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
          <div className="flex border-b border-[#D0D3CB]">
            <button
              onClick={() => setActiveTab("staff")}
              className={`text-sm font-semibold px-5 py-3 border-b-2 transition ${
                activeTab === "staff"
                  ? "border-[#2F7D6B] text-[#2F7D6B] bg-[#F5F6F4]"
                  : "border-transparent text-[#494D46] hover:text-[#1B1D1E]"
              }`}
            >
              👥 Staff
            </button>
            <button
              onClick={() => setActiveTab("unassigned")}
              className={`text-sm font-semibold px-5 py-3 border-b-2 transition flex items-center gap-2 ${
                activeTab === "unassigned"
                  ? "border-[#2F7D6B] text-[#2F7D6B] bg-[#F5F6F4]"
                  : "border-transparent text-[#494D46] hover:text-[#1B1D1E]"
              }`}
            >
              🗂 Unassigned
              {unassignedCount > 0 && (
                <span className="text-xs bg-[#9E3527] text-white px-2 py-0.5 rounded-full font-bold">
                  {unassignedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Unassigned tab content */}
      {activeTab === "unassigned" && viewerRole === "super_admin" ? (
        <UnassignedPanel />
      ) : (
        <>
          {error && (
            <p className="text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Add staff form */}
          <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D0D3CB]">
              <h2 className="font-medium text-[#1B1D1E]">Add staff</h2>
              <p className="text-xs text-[#494D46] mt-0.5">
                A branch can have multiple cashiers, chefs and delivery riders.
              </p>
            </div>
            <form onSubmit={handleAdd} className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {viewerRole === "super_admin" && (
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(Number(e.target.value))}
                    className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
                >
                  {Object.entries(STAFF_ROLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
                  required
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2 items-start">
                <input
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
                  required
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 border border-[#D0D3CB] rounded-md overflow-hidden">
                    <span className="px-2 py-1.5 bg-[#F5F6F4] border-r border-[#D0D3CB] text-sm">🇵🇰</span>
                    <input
                      placeholder="03XX-XXXXXXX"
                      type="tel"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className={`px-2.5 py-1.5 text-sm focus:outline-none w-36 ${
                        phoneError ? "bg-[#FBEAE7]" : ""
                      }`}
                      required
                    />
                  </div>
                  {phoneError && <p className="text-xs text-[#9E3527]">{phoneError}</p>}
                  {!phoneError && phone && <p className="text-xs text-[#1F6F54]">✓ Valid number</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting || !!phoneError}
                  className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add staff member"}
                </button>
              </div>
            </form>
          </div>

          {/* Staff list */}
          <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D0D3CB]">
              <h2 className="font-medium text-[#1B1D1E]">Staff</h2>
            </div>
            {staff.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#494D46]">No staff yet.</p>
            ) : (
              <ul>
                {staff.map((u) => (
                  <li
                    key={u.id}
                    className="border-b border-[#F0F1EE] last:border-0 px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div>
                      <p className="text-sm text-[#1B1D1E]">
                        {u.name}
                        <span className="text-[#6B7068]"> ({u.email})</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <RoleBadge role={u.role} />
                        {(u as any).phone && (
                          <span className="text-xs text-[#494D46]">📞 {(u as any).phone}</span>
                        )}
                        {viewerRole === "super_admin" && (
                          <span className="text-xs mono-num text-[#6B7068]">
                            {branchName(u.branch_id)}
                          </span>
                        )}
                      </div>
                    </div>

                    {u.role === "branch_admin" ? (
                      <span className="text-xs text-[#6B7068]">Managed in Branches tab</span>
                    ) : (
                      <button
                        onClick={() => handleRemove(u.id)}
                        className="text-xs px-2.5 py-1 rounded-md border border-[#F0C9C2] text-[#9E3527] hover:bg-[#FBEAE7]"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}