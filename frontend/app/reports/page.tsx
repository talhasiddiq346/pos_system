"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { api } from "@/lib/api";
import ReportsDashboard from "@/components/reports/ReportsDashboard";
import type { Role } from "@/lib/types";

export default function ReportsPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => {
        const userRole = r.data.role;
        if (!["super_admin", "branch_admin"].includes(userRole)) {
          // Not authorized — redirect to login
          router.replace("/login");
          return;
        }
        setRole(userRole);
        setBranchId(r.data.branch_id);
        setLoading(false);
      })
      .catch((err) => {
        // Not logged in or session expired
        if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
          router.replace("/login");
        } else {
          setError("Failed to load. Please try again.");
          setLoading(false);
        }
      });
  }, [router]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#FAF8F5", fontFamily: "'DM Sans',-apple-system,sans-serif" }}
      >
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#E8542F] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#A89F94]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "#FAF8F5", fontFamily: "'DM Sans',-apple-system,sans-serif" }}
      >
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-8 max-w-sm text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-[#1A1613] font-semibold mb-2">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="mt-4 bg-[#E8542F] text-white text-sm font-semibold px-5 py-2 rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!role) return null;

  return <ReportsDashboard viewerRole={role} viewerBranchId={branchId} />;
}