"use client";
import { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { UserRow, StaffRole } from "@/lib/types";
import PersonPicker, { PersonChoice, emptyNewPerson } from "./PersonPicker";


type Branch = { id: number; name: string; address: string | null };

type StaffEntry = {
  key: string;
  role: StaffRole;
  person: PersonChoice;
};

const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  cashier: "Cashier",
  chef: "Chef",
  delivery: "Delivery Rider",
};

function newStaffEntry(role: StaffRole = "cashier"): StaffEntry {
  return { key: crypto.randomUUID(), role, person: emptyNewPerson() };
}

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function BranchesPanel() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newAdmin, setNewAdmin] = useState<PersonChoice>(emptyNewPerson());
  const [staffEntries, setStaffEntries] = useState<StaffEntry[]>([newStaffEntry("cashier"), newStaffEntry("chef")]);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [adminEditId, setAdminEditId] = useState<number | null>(null);
  const [adminChoice, setAdminChoice] = useState<PersonChoice>(emptyNewPerson());
  const assignableUsers = users.filter((u) => u.role !== "super_admin");

  async function loadAll() {
    setLoading(true);
    const [branchesRes, usersRes] = await Promise.all([
      api.get<Branch[]>("/branches"),
      api.get<UserRow[]>("/users"),
    ]);
    setBranches(branchesRes.data);
    setUsers(usersRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function adminFor(branchId: number) {
    return users.find((u) => u.branch_id === branchId && u.role === "branch_admin");
  }

  function staffFor(branchId: number) {
    return users.filter((u) => u.branch_id === branchId && u.role !== "branch_admin");
  }

  function resetCreateForm() {
  setNewName("");
  setNewAddress("");
  setNewAdmin(emptyNewPerson());
  setStaffEntries([newStaffEntry("cashier"), newStaffEntry("chef")]);
}
  function updateStaffEntry(key: string, patch: Partial<StaffEntry>) {
    setStaffEntries((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeStaffEntry(key: string) {
    setStaffEntries((list) => list.filter((s) => s.key !== key));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!staffEntries.some((s) => s.role === "cashier") || !staffEntries.some((s) => s.role === "chef")) {
  setError("A cashier and a chef are both required to create a branch");
  return;
}

    setCreating(true);
    try {
      await api.post("/branches", {
        name: newName,
        address: newAddress,
        admin: newAdmin,
        staff: staffEntries.map((s) => ({ role: s.role, ...s.person })),
      });
      resetCreateForm();
      setShowCreate(false);
      await loadAll();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleEditSave(id: number) {
    setError("");
    try {
      await api.patch(`/branches/${id}`, { name: editName, address: editAddress });
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this branch? Only an empty branch can be deleted.")) return;
    setError("");
    try {
      await api.delete(`/branches/${id}`);
      await loadAll();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function handleAdminChange(branchId: number) {
    setError("");
    try {
      await api.patch(`/branches/${branchId}/admin`, { admin: adminChoice });
      setAdminEditId(null);
      setAdminChoice(emptyNewPerson());
      await loadAll();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (loading) return <p className="text-sm text-[#6B7068]">Loading branches...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[#B3402F] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0] flex items-center justify-between">
          <h2 className="font-medium text-[#1B1D1E]">Branches</h2>
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="text-sm px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white hover:bg-[#27695A]"
          >
            {showCreate ? "Cancel" : "+ Add branch"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="px-5 py-4 border-b border-[#E3E5E0] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input placeholder="Branch name" value={newName} onChange={(e) => setNewName(e.target.value)} className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm" required />
              <input placeholder="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm" />
            </div>

            <div>
              <p className="text-xs font-medium text-[#6B7068] uppercase tracking-wide mb-1.5">Branch admin</p>
              <PersonPicker choice={newAdmin} onChange={setNewAdmin} users={assignableUsers} branches={branches} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-[#6B7068] uppercase tracking-wide">
                  Staff <span className="text-[#B3402F]">(at least one cashier required)</span>
                </p>
                <button
                  type="button"
                  onClick={() => setStaffEntries((list) => [...list, newStaffEntry("cashier")])}
                  className="text-xs px-2.5 py-1 rounded-md border border-[#E3E5E0] hover:bg-[#F5F6F4]"
                >
                  + Add staff member
                </button>
              </div>

              <div className="space-y-2">
                {staffEntries.map((entry) => (
                  <div key={entry.key} className="border border-[#E3E5E0] rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={entry.role}
                        onChange={(e) => updateStaffEntry(entry.key, { role: e.target.value as StaffRole })}
                        className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm"
                      >
                        {Object.entries(STAFF_ROLE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>

                      {staffEntries.length > 1 && (
                        <button type="button" onClick={() => removeStaffEntry(entry.key)} className="text-xs text-[#B3402F] hover:underline">
                          Remove
                        </button>
                      )}
                    </div>

                    <PersonPicker choice={entry.person} onChange={(person) => updateStaffEntry(entry.key, { person })} users={assignableUsers} branches={branches} />
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={creating} className="text-sm px-4 py-1.5 rounded-md bg-[#1B1D1E] text-white hover:bg-black disabled:opacity-50">
              {creating ? "Creating branch..." : "Create branch"}
            </button>
          </form>
        )}

        {branches.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#6B7068]">No branches yet.</p>
        ) : (
          <ul>
            {branches.map((b) => {
              const admin = adminFor(b.id);
              const staff = staffFor(b.id);
              const isEditing = editingId === b.id;
              const isAdminEditing = adminEditId === b.id;

              return (
                <li key={b.id} className="border-b border-[#F0F1EE] last:border-0 px-5 py-4">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm" />
                        <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSave(b.id)} className="text-sm px-3 py-1.5 rounded-md bg-[#2F7D6B] text-white">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-sm px-3 py-1.5 rounded-md border border-[#E3E5E0]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#1B1D1E]">
                          <span className="mono-num text-[#6B7068] mr-2">#{b.id}</span>
                          {b.name}
                        </p>
                        <p className="text-xs text-[#6B7068]">{b.address || "No address on file"}</p>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {admin ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E6F2EF] text-[#1F6F54]">
                              Admin: {admin.name}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#FBEAE7] text-[#B3402F]">
                              No admin assigned
                            </span>
                          )}
                          {staff.map((s) => (
                            <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-[#F5F6F4] text-[#6B7068]">
                              {s.role}: {s.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => { setAdminEditId(isAdminEditing ? null : b.id); setAdminChoice(emptyNewPerson()); }} className="text-xs px-2.5 py-1 rounded-md border border-[#E3E5E0] hover:bg-[#F5F6F4]">
                          {isAdminEditing ? "Cancel" : "Change admin"}
                        </button>
                        <button onClick={() => { setEditingId(b.id); setEditName(b.name); setEditAddress(b.address || ""); }} className="text-xs px-2.5 py-1 rounded-md border border-[#E3E5E0] hover:bg-[#F5F6F4]">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(b.id)} className="text-xs px-2.5 py-1 rounded-md border border-[#F0C9C2] text-[#B3402F] hover:bg-[#FBEAE7]">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {isAdminEditing && (
                    <div className="mt-3 space-y-2">
                      <PersonPicker choice={adminChoice} onChange={setAdminChoice} users={assignableUsers} branches={branches} />
                      <button onClick={() => handleAdminChange(b.id)} className="text-sm px-3 py-1.5 rounded-md bg-[#1B1D1E] text-white">
                        Confirm
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}