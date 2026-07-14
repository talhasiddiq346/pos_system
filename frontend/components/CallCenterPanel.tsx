"use client";
import { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { UserRow } from "@/lib/types";

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function CallCenterPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<UserRow[]>("/users");
    setUsers(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const callCenterStaff = users.filter((u) => u.role === "call_center");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/users", { name, email, password, role: "call_center" });
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: number) {
    if (!confirm("Remove this call center agent?")) return;
    setError("");
    try {
      await api.delete(`/users/${id}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (loading) return <p className="text-sm text-[#6B7068]">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-[#B3402F] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">{error}</p>}

      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0]">
          <h2 className="font-medium text-[#1B1D1E]">Add call center agent</h2>
          <p className="text-xs text-[#6B7068] mt-0.5">Call center agents are not tied to a specific branch.</p>
        </div>
        <form onSubmit={handleAdd} className="px-5 py-4 flex flex-wrap items-center gap-2">
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm" required />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm" required />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm" required />
          <button type="submit" disabled={submitting} className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-50">
            {submitting ? "Adding..." : "Add agent"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0]">
          <h2 className="font-medium text-[#1B1D1E]">Call center agents</h2>
        </div>
        {callCenterStaff.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#6B7068]">No call center agents yet.</p>
        ) : (
          <ul>
            {callCenterStaff.map((u) => (
              <li key={u.id} className="border-b border-[#F0F1EE] last:border-0 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#1B1D1E]">{u.name}</p>
                  <p className="text-xs text-[#6B7068]">{u.email}</p>
                </div>
                <button onClick={() => handleRemove(u.id)} className="text-xs px-2.5 py-1 rounded-md border border-[#F0C9C2] text-[#B3402F] hover:bg-[#FBEAE7]">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}