"use client";

import Link from "next/link";
import { fmt } from "../dashboard";

type Props = { pending: number };

export default function PendingAlert({ pending }: Props) {
  if (!pending) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-[16px] text-amber-700">
        <i className="bi bi-exclamation-triangle" />
      </span>
      <div className="flex-1 text-[12.5px]">
        <span className="font-bold text-amber-800">{fmt(pending)} GIN</span>{" "}
        <span className="text-amber-700">outbound belum terkonfirmasi.</span>
      </div>
      <Link
        href="/outbound"
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-amber-700"
      >
        Lihat
      </Link>
    </div>
  );
}
