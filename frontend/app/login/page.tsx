"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      const role = res.data.role;
      if (role === "super_admin") router.push("/admin");
      else if (role === "branch_admin") router.push("/branch-admin");
      else if (role === "cashier") router.push("/cashier");
      else if (role === "call_center") router.push("/call-center");
      else if (role === "delivery") router.push("/delivery");
      else if (role === "chef") router.push("/chef");
      else router.push("/login");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Invalid credentials");
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F4] flex items-center justify-center p-4">
      <div className="w-full max-w-[360px]">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#14171A] mb-4">
            <span className="text-2xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-bold text-[#14171A] tracking-tight">POS System</h1>
          <p className="text-sm text-[#6B7068] mt-1">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E3E5E0] rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 bg-[#FBEAE7] border border-[#F0C9C2] rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-[#9E3527] text-sm">⚠</span>
              <p className="text-sm text-[#9E3527]">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#494D46] uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full border border-[#E3E5E0] rounded-xl px-4 py-2.5 text-sm text-[#14171A] placeholder:text-[#B5B8B0] focus:outline-none focus:ring-2 focus:ring-[#2F7D6B] focus:border-transparent transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#494D46] uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full border border-[#E3E5E0] rounded-xl px-4 py-2.5 pr-11 text-sm text-[#14171A] placeholder:text-[#B5B8B0] focus:outline-none focus:ring-2 focus:ring-[#2F7D6B] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9B9F98] hover:text-[#494D46] transition-colors"
                >
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 bg-[#14171A] hover:bg-[#2A2D30] text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#9B9F98] mt-5">
          Secure · Internal access only
        </p>
      </div>
    </div>
  );
}