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
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className="shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wide transition-all hover:opacity-75 hover:scale-105 cursor-pointer"
              style={
                isActive
                  ? { background: accentColor, color: "#ffffff" }
                  : { background: accentTint, color: accentColor }
              }
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
