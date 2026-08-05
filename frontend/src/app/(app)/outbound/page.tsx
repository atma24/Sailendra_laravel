"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Bk = {
  id_barang_keluar: number;
  tanggal_keluar: string;
  nama_driver: string;
  status: string;
  nama_pengguna_lokasi: string;
  id_pengguna_lokasi: string;
};

export default function OutboundTanggalPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<Bk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lokasiAktif, setLokasiAktif] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setLokasiAktif(s.lokasi === "all" ? "Semua Lokasi" : String(s.lokasi));
    apiGet<{ data: Bk[] }>(`/barang-keluar?${lokasiParam(s)}`)
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const tanggalSet = Array.from(new Set(rows.map((r) => r.tanggal_keluar)))
    .filter((t) => !keyword || t.includes(keyword))
    .sort()
    .reverse();

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
            placeholder="Cari tanggal contoh: 2026-05-09"
            className="h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] pr-[31px] pl-[31px] text-[11px] font-bold outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]"
          />
          {keyword && (
            <button
              onClick={() => setKeyword("")}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 cursor-pointer text-[11px] text-[#6b7280]"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
        <div className="flex gap-[7px]">
          <Link
            href="/outbound/form"
            className="inline-flex h-[31px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#191970] px-2.5 text-[11px] font-extrabold text-white no-underline transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)]"
          >
            <i className="bi bi-plus-lg" />
            Tambah Outbound
          </Link>
        </div>
      </div>

      {lokasiAktif && (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-3 py-2 text-[11px] font-extrabold text-[#191970]">
          <i className="bi bi-geo-alt mr-1.5" />
          {lokasiAktif}
        </div>
      )}

      {tanggalSet.length === 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-2.5 py-3 text-[11px] font-bold text-[#6b7280]">
          Tidak ada data tanggal outbound.
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {tanggalSet.map((tgl) => (
            <Link
              key={tgl}
              href={`/outbound/${tgl}`}
              className="flex items-center gap-1.5 rounded-[11px] border border-[#e9edf5] bg-white px-2 py-2 no-underline transition hover:-translate-y-px hover:border-[rgba(25,25,112,0.18)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
            >
              <div className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-lg bg-[#eef0ff] text-[13px] text-[#191970]">
                <i className="bi bi-calendar3" />
              </div>
              <div className="text-[12px] font-black tracking-tight text-[#172033]">{tgl}</div>
              <div className="ml-auto flex items-center text-[14px] text-[#6b7280]">
                <i className="bi bi-chevron-right" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}