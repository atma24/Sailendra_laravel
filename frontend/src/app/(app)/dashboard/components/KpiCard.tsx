"use client";

import type { ReactNode } from "react";
import { fmt } from "../dashboard";

type Props = {
  label: string;
  value: ReactNode;
  icon?: string;
  tag?: string;
  tagTone?: "neutral" | "success" | "warn" | "danger";
  hint?: string;
  loading?: boolean;
};

const TONE: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-600",
  warn: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
};

export default function KpiCard({
  label,
  value,
  icon,
  tag,
  tagTone = "neutral",
  hint,
  loading,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-[15px] text-indigo-900">
            <i className={`bi ${icon}`} />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-[26px] font-extrabold leading-none tracking-tight text-slate-800 tabular-nums">
          {loading ? <span className="text-slate-300">—</span> : value}
        </span>
        {tag && (
          <span
            className={`mb-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${TONE[tagTone]}`}
          >
            {tag}
          </span>
        )}
      </div>

      {hint && <div className="mt-1.5 text-[11.5px] text-slate-400">{hint}</div>}
    </div>
  );
}

export function KpiNumber({ n, loading }: { n: number; loading?: boolean }) {
  return <>{loading ? "—" : fmt(n)}</>;
}
