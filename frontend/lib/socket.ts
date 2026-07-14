import { io, Socket } from "socket.io-client";

// If NEXT_PUBLIC_API_URL is missing, fall back to localhost so dev never breaks.
// The regex strips a trailing "/api" or "/api/" so this works whether the env var
// includes "/api" (e.g. "https://api.example.com/api") or not ("https://api.example.com").
const RAW = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const API_ORIGIN = RAW.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_ORIGIN, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(
  branchId: number | null,
  role: string,
  userId?: number
) {
  const s = getSocket();
  s.connect();

  s.on("connect", () => {
    if (branchId) {
      s.emit("join_branch", branchId);
      s.emit("join_role", { branchId, role });
    }
    // Rider apna personal room join kare
    if (role === "delivery" && userId) {
      s.emit("join_rider", userId);
    }
    console.log("Socket connected → origin:", API_ORIGIN, "branch:", branchId, "role:", role);
  });

  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}