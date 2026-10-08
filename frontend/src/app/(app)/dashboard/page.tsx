"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth";
import FilterBar from "./components/FilterBar";
import StockSummaryCard from "./components/StockSummaryCard";
import TransactionVolume from "./components/TransactionVolume";
import PendingAlert from "./components/PendingAlert";
import InboundTypeTrends from "./components/InboundTypeTrends";
import OutboundTypeTrends from "./components/OutboundTypeTrends";
import ExpiredAlertList from "./components/ExpiredAlertList";
import StockHealthList from "./components/StockHealthList";
import {
  defaultFilters,
  useDashboardSummary,
  useRackCapacity,
  type DashboardFilters,
} from "./hooks/useDashboardSummary";
import {
  useDaftarTanggalUtilisasi,
  useSnapshotUtilisasi,
} from "./hooks/useUtilisasiSnapshot";

export default function DashboardPage() {
  const session = useSession();
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const { summary, loading, error } = useDashboardSummary(session, filters);
  const kapasitasRak = useRackCapacity(session, filters.depo);

  // Mode snapshot Warehouse Utilization: "" = realtime (default).
  // Reset ke realtime setiap depo / bulan berubah.
  const [tglSnapshot, setTglSnapshot] = useState("");
  const depoSnapshot =
    filters.depo || String(session?.user?.id_pengguna_lokasi ?? "");
  const bulanSnapshot = `${filters.tahun}-${filters.bulan.padStart(2, "0")}`;
  const daftarTanggal = useDaftarTanggalUtilisasi(
    session,
    depoSnapshot,
    bulanSnapshot
  );
  const {
    snapshot,
    loading: snapshotLoading,
    kosong: snapshotKosong,
  } = useSnapshotUtilisasi(session, depoSnapshot, tglSnapshot);
  const modeSnapshot = tglSnapshot !== "";

  // Kembali ke realtime setiap depo / bulan berubah.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset mode snapshot saat filter berubah
    setTglSnapshot("");
  }, [filters.depo, filters.tahun, filters.bulan]);

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

  const inbound = summary?.inbound;
  const outbound = summary?.outbound;

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

      {/* Ringkasan stok: realtime default, atau snapshot tanggal terpilih */}
      {modeSnapshot && snapshotKosong && !snapshotLoading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-700">
          Tidak ada snapshot untuk depo ini pada tanggal {tglSnapshot}.
        </div>
      )}
      <StockSummaryCard
        totalProduk={
          modeSnapshot && snapshot
            ? snapshot.produk_total
            : (summary?.produk_realtime?.total_produk ?? 0)
        }
        totalQty={
          modeSnapshot && snapshot
            ? snapshot.produk_qty
            : (summary?.produk_realtime?.total_qty ?? 0)
        }
        terpakai={modeSnapshot && snapshot ? snapshot.storage_dalam.terpakai : storage.terpakai}
        kapasitas={modeSnapshot && snapshot ? snapshot.storage_dalam.kapasitas : storage.kapasitas}
        persen={modeSnapshot && snapshot ? snapshot.storage_dalam.persen : storage.persen}
        luar={
          modeSnapshot && snapshot
            ? snapshot.storage_luar
            : (summary?.storage_luar ?? { terpakai: 0, kapasitas: 0, persen: 0 })
        }
        gallon={
          modeSnapshot && snapshot
            ? snapshot.gallon_breakdown.gallon
            : (summary?.gallon_breakdown?.gallon ?? { vip: 0, aqua: 0, vit: 0 })
        }
        jug={
          modeSnapshot && snapshot
            ? snapshot.gallon_breakdown.jug
            : (summary?.gallon_breakdown?.jug ?? { aqua: 0, vit: 0 })
        }
        gallonZona={
          modeSnapshot && snapshot
            ? (snapshot.detail?.gallon_zona?.gallon ?? undefined)
            : summary?.gallon_zona?.gallon
        }
        jugZona={
          modeSnapshot && snapshot
            ? (snapshot.detail?.gallon_zona?.jug ?? undefined)
            : summary?.gallon_zona?.jug
        }
        perKategori={
          modeSnapshot && snapshot
            ? (snapshot.detail?.gallon_per_kategori ?? undefined)
            : summary?.gallon_per_kategori
        }
        produkPerKategori={
          modeSnapshot && snapshot
            ? (snapshot.detail?.produk_per_kategori ?? undefined)
            : summary?.produk_per_kategori
        }
        loading={loading || snapshotLoading}
        daftarTanggal={daftarTanggal}
        tanggalSnapshot={tglSnapshot}
        onTanggalChange={setTglSnapshot}
        modeSnapshot={modeSnapshot}
        snapshotLoading={snapshotLoading}
      />

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

      {/* Inbound per tipe: Total + tiap tipe, masing-masing deret waktu (2 batang/hari) */}
      {!loading && (
        <InboundTypeTrends
          seriesByType={summary?.inbound_series_by_type ?? []}
          totalPlanned={inbound?.series_planned ?? []}
          totalActual={inbound?.series_actual ?? []}
          minggu={filters.minggu}
          mulai={summary?.periode?.mulai ?? ""}
          monthStart={summary?.periode?.bulan ? `${summary.periode.bulan}-01` : ""}
          bulan={summary?.periode?.bulan}
          tahun={summary?.periode?.tahun}
        />
      )}

      {/* Outbound per tipe: Total + tiap tipe, masing-masing deret waktu (2 batang/hari) */}
      {!loading && (
        <OutboundTypeTrends
          seriesByType={summary?.outbound_series_by_type ?? []}
          totalPlanned={outbound?.series_planned ?? []}
          totalActual={outbound?.series_actual ?? []}
          minggu={filters.minggu}
          mulai={summary?.periode?.mulai ?? ""}
          monthStart={summary?.periode?.bulan ? `${summary.periode.bulan}-01` : ""}
          bulan={summary?.periode?.bulan}
          tahun={summary?.periode?.tahun}
        />
      )}

      {/* Expired & stok */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ExpiredAlertList
          rows={summary?.expired_alert ?? []}
          mode={filters.expiredMode}
          onModeChange={(expiredMode) =>
            setFilters({ ...filters, expiredMode })
          }
          loading={loading}
        />
        <StockHealthList rows={summary?.stok_list ?? []} />
      </div>
    </div>
  );
}
