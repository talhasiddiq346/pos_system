"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSiteSettings } from "@/lib/useSiteSettings";
import StaticPageShell from "@/components/website/StaticPageShell";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") + "/api";

type Branch = { id: number; name: string; address: string; phone?: string; city?: string };

export default function ContactPage() {
  const site = useSiteSettings();
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    axios.get<Branch[]>(`${API}/public/branches`).then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  return (
    <StaticPageShell title="Contact Us">
      <p>
        Questions about an order, a refund, or just want to say hello? Reach out to your nearest{" "}
        {site.brandName} branch below, or use the order tracker to check on an existing order.
      </p>

      {branches.length === 0 ? (
        <p className="text-[#6B6259]">Branch contact details will appear here shortly.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 not-prose">
          {branches.map((b) => (
            <div key={b.id} className="bg-white border border-[#E8DFD0] rounded-xl p-4">
              <p className="font-semibold text-[#1A1613]">{b.name}</p>
              <p className="text-sm text-[#6B6259] mt-1">{b.address}{b.city ? `, ${b.city}` : ""}</p>
              {b.phone && (
                <a href={`tel:${b.phone}`} className="text-sm font-medium mt-1 inline-block" style={{ color: site.primaryColor }}>
                  📞 {b.phone}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </StaticPageShell>
  );
}
