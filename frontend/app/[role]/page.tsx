"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ROLE_SLUGS } from "@/lib/roles";
import Dashboard from "@/components/Dashboard";
import type { User } from "@/lib/types";
import NotificationToast from "@/components/shared/NotificationToast";
export default function RoleDashboardPage() {
  const params = useParams<{ role: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<User>("/auth/me")
      .then((res) => {
        const expectedDbRole = ROLE_SLUGS[params.role];
        if (!expectedDbRole || res.data.role !== expectedDbRole) {
          router.push("/login");
          return;
        }
        setUser(res.data);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [params.role]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!user) return null;

  return (
  <>
    <NotificationToast />
    <Dashboard user={user} />
  </>
);
}