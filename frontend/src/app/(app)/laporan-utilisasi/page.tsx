"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDownload, apiGet, ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth";

type Loc = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };

type StorageStat = { terpakai: number; kapasitas: number; persen: number };

type ZonaStat = { qty: number; kapasitas: number };

type KategoriItem = {
  nama: string;
  satuan: string;
  qty: number;
  zona?: Record<string, ZonaStat>;
};

type Snapshot = {
  tanggal: string;
  id_pengguna_lokasi: string;
  produk_total: number;
  produk_qty: number;
  storage_dalam: StorageStat;
  storage_luar: StorageStat;
  gallon_breakdown?: {
    gallon?: { vip: number; aqua: number; vit: number };
    jug?: { aqua: number; vit: number };
  };
  zona?: Record<string, ZonaStat>;
  detail: {
    gallon_breakdown?: {
      gallon?: { vip: number; aqua: number; vit: number };
      jug?: { aqua: number; vit: number };
    } | null;
    produk_per_kategori?: Record<string, { items: KategoriItem[] }> | null;
  } | null;
  created_at: string;
};

const ZONA_LABEL: Record<string, string> = {
  reguler: "Reguler",
  mobil: "Mobil",
  transit: "Transit",
  bad_reject: "Bad/Reject",
};

const fmt = (n: number | string) => new Intl.NumberFormat("id-ID").format(Number(n) || 0);

const todayStr = () => new Date().toISOString().slice(0, 10);

function StatBox({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "blue" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-[20px] font-bold tabular-nums text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-slate-500">{sub}</div>}
    </div>
  );
}

