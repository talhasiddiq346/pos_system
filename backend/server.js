import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import branchRoutes from "./routes/branches.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import riderRoutes from "./routes/riders.js";
import cashierRoutes from "./routes/cashier.js";
import reportRoutes from "./routes/reports.js";
import publicRoutes from "./routes/public.js";
import settingsRoutes from "./routes/settings.js";

// ── Phase 11 imports
import analyticsRoutes from "./routes/analytics.js";
import alertsRoutes, { checkAlerts } from "./routes/alerts.js";
import pdfReportRoutes from "./routes/pdf-reports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// ═══════════════════════════════════════════════════
// 🔒 SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════

// CRITICAL: Trust Railway's proxy — without this, req.ip is wrong
// and rate limiting will block/allow the wrong clients
app.set("trust proxy", 1);

// ── CORS: allowlist (comma-separated env var supports multiple origins)
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // Allow same-origin (no Origin header — e.g. mobile apps, curl)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    console.warn(`CORS blocked: ${origin} (allowed: ${allowedOrigins.join(", ")})`);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));

// ── Helmet: security headers
app.use(
  helmet({
    // Allow serving images to Vercel frontend (cross-origin)
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // API doesn't render HTML, so no CSP needed
    contentSecurityPolicy: false,
  })
);

// ── Body parsers with size limit
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── Rate limits

// Global limit: 300 requests per 15 min per IP (generous for normal use)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
  // Skip health check and static uploads from rate limit
  skip: (req) => req.path === "/api/health" || req.path.startsWith("/uploads/"),
});
app.use("/api/", globalLimiter);

// Strict limit on login: 10 attempts per 15 min per IP
// Successful logins don't count (won't lock out real users)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts, please try again in 15 minutes" },
});
app.use("/api/auth/login", authLimiter);

// Order creation limit: 30 orders per minute per IP (prevents spam ordering)
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many orders, please try again in a minute" },
});
app.use("/api/orders", orderLimiter);

// ═══════════════════════════════════════════════════
// 📡 SOCKET.IO
// ═══════════════════════════════════════════════════

export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

io.on("connection", (socket) => {
  socket.on("join_branch", (branchId) => {
    socket.join(`branch_${branchId}`);
  });
  socket.on("join_role", ({ branchId, role }) => {
    socket.join(`branch_${branchId}_${role}`);
  });
  socket.on("join_rider", (riderId) => {
    socket.join(`rider_${riderId}`);
  });
  socket.on("join_cashier", (cashierId) => {
    socket.join(`cashier_${cashierId}`);
  });
  socket.on("disconnect", () => {});
});

// ═══════════════════════════════════════════════════
// 🛣  ROUTES
// ═══════════════════════════════════════════════════

app.get("/api/health", (_, res) => res.json({ ok: true, env: process.env.NODE_ENV || "development" }));
app.use("/api/auth", authRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/cashier", cashierRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/settings", settingsRoutes);

// ── Phase 11 routes
app.use("/api/reports", analyticsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/reports/pdf", pdfReportRoutes);

// ── Error handler (last)
app.use((err, req, res, next) => {
  // CORS errors get a cleaner response
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS: origin not allowed" });
  }
  // Multer errors (bad file type, too large) — give a real message instead of a bare 500
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Image is too large — max 8MB" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes("images allowed")) {
    return res.status(400).json({ error: err.message });
  }
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Alerts auto-check
setTimeout(() => {
  console.log("Running initial alerts check...");
  checkAlerts();
}, 5000);

setInterval(() => {
  checkAlerts();
}, 15 * 60 * 1000);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🔥 API → http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   CORS allowed: ${allowedOrigins.join(", ")}`);
});