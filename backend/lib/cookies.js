// Cookie options helper — switches between dev and production settings.
//
// DEV (localhost):
//   - secure: false (works over http://)
//   - sameSite: "lax" (frontend + backend on same origin family)
//
// PROD (Railway + Vercel — different domains):
//   - secure: true (https only)
//   - sameSite: "none" (required for cross-site cookies)
//
// httpOnly is ALWAYS true — prevents XSS from reading the JWT.

const isProd = process.env.NODE_ENV === "production";

export function cookieOptions(overrides = {}) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    ...overrides,
  };
}

// For clearing cookies — MUST match the options used when setting,
// otherwise browser won't remove them.
export function clearCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };
}