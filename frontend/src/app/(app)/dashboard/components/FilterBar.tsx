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
  const ddRef = useRef<HTMLDivElement>(null);

  // Opsi depo: dari akun lokasi user (multi-role) atau lokasi tunggal.
  const depos = useMemo(() => {
    if (isMultiRole(session.user.role) && session.user.akun_lokasi?.length) {
      return session.user.akun_lokasi.map((a) => ({
        id: String(a.id_pengguna_lokasi ?? ""),
        nama: a.nama_pengguna_lokasi || String(a.id_pengguna_lokasi ?? ""),
      }));
    }
    if (session.user.id_pengguna_lokasi) {
      return [
        {
          id: String(session.user.id_pengguna_lokasi),
          nama: session.user.nama_pengguna_lokasi || "Lokasi",
        },
      ];
    }
    return [];
  }, [session]);

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

  const tahunOpts = useMemo(() => {
    const y = Number(filters.tahun) || new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [filters.tahun]);

  const filteredProduk = useMemo(() => {
    const q = produkQuery.toLowerCase();
    return produkList.filter((p) => p.toLowerCase().includes(q)).slice(0, 50);
  }, [produkList, produkQuery]);

  const toggleProduk = (nama: string) => {
    const has = filters.produk.includes(nama);
    onChange({
      ...filters,
      produk: has
        ? filters.produk.filter((p) => p !== nama)
        : [...filters.produk, nama],
    });
  };

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
          {tahunOpts.map((y) => (
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
            <option key={w} value={w}>
              Minggu {w}
            </option>
          ))}
        </select>

        {depos.length > 0 && (
          <select
            className={selectCls}
            value={filters.depo}
            onChange={(e) => onChange({ ...filters, depo: e.target.value })}
          >
            <option value="">Semua depo</option>
            {depos.map((d) => (
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
