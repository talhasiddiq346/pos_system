"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type Banner = { image_url: string; link?: string | null };

export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;

  return (
    <div className="px-2 sm:px-4 md:px-0 py-6 md:py-0 relative animate-fade-in">
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        pagination={{ clickable: true }}
        navigation={{
          nextEl: ".swiper-button-next-promo",
          prevEl: ".swiper-button-prev-promo",
        }}
        autoplay={banners.length > 1 ? { delay: 5000, disableOnInteraction: false } : false}
        loop={banners.length > 1}
        className="w-full rounded-md sm:rounded-3xl md:rounded-none"
      >
        {banners.map((banner, i) => {
          const slide = (
            <div className="relative md:rounded-none rounded-md sm:rounded-3xl overflow-hidden h-96 sm:h-128 md:h-208 bg-[#EDE8E1]">
              <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          );
          return (
            <SwiperSlide key={i}>
              {banner.link ? <a href={banner.link}>{slide}</a> : slide}
            </SwiperSlide>
          );
        })}
      </Swiper>

      {banners.length > 1 && (
        <>
          <button
            aria-label="Previous slide"
            className="swiper-button-prev-promo absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-20 bg-black/60 rounded-r-md flex items-center justify-center hover:bg-black transition-all hover:scale-110 cursor-pointer"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            aria-label="Next slide"
            className="swiper-button-next-promo absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-20 bg-black/60 rounded-l-md flex items-center justify-center hover:bg-black transition-all hover:scale-110 cursor-pointer"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
