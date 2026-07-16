"use client";
import { useEffect, useState } from "react";

type Banner = { image_url: string; link?: string | null };

export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const current = banners[Math.min(index, banners.length - 1)];

  function go(delta: number) {
    setIndex((i) => (i + delta + banners.length) % banners.length);
  }

  const slide = (
    <div className="relative w-full h-56 sm:h-72 md:h-112 overflow-hidden bg-[#EDE8E1]">
      <img src={current.image_url} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); go(-1); }}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-lg font-bold text-[#1A1613] hover:bg-white"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.preventDefault(); go(1); }}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-lg font-bold text-[#1A1613] hover:bg-white"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setIndex(i); }}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  return current.link ? <a href={current.link}>{slide}</a> : slide;
}
