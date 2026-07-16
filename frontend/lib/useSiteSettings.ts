"use client";
import { useEffect, useState } from "react";
import axios from "axios";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";

export type Banner = { image_url: string; link?: string | null };

export type ActiveVoucher = {
  code: string;
  label: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_discount_cap: number | null;
  min_order_amount: number;
};

export type SiteBranding = {
  brandName: string;
  logoUrl: string | null;
  bannerImages: Banner[];
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  activeVoucher: ActiveVoucher | null;
  loading: boolean;
};

const DEFAULTS: Omit<SiteBranding, "loading"> = {
  brandName: "Tandoor",
  logoUrl: null,
  bannerImages: [],
  primaryColor: "#E8542F",
  secondaryColor: "#F0A93B",
  backgroundColor: "#F4EBD9",
  activeVoucher: null,
};

export function useSiteSettings(): SiteBranding {
  const [state, setState] = useState<SiteBranding>({ ...DEFAULTS, loading: true });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      axios.get(`${API}/settings`),
      axios.get(`${API}/settings/vouchers/active`).catch(() => ({ data: null })),
    ]).then(([settingsRes, voucherRes]) => {
      if (cancelled) return;
      const d = settingsRes.data || {};
      setState({
        brandName: d.brand_name || DEFAULTS.brandName,
        logoUrl: d.logo_url || null,
        bannerImages: Array.isArray(d.banner_images) ? d.banner_images : [],
        primaryColor: d.primary_color || DEFAULTS.primaryColor,
        secondaryColor: d.secondary_color || DEFAULTS.secondaryColor,
        backgroundColor: d.background_color || DEFAULTS.backgroundColor,
        activeVoucher: voucherRes.data || null,
        loading: false,
      });
    }).catch(() => {
      if (!cancelled) setState((s) => ({ ...s, loading: false }));
    });

    return () => { cancelled = true; };
  }, []);

  return state;
}
