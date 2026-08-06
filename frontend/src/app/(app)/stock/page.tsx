"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Row = {
  id_produk: number;
  nama_produk: string;
  kategori_lokasi: string;
  satuan: string;
  total_qty: number;
  best_before_terdekat: string | null;
};

const ZONAS = ["normal", "bad", "reject", "receh", "festive", "transit", "hold", "all"];

export default function StockPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [zona, setZona] = useState("normal");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    apiGet<{ data: Row[] }>(`/stok?mode=list&zona=${zona}&${lokasiParam(s)}`)
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router, zona]);

  const filtered = rows.filter(
    (r) =>
      !keyword ||
      `${r.id_produk} ${r.nama_produk} ${r.kategori_lokasi}`.toLowerCase().includes(keyword.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <div className="relative">
          <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#6b7280]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari produk atau lokasi"
            className="h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] pr-[31px] pl-[31px] text-[11px] font-bold outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 px-0 pt-2">
          {ZONAS.map((z) => {
            const active = zona === z;
            return (
              <button
                key={z}
                onClick={() => setZona(z)}
                className={`inline-flex h-[27px] items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-extrabold transition ${
                  active
                    ? "border-[#191970] bg-[#191970] text-white"
                    : "border-[#e2e7f0] bg-[#fbfcff] text-[#172033]"
                }`}
              >
                {z === "all" ? "Semua" : z.charAt(0).toUpperCase() + z.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-2.5 py-3 text-[11px] font-bold text-[#6b7280]">
          Tidak ada data stok.
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {filtered.map((r) => (
            <Link
              key={r.id_produk}
              href={`/stock/${r.id_produk}?zona=${zona}`}
              className="flex items-center gap-1.5 rounded-[11px] border border-[#e9edf5] bg-white px-2 py-2 no-underline transition hover:-translate-y-px hover:border-[rgba(25,25,112,0.18)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
            >
              <div className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-lg bg-[#eef0ff] text-[13px] text-[#191970]">
                <i className="bi bi-box-seam" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black tracking-tight text-[#172033]">
                  {r.id_produk} - {r.nama_produk}
                </div>
                <div className="text-[10px] font-semibold text-[#6b7280]">
                  {r.kategori_lokasi} {r.best_before_terdekat && `| BB terdekat ${r.best_before_terdekat}`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12px] font-black text-[#191970]">
                  {r.total_qty} <span className="text-[10px]">{r.satuan}</span>
                </div>
              </div>
              <div className="text-[14px] text-[#6b7280]">
                <i className="bi bi-chevron-right" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
