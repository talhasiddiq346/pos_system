"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export default function TopBarRider({ user }: { user: User }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post("/auth/logout");
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed:", err);
      // Force redirect even if logout API fails
      window.location.href = "/login";
    }
  }

  return (
    <>
      <div
        className="sticky top-0 z-40 bg-white border-b border-[#E3E5E0] shadow-sm"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left — Brand */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8542F] to-[#F0A93B] flex items-center justify-center text-white text-sm flex-shrink-0">
              🔥
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#14171A] leading-none">Tandoor</p>
              <p className="text-[10px] text-[#6B7068] uppercase tracking-wider mt-0.5">Rider</p>
            </div>
          </div>

          {/* Right — Logout button */}
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 px-3 h-10 rounded-xl bg-[#F5F6F4] hover:bg-[#EDEFEA] active:scale-[0.97] transition-all"
            aria-label="Logout"
          >
            <div className="text-right hidden sm:block min-w-0">
              <p className="text-xs font-semibold text-[#14171A] truncate max-w-[100px]">{user.name}</p>
              <p className="text-[10px] text-[#6B7068]">Logout</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8542F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Logout confirmation modal */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn"
          onClick={() => !loggingOut && setConfirming(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#FBEAE7] mx-auto flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9E3527" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#14171A] text-center">Logout?</h3>
            <p className="text-sm text-[#6B7068] text-center mt-1">
              You'll need to log back in to see your orders
            </p>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={() => setConfirming(false)}
                disabled={loggingOut}
                className="h-12 rounded-xl border border-[#E3E5E0] text-[#494D46] font-semibold text-sm hover:bg-[#F5F6F4] disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="h-12 rounded-xl bg-[#9E3527] text-white font-semibold text-sm hover:bg-[#822C21] disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {loggingOut ? "..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
        }
      `}</style>
    </>
  );
}