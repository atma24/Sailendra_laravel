"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Session } from "@/lib/auth";
import type { Summary } from "../dashboard";

/** Bentuk 1 baris snapshot dari GET /api/laporan-utilisasi (formatRow). */
export type SnapshotUtilisasi = {
  tanggal: string;
  id_pengguna_lokasi: string;
  produk_total: number;
  produk_qty: number;
  storage_dalam: { terpakai: number; kapasitas: number; persen: number };
  storage_luar: { terpakai: number; kapasitas: number; persen: number };
  gallon_breakdown: NonNullable<Summary["gallon_breakdown"]>;
  zona: Record<string, { qty: number; kapasitas: number }>;
  detail: {
    produk_realtime?: Summary["produk_realtime"] | null;
    gallon_breakdown?: Summary["gallon_breakdown"] | null;
    gallon_zona?: Summary["gallon_zona"] | null;
    gallon_per_kategori?: Summary["gallon_per_kategori"] | null;
    produk_per_kategori?: Summary["produk_per_kategori"] | null;
  } | null;
  created_at: string;
};

type DaftarRow = { tanggal: string; jumlah_depo?: number };

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const body = res as { data?: unknown };
  return Array.isArray(body?.data) ? (body.data as T[]) : [];
}

/**
 * Daftar tanggal yang punya snapshot untuk 1 depo pada bulan YYYY-MM.
 * Dipakai mengisi dropdown tanggal di card Warehouse Utilization.
 */
export function useDaftarTanggalUtilisasi(
  session: Session | null,
  depo: string,
  bulan: string
) {
  const [daftar, setDaftar] = useState<string[]>([]);

  useEffect(() => {
    if (!session || !depo || !bulan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset daftar saat filter belum lengkap
      setDaftar([]);
      return;
    }
    let batal = false;
    const sp = new URLSearchParams({ bulan, depo });
    apiGet<DaftarRow[]>(`/laporan-utilisasi/daftar?${sp.toString()}`)
      .then((res) => {
        if (batal) return;
        const rows = asArray<DaftarRow>(res);
        setDaftar(
          rows
            .map((r) => String(r.tanggal ?? "").slice(0, 10))
            .filter(Boolean)
            .sort()
            .reverse()
        );
      })
      .catch(() => {
        if (!batal) setDaftar([]);
      });
    return () => {
      batal = true;
    };
  }, [session, depo, bulan]);

  return daftar;
}

/**
 * Ambil 1 snapshot (depo + tanggal). Bila tanggal kosong, tidak fetch.
 * Mengembalikan snapshot (null bila belum ada), status loading,
 * dan flag kosong (tanggal dipilih tapi snapshot tidak ada).
 */
export function useSnapshotUtilisasi(
  session: Session | null,
  depo: string,
  tanggal: string
) {
  const [snapshot, setSnapshot] = useState<SnapshotUtilisasi | null>(null);
  const [loading, setLoading] = useState(false);
  const [kosong, setKosong] = useState(false);

  const muat = useCallback(async () => {
    if (!session || !depo || !tanggal) {
      setSnapshot(null);
      setKosong(false);
      return;
    }
    setLoading(true);
    setKosong(false);
    try {
      const sp = new URLSearchParams({ tanggal, depo });
      const res = await apiGet<SnapshotUtilisasi>(
        `/laporan-utilisasi?${sp.toString()}`
      );
      const body = res as unknown as
        | SnapshotUtilisasi
        | { data?: SnapshotUtilisasi | null };
      const data =
        body && typeof body === "object" && "data" in body
          ? (body.data ?? null)
          : (body as SnapshotUtilisasi | null);
      setSnapshot(data);
      setKosong(data === null);
    } catch {
      setSnapshot(null);
      setKosong(false);
    } finally {
      setLoading(false);
    }
  }, [session, depo, tanggal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat snapshot saat depo/tanggal berubah
    muat();
  }, [muat]);

  return { snapshot, loading, kosong };
}
