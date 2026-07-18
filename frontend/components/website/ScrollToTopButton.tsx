"use client";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useSiteSettings } from "@/lib/useSiteSettings";

export default function ScrollToTopButton() {
  const site = useSiteSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className={`fixed right-4 bottom-24 md:bottom-6 z-40 w-11 h-11 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-1 active:scale-90 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      style={{ background: site.primaryColor }}
    >
      <ArrowUp size={18} className="animate-float" />
    </button>
  );
}
