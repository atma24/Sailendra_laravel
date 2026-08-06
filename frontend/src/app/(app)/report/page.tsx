"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Item = {
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  dibuat_oleh: string;
  createdAt?: string;
  [k: string]: any;
};

const MODES = ["day", "month", "year", "range"];

export default function ReportPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [jenis, setJenis] = useState("barang-masuk");
  const [mode, setMode] = useState("day");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<Item[]>([]);
  const [periode, setPeriode] = useState("");
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  if (!session) return null;
  const ss = session;

  const lokasiAll = (): string =>
    Array.isArray(ss.lokasi)
      ? ss.lokasi.join(",")
      : ss.lokasi === "all"
        ? ""
        : String(ss.user.id_pengguna_lokasi || "");

  function buildParams() {
    const p = new URLSearchParams();
    p.set("mode", mode);
    if (mode === "day") p.set("date", date);
    if (mode === "month") {
      p.set("month", month);
      p.set("year", year);
    }
    if (mode === "year") p.set("year", year);
    if (mode === "range") {
      p.set("start_date", startDate);
      p.set("end_date", endDate);
    }
    if (ss.lokasi !== "all") p.set("id_pengguna_lokasi", lokasiAll());
    return p;
  }

  async function lihat() {
    setLoading(true);
    setError("");
    const url = jenis === "mutasi" ? "/laporan/mutasi" : `/laporan/${jenis}`;
    try {
      const r = await apiGet<{ mode: string; periode: string; count: number; items: Item[] }>(`${url}?${buildParams().toString()}`);
      setItems(r.items || []);
      setPeriode(r.periode || "");
      setCount(r.count || 0);
    } catch (e: any) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function unduh() {
    setError("");
    try {
      const p = buildParams();
      if (jenis === "gabungan") {
        p.set("from", startDate);
        p.set("to", endDate);
        p.set("id_pengguna_lokasi", lokasiAll());
      }
      if (jenis === "stok-opname") {
        p.set("mode", "export");
        p.set("tanggal_opname", date);
        p.set("id_pengguna_lokasi", lokasiAll());
      }
      const url = jenis === "mutasi" ? "/laporan/mutasi" : `/laporan/${jenis}`;
      const res = await fetch(`/api${url}?${p.toString()}`, { headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt.slice(0, 200) || "Gagal mengunduh laporan");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${jenis}_${date || year}.xls`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const inputCls =
    "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";
  const labelCls = "mb-1 block text-[10px] font-extrabold text-[#172033]";

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
        <div className="flex flex-col gap-[7px]">
          <div>
            <label className={labelCls}>Jenis Laporan</label>
            <select className={inputCls} value={jenis} onChange={(e) => setJenis(e.target.value)}>
              <option value="barang-masuk">Barang Masuk</option>
              <option value="barang-keluar">Barang Keluar</option>
              <option value="mutasi">Mutasi</option>
              <option value="gabungan">Gabungan</option>
              <option value="stok-opname">Stock Opname</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Mode</label>
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>

          {mode === "day" && (
            <div>
              <label className={labelCls}>Tanggal</label>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {mode === "month" && (
            <div className="grid grid-cols-2 gap-[7px]">
              <div>
                <label className={labelCls}>Bulan</label>
                <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tahun</label>
                <input type="number" className={inputCls} value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
            </div>
          )}
          {mode === "year" && (
            <div>
              <label className={labelCls}>Tahun</label>
              <input type="number" className={inputCls} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          )}
          {mode === "range" && (
            <div className="grid grid-cols-2 gap-[7px]">
              <div>
                <label className={labelCls}>Dari</label>
                <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Sampai</label>
                <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[10px] font-extrabold text-[#dc2626]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-[7px]">
        <button
          onClick={unduh}
          className="flex min-h-[33px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#191970] text-[11px] font-black text-white transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)]"
        >
          <i className="bi bi-download" />
          Unduh Excel
        </button>
        <button
          onClick={lihat}
          disabled={jenis === "gabungan" || jenis === "stok-opname"}
          className="flex min-h-[33px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#eef0ff] text-[11px] font-black text-[#191970] transition hover:bg-[#191970] hover:text-white disabled:opacity-50"
        >
          {loading ? "Memuat..." : "Lihat Data"}
        </button>
      </div>

      {periode && (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-3 py-2 text-[11px] font-extrabold text-[#191970]">
          {periode} | {count} data
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-2">
          <div className="flex max-h-[60vh] flex-col gap-[7px] overflow-y-auto">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border border-[#e9edf5] bg-[#fbfcff] p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-extrabold text-[#172033]">{it.nama_produk}</div>
                    <div className="text-[9px] font-semibold text-[#6b7280]">
                      {it.nama_driver || it.dibuat_oleh || "-"} | {it.nama_pengguna_lokasi || ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] font-black text-[#191970]">{it.jumlah} {it.satuan || ""}</div>
                </div>
                <div className="mt-1 text-[9px] font-semibold text-[#6b7280]">
                  {it.best_before || it.tanggal || it.created_at || it.createdAt || ""}
                  {(it.batch || it.no_dn) && <> | {it.batch || ""} {it.no_dn || ""}</>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}