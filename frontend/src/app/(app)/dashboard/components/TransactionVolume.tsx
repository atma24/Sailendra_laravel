"use client";

import { fmt } from "../dashboard";

type Props = {
  totals: {
    shipment: number;
    so: number;
    gin: number;
    barang_datang: number;
    barang_terkirim: number;
  };
  loading?: boolean;
};

const ITEMS: { key: keyof Props["totals"]; label: string; icon: string }[] = [
  { key: "shipment", label: "Total Shipment", icon: "bi-truck" },
  { key: "so", label: "Total SO", icon: "bi-receipt" },
  { key: "gin", label: "Total GIN", icon: "bi-box-arrow-up" },
  { key: "barang_datang", label: "Barang Datang", icon: "bi-box-arrow-in-down" },
  { key: "barang_terkirim", label: "Barang Terkirim", icon: "bi-send-check" },
];

export default function TransactionVolume({ totals, loading }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-[13.5px] font-bold tracking-tight text-slate-800">
        Volume Transaksi
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ITEMS.map((it) => (
          <div
            key={it.key}
            className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <i className={`bi ${it.icon}`} />
              <span className="truncate">{it.label}</span>
            </div>
            <div className="mt-1.5 text-[20px] font-extrabold leading-none text-slate-800 tabular-nums">
              {loading ? <span className="text-slate-300">—</span> : fmt(totals[it.key])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
