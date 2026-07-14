"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import type { Role } from "@/lib/types";

type Report = { id: string; name: string; desc: string; icon: string };
type Branch = { id: number; name: string };

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || err.message || "Download failed";
  return "Download failed";
}

export default function DownloadReports({
  filters,
  viewerRole,
  branches,
  branchFilter,
}: {
  filters: any;
  viewerRole: Role;
  branches: Branch[];
  branchFilter: number | "all";
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState("cashier");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Report[]>("/reports/pdf/available")
      .then((r) => setReports(r.data))
      .catch(() => setError("Could not load report list"));
  }, []);

  async function download(reportId: string) {
    setDownloading(reportId);
    setError("");
    try {
      const params: any = {
        from: filters.from,
        to: filters.to,
        branch_id: filters.branch_id ?? "all",
      };
      if (reportId === "staff") params.staff_role = staffRole;

      // Use the shared axios instance (has baseURL + credentials + auth interceptor)
      const res = await api.get(`/reports/pdf/${reportId}`, {
        params,
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tandoor-${reportId}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      setError(errMsg(err));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDE8E1]">
        <h2 className="text-lg font-bold text-[#1A1613]">📄 Download Reports</h2>
        <p className="text-xs text-[#A89F94] mt-0.5">Export as PDF for records</p>
      </div>

      {error && (
        <div className="mx-5 mt-3 text-sm text-[#DC2626] bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.length === 0 ? (
          <p className="col-span-full text-sm text-[#A89F94] py-6 text-center">
            Loading reports...
          </p>
        ) : (
          reports.map((r) => (
            <div
              key={r.id}
              className="border border-[#EDE8E1] rounded-xl p-4 hover:border-[#E8542F] transition"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 bg-[#FFF0E8] rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1A1613] text-sm mb-0.5">{r.name}</p>
                  <p className="text-xs text-[#A89F94] leading-snug">{r.desc}</p>
                </div>
              </div>

              {r.id === "staff" && (
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full text-xs border border-[#EDE8E1] rounded-lg px-2 py-1.5 mb-2 bg-white"
                >
                  <option value="cashier">💵 Cashiers</option>
                  <option value="chef">👨‍🍳 Chefs</option>
                  <option value="delivery">🛵 Riders</option>
                  <option value="call_center">📞 Call Center</option>
                </select>
              )}

              <button
                onClick={() => download(r.id)}
                disabled={downloading === r.id}
                className="w-full bg-[#1A1613] text-white text-sm font-semibold py-2 rounded-lg hover:bg-[#2A231D] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {downloading === r.id ? (
                  "Generating..."
                ) : (
                  <>
                    <span>⬇</span> Download PDF
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}