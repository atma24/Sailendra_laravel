"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { apiGet } from "@/lib/api";
import { useSession, lokasiParam, type Session } from "@/lib/auth";

type Summary = {
  mutasi_total: number;
  inbound: { bulan_ini: number; series: { tanggal: string; qty: number }[] };
  outbound: {
    bulan_ini: number;
    pending: number;
    series: { tanggal: string; qty: number }[];
  };
  stock: { zona: Record<string, number>; total_qty: number };
  stok_list: { nama_produk: string; stok: number }[];
  penjualan: { nama_produk: string; qty: number }[];
};

const dashCss = `
:root {
  --primary: #191970;
  --primary-soft: #E8E8F2;
  --success: #16A34A;
  --danger: #DC2626;
  --warning: #D97706;
  --purple: #7C3AED;
  --text-main: #1E293B;
  --text-soft: #64748B;
  --line: #E2E8F0;
  --card-bg: #FFFFFF;
}

.dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }

.filter-form { display: flex; align-items: center; gap: 10px; background: var(--card-bg); padding: 8px 16px; border-radius: 12px; border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.filter-form label { font-size: 13px; font-weight: 700; color: var(--text-main); margin: 0; }
.filter-form input { border: none; outline: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--primary); cursor: pointer; background: transparent; }

.dash-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px; }
.dash-card { display: flex; align-items: center; gap: 16px; background: var(--card-bg); border: 1px solid var(--line); border-radius: 16px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05); transition: transform 0.2s; }
.dash-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }

.dash-icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
.dash-icon-primary { background: var(--primary-soft); color: var(--primary); }
.dash-icon-blue { background: var(--primary-soft); color: var(--primary); }
.dash-icon-red { background: #FEE2E2; color: var(--danger); }
.dash-icon-purple { background: #F3E8FF; color: var(--purple); }
.dash-icon-amber { background: #FEF3C7; color: var(--warning); }

.dash-info { display: flex; flex-direction: column; }
.dash-value { font-size: 22px; font-weight: 800; color: var(--text-main); line-height: 1.2; }
.dash-label { font-size: 12px; font-weight: 600; color: var(--text-soft); }

.dash-alert { display: flex; align-items: center; gap: 12px; background: #FEF2F2; border-left: 4px solid var(--danger); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.alert-icon { color: var(--danger); font-size: 18px; }
.alert-text { font-size: 13px; color: #991B1B; flex: 1; }
.alert-btn { font-size: 12px; font-weight: 700; background: var(--danger); color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; transition: 0.2s; border: 0; cursor: pointer; }
.alert-btn:hover { background: #B91C1C; color: white; }

.dash-charts { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.chart-card, .stok-card { background: var(--card-bg); border: 1px solid var(--line); border-radius: 16px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.dash-card-head { margin-bottom: 16px; }
.dash-card-title { font-size: 16px; font-weight: 800; color: var(--text-main); }
.dash-card-sub { font-size: 12px; color: var(--text-soft); margin-top: 4px; }

.canvas-container { position: relative; height: 280px; width: 100%; }

.stok-wrap { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 5px; }
.stok-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 8px; background: #F8FAFC; }
.stok-rank { width: 22px; height: 22px; flex-shrink: 0; border-radius: 6px; background: var(--primary); color: white; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
.stok-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
.stok-name { font-size: 13px; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stok-qty { font-size: 12px; font-weight: 800; color: var(--success); flex-shrink: 0; }

.dash-empty { text-align: center; padding: 30px; font-size: 14px; font-weight: 600; color: var(--text-soft); }

@media (max-width: 992px) {
  .dash-charts { grid-template-columns: 1fr; }
  .canvas-container { height: 250px; }
}
`;

const fmt = (n: string | number) => new Intl.NumberFormat("id-ID").format(Number(n) || 0);

