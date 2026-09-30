"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import { type Session, isMultiRole } from "@/lib/auth";
import { NAMA_BULAN } from "../dashboard";
import type { DashboardFilters } from "../hooks/useDashboardSummary";

type Props = {
  session: Session;
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
};

const selectCls =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export default function FilterBar({ session, filters, onChange }: Props) {
  const [produkList, setProdukList] = useState<string[]>([]);
  const [produkOpen, setProdukOpen] = useState(false);
  const [produkQuery, setProdukQuery] = useState("");
  const [depos, setDepos] = useState<{ id: string; nama: string }[]>([]);
  const [tahunOpts, setTahunOpts] = useState<number[]>(() => [
    new Date().getFullYear(),
  ]);
  const ddRef = useRef<HTMLDivElement>(null);

  // Depo hanya relevan untuk role support & superadmin (multi-role).
  const canPickDepo = isMultiRole(session.user.role);

  // Opsi depo: seluruh depo di sistem.
  useEffect(() => {
    if (!canPickDepo) return;
    let live = true;
    apiGet<{ id_pengguna_lokasi: string | number; nama_pengguna_lokasi: string }[]>(
      "/pengguna-lokasi"
    )
      .then((res) => {
        if (!live) return;
        const rows = res.data || [];
        setDepos(
          rows.map((d) => ({
            id: String(d.id_pengguna_lokasi ?? ""),
            nama: d.nama_pengguna_lokasi || String(d.id_pengguna_lokasi ?? ""),
          }))
        );
      })
      .catch(() => live && setDepos([]));
    return () => {
      live = false;
    };
  }, [canPickDepo]);

  const depoOptions = canPickDepo ? depos : [];

  // Opsi item (produk).
  useEffect(() => {
    apiGet<{ nama_produk: string }[]>("/produk?limit=100")
      .then((res) => {
        const rows = (Array.isArray(res)
          ? res
          : (res as unknown as { data?: unknown[] }).data || []) as {
          nama_produk?: string;
        }[];
        const names = rows.map((r) => r.nama_produk || "").filter(Boolean);
        setProdukList(Array.from(new Set(names)).sort());
      })
      .catch(() => setProdukList([]));
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) {
        setProdukOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Opsi tahun: dari tahun paling awal yang punya data s/d tahun berjalan.
  useEffect(() => {
    let live = true;
    const nowYear = new Date().getFullYear();
    apiGet<number[]>("/dashboard/tahun-tersedia")
      .then((res) => {
        if (!live) return;
        const rows = (res.data || []).filter((y) => Number.isFinite(Number(y)));
        if (rows.length === 0) {
          setTahunOpts([nowYear]);
          return;
        }
        const years = rows.map((y) => Number(y)).sort((a, b) => a - b);
        setTahunOpts(years);
      })
      .catch(() => live && setTahunOpts([nowYear]));
    return () => {
      live = false;
    };
  }, []);

  const filteredProduk = useMemo(() => {
    const q = produkQuery.toLowerCase();
    return produkList.filter((p) => p.toLowerCase().includes(q)).slice(0, 50);
  }, [produkList, produkQuery]);

  // Pastikan tahun terpilih selalu ada di daftar opsi.
  const tahunOptions = useMemo(() => {
    const y = Number(filters.tahun);
    if (Number.isFinite(y) && !tahunOpts.includes(y)) {
      return [...tahunOpts, y].sort((a, b) => a - b);
    }
    return tahunOpts;
  }, [tahunOpts, filters.tahun]);

  const toggleProduk = (nama: string) => {
    const has = filters.produk.includes(nama);
    onChange({
      ...filters,
      produk: has
        ? filters.produk.filter((p) => p !== nama)
        : [...filters.produk, nama],
    });
  };

  // Jumlah minggu pada bulan terpilih. Definisi: Minggu 1 = tgl 1 s/d hari
  // Minggu pertama (bisa parsial); Minggu 2+ = blok Senin–Minggu penuh.
  const jumlahMinggu = useMemo(() => {
    const y = Number(filters.tahun);
    const mo = Number(filters.bulan);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
      return 6;
    }
    const start = new Date(y, mo - 1, 1);
    const end = new Date(y, mo, 0); // hari terakhir bulan
    // Hari Minggu pertama pada/atau setelah tgl 1.
    const firstSunday = new Date(start);
    firstSunday.setDate(start.getDate() + ((7 - start.getDay()) % 7));
    let count = 1;
    const cursor = new Date(firstSunday);
    cursor.setDate(firstSunday.getDate() + 1); // Senin setelah Minggu pertama
    while (cursor.getTime() <= end.getTime()) {
      count++;
      cursor.setDate(cursor.getDate() + 7);
    }
    return count;
  }, [filters.tahun, filters.bulan]);

  useEffect(() => {
    const w = Number(filters.minggu);
    if (filters.minggu !== "" && Number.isFinite(w) && w > jumlahMinggu) {
      onChange({ ...filters, minggu: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumlahMinggu]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-1 text-[12.5px] font-semibold text-slate-400">
          Filter
        </span>

        <select
          className={selectCls}
          value={filters.tahun}
          onChange={(e) => onChange({ ...filters, tahun: e.target.value })}
        >
          {tahunOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          className={selectCls}
          value={filters.bulan}
          onChange={(e) => onChange({ ...filters, bulan: e.target.value })}
        >
          {NAMA_BULAN.map((n, i) => (
            <option key={n} value={i + 1}>
              {n}
            </option>
          ))}
        </select>

        <select
          className={selectCls}
          value={filters.minggu}
          onChange={(e) => onChange({ ...filters, minggu: e.target.value })}
        >
          <option value="">Semua minggu</option>
          {[1, 2, 3, 4, 5, 6].map((w) => (
            <option key={w} value={w} disabled={w > jumlahMinggu}>
              Minggu {w}
              {w > jumlahMinggu ? " (tidak ada)" : ""}
            </option>
          ))}
        </select>

        {canPickDepo && (
          <select
            className={selectCls}
            value={filters.depo}
            onChange={(e) => onChange({ ...filters, depo: e.target.value })}
          >
            <option value="">Semua depo</option>
            {depoOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>
        )}

        <div className="relative" ref={ddRef}>
          <button
            type="button"
            onClick={() => setProdukOpen((v) => !v)}
            className={`${selectCls} flex min-w-[160px] items-center justify-between gap-2 text-left`}
          >
            <span className="truncate">
              {filters.produk.length > 0
                ? `${filters.produk.length} item dipilih`
                : "Semua item"}
            </span>
            <i className="bi bi-chevron-down text-[10px] text-slate-400" />
          </button>

          {produkOpen && (
            <div className="absolute left-0 top-11 z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-100 p-2">
                <input
                  autoFocus
                  value={produkQuery}
                  onChange={(e) => setProdukQuery(e.target.value)}
                  placeholder="Cari item..."
                  className="h-8 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-indigo-400"
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {filteredProduk.length === 0 && (
                  <div className="px-3 py-4 text-center text-[12px] text-slate-400">
                    Tidak ada item
                  </div>
                )}
                {filteredProduk.map((p) => {
                  const checked = filters.produk.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleProduk(p)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          checked
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {checked && <i className="bi bi-check text-[10px]" />}
                      </span>
                      <span className="truncate text-slate-700">{p}</span>
                    </button>
                  );
                })}
              </div>
              {filters.produk.length > 0 && (
                <div className="border-t border-slate-100 p-2">
                  <button
                    type="button"
                    onClick={() => onChange({ ...filters, produk: [] })}
                    className="w-full rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    Bersihkan pilihan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
