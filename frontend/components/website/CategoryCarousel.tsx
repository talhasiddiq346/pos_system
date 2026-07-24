"use client";

type Category = { name: string; image_url?: string };

export default function CategoryCarousel({
  categories,
  activeCategory,
  onSelect,
  accentColor,
  accentTint,
}: {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (name: string) => void;
  accentColor: string;
  accentTint: string;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 sm:py-6">
      <div className="flex items-start gap-2 overflow-x-auto no-scrollbar pb-1 pt-1">
        {categories.map((cat, i) => {
          const isActive = activeCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className={`shrink-0 w-24 sm:w-28 flex flex-col items-center gap-2 transition-all hover:scale-110 active:scale-90 cursor-pointer animate-fade-in-up ${isActive ? "scale-105" : ""}`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
            >
              <span
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden flex items-center justify-center shadow-md transition-all shrink-0"
                style={{
                  border: `3px solid ${isActive ? accentColor : accentTint}`,
                  boxShadow: isActive ? `0 0 0 4px ${accentColor}33` : undefined,
                  background: accentTint,
                }}
              >
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">🍽️</span>
                )}
              </span>
              <span
                className="text-xs sm:text-sm font-bold uppercase tracking-wide text-center leading-tight line-clamp-2 h-8 sm:h-9 flex items-center justify-center"
                style={{ color: isActive ? accentColor : "#6B6259" }}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
