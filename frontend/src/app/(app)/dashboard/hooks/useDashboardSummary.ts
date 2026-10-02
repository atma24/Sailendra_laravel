"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { lokasiParam, type Session } from "@/lib/auth";
import type { Summary } from "../dashboard";

export type ExpiredMode = "all" | "h30";

export type DashboardFilters = {
  tahun: string;
  bulan: string; // 1-12
  minggu: string; // "" | "1".."6"
  depo: string; // id_pengguna_lokasi, "" = ikut session
  produk: string[]; // nama_produk
  expiredMode: ExpiredMode; // filter card aging produk
};

export function defaultFilters(): DashboardFilters {
  const now = new Date();
  return {
    tahun: String(now.getFullYear()),
    bulan: String(now.getMonth() + 1),
    minggu: "",
    depo: "",
    produk: [],
    expiredMode: "h30",
  };
}

function buildParams(session: Session, f: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();
  const lok = lokasiParam(session);
  if (f.depo) {
    params.set("id_pengguna_lokasi", f.depo);
  } else if (lok) {
    lok.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k && v !== undefined) params.set(k, v);
    });
  }
  params.set("tahun", f.tahun);
  params.set("bulan", `${f.tahun}-${f.bulan.padStart(2, "0")}`);
  if (f.minggu) params.set("minggu", f.minggu);
  if (f.produk.length > 0) params.set("produk", f.produk.join(","));
  if (f.expiredMode === "all") params.set("expired_mode", "all");
  return params;
}

export function useDashboardSummary(
  session: Session | null,
  filters: DashboardFilters
) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const produkKey = filters.produk.join(",");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildParams(session, filters);
      const res = await apiGet<Summary>(`/dashboard/summary?${params.toString()}`);
      // Endpoint mengembalikan objek flat (bukan envelope data), jadi pakai body apa adanya.
      const body = res as unknown as Summary & { data?: Summary };
      setSummary(body.data ?? body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    filters.tahun,
    filters.bulan,
    filters.minggu,
    filters.depo,
    filters.expiredMode,
    produkKey,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data dashboard saat filter berubah
    load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

export function useRackCapacity(session: Session | null, depo: string) {
  const [kapasitas, setKapasitas] = useState(0);

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams();
    if (depo) {
      params.set("id_pengguna_lokasi", depo);
    } else {
      const lok = lokasiParam(session);
      lok.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k && v !== undefined) params.set(k, v);
      });
    }

    apiGet<{ total_kapasitas: number }[]>(
      `/stok?mode=kapasitas_total&${params.toString()}`
    )
      .then((rows) => {
        const list = (Array.isArray(rows)
          ? rows
          : (rows as unknown as { data?: unknown[] }).data || []) as {
          total_kapasitas?: unknown;
        }[];
        const v = parseInt(String(list[0]?.total_kapasitas ?? ""), 10);
        setKapasitas(Number.isNaN(v) ? 0 : v);
      })
      .catch(() => setKapasitas(0));
  }, [session, depo]);

  return kapasitas;
}
