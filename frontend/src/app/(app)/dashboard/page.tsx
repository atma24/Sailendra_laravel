"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Chart from "chart.js/auto";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

const ZONA_LABEL: Record<string, string> = {
  normal: "Normal",
  bad: "Bad Stock",
  reject: "Reject",
  receh: "Receh",
  festive: "Festive",
  transit: "Transit",
  hold: "Hold",
};
const ZONA_COLORS = ["#10B981", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#14B8A6", "#64748B"];

function formatAngka(n: number) {
  return new Intl.NumberFormat("id-ID").format(n || 0);
}

export default function DashboardPage() {
  const lineRef = useRef<HTMLCanvasElement>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);
  const [summary, setSummary] = useState<any>(null);
  const [bulan, setBulan] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      setError("Sesi berakhir, silakan login ulang.");
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet(`/dashboard/summary?bulan=${bulan}&${lokasiParam(s)}`)
      .then((r) => setSummary(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bulan]);

  const inbound = summary?.inbound || { bulan_ini: 0, series: [] };
  const outbound = summary?.outbound || { bulan_ini: 0, pending: 0, top10: [], series: [] };
  const stock = summary?.stock || { zona: {}, total_qty: 0 };

  const lineData = useMemo(() => {
    const labels = inbound.series.map((s: any) => {
      const [, m, d] = s.tanggal.split("-");
      return `${d}/${m}`;
    });
    const masuk = inbound.series.map((s: any) => s.qty);
    const keluar = outbound.series.map((s: any) => s.qty);
    return { labels, masuk, keluar };
  }, [inbound, outbound]);

  useEffect(() => {
    if (!summary || !lineRef.current || !pieRef.current) return;

    const line = new Chart(lineRef.current, {
      type: "line",
      data: {
        labels: lineData.labels,
        datasets: [
          {
            label: "Barang Masuk",
            data: lineData.masuk,
            borderColor: "#0284C7",
            backgroundColor: "rgba(2, 132, 199, 0.1)",
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#0284C7",
            tension: 0.3,
            fill: true,
          },
          {
            label: "Barang Keluar",
            data: lineData.keluar,
            borderColor: "#DC2626",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 3,
            pointBackgroundColor: "#DC2626",
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { usePointStyle: true, font: { size: 12 } } },
          tooltip: { mode: "index", intersect: false, backgroundColor: "rgba(15,23,42,0.9)" },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#F1F5F9" } },
          x: { grid: { display: false } },
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
      },
    });

    const zonaKeys = Object.keys(stock.zona);
    const pie = new Chart(pieRef.current, {
      type: "doughnut",
      data: {
        labels: zonaKeys.map((k) => ZONA_LABEL[k] || k),
        datasets: [
          {
            data: zonaKeys.map((k) => stock.zona[k]),
            backgroundColor: ZONA_COLORS,
            borderWidth: 2,
            borderColor: "#ffffff",
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { position: "right", labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
          tooltip: { backgroundColor: "rgba(15,23,42,0.9)" },
        },
      },
    });

    return () => {
      line.destroy();
      pie.destroy();
    };
  }, [summary, lineData, stock]);

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  const bulanLabel = new Date(`${bulan}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const cards = [
    { icon: "bi-box-seam", cls: "dash-icon-primary", value: summary.produk_total, label: "Total Produk (SKU)" },
    { icon: "bi-factory", cls: "dash-icon-primary", value: summary.plant_total, label: "Total Plant" },
    { icon: "bi-box-arrow-in-down", cls: "dash-icon-blue", value: inbound.bulan_ini, label: "Masuk Bulan Ini" },
    { icon: "bi-box-arrow-up", cls: "dash-icon-red", value: outbound.bulan_ini, label: "Keluar Bulan Ini" },
    { icon: "bi-arrow-left-right", cls: "dash-icon-purple", value: summary.mutasi_total, label: "Total Mutasi" },
    { icon: "bi-boxes", cls: "dash-icon-amber", value: stock.total_qty, label: "Total Stok Fisik" },
  ];

  const iconColor: Record<string, string> = {
    "dash-icon-primary": "bg-[#e8e8f2] text-[#191970]",
    "dash-icon-blue": "bg-[#e8e8f2] text-[#191970]",
    "dash-icon-red": "bg-[#fee2e2] text-[#dc2626]",
    "dash-icon-purple": "bg-[#f3e8ff] text-[#7c3aed]",
    "dash-icon-amber": "bg-[#fef3c7] text-[#d97706]",
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <label className="text-[13px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1 inline"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Periode:
          </label>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="cursor-pointer bg-transparent text-sm font-semibold text-[#191970] outline-none"
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] transition hover:-translate-y-[3px] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]"
          >
            <div className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl text-2xl ${iconColor[c.cls]}`}>
              <i className={`bi ${c.icon}`} />
            </div>
            <div className="flex flex-col">
              <div className="text-[22px] font-extrabold leading-tight">{formatAngka(c.value)}</div>
              <div className="text-[12px] font-semibold text-[#6b7280]">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {outbound.pending > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border-l-4 border-[#ef2b2d] bg-[#fef2f2] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="text-lg text-[#ef2b2d]">
            <i className="bi bi-exclamation-triangle-fill" />
          </div>
          <div className="flex-1 text-[13px] font-bold text-[#991b1b]">
            Terdapat <strong>{outbound.pending}</strong> transaksi keluar yang belum dikonfirmasi.
          </div>
          <Link
            href="/outbound"
            className="rounded-md bg-[#ef2b2d] px-3 py-1.5 text-[12px] font-bold text-white no-underline transition hover:bg-[#b91c1c]"
          >
            Tindak Lanjuti
          </Link>
        </div>
      )}

      <div className="mb-4 grid grid-cols-[2fr_1fr] gap-4 max-lg:grid-cols-1">
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="mb-4">
            <div className="text-base font-extrabold">Tren Transaksi (Harian)</div>
            <div className="mt-1 text-[12px] text-[#6b7280]">
              Perbandingan kuantitas barang masuk & keluar selama bulan {bulanLabel}
            </div>
          </div>
          <div className="relative h-[280px] w-full">
            <canvas ref={lineRef} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="mb-4">
            <div className="text-base font-extrabold">Distribusi Zona Stok</div>
            <div className="mt-1 text-[12px] text-[#6b7280]">Berdasarkan kuantitas barang</div>
          </div>
          <div className="relative h-[280px] w-full">
            <canvas ref={pieRef} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="mb-4">
          <div className="text-base font-extrabold">Top 10 Barang Terlaris</div>
          <div className="mt-1 text-[12px] text-[#6b7280]">Bulan {bulanLabel}</div>
        </div>
        {outbound.top10.length === 0 ? (
          <div className="p-[30px] text-center text-sm font-semibold text-[#6b7280]">
            <i className="bi bi-inbox mb-2 block text-[2rem] opacity-60" />
            Belum ada data transaksi.
          </div>
        ) : (
          <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
            {outbound.top10.map((t: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-2.5 py-2"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-[#191970] text-[11px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span className="truncate text-[13px] font-bold">{t.nama_produk}</span>
                </span>
                <span className="shrink-0 text-[12px] font-extrabold text-[#16a34a]">
                  {formatAngka(t.qty)} Qty
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}