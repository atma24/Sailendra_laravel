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

const statusClass = (status: unknown, expired: boolean) => {
  const s = String(status || (expired ? "Expired" : "Fresh"));
  if (s === "Expired" || expired)
    return "bg-red-100 text-red-700";
  if (s === "Warning")
    return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
};

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
        <div className="max-h-[340px] overflow-auto">
          <table className="w-full min-w-[880px] text-[12px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2 font-semibold">Produk</th>
                <th className="py-2 pr-2 font-semibold">Batch</th>
                <th className="py-2 pr-2 font-semibold">Tgl Produksi</th>
                <th className="py-2 pr-2 font-semibold">Tgl Inbound</th>
                <th className="py-2 pr-2 font-semibold">Best Before</th>
                <th className="py-2 pr-2 font-semibold">Lokasi</th>
                <th className="py-2 pr-2 text-right font-semibold">Kuantiti</th>
                <th className="py-2 pr-2 text-right font-semibold">Aging (Hari)</th>
                <th className="py-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const aging = r.aging_hari;
                const isFallback = Boolean(r.production_fallback);
                const status = r.status || (r.expired ? "Expired" : "Fresh");
                return (
                  <tr
                    key={`${r.nama_produk}-${r.batch || ""}-${r.best_before}-${i}`}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="max-w-[180px] truncate py-2 pr-2 font-medium text-slate-700">
                      {r.nama_produk}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-slate-500">
                      {r.batch || "-"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-slate-500">
                      {fmtTanggalSlash(r.production_date)}
                      {isFallback && r.production_date ? (
                        <span
                          className="ml-1 font-bold text-amber-600"
                          title="Data lama: fallback ke tanggal masuk"
                        >
                          *
                        </span>
                      ) : undefined}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-slate-500">
                      {fmtTanggalSlash(r.tanggal_masuk)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-slate-500">
                      {fmtTanggalSlash(r.best_before)}
                    </td>
                    <td className="max-w-[140px] truncate py-2 pr-2 text-slate-500">
                      {r.lokasi || "-"}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-slate-700">
                      {fmt(r.qty)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-slate-700">
                      {aging === null || aging === undefined ? "-" : fmt(aging)}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${statusClass(status, r.expired)}`}
                        title={
                          r.sisa_hari === null || r.sisa_hari === undefined
                            ? undefined
                            : `Sisa ${fmt(r.sisa_hari)} hari ke best before`
                        }
                      >
                        {status}
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
