"use client";
import { useState } from "react";
import BranchSelector from "@/components/website/BranchSelector";
import WebsiteMenu from "@/components/website/WebsiteMenu";
import WebsiteCheckout from "@/components/website/WebsiteCheckout";
import OrderSuccess from "@/components/website/OrderSuccess";
import OrderTracker from "@/components/website/OrderTracker";

type Branch = { id: number; name: string; address: string };
type CartItem = {
  key: string; product_id: number; product_name: string;
  variant_id: number | null; variant_name: string | null;
  unit_price: number; quantity: number;
};

type Screen =
  | { name: "branches" }
  | { name: "menu"; branch: Branch }
  | { name: "checkout"; branch: Branch; cart: CartItem[] }
  | { name: "success"; orderCode: string; total: number }
  | { name: "track"; orderCode?: string };

export default function OrderPage() {
  const [screen, setScreen] = useState<Screen>({ name: "branches" });

  if (screen.name === "branches") {
    return (
      <BranchSelector
        onSelect={(branch) => setScreen({ name: "menu", branch })}
        onTrack={() => setScreen({ name: "track" })}
      />
    );
  }

  if (screen.name === "menu") {
    return (
      <WebsiteMenu
        branch={screen.branch}
        onBack={() => setScreen({ name: "branches" })}
        onTrack={() => setScreen({ name: "track" })}
        onCheckout={(cart) => setScreen({ name: "checkout", branch: screen.branch, cart })}
      />
    );
  }

  if (screen.name === "checkout") {
    return (
      <WebsiteCheckout
        branch={screen.branch}
        cart={screen.cart}
        onBack={() => setScreen({ name: "menu", branch: screen.branch })}
        onOrderPlaced={(orderCode, total) => setScreen({ name: "success", orderCode, total })}
      />
    );
  }

  if (screen.name === "success") {
    return (
      <OrderSuccess
        orderCode={screen.orderCode}
        total={screen.total}
        onTrack={() => setScreen({ name: "track", orderCode: screen.orderCode })}
        onNewOrder={() => setScreen({ name: "branches" })}
      />
    );
  }

  if (screen.name === "track") {
    return (
      <OrderTracker
        initialCode={screen.orderCode}
        onBack={() => setScreen({ name: "branches" })}
      />
    );
  }

  return null;
}