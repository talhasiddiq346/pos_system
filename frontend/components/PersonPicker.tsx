"use client";
import type { UserRow } from "@/lib/types";

export type PersonChoice =
  | { mode: "new"; name: string; email: string; password: string }
  | { mode: "existing"; user_id: number | "" };

export function emptyNewPerson(): PersonChoice {
  return { mode: "new", name: "", email: "", password: "" };
}

type Branch = { id: number; name: string };

function statusLabel(u: UserRow, branches: Branch[]) {
  if (u.branch_id === null) return "Unassigned";
  const branch = branches.find((b) => b.id === u.branch_id);
  const branchName = branch ? branch.name : `Branch #${u.branch_id}`;
  return `${branchName} · ${u.role.replace("_", " ")}`;
}

export default function PersonPicker({
  choice,
  onChange,
  users,
  branches = [],
}: {
  choice: PersonChoice;
  onChange: (c: PersonChoice) => void;
  users: UserRow[];
  branches?: Branch[];
}) {
  return (
    <div className="space-y-2 bg-[#F5F6F4] rounded-md p-3 border border-[#D0D3CB]">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={choice.mode === "new"} onChange={() => onChange(emptyNewPerson())} />
          Create new user
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={choice.mode === "existing"}
            onChange={() => onChange({ mode: "existing", user_id: "" })}
          />
          Select existing user
        </label>
      </div>

      {choice.mode === "new" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input placeholder="Full name" value={choice.name} onChange={(e) => onChange({ ...choice, name: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" required />
          <input placeholder="Email" type="email" value={choice.email} onChange={(e) => onChange({ ...choice, email: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" required />
          <input placeholder="Password" type="password" value={choice.password} onChange={(e) => onChange({ ...choice, password: e.target.value })} className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm" required />
        </div>
      ) : (
        <select
          value={choice.user_id}
          onChange={(e) => onChange({ mode: "existing", user_id: Number(e.target.value) })}
          className="border border-[#D0D3CB] rounded-md px-2.5 py-1.5 text-sm w-full"
          required
        >
          <option value="">Select a user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email}) — {statusLabel(u, branches)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}