"use client";

import { useMemo, useState } from "react";
import { useSession } from "@/lib/auth";
import FilterBar from "./components/FilterBar";
import KpiCard from "./components/KpiCard";
import StorageUsageCard from "./components/StorageUsageCard";
import TransactionVolume from "./components/TransactionVolume";
import PendingAlert from "./components/PendingAlert";
import TrendChart from "./components/TrendChart";
import TypeCharts from "./components/TypeCharts";
import GroupBarChart from "./components/GroupBarChart";
import ZonaPie from "./components/ZonaPie";
import ExpiredAlertList from "./components/ExpiredAlertList";
import StockHealthList from "./components/StockHealthList";
import ChartCard from "./components/ChartCard";
import {
  defaultFilters,
  useDashboardSummary,
  useRackCapacity,
  type DashboardFilters,
} from "./hooks/useDashboardSummary";
import { fmt } from "./dashboard";

export default function DashboardPage() {
  const session = useSession();
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const { summary, loading, error } = useDashboardSummary(session, filters);
  const kapasitasRak = useRackCapacity(session, filters.depo);

  const storage = useMemo(() => {
    const reg = summary?.storage_regular;
    if (reg && reg.kapasitas > 0) return reg;
    // Fallback: hitung dari total_qty vs kapasitas rak.
    const terpakai = summary?.stock?.total_qty ?? 0;
    const kap = kapasitasRak || 0;
    return {
      terpakai,
      kapasitas: kap,
      persen: kap > 0 ? Math.round((terpakai / kap) * 100) : 0,
    };
  }, [summary, kapasitasRak]);

  if (!session) return null;

  return (
    <div className="space-y-4">
      <FilterBar session={session} filters={filters} onChange={setFilters} />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
          {error}
        </div>
      )}

      <PendingAlert pending={summary?.outbound?.pending ?? 0} />

      {/* KPI utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Produk"
          value={fmt(summary?.produk_realtime?.total_produk ?? 0)}
          icon="bi-box-seam"
          hint={`${fmt(summary?.produk_realtime?.total_qty ?? 0)} qty di gudang`}
          loading={loading}
        />
        <StorageUsageCard
          terpakai={storage.terpakai}
          kapasitas={storage.kapasitas}
          persen={storage.persen}
          loading={loading}
        />
        <KpiCard
          label="Barang Datang"
          value={fmt(summary?.totals?.barang_datang ?? 0)}
          tag="Terkonfirmasi"
          tagTone="success"
          icon="bi-box-arrow-in-down"
          loading={loading}
        />
        <KpiCard
          label="Barang Terkirim"
          value={fmt(summary?.totals?.barang_terkirim ?? 0)}
          tag="Terkonfirmasi"
          tagTone="success"
          icon="bi-send-check"
          loading={loading}
        />
      </div>

      {/* Volume transaksi */}
      <TransactionVolume
        totals={
          summary?.totals ?? {
            shipment: 0,
            so: 0,
            gin: 0,
            barang_datang: 0,
            barang_terkirim: 0,
          }
        }
        loading={loading}
      />

      {/* Tren harian + zona */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Tren Barang Masuk vs Keluar"
            subtitle="Qty per hari (terkonfirmasi)"
          >
            <TrendChart
              inbound={summary?.inbound?.series ?? []}
              outbound={summary?.outbound?.series ?? []}
            />
          </ChartCard>
        </div>
        <ZonaPie zona={summary?.stock?.zona ?? {}} />
      </div>

      {/* Inbound per tipe */}
      <TypeCharts
        title="Inbound per Tipe"
        subtitle="Transaksi vs terkonfirmasi"
        data={summary?.inbound_by_type?.data ?? []}
        overall={
          summary?.inbound_by_type?.overall ?? {
            tipe: "Overall",
            planned: 0,
            actual: 0,
            planned_qty: 0,
            actual_qty: 0,
          }
        }
        meta={(r) => `${r.tipe}`}
      />

      {/* Outbound per tipe */}
      <TypeCharts
        title="Outbound per Tipe"
        subtitle="Transaksi vs terkonfirmasi"
        data={summary?.outbound_by_type?.data ?? []}
        overall={
          summary?.outbound_by_type?.overall ?? {
            tipe: "Overall",
            planned: 0,
            actual: 0,
            planned_qty: 0,
            actual_qty: 0,
          }
        }
        meta={(r) => `${r.tipe}`}
      />

      {/* Outbound per GIN & per SO */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GroupBarChart
          title="Outbound per GIN (Top 10)"
          subtitle="Transaksi vs terkonfirmasi"
          rows={summary?.outbound_per_gin ?? []}
        />
        <GroupBarChart
          title="Outbound per No. SO (Top 10)"
          subtitle="Transaksi vs terkonfirmasi"
          rows={summary?.outbound_per_so ?? []}
        />
      </div>

      {/* Expired & stok */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ExpiredAlertList rows={summary?.expired_alert ?? []} />
        <StockHealthList rows={summary?.stok_list ?? []} />
      </div>
    </div>
  );
}
