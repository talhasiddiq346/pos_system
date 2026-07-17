"use client";
import { useSiteSettings } from "@/lib/useSiteSettings";
import StaticPageShell from "@/components/website/StaticPageShell";

export default function AboutPage() {
  const site = useSiteSettings();

  return (
    <StaticPageShell title={`About ${site.brandName}`}>
      <p>
        Welcome to {site.brandName}! We're passionate about serving fresh, delicious food made with
        quality ingredients, delivered quickly and reliably right to your door — or ready for pickup
        at your nearest branch.
      </p>
      <p>
        From our kitchen to your table, every order is prepared fresh and packed with care. Whether
        you're ordering for one or feeding the whole family, we've got a menu built to satisfy.
      </p>
      <p>
        Have feedback or a special request? We'd love to hear from you — reach out via our{" "}
        <a href="/contact" className="underline font-medium">Contact page</a>.
      </p>
    </StaticPageShell>
  );
}
