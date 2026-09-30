"use client";

import { fmt, type GallonZona, type ZonaStat } from "../dashboard";

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
        <div key={item} className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
            {ITEM_LABEL[item] ?? item}
          </div>
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
      ))}
    </div>
  );
}

/** Bar storage (terpakai / kapasitas) + persen. */
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
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <span
          className="text-[12px] font-bold tabular-nums"
          style={{ color: tone }}
        >
          {loading ? "—" : `${pct}%`}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: tone }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
        {loading ? "—" : `${fmt(terpakai)} / ${fmt(kapasitas)} kapasitas`}
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
  loading,
}: Props) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[13px] text-blue-700">
          <i className="bi bi-box-seam" />
        </span>
        <h2 className="text-[14px] font-extrabold tracking-tight text-blue-800">
          Ringkasan Stok Gudang
        </h2>
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

        <div className="space-y-3 rounded-xl border border-blue-100 bg-white px-3.5 py-2.5">
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

      {/* Detail gallon & jug */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Group
          title="Gallon"
          icon="bi-droplet-half"
          footer={
            gallonZona ? (
              <ZonaBreakdown data={gallonZona} loading={loading} />
            ) : undefined
          }
        >
          <Item label="Gallon VIP" value={gallon.vip} loading={loading} />
          <Item label="Gallon Aqua" value={gallon.aqua} loading={loading} />
          <Item label="Gallon Vit" value={gallon.vit} loading={loading} />
        </Group>

        <Group
          title="Jug"
          icon="bi-water"
          footer={
            jugZona ? (
              <ZonaBreakdown data={jugZona} loading={loading} />
            ) : undefined
          }
        >
          <Item label="Jug Aqua" value={jug.aqua} loading={loading} />
          <Item label="Jug Vit" value={jug.vit} loading={loading} />
        </Group>
      </div>
    </section>
  );
}
