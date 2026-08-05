"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, isMultiRole } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
    } else if (isMultiRole(s.user.role) && !s.lokasi) {
      router.replace("/pilih-lokasi");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return null;
}