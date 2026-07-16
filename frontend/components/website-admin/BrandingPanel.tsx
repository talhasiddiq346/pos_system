"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import DropZone from "./DropZone";

type Banner = { image_url: string; public_id?: string; link?: string | null };
type SiteSettings = {
  id: number;
  brand_name: string;
  logo_url: string | null;
  banner_images: Banner[];
  primary_color: string;
  secondary_color: string;
  background_color: string;
};

function errMsg(err: unknown) {
  if (axios.isAxiosError(err)) return err.response?.data?.error || "Something went wrong";
  return "Something went wrong";
}

export default function BrandingPanel() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#E8542F");
  const [secondaryColor, setSecondaryColor] = useState("#F0A93B");
  const [backgroundColor, setBackgroundColor] = useState("#F4EBD9");
  const [saving, setSaving] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerLink, setBannerLink] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<SiteSettings>("/settings");
    setSettings(res.data);
    setBrandName(res.data.brand_name);
    setPrimaryColor(res.data.primary_color);
    setSecondaryColor(res.data.secondary_color);
    setBackgroundColor(res.data.background_color);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.put("/settings", {
        brand_name: brandName,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_color: backgroundColor,
      });
      setSuccess("✅ Branding saved");
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload() {
    if (!logoFile) return;
    setError("");
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("image", logoFile);
      await api.post("/settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLogoFile(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleLogoRemove() {
    setError("");
    setUploadingLogo(true);
    try {
      await api.delete("/settings/logo");
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleBannerUpload() {
    if (!bannerFile) return;
    setError("");
    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("image", bannerFile);
      if (bannerLink.trim()) formData.append("link", bannerLink.trim());
      await api.post("/settings/banner", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBannerFile(null);
      setBannerLink("");
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleBannerRemove(index: number) {
    if (!settings) return;
    setError("");
    try {
      const nextBanners = settings.banner_images.filter((_, i) => i !== index);
      await api.put("/settings/banners", { banners: nextBanners });
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (loading) return <p className="text-sm text-[#6B7068]">Loading branding settings...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[#B3402F] bg-[#FBEAE7] border border-[#F0C9C2] rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-[#1F6F54] bg-[#E6F2EF] border border-[#C7E2DA] rounded-md px-3 py-2">
          {success}
        </p>
      )}

      {/* Brand name + colors */}
      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0]">
          <h2 className="font-medium text-[#1B1D1E]">Brand &amp; theme</h2>
          <p className="text-xs text-[#6B7068] mt-0.5">
            Applied across the customer-facing ordering website.
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[#6B7068] uppercase tracking-wide block mb-1.5">
              Brand name
            </label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm w-full max-w-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Primary color", value: primaryColor, set: setPrimaryColor },
              { label: "Secondary color", value: secondaryColor, set: setSecondaryColor },
              { label: "Background color", value: backgroundColor, set: setBackgroundColor },
            ].map((c) => (
              <div key={c.label}>
                <label className="text-xs font-medium text-[#6B7068] uppercase tracking-wide block mb-1.5">
                  {c.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.value}
                    onChange={(e) => c.set(e.target.value)}
                    className="w-9 h-9 rounded-md border border-[#E3E5E0] cursor-pointer"
                  />
                  <input
                    value={c.value}
                    onChange={(e) => c.set(e.target.value)}
                    className="border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm w-28 font-mono"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded-md bg-[#2F7D6B] text-white hover:bg-[#27695A] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0]">
          <h2 className="font-medium text-[#1B1D1E]">Logo</h2>
        </div>
        <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
          <div className="shrink-0 space-y-1.5">
            <div className="w-16 h-16 rounded-xl bg-[#F5F6F4] border border-[#E3E5E0] flex items-center justify-center overflow-hidden">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl">🔥</span>
              )}
            </div>
            {settings?.logo_url && (
              <button
                onClick={handleLogoRemove}
                disabled={uploadingLogo}
                className="text-[11px] text-[#B3402F] hover:underline disabled:opacity-50"
              >
                Remove logo
              </button>
            )}
          </div>
          <div className="flex-1 min-w-[240px]">
            <DropZone
              file={logoFile}
              onFile={setLogoFile}
              label="PNG/JPG, square works best, up to 8MB"
              uploading={uploadingLogo}
              uploadLabel="Upload logo"
              onUpload={handleLogoUpload}
            />
          </div>
        </div>
      </div>

      {/* Banner carousel images */}
      <div className="bg-white border border-[#E3E5E0] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E3E5E0]">
          <h2 className="font-medium text-[#1B1D1E]">Hero banner carousel</h2>
          <p className="text-xs text-[#6B7068] mt-0.5">
            Shown at the top of the menu page. Add multiple slides for a carousel; leave empty to fall back to product photos.
          </p>
        </div>

        <div className="px-5 py-4 border-b border-[#F0F1EE] space-y-3">
          <input
            placeholder="Optional link (e.g. a category or promo URL)"
            value={bannerLink}
            onChange={(e) => setBannerLink(e.target.value)}
            className="w-full border border-[#E3E5E0] rounded-md px-2.5 py-1.5 text-sm"
          />
          <DropZone
            file={bannerFile}
            onFile={setBannerFile}
            label="wide images work best (e.g. 1200×500)"
            uploading={uploadingBanner}
            uploadLabel="+ Add slide"
            onUpload={handleBannerUpload}
          />
        </div>

        {settings && settings.banner_images.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#6B7068]">No banner slides yet — using product photos as fallback.</p>
        ) : (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {settings?.banner_images.map((b, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-[#E3E5E0] group">
                <img src={b.image_url} alt="" className="w-full aspect-video object-cover" />
                <button
                  onClick={() => handleBannerRemove(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                >
                  ✕
                </button>
                {b.link && (
                  <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-1 truncate">
                    {b.link}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
