"use client";

import { fmt, fmtTanggalSlash, type ExpiredRow } from "../dashboard";
import ChartCard, { EmptyChart } from "./ChartCard";
import type { ExpiredMode } from "../hooks/useDashboardSummary";

type Props = {
  rows: ExpiredRow[];
  mode?: ExpiredMode;
  onModeChange?: (mode: ExpiredMode) => void;
  loading?: boolean;
};

const MODE_OPTS: { value: ExpiredMode; label: string }[] = [
  { value: "h30", label: "H-30" },
  { value: "all", label: "All Time" },
];

export default function ExpiredAlertList({
  rows,
  mode = "h30",
  onModeChange,
  loading,
}: Props) {
  return (
    <ChartCard
      title="Umur Produk — Mendekati Expired"
      subtitle={
        mode === "all"
          ? "Semua stok ber-best-before (muncul sampai stok habis)"
          : "Best before H-30 s/d lewat (muncul sampai stok habis)"
      }
      right={
        <div className="flex items-center gap-2">
          {onModeChange && (
            <div className="flex rounded-full bg-slate-100 p-0.5">
              {MODE_OPTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={loading}
                  onClick={() => mode !== o.value && onModeChange(o.value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    mode === o.value
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  } ${loading ? "opacity-50" : ""}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {rows.length > 0 ? (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11.5px] font-bold text-red-600">
              {rows.length} item
            </span>
          ) : undefined}
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyChart
          label={
            mode === "all"
              ? "Tidak ada stok ber-best-before"
              : "Tidak ada produk mendekati expired"
          }
        />
      ) : (
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2 font-semibold">Product</th>
                <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                <th className="py-2 pr-2 font-semibold">Expired Date</th>
                <th className="py-2 pr-2 font-semibold">Production Date</th>
                <th className="py-2 text-right font-semibold">Aging Day</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const aging = r.aging_hari;
                return (
                  <tr
                    key={`${r.nama_produk}-${r.best_before}-${i}`}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="max-w-[220px] truncate py-2 pr-2 font-medium text-slate-700">
                      {r.nama_produk}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-slate-700">
                      {fmt(r.qty)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-slate-500">
                      {fmtTanggalSlash(r.best_before)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-slate-500">
                      {fmtTanggalSlash(r.production_date)}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          aging === null || aging === undefined
                            ? "bg-slate-100 text-slate-500"
                            : r.expired
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {aging === null || aging === undefined
                          ? "-"
                          : `${fmt(aging)} day`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}
