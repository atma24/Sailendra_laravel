// Util bersama untuk agregasi data deret waktu (trend) dashboard.

import {
  fmtHariSingkat,
  fmtTanggalFull,
  NAMA_BULAN_SINGKAT,
  type SeriesPoint,
} from "../dashboard";
import type { TrendDatum } from "./TrendChart";

/**
 * Ubah tanggal ISO ke indeks minggu ke-N dalam bulan (0-based).
 *
 * Konvensi (sama dengan backend `ParsesPeriode::weekRange`):
 * Minggu 1 dimulai tanggal 1 dan berakhir pada hari Minggu pertama (bisa
 * parsial). Minggu 2+ adalah blok Senin–Minggu penuh.
 * Contoh September 2025 (1 Sep = Senin): 1 Sep → 0, 7 Sep → 0, 8 Sep → 1.
 * Contoh September 2024 (1 Sep = Minggu): 1 Sep → 0, 2 Sep → 1.
 */
export function weekIndexInMonth(iso: string, monthStart: string): number {
  const d = new Date(`${iso}T00:00:00`);
  const m = new Date(`${monthStart}T00:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(m.getTime())) return 0;

  // Hari Minggu pertama pada/atau setelah awal bulan.
  const firstSunday = new Date(m);
  const mDow = m.getDay(); // 0=Minggu .. 6=Sabtu
  firstSunday.setDate(m.getDate() + ((7 - mDow) % 7));

  if (d.getTime() <= firstSunday.getTime()) return 0;

  // Mulai hitung blok 7 hari (Senin–Minggu) setelah Minggu pertama.
  const danach = new Date(firstSunday);
  danach.setDate(firstSunday.getDate() + 1); // Senin setelah Minggu pertama
  const diffDays = Math.floor(
    (d.getTime() - danach.getTime()) / 86400000
  );
  if (diffDays < 0) return 0;
  return 1 + Math.floor(diffDays / 7);
}

export type TrendMode = {
  /** true = harian (satu titik per hari); false = agregasi per minggu. */
  isWeekly: boolean;
  /** Tanggal awal periode (YYYY-MM-DD). */
  mulai: string;
  /** Awal bulan (YYYY-MM-DD) — acuan indeks minggu. Jika kosong, pakai `mulai`. */
  monthStart?: string;
  bulan?: string;
  tahun?: string;
};

const fmtRange = (a: string, b: string) => {
  const [, ma, da] = a.split("-");
  const [, mb, db] = b.split("-");
  if (ma === mb) return `${Number(da)}–${Number(db)} ${NAMA_BULAN_SINGKAT[Number(ma) - 1] ?? ""}`;
  return `${Number(da)} ${NAMA_BULAN_SINGKAT[Number(ma) - 1] ?? ""} – ${Number(db)} ${NAMA_BULAN_SINGKAT[Number(mb) - 1] ?? ""}`.trim();
};

/**
 * Bangun titik-titik trend (label + planned + actual) dari dua deret harian.
 * - Mode harian: satu titik per hari (label nama hari).
 * - Mode mingguan: agregasi per minggu ke-N dalam bulan (label "Minggu N" + rentang tgl).
 */
export function buildTrendData(
  planned: SeriesPoint[],
  actual: SeriesPoint[],
  { isWeekly, mulai, monthStart, bulan, tahun }: TrendMode
): TrendDatum[] {
  if (isWeekly) {
    const actualMap = new Map(actual.map((p) => [p.tanggal, p.qty]));
    return planned.map((p) => ({
      key: p.tanggal,
      label: fmtHariSingkat(p.tanggal),
      full: fmtTanggalFull(p.tanggal),
      planned: p.qty,
      actual: actualMap.get(p.tanggal) ?? 0,
    }));
  }

  const anchor = monthStart || mulai;
  const bucket = new Map<
    number,
    { planned: number; actual: number; first: string; last: string }
  >();
  const put = (iso: string, plannedQty: number, actualQty: number) => {
    const idx = weekIndexInMonth(iso, anchor);
    const cur =
      bucket.get(idx) ?? { planned: 0, actual: 0, first: iso, last: iso };
    cur.planned += plannedQty;
    cur.actual += actualQty;
    if (iso < cur.first) cur.first = iso;
    if (iso > cur.last) cur.last = iso;
    bucket.set(idx, cur);
  };

  const actualMap = new Map(actual.map((p) => [p.tanggal, p.qty]));
  planned.forEach((p) => put(p.tanggal, p.qty, actualMap.get(p.tanggal) ?? 0));
  actual.forEach((p) => {
    if (!planned.some((q) => q.tanggal === p.tanggal)) put(p.tanggal, 0, p.qty);
  });

  const bln = bulan ? `${NAMA_BULAN_SINGKAT[Number(bulan) - 1] ?? ""} ` : "";
  return Array.from(bucket.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, v]) => ({
      key: `w${idx}`,
      label: `Minggu ${idx + 1}`,
      full: `Minggu ${idx + 1} · ${bln}${tahun ?? ""} (${fmtRange(v.first, v.last)})`.trim(),
      planned: v.planned,
      actual: v.actual,
    }));
}
