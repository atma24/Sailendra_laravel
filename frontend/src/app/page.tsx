"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getSession() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#191970]/20 border-t-[#191970]" />
    </div>
  );
}