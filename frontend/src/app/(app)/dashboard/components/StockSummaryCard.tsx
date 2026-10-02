"use client";

import { useState } from "react";
import {
  fmt,
  type GallonZona,
  type Summary,
  type ZonaStat,
} from "../dashboard";

type Props = {
  /** Total SKU produk realtime. */
  totalProduk: number;
  /** Total qty seluruh produk (mengikuti filter). */
  totalQty: number;
  /** Stok terpakai (qty). */
  terpakai: number;
  /** Kapasitas gudang (qty). */
  kapasitas: number;
  /** Persen pemakaian 0-100. */
  persen: number;
  /** Storage luar gudang (mobil, transit, dll). */
  luar: { terpakai: number; kapasitas: number; persen: number };
  gallon: { vip: number; aqua: number; vit: number };
  jug: { aqua: number; vit: number };
  /** Breakdown stok gallon per item & jenis lokasi penyimpanan. */
  gallonZona?: GallonZona;
  /** Breakdown stok jug per item & jenis lokasi penyimpanan. */
  jugZona?: GallonZona;
  /** Breakdown gallon/jug per kategori lokasi (tab dinamis). */
  perKategori?: Summary["gallon_per_kategori"];
  /** Semua item produk per kategori lokasi (card dinamis SPS/XWH/...). */
  produkPerKategori?: Summary["produk_per_kategori"];
  loading?: boolean;
};

/** Label untuk tiap item produk. */
const ITEM_LABEL: Record<string, string> = {
  vip: "VIP",
  aqua: "Aqua",
  vit: "Vit",
};

const ZONA_META: { key: keyof ZonaStat; label: string }[] = [
  { key: "reguler", label: "Reguler" },
  { key: "mobil", label: "Mobil" },
  { key: "transit", label: "Transit" },
  { key: "bad_reject", label: "Bad & Reject" },
];

