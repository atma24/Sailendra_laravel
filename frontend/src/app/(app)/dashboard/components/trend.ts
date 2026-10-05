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
  /**
   * true = satu minggu dipilih (satu titik per hari, label nama hari).
   * false = "Semua minggu" (satu titik per tanggal 1–akhir bulan, label angka tanggal).
   */
  isWeekly: boolean;
  /** Tanggal awal periode (YYYY-MM-DD). */
  mulai: string;
  /** Awal bulan (YYYY-MM-DD) — dipertahankan untuk kompatibilitas, tidak lagi dipakai agregasi. */
  monthStart?: string;
  bulan?: string;
  tahun?: string;
};

/**
 * Bangun titik-titik trend (label + planned + actual) dari dua deret harian.
 * - Satu minggu dipilih: satu titik per hari (label nama hari, mis. Sen..Min).
 * - Semua minggu: satu titik per tanggal 1–akhir bulan (label angka tanggal, mis. 1..30).
 */
export function buildTrendData(
  planned: SeriesPoint[],
  actual: SeriesPoint[],
  { isWeekly }: TrendMode
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

  // Semua minggu: tampilkan harian tanggal 1–akhir bulan (tanpa agregasi mingguan).
  const plannedMap = new Map(planned.map((p) => [p.tanggal, p.qty]));
  const actualMap = new Map(actual.map((p) => [p.tanggal, p.qty]));
  const dates = Array.from(new Set([...plannedMap.keys(), ...actualMap.keys()])).sort();
  return dates.map((iso) => ({
    key: iso,
    label: String(Number(iso.slice(8, 10)) || iso),
    full: fmtTanggalFull(iso),
    planned: plannedMap.get(iso) ?? 0,
    actual: actualMap.get(iso) ?? 0,
  }));
}

/**
 * Subtitle kartu untuk mode "Semua minggu": "Harian (1–30 Sep)".
 * Dihitung dari deret tanggal backend (selalu 1–akhir bulan).
 */
export function monthlySubtitle(planned: SeriesPoint[], bulan?: string): string {
  if (planned.length === 0) return "Harian";
  const first = planned[0].tanggal;
  const last = planned[planned.length - 1].tanggal;
  const d1 = Number(first.slice(8, 10));
  const d2 = Number(last.slice(8, 10));
  const m = Number(bulan ?? last.slice(5, 7));
  const mon = NAMA_BULAN_SINGKAT[m - 1] ?? "";
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return "Harian";
  return `Harian (${d1}–${d2}${mon ? ` ${mon}` : ""})`;
}