export default function LaporanUtilisasiPage() {
  const session = useSession();
  const [locs, setLocs] = useState<Loc[]>([]);
  const [depo, setDepo] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Muat daftar depo.
  useEffect(() => {
    let live = true;
    apiGet<Loc[]>("/pengguna-lokasi")
      .then((r) => {
        if (!live) return;
        const list = r.data || [];
        setLocs(list);
        setDepo((prev) => prev || (list[0]?.id_pengguna_lokasi ?? ""));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const load = useCallback(() => {
    if (!depo || !tanggal) return;
    setLoading(true);
    setError("");
    apiGet<Snapshot | null>(`/laporan-utilisasi?tanggal=${tanggal}&depo=${depo}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [depo, tanggal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat snapshot saat depo/tanggal berubah
    load();
  }, [load]);

  const namaDepo = useMemo(
    () => locs.find((l) => l.id_pengguna_lokasi === depo)?.nama_pengguna_lokasi ?? "",
    [locs, depo]
  );

  const onExport = async () => {
    if (!depo || !tanggal) return;
    setExporting(true);
    setError("");
    try {
      await apiDownload(
        `/laporan-utilisasi/export?tanggal=${tanggal}&depo=${depo}`,
        `warehouse-utilization_${tanggal}_${depo}.xls`
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal export");
    } finally {
      setExporting(false);
    }
  };

  if (!session) return null;

  const gb = data?.gallon_breakdown ?? data?.detail?.gallon_breakdown;
  const zona = data?.zona;
  const perKategori = data?.detail?.produk_per_kategori ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-[16px] font-bold text-slate-800">Report — Warehouse Utilization</h1>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Snapshot otomatis tiap 23:59 WIB. 1 report per depo per hari.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-medium text-slate-600">Depo</span>
            <select
              value={depo}
              onChange={(e) => setDepo(e.target.value)}
              className="min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
            >
              {locs.map((l) => (
                <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                  {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-medium text-slate-600">Tanggal</span>
            <input
              type="date"
              value={tanggal}
              max={todayStr()}
              onChange={(e) => setTanggal(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
            />
          </label>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-slate-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Memuat..." : "Tampilkan"}
          </button>

          <button
            type="button"
            onClick={onExport}
            disabled={!data || exporting}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {exporting ? "Menyiapkan..." : "Export Excel"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
          {error}
        </div>
      )}

      {!loading && !data && !error && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-[13px] text-slate-500">
          Tidak ada snapshot untuk {namaDepo || depo} pada tanggal {tanggal}.
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-[12.5px] text-slate-600">
            <b>{namaDepo || data.id_pengguna_lokasi}</b> &nbsp;•&nbsp; Data per 23:59 WIB,{" "}
            <b>{data.tanggal}</b>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatBox label="Total Produk (SKU)" value={fmt(data.produk_total)} tone="blue" />
            <StatBox label="Total Qty" value={fmt(data.produk_qty)} />
            <StatBox
              label="Storage Dalam"
              value={`${data.storage_dalam.persen}%`}
              sub={`${fmt(data.storage_dalam.terpakai)} / ${fmt(data.storage_dalam.kapasitas)}`}
              tone="blue"
            />
            <StatBox
              label="Storage Luar"
              value={`${data.storage_luar.persen}%`}
              sub={`${fmt(data.storage_luar.terpakai)} / ${fmt(data.storage_luar.kapasitas)}`}
              tone="amber"
            />
          </div>

          {gb && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[13px] font-semibold text-slate-700">Breakdown Gallon / Jug</div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { k: "Gallon VIP", v: gb.gallon?.vip ?? 0 },
                  { k: "Gallon Aqua", v: gb.gallon?.aqua ?? 0 },
                  { k: "Gallon Vit", v: gb.gallon?.vit ?? 0 },
                  { k: "Jug Aqua", v: gb.jug?.aqua ?? 0 },
                  { k: "Jug Vit", v: gb.jug?.vit ?? 0 },
                ].map((it) => (
                  <div key={it.k} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-slate-400">{it.k}</div>
                    <div className="text-[16px] font-bold tabular-nums text-slate-700">{fmt(it.v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {zona && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[13px] font-semibold text-slate-700">Ringkasan per Zona</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-4 font-semibold">Zona</th>
                      <th className="py-2 pr-4 text-right font-semibold">Qty</th>
                      <th className="py-2 pr-4 text-right font-semibold">Kapasitas</th>
                      <th className="py-2 text-right font-semibold">Utilisasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ZONA_LABEL).map(([key, label]) => {
                      const z = zona[key] ?? { qty: 0, kapasitas: 0 };
                      const pct = z.kapasitas > 0 ? Math.round((z.qty / z.kapasitas) * 1000) / 10 : 0;
                      return (
                        <tr key={key} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-4 font-semibold text-slate-700">{label}</td>
                          <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{fmt(z.qty)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums text-slate-500">{fmt(z.kapasitas)}</td>
                          <td className="py-2 text-right tabular-nums font-semibold text-slate-700">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {perKategori && Object.keys(perKategori).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[13px] font-semibold text-slate-700">Detail Produk per Kategori</div>
              <div className="mt-3 space-y-4">
                {Object.entries(perKategori).map(([kat, val]) => {
                  const items = val?.items ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={kat}>
                      <div className="mb-1.5 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-slate-600">
                        {kat} <span className="ml-1.5 text-slate-400">({items.length})</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12.5px]">
                          <thead>
                            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                              <th className="py-2 pr-4 font-semibold">Produk</th>
                              <th className="py-2 pr-4 font-semibold">Satuan</th>
                              <th className="py-2 pr-4 text-right font-semibold">Qty</th>
                              {Object.entries(ZONA_LABEL).map(([zk, zl]) => (
                                <th key={zk} className="py-2 pr-4 text-right font-semibold">{zl}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it) => (
                              <tr key={`${kat}-${it.nama}`} className="border-b border-slate-100 last:border-0">
                                <td className="py-2 pr-4 font-semibold text-slate-700">{it.nama}</td>
                                <td className="py-2 pr-4 text-slate-500">{it.satuan}</td>
                                <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{fmt(it.qty)}</td>
                                {Object.keys(ZONA_LABEL).map((zk) => (
                                  <td key={zk} className="py-2 pr-4 text-right tabular-nums text-slate-500">
                                    {fmt(it.zona?.[zk]?.qty ?? 0)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-[11.5px] text-slate-400">
            Snapshot tersimpan: {data.created_at}
          </div>
        </div>
      )}
    </div>
  );
}
