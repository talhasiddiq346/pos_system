"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import RoleBadge from "./RoleBadge";
import type { UserRow } from "@/lib/types";

const ADMIN_ROLES = ["branch_admin", "super_admin"];

type Branch = { id: number; name: string };

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function PasswordsPanel({
  currentUserId,
  viewerRole,
}: {
  currentUserId: number;
  viewerRole: string;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeId, setActiveId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const calls: Promise<any>[] = [api.get<UserRow[]>("/users")];
    if (viewerRole === "super_admin") calls.push(api.get<Branch[]>("/branches"));
    Promise.all(calls).then((results) => {
      setUsers(results[0].data);
      if (viewerRole === "super_admin") setBranches(results[1].data);
      setLoading(false);
    });
  }, []);

  function canReset(u: UserRow) {
    if (u.id === currentUserId) return false;
    if (viewerRole === "super_admin") return true;
    if (viewerRole === "branch_admin") return !ADMIN_ROLES.includes(u.role);
    return false;
  }

  function branchLabel(branchId: number | null) {
    if (branchId === null) return "Unassigned";
    const b = branches.find((b) => b.id === branchId);
    return b ? b.name : `Branch #${branchId}`;
  }

  async function handleReset(id: number) {
    setError("");
    setSuccess("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    try {
      await api.patch(`/users/${id}/password`, { new_password: newPassword });
      setSuccess("Password updated");
      setActiveId(null);
      setNewPassword("");
    } catch (err) {
      setError(errMsg(err));
    }
  }

  const manageable = users.filter(canReset);

  if (loading) return <p className="text-sm text-[#494D46]">Loading...</p>;

  return (
    <div className="bg-white border border-[#D0D3CB] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#D0D3CB]">
        <h2 className="font-medium text-[#1B1D1E]">Reset password</h2>
        <p className="text-xs text-[#494D46] mt-0.5">
          {viewerRole === "super_admin"
            ? "You can reset the password for any user, including unassigned staff."
            : "You can reset passwords for staff in your branch."}
        </p>
      </div>

      {error && <p className="mx-5 mt-3 text-sm text-[#9E3527] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}
      {success && <p className="mx-5 mt-3 text-sm text-[#1F6F54] bg-[#E6F2EF] border border-[#C7E2DA] rounded-md px-3 py-2">{success}</p>}

      {manageable.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[#494D46]">No users available.</p>
      ) : (
        <ul>
          {manageable.map((u) => (
            <li key={u.id} className="border-b border-[#EDEFEA] last:border-0 px-5 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-[#1B1D1E]">{u.name} <span className="text-[#494D46]">({u.email})</span></p>
                  <div className="flex items-center gap-2 mt-1">
                    <RoleBadge role={u.role} />
                    {viewerRole === "super_admin" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.branch_id === null ? "bg-[#FBEAE7] text-[#9E3527]" : "bg-[#F0F1ED] text-[#494D46]"}`}>
                        {branchLabel(u.branch_id)}
                      </span>
                    )}
                  </div>
                </div>

                {activeId === u.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm"
                    />
                    <button onClick={() => handleReset(u.id)} className="text-xs px-3 py-1.5 rounded-md bg-[#1B1D1E] text-white font-medium">Confirm</button>
                    <button onClick={() => { setActiveId(null); setNewPassword(""); }} className="text-xs px-3 py-1.5 rounded-md border border-[#C9CCC5] text-[#1B1D1E] font-medium">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setActiveId(u.id); setNewPassword(""); }} className="text-xs px-3 py-1.5 rounded-md border border-[#C9CCC5] text-[#1B1D1E] font-medium hover:bg-[#F5F6F4]">
                    Reset password
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}