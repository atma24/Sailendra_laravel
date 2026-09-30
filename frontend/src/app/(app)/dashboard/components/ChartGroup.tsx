"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  tone: "inbound" | "outbound";
  children: ReactNode;
};

const TONE: Record<
  Props["tone"],
  { wrap: string; title: string; subtitle: string; icon: string; badge: string }
> = {
  inbound: {
    wrap: "border-emerald-100 bg-emerald-50/60",
    title: "text-emerald-800",
    subtitle: "text-emerald-600/80",
    icon: "bi-box-arrow-in-down",
    badge: "bg-emerald-100 text-emerald-700",
  },
  outbound: {
    wrap: "border-red-100 bg-red-50/60",
    title: "text-red-800",
    subtitle: "text-red-600/80",
    icon: "bi-box-arrow-up",
    badge: "bg-red-100 text-red-700",
  },
};

export default function ChartGroup({ title, subtitle, tone, children }: Props) {
  const t = TONE[tone];

  return (
    <section className={`rounded-3xl border p-4 sm:p-5 ${t.wrap}`}>
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-[16px] ${t.badge}`}
        >
          <i className={`bi ${t.icon}`} />
        </span>
        <div>
          <h2 className={`text-[15px] font-extrabold tracking-tight ${t.title}`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`mt-0.5 text-[12px] ${t.subtitle}`}>{subtitle}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>
    </section>
  );
}
