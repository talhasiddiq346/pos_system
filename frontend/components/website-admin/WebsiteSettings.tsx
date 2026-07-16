"use client";
import Tabs from "../Tabs";
import BrandingPanel from "./BrandingPanel";
import VouchersPanel from "./VouchersPanel";
import PopularProductsPanel from "./PopularProductsPanel";

export default function WebsiteSettings() {
  return (
    <Tabs
      tabs={[
        { key: "branding", label: "Branding", content: <BrandingPanel /> },
        { key: "popular", label: "Popular Products", content: <PopularProductsPanel /> },
        { key: "vouchers", label: "Vouchers", content: <VouchersPanel /> },
      ]}
    />
  );
}
