"use client";
import OrderTracker from "@/components/website/OrderTracker";
import { useRouter } from "next/navigation";

export default function TrackPage() {
  const router = useRouter();
  return <OrderTracker onBack={() => router.push("/order")} />;
}