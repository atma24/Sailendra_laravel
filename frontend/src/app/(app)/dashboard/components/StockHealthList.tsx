"use client";

import { useMemo, useState } from "react";
import { fmt } from "../dashboard";
import ChartCard, { EmptyChart } from "./ChartCard";

type Props = { rows: { nama_produk: string; stok: number; satuan?: string }[] };

export default function StockHealthList({ rows }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const key = q.toLowerCase();
    return rows.filter((r) => r.nama_produk.toLowerCase().includes(key));
  }, [rows, q]);

  return (
    <ChartCard
      title="Ketersediaan Stok"
      subtitle={`${fmt(rows.length)} produk`}
      right={
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari produk..."
          className="h-8 w-44 rounded-lg border border-slate-200 px-2.5 text-[12px] outline-none focus:border-indigo-400"
        />
      }
    >
      {filtered.length === 0 ? (
        <EmptyChart label="Tidak ada produk" />
      ) : (
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2 font-semibold">Produk</th>
                <th className="py-2 text-right font-semibold">Stok</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.nama_produk}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="max-w-[300px] truncate py-2 pr-2 font-medium text-slate-700">
                    {r.nama_produk}
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold text-slate-700">
                    {fmt(r.stok)}
                    {r.satuan && (
                      <span className="ml-1 text-[11px] font-normal text-slate-400">
                        {r.satuan}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}