const ZONAS: [string, string][] = [
  ["normal", "Normal"],
  ["bad", "Bad Stock"],
  ["reject", "Reject"],
  ["receh", "Receh"],
  ["festive", "Festive"],
  ["transit", "Transit"],
  ["hold", "Hold"],
];
const ZONA_COLORS = ["#10B981", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#14B8A6", "#64748B"];

export default function DashboardPage() {
  const session = useSession();
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const lineChartRef = useRef<unknown>(null);
  const pieChartRef = useRef<unknown>(null);
  const barChartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(lokasiParam(session as Session));
    params.set("bulan", bulan);
    apiGet<Summary>(`/dashboard/summary?${params.toString()}`)
      .then((r) => setSummary(r.data || (r as unknown as Summary)))
      .catch(() => setSummary(null));
  }, [session, bulan]);

  const loadCharts = useCallback(() => {
    const Chart = (window as unknown as { Chart?: new (ctx: string | CanvasRenderingContext2D, cfg: unknown) => unknown }).Chart;
    if (!Chart || !summary) return;

    const line = lineRef.current;
    if (line) {
      (lineChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      const ctx = line.getContext("2d")!;
      lineChartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: (summary.inbound?.series || []).map((s) => s.tanggal.slice(8, 10) + "/" + s.tanggal.slice(5, 7)),
          datasets: [
            {
              label: "Barang Masuk",
              data: (summary.inbound?.series || []).map((s) => s.qty),
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
              data: (summary.outbound?.series || []).map((s) => s.qty),
              borderColor: "#DC2626",
              backgroundColor: "transparent",
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 3,
              pointBackgroundColor: "#DC2626",
              tension: 0.3,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { usePointStyle: true, font: { size: 12 } } },
            tooltip: { mode: "index", intersect: false, backgroundColor: "rgba(15, 23, 42, 0.9)" },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: "#F1F5F9" }, ticks: { font: { size: 11 } } },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
          interaction: { mode: "nearest", axis: "x", intersect: false },
        },
      });
    }

    const pie = pieRef.current;
    if (pie) {
      (pieChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      const ctx = pie.getContext("2d");
      if (!ctx) return;
      const zona = (summary.stock?.zona || {}) as Record<string, number>;
      pieChartRef.current = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ZONAS.map((z) => z[1]),
          datasets: [
            {
              data: ZONAS.map((z) => zona[z[0]] || 0),
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
            tooltip: { backgroundColor: "rgba(15, 23, 42, 0.9)" },
          },
        },
      });
    }

    const bar = barRef.current;
    if (bar) {
      (barChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      const ctx = bar.getContext("2d");
      if (!ctx) return;
      const sold = (summary.penjualan || []).map((s) => s.qty);
      barChartRef.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: (summary.penjualan || []).map((s) => s.nama_produk),
          datasets: [
            {
              label: "Kuantitas",
              data: sold,
              backgroundColor: "rgba(124, 58, 237, 0.7)",
              borderColor: "#7C3AED",
              borderWidth: 1,
              borderRadius: 4,
              barThickness: 26,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 10 } },
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "rgba(15, 23, 42, 0.9)" },
          },
          scales: {
            x: { beginAtZero: true, grid: { color: "#F1F5F9" }, ticks: { font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { font: { size: 11 } } },
          },
        },
      });
    }
  }, [summary]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  useEffect(() => {
    return () => {
      (lineChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      (pieChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      (barChartRef.current as { destroy?: () => void } | null)?.destroy?.();
    };
  }, []);

  if (!session) return null;

  const bulanLabelFull = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(`${bulan}-01`)
  );

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js"
        strategy="afterInteractive"
        onReady={loadCharts}
        onLoad={loadCharts}
      />
      <style>{dashCss}</style>

      <div className="dash-header">
        <form className="filter-form" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="bulan">
            <i className="bi bi-calendar-month"></i> Periode:
          </label>
          <input type="month" id="bulan" value={bulan} onChange={(e) => setBulan(e.target.value)} />
        </form>
      </div>

      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-icon dash-icon-blue"><i className="bi bi-box-arrow-in-down"></i></div>
          <div className="dash-info">
            <div className="dash-value">{fmt(summary?.inbound?.bulan_ini ?? 0)}</div>
            <div className="dash-label">Masuk Bulan Ini</div>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-icon dash-icon-red"><i className="bi bi-box-arrow-up"></i></div>
          <div className="dash-info">
            <div className="dash-value">{fmt(summary?.outbound?.bulan_ini ?? 0)}</div>
            <div className="dash-label">Keluar Bulan Ini</div>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-icon dash-icon-purple"><i className="bi bi-arrow-left-right"></i></div>
          <div className="dash-info">
            <div className="dash-value">{fmt(summary?.mutasi_total ?? 0)}</div>
            <div className="dash-label">Total Mutasi</div>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-icon dash-icon-amber"><i className="bi bi-boxes"></i></div>
          <div className="dash-info">
            <div className="dash-value">{fmt(summary?.stock?.total_qty ?? 0)}</div>
            <div className="dash-label">Total Stok Fisik</div>
          </div>
        </div>
      </div>

      {(summary?.outbound?.pending ?? 0) > 0 && (
        <div className="dash-alert">
          <div className="alert-icon"><i className="bi bi-exclamation-triangle-fill"></i></div>
          <div className="alert-text">
            Terdapat <strong>{Number(summary?.outbound?.pending || 0)} transaksi keluar</strong> yang belum dikonfirmasi.
          </div>
          <button type="button" className="alert-btn">Tindak Lanjuti</button>
        </div>
      )}

      <div className="dash-charts">
        <div className="chart-card line-chart-wrapper">
          <div className="dash-card-head">
            <div className="dash-card-title">Tren Transaksi (Harian)</div>
            <div className="dash-card-sub">
              Perbandingan kuantitas barang masuk &amp; keluar selama bulan {bulanLabelFull}
            </div>
          </div>
          <div className="canvas-container">
            <canvas id="lineChart" ref={lineRef}></canvas>
          </div>
        </div>

        <div className="chart-card pie-chart-wrapper">
          <div className="dash-card-head">
            <div className="dash-card-title">Distribusi Zona Stok</div>
            <div className="dash-card-sub">Berdasarkan kuantitas barang</div>
          </div>
          <div className="canvas-container">
            <canvas id="pieChart" ref={pieRef}></canvas>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="chart-card">
          <div className="dash-card-head">
            <div className="dash-card-title">Penjualan Barang (Bulanan)</div>
            <div className="dash-card-sub">
              Item &amp; kuantitas keluar selama bulan {bulanLabelFull}
            </div>
          </div>
          <div
            className="canvas-container"
            style={{ height: Math.max(280, (summary?.penjualan?.length ?? 0) * 36 + 40) }}
          >
            <canvas id="barChart" ref={barRef}></canvas>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="stok-card">
          <div className="dash-card-head">
            <div className="dash-card-title">Daftar Stok Produk Tersedia</div>
            <div className="dash-card-sub">Produk dengan stok fisik aktif</div>
          </div>
          {!summary?.stok_list?.length ? (
            <div className="dash-empty">
              <i className="bi bi-inbox text-muted" style={{ fontSize: "2rem" }}></i>
              <br />
              Belum ada data stok.
            </div>
          ) : (
            <div className="stok-wrap">
              {summary.stok_list.map((t, i) => (
                <div className="stok-row" key={i}>
                  <span className="stok-main">
                    <span className="stok-rank">{i + 1}</span>
                    <span className="stok-name">{t.nama_produk}</span>
                  </span>
                  <span className="stok-qty">{fmt(t.stok)} Stok</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}