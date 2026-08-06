"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Row = {
  id_mutasi: number;
  nama_produk: string;
  jumlah: number;
  satuan: string;
  best_before: string;
  jenis_mutasi: string;
  lokasi_sumber: string;
  lokasi_tujuan: string;
  catatan: string;
  created_at: string;
  nama_pengguna: string;
  nama_pengguna_lokasi: string;
};

const JENIS: Record<string, string> = {
  GS_GS: "Goods - Goods",
  GS_BAD: "Goods - Bad",
  BAD_GS: "Bad - Goods",
  GS_REJ: "Goods - Reject",
  BAD_REJ: "Bad - Reject",
};

export default function MutasiPage() {
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
    apiGet<{ data: Row[]; mutasi: Row[] }>(`/mutasi?${lokasiParam(s)}`)
      .then((r) => setRows(r.data || r.mutasi || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = rows.filter(
    (r) =>
      !keyword ||
      `${r.nama_produk} ${r.lokasi_sumber} ${r.lokasi_tujuan} ${r.jenis_mutasi}`
        .toLowerCase()
        .includes(keyword.toLowerCase())
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
            placeholder="Cari produk, lokasi, atau jenis"
            className="h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] pr-[31px] pl-[31px] text-[11px] font-bold outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]"
          />
        </div>
        <Link
          href="/mutasi/form"
          className="inline-flex h-[31px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#191970] px-2.5 text-[11px] font-extrabold text-white no-underline transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)]"
        >
          <i className="bi bi-plus-lg" />
          Tambah Mutasi
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-2.5 py-3 text-[11px] font-bold text-[#6b7280]">
          Tidak ada data mutasi.
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {filtered.map((r) => (
            <div key={r.id_mutasi} className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-extrabold text-[#172033]">{r.nama_produk}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">
                    {r.created_at} | {r.nama_pengguna || r.nama_pengguna_lokasi || "-"}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#eef0ff] px-2 py-0.5 text-[9px] font-black text-[#191970]">
                  {JENIS[r.jenis_mutasi] || r.jenis_mutasi}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 border-t border-[#e9edf5] pt-2 text-[11px] font-bold text-[#172033]">
                <span>{r.lokasi_sumber || "-"}</span>
                <i className="bi bi-arrow-right text-[10px] text-[#6b7280]" />
                <span>{r.lokasi_tujuan || "-"}</span>
                <span className="ml-auto shrink-0 font-black text-[#191970]">
                  {r.jumlah} {r.satuan}
                </span>
              </div>
              <div className="mt-1 text-[9px] font-semibold text-[#6b7280]">
                BB {r.best_before || "-"} {r.catatan ? `| ${r.catatan}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
