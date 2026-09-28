// Tipe & util bersama untuk dashboard.

export type SeriesPoint = { tanggal: string; qty: number };

export type TypeRow = {
  tipe: string;
  planned: number;
  actual: number;
  planned_qty: number;
  actual_qty: number;
};

export type GroupRow = {
  label: string;
  planned: number;
  actual: number;
  planned_qty: number;
  actual_qty: number;
};

export type ExpiredRow = {
  nama_produk: string;
  batch: string;
  best_before: string;
  lokasi: string;
  kategori: string;
  qty: number;
  sisa_hari: number | null;
  expired: boolean;
};

export type Summary = {
  periode: {
    bulan: string;
    tahun: string;
    minggu: string;
    mulai: string;
    sampai: string;
  };
  mutasi_total: number;
  inbound: {
    total: number;
    total_qty: number;
    bulan_ini: number;
    qty_bulan_ini: number;
    qty_today: number;
    series: SeriesPoint[];
  };
  outbound: {
    total: number;
    total_qty: number;
    bulan_ini: number;
    qty_bulan_ini: number;
    qty_today: number;
    pending: number;
    series: SeriesPoint[];
  };
  stock: {
    zona: Record<string, number>;
    total_sku: number;
    total_qty: number;
  };
  stok_list: { nama_produk: string; stok: number; satuan?: string }[];
  penjualan: { nama_produk: string; qty: number }[];
  produk_realtime: { total_produk: number; total_qty: number };
  storage_regular: { terpakai: number; kapasitas: number; persen: number };
  totals: {
    shipment: number;
    so: number;
    gin: number;
    barang_datang: number;
    barang_terkirim: number;
  };
  inbound_by_type: { data: TypeRow[]; overall: TypeRow };
  outbound_by_type: { data: TypeRow[]; overall: TypeRow };
  outbound_per_gin: GroupRow[];
  outbound_per_so: GroupRow[];
  expired_alert: ExpiredRow[];
};

export const fmt = (n: string | number) =>
  new Intl.NumberFormat("id-ID").format(Number(n) || 0);

export const fmtShort = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return fmt(v);
};

export const fmtTanggal = (iso: string) => {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
};

export const fmtTanggalFull = (iso: string) => {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const ZONA_ORDER = [
  "normal",
  "bad",
  "reject",
  "receh",
  "mobil",
  "festive",
  "transit",
  "hold",
  "qi",
] as const;

export const ZONA_LABEL: Record<string, string> = {
  normal: "Regular",
  bad: "Bad Stock",
  reject: "Reject",
  receh: "Receh",
  mobil: "Mobil",
  festive: "Festive",
  transit: "Transit",
  hold: "Hold",
  qi: "QI",
};

// Palet warna modern minimalis (navy brand + aksen).
export const COLORS = {
  navy: "#191970",
  navySoft: "#4040a0",
  planned: "#c7cbe0",
  actual: "#191970",
  inbound: "#2563eb",
  outbound: "#ef2b2d",
  success: "#16a34a",
  warn: "#f59e0b",
  danger: "#dc2626",
  grid: "#eef1f7",
  text: "#6b7280",
};

const ZONA_COLOR_MAP: Record<string, string> = {
  normal: "#191970",
  bad: "#dc2626",
  reject: "#ef4444",
  receh: "#f59e0b",
  mobil: "#0ea5e9",
  festive: "#8b5cf6",
  transit: "#14b8a6",
  hold: "#64748b",
  qi: "#f97316",
};

export const zonaColor = (key: string) => ZONA_COLOR_MAP[key] || "#94a3b8";

export const persen = (qty: number, kap: number) =>
  kap > 0 ? Math.min(100, Math.round((qty / kap) * 100)) : 0;
