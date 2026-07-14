"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import RoleBadge from "./RoleBadge";
import type { UserRow } from "@/lib/types";

type Branch = { id: number; name: string };

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function UnassignedPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [targetBranch, setTargetBranch] = useState<number | "">("");

  async function load() {
    setLoading(true);
    const [usersRes, branchesRes] = await Promise.all([
      api.get<UserRow[]>("/users"),
      api.get<Branch[]>("/branches"),
    ]);
    setUsers(usersRes.data);
    setBranches(branchesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const unassigned = users.filter(
    (u) => ["branch_admin", "cashier", "chef"].includes(u.role) && u.branch_id === null
  );

  async function handleAssign(id: number, role: string) {
    setError("");
    setSuccess("");
    if (!targetBranch) {
      setError("Select a branch");
      return;
    }
    try {
      await api.patch(`/users/${id}/reassign`, { role, branch_id: targetBranch });
      setSuccess("Assigned to branch");
      setAssigningId(null);
      setTargetBranch("");
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Permanently delete this account?")) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/users/${id}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (loading) return <p className="text-sm text-[#6B7068]">Loading...</p>;

  return (
    <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E3E5E0]">
        <h2 className="font-medium text-[#1B1D1E]">Unassigned</h2>
        <p className="text-xs text-[#6B7068] mt-0.5">
          People who were replaced, or whose branch was deleted, land here. Assign them to a branch or delete the account.
        </p>
      </div>

      {error && <p className="mx-5 mt-3 text-sm text-[#B3402F] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}
      {success && <p className="mx-5 mt-3 text-sm text-[#1F6F54] bg-[#E6F2EF] border border-[#C7E2DA] rounded-md px-3 py-2">{success}</p>}

      {unassigned.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[#6B7068]">Nobody is unassigned right now.</p>
      ) : (
        <ul>
          {unassigned.map((u) => (
            <li key={u.id} className="border-b border-[#F0F1EE] last:border-0 px-5 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-[#1B1D1E]">{u.name} <span className="text-[#6B7068]">({u.email})</span></p>
                  <div className="mt-1"><RoleBadge role={u.role} /></div>
                </div>

                <div className="flex items-center gap-2">
                  {u.role === "branch_admin" ? (
                    <span className="text-xs text-[#6B7068]">Use the Branches tab to assign as admin</span>
                  ) : assigningId === u.id ? (
                    <>
                      <select
                        value={targetBranch}
                        onChange={(e) => setTargetBranch(Number(e.target.value))}
                        className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm"
                      >
                        <option value="">Select branch</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button onClick={() => handleAssign(u.id, u.role)} className="text-xs px-2.5 py-1 rounded-md bg-[#1B1D1E] text-white">Confirm</button>
                      <button onClick={() => setAssigningId(null)} className="text-xs px-2.5 py-1 rounded-md border border-[#E3E5E0]">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => { setAssigningId(u.id); setTargetBranch(""); }} className="text-xs px-2.5 py-1 rounded-md border border-[#E3E5E0] hover:bg-[#F5F6F4]">
                      Assign to branch
                    </button>
                  )}
                  <button onClick={() => handleDelete(u.id)} className="text-xs px-2.5 py-1 rounded-md border border-[#F0C9C2] text-[#B3402F] hover:bg-[#FBEAE7]">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}