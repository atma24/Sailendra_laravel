"use client";

import { useSession } from "@/lib/auth";

export default function Placeholder({ title }: { title: string }) {
  const session = useSession();
  return (
    <div className="rounded-[14px] border border-[#e7eaf2] bg-white p-5">
      <h2 className="text-[16px] font-black tracking-tight text-[#172033]">{title}</h2>
      <p className="mt-1 text-[12px] font-semibold text-[#6b7280]">
        Modul belum dibangun. {session?.user.role ? `Login sebagai ${session.user.role}.` : ""}
      </p>
    </div>
  );
}