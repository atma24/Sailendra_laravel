"use client";

import { fmt, fmtTanggalFull, type ExpiredRow } from "../dashboard";
import ChartCard, { EmptyChart } from "./ChartCard";

type Props = { rows: ExpiredRow[] };

export default function ExpiredAlertList({ rows }: Props) {
  return (
    <ChartCard
      title="Umur Produk — Mendekati Expired"
      subtitle="Best before H-30 s/d lewat (muncul sampai batch habis)"
      right={
        rows.length > 0 ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11.5px] font-bold text-red-600">
            {rows.length} batch
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyChart label="Tidak ada produk mendekati expired" />
      ) : (
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2 font-semibold">Produk</th>
                <th className="py-2 pr-2 font-semibold">Batch</th>
                <th className="py-2 pr-2 font-semibold">Lokasi</th>
                <th className="py-2 pr-2 font-semibold">Best Before</th>
                <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const expired = r.expired;
                const soon = !expired && (r.sisa_hari ?? 99) <= 7;
                return (
                  <tr
                    key={`${r.nama_produk}-${r.batch}-${i}`}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="max-w-[220px] truncate py-2 pr-2 font-medium text-slate-700">
                      {r.nama_produk}
                    </td>
                    <td className="py-2 pr-2 text-slate-500">{r.batch}</td>
                    <td className="py-2 pr-2 text-slate-500">{r.lokasi}</td>
                    <td className="py-2 pr-2 text-slate-500">
                      {fmtTanggalFull(r.best_before)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-slate-700">
                      {fmt(r.qty)}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          expired
                            ? "bg-red-100 text-red-700"
                            : soon
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {expired ? "Expired" : `${r.sisa_hari ?? "-"} hari`}
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
