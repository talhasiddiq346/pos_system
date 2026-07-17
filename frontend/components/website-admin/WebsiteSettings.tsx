"use client";
import Tabs from "../Tabs";
import BrandingPanel from "./BrandingPanel";
import VouchersPanel from "./VouchersPanel";
import PopularProductsPanel from "./PopularProductsPanel";
import CategoriesPanel from "./CategoriesPanel";

export default function WebsiteSettings() {
  return (
    <Tabs
      tabs={[
        { key: "branding", label: "Branding", content: <BrandingPanel /> },
        { key: "categories", label: "Categories", content: <CategoriesPanel /> },
        { key: "popular", label: "Popular Products", content: <PopularProductsPanel /> },
        { key: "vouchers", label: "Vouchers", content: <VouchersPanel /> },
      ]}
    />
  );
}
