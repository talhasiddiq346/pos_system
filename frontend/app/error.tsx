"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F5F6F4] flex items-center justify-center p-6">
      <div className="bg-white border border-[#E3E5E0] rounded-2xl px-8 py-10 max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-[#FBEAE7] flex items-center justify-center mx-auto text-xl">⚠️</div>
        <h2 className="text-lg font-semibold text-[#14171A] mt-4">Something went wrong</h2>
        <p className="text-sm text-[#6B7068] mt-2">An unexpected error occurred. Please try again.</p>
        <button onClick={reset}
          className="mt-6 text-sm font-medium px-6 py-2.5 rounded-lg bg-[#2F7D6B] text-white hover:bg-[#27695A]">
          Try again
        </button>
      </div>
    </div>
  );
}