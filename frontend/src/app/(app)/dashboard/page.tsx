"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
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
  stok_list: { nama_produk: string; stok: number; satuan?: string }[];
  penjualan: { nama_produk: string; qty: number }[];
};

const dashCss = `
:root {
  --primary-navy: #191970;
  --primary-navy-hover: #121254;
  --primary-navy-soft: #EEF2FF;
  --primary-navy-border: #C7D2FE;
  
  --danger-red: #DC2626;
  --danger-red-soft: #FEF2F2;
  --danger-red-border: #FCA5A5;
  
  --success-green: #10B981;
  --success-green-soft: #ECFDF5;
  
  --warning-amber: #F59E0B;
  --warning-amber-soft: #FFFBEB;
  
  --text-dark: #0F172A;
  --text-medium: #475569;
  --text-muted: #64748B;
  --text-light: #94A3B8;
  
  --bg-page: #F8FAFC;
  --bg-card: #FFFFFF;
  --border-light: #E2E8F0;
  --border-subtle: #F1F5F9;
}

.dash-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

/* Header & Welcome Banner */
.dash-welcome-card {
  background: linear-gradient(135deg, #191970 0%, #2A2A8F 100%);
  border-radius: 20px;
  padding: 24px 28px;
  color: #FFFFFF;
  box-shadow: 0 10px 25px -5px rgba(25, 25, 112, 0.25);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  position: relative;
  overflow: hidden;
}

.dash-welcome-card::before {
  content: "";
  position: absolute;
  top: -40px;
  right: -40px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.dash-welcome-card::after {
  content: "";
  position: absolute;
  bottom: -50px;
  right: 120px;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  pointer-events: none;
}

.welcome-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 1;
}

.welcome-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  width: fit-content;
}

.welcome-title {
  font-size: 24px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.welcome-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.dash-filter-pill {
  z-index: 1;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 14px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dash-filter-pill label {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.dash-filter-pill input[type="month"] {
  background: #FFFFFF;
  color: var(--primary-navy);
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 700;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Metric KPI Cards Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.03);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  position: relative;
  overflow: hidden;
}

.kpi-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--card-accent, var(--primary-navy));
}

.kpi-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 20px -5px rgba(15, 23, 42, 0.08);
  border-color: var(--card-border-hover, var(--primary-navy-border));
}

.kpi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kpi-icon-wrapper {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  transition: transform 0.2s;
}

.kpi-card:hover .kpi-icon-wrapper {
  transform: scale(1.08);
}

.kpi-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-medium);
  margin: 0;
}

.kpi-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-dark);
  letter-spacing: -0.5px;
  line-height: 1.1;
  margin-top: 4px;
}

.kpi-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
  border-top: 1px dashed var(--border-subtle);
  padding-top: 12px;
}

.kpi-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

/* Card Specific Themes */
.kpi-inbound {
  --card-accent: var(--success-green);
  --card-border-hover: #A7F3D0;
}
.kpi-inbound .kpi-icon-wrapper {
  background: var(--success-green-soft);
  color: var(--success-green);
}
.kpi-inbound .kpi-tag {
  background: var(--success-green-soft);
  color: var(--success-green);
}

.kpi-outbound {
  --card-accent: var(--danger-red);
  --card-border-hover: var(--danger-red-border);
}
.kpi-outbound .kpi-icon-wrapper {
  background: var(--danger-red-soft);
  color: var(--danger-red);
}
.kpi-outbound .kpi-tag {
  background: var(--danger-red-soft);
  color: var(--danger-red);
}

.kpi-mutasi {
  --card-accent: var(--primary-navy);
  --card-border-hover: var(--primary-navy-border);
}
.kpi-mutasi .kpi-icon-wrapper {
  background: var(--primary-navy-soft);
  color: var(--primary-navy);
}
.kpi-mutasi .kpi-tag {
  background: var(--primary-navy-soft);
  color: var(--primary-navy);
}

.kpi-stock {
  --card-accent: var(--warning-amber);
  --card-border-hover: #FDE68A;
}
.kpi-stock .kpi-icon-wrapper {
  background: var(--warning-amber-soft);
  color: var(--warning-amber);
}
.kpi-stock .kpi-tag {
  background: var(--warning-amber-soft);
  color: var(--warning-amber);
}

/* Alert Widget */
.dash-alert-banner {
  background: linear-gradient(90deg, #FEF2F2 0%, #FFFFFF 100%);
  border: 1px solid var(--danger-red-border);
  border-left: 5px solid var(--danger-red);
  border-radius: 14px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.06);
}

.dash-alert-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.dash-alert-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #FEE2E2;
  color: var(--danger-red);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.dash-alert-text {
  font-size: 13px;
  color: #7F1D1D;
  margin: 0;
  line-height: 1.4;
}

.dash-alert-text strong {
  color: var(--danger-red);
  font-weight: 800;
}

.dash-alert-btn {
  background: var(--danger-red);
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.2);
}

.dash-alert-btn:hover {
  background: #B91C1C;
  color: #FFFFFF;
  box-shadow: 0 4px 10px rgba(220, 38, 38, 0.3);
}

/* Section Grid Layout */
.dash-main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.chart-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.03);
  display: flex;
  flex-direction: column;
}

.chart-card-full {
  grid-column: 1 / -1;
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
  gap: 10px;
}

.card-header-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-dark);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.card-header-title i {
  color: var(--primary-navy);
  font-size: 18px;
}

.card-header-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.canvas-wrapper {
  position: relative;
  width: 100%;
  height: 290px;
}

/* Stock Health Section */
.multi-select-container {
  position: relative;
  min-width: 200px;
}

.multi-select-btn {
  background: var(--bg-page);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}

.multi-select-btn:hover {
  border-color: var(--primary-navy);
  background: #FFFFFF;
}

.multi-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 260px;
  max-height: 240px;
  overflow-y: auto;
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  z-index: 50;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.multi-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dark);
  cursor: pointer;
  user-select: none;
}

.multi-select-item:hover {
  background: var(--primary-navy-soft);
  color: var(--primary-navy);
}

.multi-select-item input[type="checkbox"] {
  accent-color: var(--primary-navy);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.multi-select-clear {
  font-size: 11px;
  color: var(--danger-red);
  font-weight: 700;
  padding: 4px 8px;
  text-align: right;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 4px;
}

.multi-select-clear:hover {
  text-decoration: underline;
}

.stock-search-box {
  position: relative;
  margin-bottom: 12px;
}

.stock-search-box input {
  width: 100%;
  padding: 8px 14px 8px 36px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  font-size: 13px;
  outline: none;
  background: var(--bg-page);
  transition: all 0.2s;
}

.stock-search-box input:focus {
  background: #FFFFFF;
  border-color: var(--primary-navy);
  box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.08);
}

.stock-search-box i {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-light);
  font-size: 14px;
}

.stock-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 330px;
  overflow-y: auto;
  padding-right: 4px;
}

.stock-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--bg-page);
  border: 1px solid var(--border-subtle);
  transition: background 0.15s;
  gap: 12px;
}

.stock-item-row:hover {
  background: #F1F5F9;
}

.stock-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.stock-rank-badge {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--primary-navy-soft);
  color: var(--primary-navy);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stock-item-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.stock-item-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-progress-bar {
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: #E2E8F0;
  margin-top: 6px;
  overflow: hidden;
}

.stock-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--primary-navy) 0%, #3B82F6 100%);
  transition: width 0.4s ease;
}

.stock-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.stock-count-text {
  font-size: 13px;
  font-weight: 800;
  color: var(--primary-navy);
}

.stock-status-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-safe { background: var(--success-green-soft); color: var(--success-green); }
.tag-warning { background: var(--warning-amber-soft); color: var(--warning-amber); }
.tag-danger { background: var(--danger-red-soft); color: var(--danger-red); }

.dash-empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

.dash-empty-icon {
  font-size: 36px;
  color: var(--text-light);
  margin-bottom: 8px;
}

@media (max-width: 1024px) {
  .dash-main-grid {
    grid-template-columns: 1fr;
  }
  .chart-card-full {
    grid-column: auto;
  }
}

@media (max-width: 640px) {
  .dash-welcome-card {
    padding: 18px 20px;
  }
  .welcome-title {
    font-size: 20px;
  }
  .dash-filter-pill {
    width: 100%;
    justify-content: space-between;
  }
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  .dash-alert-banner {
    flex-direction: column;
    align-items: flex-start;
  }
  .dash-alert-btn {
    width: 100%;
    justify-content: center;
  }
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
  ["qi", "QI"],
];

// High-contrast color palette using Navy, Red, Amber, Emerald, Indigo, Slate & Bright Yellow for QI
const ZONA_COLORS = [
  "#10B981", // Normal - Emerald Green
  "#DC2626", // Bad Stock - Crimson Red
  "#EF4444", // Reject - Light Red
  "#F59E0B", // Receh - Amber
  "#6366F1", // Festive - Indigo
  "#0EA5E9", // Transit - Sky Blue
  "#64748B", // Hold - Slate
  "#FACC15", // QI - Bright Yellow
];

export default function DashboardPage() {
  const session = useSession();
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stokSearch, setStokSearch] = useState("");
  const [selectedProduks, setSelectedProduks] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAllPenjualan, setShowAllPenjualan] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    if (selectedProduks.length > 0) {
      params.set("produk", selectedProduks.join(","));
    }
    apiGet<Summary>(`/dashboard/summary?${params.toString()}`)
      .then((r) => setSummary(r.data || (r as unknown as Summary)))
      .catch(() => setSummary(null));
  }, [session, bulan, selectedProduks]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadCharts = useCallback(() => {
    const Chart = (window as unknown as { Chart?: new (ctx: string | CanvasRenderingContext2D, cfg: unknown) => unknown }).Chart;
    if (!Chart || !summary) return;

    // Line Chart: Daily Inbound vs Outbound
    const line = lineRef.current;
    if (line) {
      (lineChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      const ctx = line.getContext("2d")!;

      const navyGrad = ctx.createLinearGradient(0, 0, 0, 250);
      navyGrad.addColorStop(0, "rgba(25, 25, 112, 0.25)");
      navyGrad.addColorStop(1, "rgba(25, 25, 112, 0.0)");

      lineChartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: (summary.inbound?.series || []).map((s) => s.tanggal.slice(8, 10) + "/" + s.tanggal.slice(5, 7)),
          datasets: [
            {
              label: "Barang Masuk (Inbound)",
              data: (summary.inbound?.series || []).map((s) => s.qty),
              borderColor: "#191970",
              backgroundColor: navyGrad,
              borderWidth: 2.5,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: "#191970",
              tension: 0.3,
              fill: true,
            },
            {
              label: "Barang Keluar (Outbound)",
              data: (summary.outbound?.series || []).map((s) => s.qty),
              borderColor: "#DC2626",
              backgroundColor: "transparent",
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 3,
              pointHoverRadius: 5,
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
            legend: {
              position: "top",
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                font: { size: 12, weight: "700", family: "inherit" },
                padding: 16,
              },
            },
            tooltip: {
              backgroundColor: "#0F172A",
              titleFont: { size: 12, weight: "bold" },
              bodyFont: { size: 12 },
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "#F1F5F9" },
              ticks: { font: { size: 11, weight: "600" }, color: "#64748B" },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: "600" }, color: "#64748B" },
            },
          },
          interaction: { mode: "nearest", axis: "x", intersect: false },
        },
      });
    }

    // Doughnut Chart: Zona Stock Breakdown
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
              borderWidth: 3,
              borderColor: "#FFFFFF",
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: {
              position: "right",
              labels: {
                usePointStyle: true,
                padding: 12,
                font: { size: 11, weight: "600", family: "inherit" },
              },
            },
            tooltip: {
              backgroundColor: "#0F172A",
              padding: 10,
              cornerRadius: 8,
            },
          },
        },
      });
    }

    // Bar Chart: Top Sales Product
    const bar = barRef.current;
    if (bar) {
      (barChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      const ctx = bar.getContext("2d");
      if (!ctx) return;

      const rawPenjualan = summary.penjualan || [];
      const displayPenjualan = showAllPenjualan ? rawPenjualan : rawPenjualan.slice(0, 5);

      // In Chart.js horizontal bar chart (indexAxis: 'y'), the first element in data/labels is displayed at the top.
      const labels = displayPenjualan.map((s) => s.nama_produk);
      const sold = displayPenjualan.map((s) => s.qty);

      barChartRef.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Kuantitas Terjual",
              data: sold,
              backgroundColor: "#191970",
              hoverBackgroundColor: "#2A2A8F",
              borderRadius: 6,
              barThickness: 24,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0F172A",
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: "#F1F5F9" },
              ticks: { font: { size: 11, weight: "600" }, color: "#64748B" },
            },
            y: {
              reverse: false,
              grid: { display: false },
              ticks: { font: { size: 11, weight: "600" }, color: "#334155" },
            },
          },
        },
      });
    }
  }, [summary]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts, showAllPenjualan]);

  useEffect(() => {
    return () => {
      (lineChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      (pieChartRef.current as { destroy?: () => void } | null)?.destroy?.();
      (barChartRef.current as { destroy?: () => void } | null)?.destroy?.();
    };
  }, []);

  const filteredStok = useMemo(() => {
    if (!summary?.stok_list) return [];
    if (!stokSearch.trim()) return summary.stok_list;
    const q = stokSearch.toLowerCase();
    return summary.stok_list.filter((s) => s.nama_produk.toLowerCase().includes(q));
  }, [summary, stokSearch]);

  const maxStokVal = useMemo(() => {
    if (!summary?.stok_list?.length) return 1;
    return Math.max(...summary.stok_list.map((s) => s.stok)) || 1;
  }, [summary]);

  const namaGudang = useMemo(() => {
    if (!session) return "Gudang Utama";
    const u = session.user;
    if (u.nama_pengguna_lokasi && u.nama_pengguna_lokasi.trim() !== "") {
      return u.nama_pengguna_lokasi;
    }
    return "Gudang Utama";
  }, [session]);

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

      <div className="dash-container">
        {/* Welcome & Filter Banner */}
        <div className="dash-welcome-card">
          <div className="welcome-info">
            <div className="welcome-badge">
              <i className="bi bi-building"></i> Gudang {namaGudang}
            </div>
            <h1 className="welcome-title">Ringkasan Operasional Gudang</h1>
            <p className="welcome-sub">
              Monitor arus barang masuk, barang keluar, dan ketersediaan stok fisik periode {bulanLabelFull}
            </p>
          </div>
          <div className="dash-filter-pill">
            <label htmlFor="bulan">
              <i className="bi bi-calendar-range"></i> Periode Bulan:
            </label>
            <input
              type="month"
              id="bulan"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
            />
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-inbound">
            <div className="kpi-header">
              <div>
                <div className="kpi-title">Barang Masuk</div>
                <div className="kpi-value">{fmt(summary?.inbound?.bulan_ini ?? 0)}</div>
              </div>
              <div className="kpi-icon-wrapper">
                <i className="bi bi-box-arrow-in-down"></i>
              </div>
            </div>
            <div className="kpi-footer">
              <span className="kpi-tag"><i className="bi bi-arrow-down-right"></i> Total Inbound</span>
              <span>Periode {bulanLabelFull}</span>
            </div>
          </div>

          <div className="kpi-card kpi-outbound">
            <div className="kpi-header">
              <div>
                <div className="kpi-title">Barang Keluar</div>
                <div className="kpi-value">{fmt(summary?.outbound?.bulan_ini ?? 0)}</div>
              </div>
              <div className="kpi-icon-wrapper">
                <i className="bi bi-box-arrow-up"></i>
              </div>
            </div>
            <div className="kpi-footer">
              <span className="kpi-tag"><i className="bi bi-arrow-up-right"></i> Total Outbound</span>
              <span>Periode {bulanLabelFull}</span>
            </div>
          </div>

          <div className="kpi-card kpi-mutasi">
            <div className="kpi-header">
              <div>
                <div className="kpi-title">Total Mutasi</div>
                <div className="kpi-value">{fmt(summary?.mutasi_total ?? 0)}</div>
              </div>
              <div className="kpi-icon-wrapper">
                <i className="bi bi-arrow-left-right"></i>
              </div>
            </div>
            <div className="kpi-footer">
              <span className="kpi-tag"><i className="bi bi-shuffle"></i> Pergerakan</span>
              <span>Aktivitas perpindahan barang</span>
            </div>
          </div>

          <div className="kpi-card kpi-stock">
            <div className="kpi-header">
              <div>
                <div className="kpi-title">Total Stok Fisik</div>
                <div className="kpi-value">{fmt(summary?.stock?.total_qty ?? 0)}</div>
              </div>
              <div className="kpi-icon-wrapper">
                <i className="bi bi-boxes"></i>
              </div>
            </div>
            <div className="kpi-footer">
              <span className="kpi-tag"><i className="bi bi-check-circle"></i> Stok Aktif</span>
              <span>Di seluruh zona penyimpanan</span>
            </div>
          </div>
        </div>

        {/* Alert Outbound Pending */}
        {(summary?.outbound?.pending ?? 0) > 0 && (
          <div className="dash-alert-banner">
            <div className="dash-alert-content">
              <div className="dash-alert-icon">
                <i className="bi bi-exclamation-triangle-fill"></i>
              </div>
              <p className="dash-alert-text">
                Terdapat <strong>{Number(summary?.outbound?.pending || 0)} transaksi keluar</strong> yang masih dalam status pending / belum dikonfirmasi.
              </p>
            </div>
            <Link href="/outbound" className="dash-alert-btn">
              Tindak Lanjuti <i className="bi bi-arrow-right-short"></i>
            </Link>
          </div>
        )}

        {/* Main Analytics Grid */}
        <div className="dash-main-grid">
          {/* Trend Line Chart */}
          <div className="chart-card">
            <div className="card-header-flex">
              <div>
                <h3 className="card-header-title">
                  <i className="bi bi-graph-up"></i> Tren Transaksi Harian
                </h3>
                <div className="card-header-sub">
                  Perbandingan kuantitas barang masuk &amp; keluar bulan {bulanLabelFull}
                </div>
              </div>
            </div>
            <div className="canvas-wrapper">
              <canvas id="lineChart" ref={lineRef}></canvas>
            </div>
          </div>

          {/* Zona Stock Doughnut Chart */}
          <div className="chart-card">
            <div className="card-header-flex">
              <div>
                <h3 className="card-header-title">
                  <i className="bi bi-pie-chart-fill"></i> Distribusi Zona Stok
                </h3>
                <div className="card-header-sub">Persentase barang berdasarkan kategori zona gudang</div>
              </div>
              <div className="multi-select-container" ref={dropdownRef}>
                <button
                  type="button"
                  className="multi-select-btn"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span>
                    {selectedProduks.length === 0
                      ? "Semua Produk"
                      : `${selectedProduks.length} Produk Dipilih`}
                  </span>
                  <i className={`bi bi-chevron-${isDropdownOpen ? "up" : "down"}`}></i>
                </button>
                {isDropdownOpen && (
                  <div className="multi-select-dropdown">
                    {selectedProduks.length > 0 && (
                      <div
                        className="multi-select-clear"
                        onClick={() => setSelectedProduks([])}
                      >
                        Reset Pilihan (Semua)
                      </div>
                    )}
                    {(summary?.stok_list || []).map((p, i) => {
                      const isChecked = selectedProduks.includes(p.nama_produk);
                      return (
                        <label key={i} className="multi-select-item">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedProduks(selectedProduks.filter((name) => name !== p.nama_produk));
                              } else {
                                setSelectedProduks([...selectedProduks, p.nama_produk]);
                              }
                            }}
                          />
                          <span className="text-truncate">{p.nama_produk}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="canvas-wrapper">
              <canvas id="pieChart" ref={pieRef}></canvas>
            </div>
          </div>

          {/* Penjualan Bar Chart */}
          <div className="chart-card">
            <div className="card-header-flex">
              <div>
                <h3 className="card-header-title">
                  <i className="bi bi-bag-check-fill"></i> Barang Keluar Terbanyak
                </h3>
                <div className="card-header-sub">
                  {showAllPenjualan ? "Seluruh produk keluar" : "Top 5 produk keluar terbanyak"} di bulan {bulanLabelFull}
                </div>
              </div>
              {(summary?.penjualan?.length ?? 0) > 5 && (
                <button
                  type="button"
                  className="multi-select-btn"
                  style={{ width: "auto" }}
                  onClick={() => setShowAllPenjualan(!showAllPenjualan)}
                >
                  <span>{showAllPenjualan ? "Tampilkan Top 5" : "Lihat Semua"}</span>
                  <i className={`bi bi-${showAllPenjualan ? "dash-circle" : "plus-circle"}`}></i>
                </button>
              )}
            </div>
            <div
              className="canvas-wrapper"
              style={{
                height: Math.max(
                  290,
                  (showAllPenjualan
                    ? summary?.penjualan?.length ?? 0
                    : Math.min(5, summary?.penjualan?.length ?? 0)) * 42 + 20
                ),
              }}
            >
              <canvas id="barChart" ref={barRef}></canvas>
            </div>
          </div>

          {/* Health Stock List */}
          <div className="chart-card">
            <div className="card-header-flex">
              <div>
                <h3 className="card-header-title">
                  <i className="bi bi-box-seam-fill"></i> Ketersediaan Stok Produk
                </h3>
              </div>
            </div>

            <div className="stock-health-container">
              <div className="stock-search-box">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  placeholder="Cari nama produk..."
                  value={stokSearch}
                  onChange={(e) => setStokSearch(e.target.value)}
                />
              </div>

              {!filteredStok.length ? (
                <div className="dash-empty-state">
                  <div className="dash-empty-icon"><i className="bi bi-inbox"></i></div>
                  {stokSearch ? "Produk tidak ditemukan." : "Belum ada data stok produk."}
                </div>
              ) : (
                <div className="stock-list-wrap">
                  {filteredStok.map((item, idx) => {
                    const pct = Math.round((item.stok / maxStokVal) * 100);
                    const unitLabel = item.satuan ? item.satuan.toUpperCase() : "PCS";

                    return (
                      <div className="stock-item-row" key={idx}>
                        <div className="stock-item-left">
                          <span className="stock-rank-badge">{idx + 1}</span>
                          <div className="stock-item-details">
                            <span className="stock-item-name">{item.nama_produk}</span>
                            <div className="stock-progress-bar">
                              <div
                                className="stock-progress-fill"
                                style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="stock-item-right">
                          <span className="stock-count-text">{fmt(item.stok)} {unitLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
