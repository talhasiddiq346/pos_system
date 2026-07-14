"use client";
import { useState, ReactNode } from "react";

type Tab = { key: string; label: string; content: ReactNode };

export default function Tabs({ tabs, defaultKey }: { tabs: Tab[]; defaultKey?: string }) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key);

  return (
    <div>
      <div className="flex gap-1 border-b border-[#E3E5E0] mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              active === t.key
                ? "border-[#2F7D6B] text-[#1B1D1E] font-medium"
                : "border-transparent text-[#6B7068] hover:text-[#1B1D1E]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.key === active)?.content}
    </div>
  );
}