/** Breakdown stok per item produk & jenis lokasi penyimpanan. */
function ZonaBreakdown({
  data,
  loading,
}: {
  data: GallonZona;
  loading?: boolean;
}) {
  const items = Object.entries(data);
  if (items.length === 0) return null;
  return (
    <div className="mt-3 space-y-3 border-t border-blue-100 pt-3">
      {items.map(([item, zona]) => (
        <div key={item}>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">
            {ITEM_LABEL[item] ?? item}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ZONA_META.map(({ key, label }) => {
              const s = zona[key];
              return (
                <StorageBar
                  key={key}
                  label={label}
                  terpakai={s.qty}
                  kapasitas={s.kapasitas}
                  persen={s.persen}
                  loading={loading}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lingkaran progres (SVG) — pengganti bar linear biar hemat tempat. */
function CircleProgress({
  value,
  size = 48,
  stroke = 6,
  color,
  loading,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  loading?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#eef2ff"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-bold tabular-nums"
          style={{ color, fontSize: size <= 48 ? 10 : 11 }}
        >
          {loading ? "—" : `${pct}%`}
        </span>
      </div>
    </div>
  );
}

/** Storage compact: lingkaran + label + qty/kapasitas di samping. */
function StorageBar({
  label,
  terpakai,
  kapasitas,
  persen,
  loading,
}: {
  label: string;
  terpakai: number;
  kapasitas: number;
  persen: number;
  loading?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, persen || 0));
  const tone = pct >= 90 ? "#dc2626" : pct >= 75 ? "#f59e0b" : "#2563eb";

  return (
    <div className="flex items-center gap-2.5">
      <CircleProgress
        value={pct}
        size={48}
        stroke={6}
        color={tone}
        loading={loading}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-slate-500">
          {label}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-400 tabular-nums">
          {loading ? "—" : `${fmt(terpakai)} / ${fmt(kapasitas)}`}
        </div>
      </div>
    </div>
  );
}

/** Sub-item angka di dalam satu grup gallon/jug. */
function Item({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className="mt-0.5 text-[17px] font-extrabold tabular-nums text-blue-900">
        {loading ? "—" : fmt(value)}
      </div>
    </div>
  );
}

/** Satu item produk pada card lokasi dinamis: nama + qty + 4 lingkaran zona. */
function DynamicItem({
  nama,
  satuan,
  qty,
  zona,
  loading,
}: {
  nama: string;
  satuan: string;
  qty: number;
  zona: ZonaStat;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-bold text-blue-900">
          {nama}
        </span>
        <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-blue-900">
          {loading ? "—" : `${fmt(qty)} ${satuan}`}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ZONA_META.map(({ key, label }) => {
          const s = zona[key];
          return (
            <StorageBar
              key={key}
              label={label}
              terpakai={s.qty}
              kapasitas={s.kapasitas}
              persen={s.persen}
              loading={loading}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Grup bersarang (card di dalam card): Gallon / Jug. */
function Group({
  title,
  icon,
  children,
  footer,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[13px] text-blue-700">
          <i className={`bi ${icon}`} />
        </span>
        <h3 className="text-[13px] font-bold tracking-tight text-blue-800">
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
      {footer}
    </div>
  );
}

const TAB_SEMUA = "SEMUA";
const TAB_DEFAULT = "GALLON";

export default function StockSummaryCard({
  totalProduk,
  totalQty,
  terpakai,
  kapasitas,
  persen,
  luar,
  gallon,
  jug,
  gallonZona,
  jugZona,
  perKategori,
  produkPerKategori,
  loading,
}: Props) {
  // Tab lokasi dinamis: "Semua" + tiap kategori dari backend.
  // Lokasi baru yang ditambah manual otomatis muncul sebagai tombol.
  const kategoriTabs = Object.keys(perKategori ?? {});
  const [tabAktif, setTabAktif] = useState<string>(TAB_DEFAULT);
  const tabValid =
    tabAktif === TAB_SEMUA || kategoriTabs.includes(tabAktif)
      ? tabAktif
      : kategoriTabs.includes(TAB_DEFAULT)
        ? TAB_DEFAULT
        : TAB_SEMUA;

  const dataTab =
    tabValid === TAB_SEMUA || !perKategori?.[tabValid]
      ? null
      : perKategori[tabValid];
  const gallonAktif = dataTab?.breakdown.gallon ?? gallon;
  const jugAktif = dataTab?.breakdown.jug ?? jug;
  const gallonZonaAktif = dataTab?.zona.gallon ?? gallonZona;
  const jugZonaAktif = dataTab?.zona.jug ?? jugZona;

  // Mode dinamis: tab lokasi selain SEMUA/GALLON menampilkan 1 card
  // berisi semua item produk pada lokasi tsb (mis. SPS, XWH).
  const isDinamis = tabValid !== TAB_SEMUA && tabValid !== TAB_DEFAULT;
  const itemsDinamis = isDinamis
    ? (produkPerKategori?.[tabValid]?.items ?? [])
    : [];

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[13px] text-blue-700">
          <i className="bi bi-box-seam" />
        </span>
        <h2 className="text-[14px] font-extrabold tracking-tight text-blue-800">
          Warehouse Utilization
        </h2>
        {/* Tombol lokasi: Semua + tiap kategori (dinamis dari backend) */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {[TAB_SEMUA, ...kategoriTabs].map((tab) => {
            const aktif = tabValid === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setTabAktif(tab)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  aktif
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-50"
                }`}
              >
                {tab === TAB_SEMUA ? "Semua" : tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ringkasan atas: Total Produk + Storage */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-blue-100 bg-white px-3.5 py-2.5">
          <div className="text-[11px] font-medium text-slate-400">
            Total Produk Gudang
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[20px] font-extrabold tabular-nums text-blue-900">
              {loading ? "—" : fmt(totalQty)}
            </span>
            <span className="text-[11.5px] text-slate-400">
              qty · {loading ? "—" : fmt(totalProduk)} SKU
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-white px-3.5 py-2.5 sm:grid-cols-2">
          <StorageBar
            label="Storage Gudang Dalam"
            terpakai={terpakai}
            kapasitas={kapasitas}
            persen={persen}
            loading={loading}
          />
          <StorageBar
            label="Storage Gudang Luar"
            terpakai={luar.terpakai}
            kapasitas={luar.kapasitas}
            persen={luar.persen}
            loading={loading}
          />
        </div>
      </div>

      {/* Detail gallon & jug, atau 1 card dinamis berisi item lokasi terpilih */}
      {isDinamis ? (
        <Group title={tabValid} icon="bi-boxes">
          <div className="col-span-2 space-y-2 sm:col-span-3">
            {loading ? (
              <div className="rounded-xl border border-blue-100 bg-white px-3 py-4 text-center text-[12px] text-slate-400">
                Memuat data {tabValid}…
              </div>
            ) : itemsDinamis.length === 0 ? (
              <div className="rounded-xl border border-blue-100 bg-white px-3 py-4 text-center text-[12px] text-slate-400">
                Belum ada stok di lokasi {tabValid}
              </div>
            ) : (
              itemsDinamis.map((it) => (
                <DynamicItem
                  key={it.nama}
                  nama={it.nama}
                  satuan={it.satuan}
                  qty={it.qty}
                  zona={it.zona}
                  loading={loading}
                />
              ))
            )}
          </div>
        </Group>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Group
            title="Gallon"
            icon="bi-droplet-half"
            footer={
              gallonZonaAktif ? (
                <ZonaBreakdown data={gallonZonaAktif} loading={loading} />
              ) : undefined
            }
          >
            <Item
              label="Gallon VIP"
              value={gallonAktif.vip}
              loading={loading}
            />
            <Item
              label="Gallon Aqua"
              value={gallonAktif.aqua}
              loading={loading}
            />
            <Item
              label="Gallon Vit"
              value={gallonAktif.vit}
              loading={loading}
            />
          </Group>

          <Group
            title="Jug"
            icon="bi-water"
            footer={
              jugZonaAktif ? (
                <ZonaBreakdown data={jugZonaAktif} loading={loading} />
              ) : undefined
            }
          >
            <Item label="Jug Aqua" value={jugAktif.aqua} loading={loading} />
            <Item label="Jug Vit" value={jugAktif.vit} loading={loading} />
          </Group>
        </div>
      )}
    </section>
  );
}
