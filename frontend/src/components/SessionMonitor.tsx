"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, clearSession } from "@/lib/auth";

export function SessionMonitor() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      const session = getSession();
      if (!session) return;

      try {
        await apiGet("/check-session");
      } catch {
        clearSession();
        router.push("/login");
      }
    }, 15000); // every 15 seconds

    return () => clearInterval(interval);
  }, [router]);

  return null;
}