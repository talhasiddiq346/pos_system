"use client";
import { useEffect, useRef } from "react";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";

export function useSocket(
  branchId: number | null,
  role: string,
  events: Record<string, (data: any) => void>,
  userId?: number
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = connectSocket(branchId, role, userId);
    socketRef.current = socket;

    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(events).forEach((event) => socket.off(event));
      disconnectSocket();
    };
  }, []);

  return socketRef;
}