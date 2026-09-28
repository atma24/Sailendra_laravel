"use client";

import { fmt, COLORS } from "../dashboard";

type Props = {
  terpakai: number;
  kapasitas: number;
  persen: number;
  loading?: boolean;
};

export default function StorageUsageCard({
  terpakai,
  kapasitas,
  persen,
  loading,
}: Props) {
  const tone =
    persen >= 90 ? "#dc2626" : persen >= 75 ? "#f59e0b" : COLORS.navy;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Storage Terpakai
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-[15px] text-indigo-900">
          <i className="bi bi-archive" />
        </span>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-[26px] font-extrabold leading-none tracking-tight text-slate-800 tabular-nums">
          {loading ? <span className="text-slate-300">—</span> : `${persen}%`}
        </span>
        <span className="mb-0.5 text-[12px] font-medium text-slate-400">blok regular</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, persen)}%`, background: tone }}
        />
      </div>

      <div className="mt-2 text-[11.5px] text-slate-400 tabular-nums">
        {loading ? "—" : `${fmt(terpakai)} / ${fmt(kapasitas)} kapasitas`}
      </div>
    </div>
  );
}
