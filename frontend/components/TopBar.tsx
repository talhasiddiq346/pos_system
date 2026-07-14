"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/roles";
import RoleBadge from "./RoleBadge";

type User = { id: number; name: string; role: string; branch_id: number | null };

export default function TopBar({ user }: { user: User }) {
  const router = useRouter();

  async function handleLogout() {
    await api.post("/auth/logout");
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-dashed border-[#E3E5E0]">
      <div>
        <h1 className="text-lg font-medium text-[#1B1D1E]">Welcome back, {user.name}</h1>
        <p className="text-sm text-[#6B7068]">
          {ROLE_LABEL[user.role] ?? user.role}
          {user.branch_id ? ` · Branch #${user.branch_id}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <RoleBadge role={user.role} />
        <button
          onClick={handleLogout}
          className="text-sm px-3 py-1.5 rounded-md border border-[#E3E5E0] text-[#1B1D1E] hover:bg-[#F5F6F4]"
        >
          Log out
        </button>
      </div>
    </header>
  );
}