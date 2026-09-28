"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}: Props) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13.5px] font-bold tracking-tight text-slate-800">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[11.5px] text-slate-400">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function EmptyChart({ label = "Tidak ada data" }: { label?: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-xl bg-slate-50 text-[12.5px] text-slate-400">
      {label}
    </div>
  );
}
