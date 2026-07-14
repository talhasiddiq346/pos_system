"use client";
import { useState } from "react";
import Sidebar, { SECTIONS_BY_ROLE, SectionKey } from "./Sidebar";
import TopBar from "./TopBar";
import BranchesPanel from "./BranchesPanel";
import StaffPanel from "./StaffPanel";
import CallCenterPanel from "./CallCenterPanel";
import PasswordsPanel from "./PasswordsPanel";
import type { User } from "@/lib/types";
import ProductsPanel from "./products/ProductsPanel";
import POSScreen from "./pos/POSScreen";
import OrdersHistoryPanel from "./orders/OrdersHistoryPanel";
import CallCenterScreen from "./call-center/CallCenterScreen";
import ChefScreen from "./chef/ChefScreen";
import RiderScreen from "./delivery/RiderScreen";
import CashSubmissionsPanel from "./cashier/CashSubmissionsPanel";
import CashReportPanel from "./admin/CashReportPanel";
import ReportsDashboard from "./reports/ReportsDashboard";
import OverviewDashboard from "./reports/OverviewDashboard";

export default function Dashboard({ user }: { user: User }) {
  const sections = SECTIONS_BY_ROLE[user.role] ?? [{ key: "overview" as SectionKey, label: "Overview" }];
  const [active, setActive] = useState<SectionKey>(sections[0].key);

  function renderOverview() {
    // Super admin + branch admin → rich overview dashboard
    if (user.role === "super_admin" || user.role === "branch_admin") {
      return (
        <OverviewDashboard
          viewerRole={user.role}
          viewerBranchId={user.branch_id}
          viewerName={user.name}
          onGoToSection={(section) => setActive(section as SectionKey)}
        />
      );
    }

    // Other roles → placeholder
    const placeholderText: Record<string, string> = {
      cashier: "Use the POS section to take orders.",
      call_center: "Order intake form is in the Take order section.",
      delivery: "Delivery queue is in My Orders section.",
      chef: "Kitchen orders are in the Kitchen section.",
    };

    return (
      <div className="bg-white border border-[#D0D3CB] rounded-lg px-5 py-6 text-sm text-[#494D46]">
        {placeholderText[user.role] ?? "Welcome!"}
      </div>
    );
  }

  function renderContent() {
    switch (active) {
      case "overview":
        return renderOverview();
      case "branches":
        return <BranchesPanel />;
      case "staff":
        return <StaffPanel viewerRole={user.role} viewerBranchId={user.branch_id} />;
      case "call-center":
        return <CallCenterPanel />;
      case "passwords":
        return <PasswordsPanel currentUserId={user.id} viewerRole={user.role} />;
      case "products":
        return <ProductsPanel user={user} />;
      case "pos":
        return <POSScreen user={user} />;
      case "receipts":
        return <OrdersHistoryPanel viewerRole={user.role} user={user} />;
      case "orders":
        return <CallCenterScreen user={user} />;
      case "kitchen":
        return <ChefScreen user={user} />;
      case "rider-home":
      case "rider-waiting":
      case "rider-history":
        return <RiderScreen user={user} />;
      case "cash-submissions":
        return <CashSubmissionsPanel user={user} />;
      case "cash-report":
        return <CashReportPanel viewerRole={user.role} />;
      case "reports":
        return (
          <ReportsDashboard
            viewerRole={user.role}
            viewerBranchId={user.branch_id}
          />
        );
      default:
        return renderOverview();
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6F4]">
      <Sidebar role={user.role} active={active} onSelect={setActive} />
      <div className="flex-1">
        <TopBar user={user} />
        <main className="p-6">{renderContent()}</main>
      </div>
    </div>
  );
}