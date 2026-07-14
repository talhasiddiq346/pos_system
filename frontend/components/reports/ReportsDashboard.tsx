"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/components/shared/useSocket";
import type { Role } from "@/lib/types";
import StatCards from "@/components/reports/StatCards";
import RevenueTrendChart from "@/components/reports/RevenueTrendChart";
import SourceComparison from "@/components/reports/SourceComparison";
import BranchComparison from "@/components/reports/BranchComparison";
import BestSellers from "@/components/reports/BestSellers";
import CategoryChart from "@/components/reports/CategoryChart";
import HourlyHeatmap from "@/components/reports/HourlyHeatmap";
import PaymentChart from "@/components/reports/PaymentChart";
import StaffPerformance from "@/components/reports/StaffPerformance";
import DownloadReports from "@/components/reports/DownloadReports";
import ReportsFilters, { DateRange } from "@/components/reports/ReportsFilters";
import AlertsBell from "@/components/reports/AlertsBell";

type Branch = { id: number; name: string };

export default function ReportsDashboard({
  viewerRole,
  viewerBranchId,
}: {
  viewerRole: Role;
  viewerBranchId: number | null;
}) {
  const [dateRange, setDateRange] = useState<DateRange>({
    label: "Last 7 days",
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [branchFilter, setBranchFilter] = useState<number | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (viewerRole === "super_admin") {
      api.get<Branch[]>("/branches").then((r) => setBranches(r.data));
    }
  }, [viewerRole]);

  // Real-time updates on new orders
  useSocket(viewerBranchId ?? 0, viewerRole, {
    new_order: () => setRefreshKey((k) => k + 1),
    order_ready: () => setRefreshKey((k) => k + 1),
  });

  // Effective branch_id for API filtering:
  // super_admin: use branchFilter (which can be "all" or specific branch id)
  // branch_admin: always use own branch (backend enforces this too, but sending it keeps client cache consistent)
  const effectiveBranchId =
    viewerRole === "super_admin" ? branchFilter : viewerBranchId;

  const filters = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
    branch_id: effectiveBranchId,
    source: sourceFilter,
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      {/* Section header — light, fits inside Dashboard shell */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E8542F] rounded-xl flex items-center justify-center text-lg">📊</div>
          <div>
            <h1 className="text-lg font-bold text-[#1A1613] tracking-tight">Reports &amp; Analytics</h1>
            <p className="text-xs text-[#A89F94]">
              {viewerRole === "super_admin" ? "All branches · real-time" : "Your branch · real-time"}
            </p>
          </div>
        </div>
        <AlertsBell viewerRole={viewerRole} viewerBranchId={viewerBranchId} />
      </div>

      {/* Filters bar */}
      <ReportsFilters
        viewerRole={viewerRole}
        branches={branches}
        dateRange={dateRange}
        setDateRange={setDateRange}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
      />

      {/* Stat cards — role-aware 4th card */}
      <StatCards filters={filters} refreshKey={refreshKey} viewerRole={viewerRole} />

      {/* Revenue trend */}
      <RevenueTrendChart filters={filters} refreshKey={refreshKey} />

      {/* 2-col row: Source + Branch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourceComparison filters={filters} refreshKey={refreshKey} />
        {viewerRole === "super_admin" && (
          <BranchComparison filters={filters} refreshKey={refreshKey} />
        )}
      </div>

      {/* 2-col row: Best sellers + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BestSellers filters={filters} refreshKey={refreshKey} />
        <CategoryChart filters={filters} refreshKey={refreshKey} />
      </div>

      {/* 2-col row: Heatmap + Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HourlyHeatmap filters={filters} refreshKey={refreshKey} />
        <PaymentChart filters={filters} refreshKey={refreshKey} />
      </div>

      {/* Staff performance — passes viewerRole for Name (Branch) display */}
      <StaffPerformance
        filters={filters}
        refreshKey={refreshKey}
        viewerRole={viewerRole}
      />

      {/* PDF downloads */}
      <DownloadReports
        filters={filters}
        viewerRole={viewerRole}
        branches={branches}
        branchFilter={branchFilter}
      />
    </div>
  );
}