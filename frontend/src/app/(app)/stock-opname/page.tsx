"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Row = {
  tanggal_opname: string;
  created_at: string;
  jenis_opname: string;
  jumlah_produk: number;
  jumlah_selisih: number;
};

export default function StockOpnamePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    apiGet<{ data: Row[] }>(`/stok-opname?mode=history&${lokasiParam(s)}`)
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = rows.filter(
    (r) => !keyword || r.tanggal_opname.includes(keyword) || r.jenis_opname.toLowerCase().includes(keyword.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <div className="relative">
          <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#6b7280]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari tanggal opname"
            className="h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] pr-[31px] pl-[31px] text-[11px] font-bold outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]"
          />
        </div>
        <Link
          href="/stock-opname/form"
          className="inline-flex h-[31px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#191970] px-2.5 text-[11px] font-extrabold text-white no-underline transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)]"
        >
          <i className="bi bi-plus-lg" />
          Tambah Opname
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-2.5 py-3 text-[11px] font-bold text-[#6b7280]">
          Tidak ada data stock opname.
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {filtered.map((r) => (
            <Link
              key={r.created_at}
              href={`/stock-opname/${encodeURIComponent(r.created_at)}`}
              className="flex items-center gap-1.5 rounded-[11px] border border-[#e9edf5] bg-white px-2 py-2 no-underline transition hover:-translate-y-px hover:border-[rgba(25,25,112,0.18)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
            >
              <div className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-lg bg-[#eef0ff] text-[13px] text-[#191970]">
                <i className="bi bi-clipboard-check" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black tracking-tight text-[#172033]">
                  {r.tanggal_opname}
                  <span className="ml-1.5 text-[10px] font-semibold text-[#6b7280]">{r.jenis_opname}</span>
                </div>
                <div className="text-[10px] font-semibold text-[#6b7280]">
                  {r.jumlah_produk} produk
                  {r.jumlah_selisih > 0 && (
                    <span className="ml-1 font-extrabold text-[#ef2b2d]">| {r.jumlah_selisih} selisih</span>
                  )}
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
