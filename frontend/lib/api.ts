import axios from "axios";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const isProdBrowser =
  typeof window !== "undefined" && window.location.hostname !== "localhost";

export const api = axios.create({
  baseURL: isProdBrowser ? "/api" : `${API_URL}/api`,
  withCredentials: true,
});

// Response interceptor — 401 pe login redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 &&
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "");

export function productImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${API_ORIGIN}${imageUrl}`;
}