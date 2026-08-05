"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Bk = {
  id_barang_keluar: number;
  tanggal_keluar: string;
  nama_driver: string;
  no_mobil: string;
  status: string;
};

type Driver = {
  nama_driver: string;
  no_mobil: string;
  status: string;
  count: number;
};

const STATUS_OPTIONS = ["", "Draft", "Pending", "Selesai"];

export default function OutboundDriverPage() {
  const { tanggal } = useParams<{ tanggal: string }>();
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Bk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    apiGet<{ data: Bk[] }>(`/barang-keluar?tanggal=${tanggal}&${lokasiParam(s)}`)
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router, tanggal]);

  const drivers = rows
    .filter((r) => !keyword || r.nama_driver.toLowerCase().includes(keyword.toLowerCase()))
    .filter((r) => !status || r.status.toLowerCase() === status.toLowerCase())
    .reduce<Record<string, Driver>>((acc, r) => {
      const key = `${r.nama_driver}_${r.no_mobil}`;
      if (!acc[key]) {
        acc[key] = { nama_driver: r.nama_driver, no_mobil: r.no_mobil, status: r.status, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});
  const driverList = Object.values(drivers);

  const statusCounts = (st: string) =>
    rows.filter((r) => !st || r.status.toLowerCase() === st.toLowerCase()).length;

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <Link
          href="/outbound"
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] no-underline transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali ke tanggal
        </Link>
        <span className="whitespace-nowrap rounded-full bg-[#eef0ff] px-2 py-1 text-[10px] font-black text-[#191970]">
          {tanggal}
        </span>
      </div>

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <div className="relative">
          <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#6b7280]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari nama driver"
            className="h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] pr-[31px] pl-[31px] text-[11px] font-bold outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 px-0 pt-2">
          {STATUS_OPTIONS.map((st) => {
            const active = status === st;
            return (
              <button
                key={st}
                onClick={() => setStatus(st)}
                className={`inline-flex h-[27px] items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-extrabold transition ${
                  active
                    ? "border-[#191970] bg-[#191970] text-white"
                    : "border-[#e2e7f0] bg-[#fbfcff] text-[#172033]"
                }`}
              >
                <span>{st === "" ? "Semua" : st}</span>
                <span className={`rounded-full px-1 text-[10px] font-extrabold ${active ? "bg-white/25 text-white" : "bg-[rgba(15,23,42,0.06)]"}`}>
                  {statusCounts(st)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {driverList.length === 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-2.5 py-3 text-[11px] font-bold text-[#6b7280]">
          Driver tidak ditemukan pada tanggal ini.
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {driverList.map((d) => {
            const st = d.status || "Draft";
            const bg = st === "Pending" ? "#fef3c7" : st === "Selesai" ? "#d1fae5" : "#e5e7eb";
            const text = st === "Pending" ? "#92400e" : st === "Selesai" ? "#065f46" : "#4b5563";
            return (
              <Link
                key={`${d.nama_driver}_${d.no_mobil}`}
                href={`/outbound/${tanggal}/${encodeURIComponent(d.nama_driver)}`}
                className="flex items-center gap-1.5 rounded-[11px] border border-[#e9edf5] bg-white px-2 py-2 no-underline transition hover:-translate-y-px hover:border-[rgba(25,25,112,0.18)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
              >
                <div className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-lg bg-[#eef0ff] text-[13px] text-[#191970]">
                  <i className="bi bi-truck" />
                </div>
                <div style={{ flex: 1 }} className="text-[12px] font-black tracking-tight text-[#172033]">
                  {d.nama_driver}
                </div>
                <span
                  className="whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-black"
                  style={{ background: bg, color: text }}
                >
                  {st}
                </span>
                <div className="text-[14px] text-[#6b7280]">
                  <i className="bi bi-chevron-right" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}