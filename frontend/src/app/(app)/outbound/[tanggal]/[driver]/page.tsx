"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Item = {
  id_barang_keluar: number;
  id_item: number;
  id_produk: number;
  nama_produk: string;
  jumlah: number;
  kuantitas: number;
  satuan: string;
  best_before: string;
  lokasi_block: string;
  catatan: string;
  rencana_deep: { label_lokasi: string; batch?: string; best_before?: string }[];
};

export default function OutboundDetailPage() {
  const { tanggal, driver } = useParams<{ tanggal: string; driver: string }>();
  const router = useRouter();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const drv = decodeURIComponent(driver);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    async function load() {
      const sess = getSession();
      if (!sess) {
        router.replace("/login");
        return;
      }
      try {
        // cari id_barang_keluar pertama dari grup driver
        const listRes = await apiGet<{ data: any[] }>(
          `/barang-keluar?tanggal=${tanggal}&${lokasiParam(sess)}&cari=${encodeURIComponent(drv)}`
        );
        const match = (listRes.data || []).find(
          (r) => r.nama_driver.toLowerCase() === drv.toLowerCase()
        );
        if (!match) {
          setError("Data tidak ditemukan.");
          return;
        }
        const det = await apiGet<{ data: { data: any; items: Item[] } }>(
          `/barang-keluar/detail?id_barang_keluar=${match.id_barang_keluar}&id_pengguna_lokasi=${sess.lokasi === "all" ? match.id_pengguna_lokasi : sess.user.id_pengguna_lokasi}`
        );
        setHeader(det.data.data);
        setItems(det.data.items || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, tanggal, drv]);

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  const totalQty = items.reduce((a, i) => a + i.jumlah, 0);

  function row(label: string, value: string | number | null) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    return (
      <div key={label} className="flex items-center justify-between border-b border-[#e9edf5] py-2 text-[11px] last:border-0">
        <span className="font-bold text-[#6b7280]">{label}</span>
        <span className="font-extrabold text-[#172033]">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <button
          onClick={() => router.push(`/outbound/${tanggal}`)}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali
        </button>
        <div className="ml-auto text-right">
          <div className="text-[13px] font-black text-[#172033]">{header?.nama_driver || drv}</div>
          <div className="text-[10px] font-semibold text-[#6b7280]">{tanggal}</div>
        </div>
      </div>

      <div className="grid gap-[7px] md:grid-cols-2">
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <h3 className="mb-1 text-[12px] font-black text-[#191970]">Detail Outbound</h3>
          {row("No GIN", header?.gin_no)}
          {row("No Mobil", header?.no_mobil)}
          {row("Driver", header?.nama_driver)}
          {row("Tipe", header?.tipe_pengeluaran)}
          {row("Tujuan", header?.tujuan)}
          {row("Tanggal Keluar", header?.tanggal_keluar)}
          {row("Status", header?.status)}
          {row("Dibuat oleh", header?.dibuat_oleh)}
          {row("Diperbarui oleh", header?.diperbarui_nama)}
          {row("Jumlah Jenis", items.length)}
          {row("Total Qty", totalQty)}
        </div>

        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <h3 className="mb-1 text-[12px] font-black text-[#191970]">Item Barang</h3>
          {items.map((it) => (
            <div key={it.id_item} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between border-b border-[#e9edf5] pb-1.5">
                <span className="text-[12px] font-extrabold text-[#172033]">{it.nama_produk}</span>
                <span className="shrink-0 text-[12px] font-black text-[#191970]">
                  {it.jumlah} {it.satuan}
                </span>
              </div>
              <div className="pt-1 text-[10px] font-semibold text-[#6b7280]">
                {it.lokasi_block && <span>Lokasi: {it.lokasi_block}</span>}
                {it.best_before && <span> | BB: {it.best_before}</span>}
              </div>
              {it.rencana_deep && it.rencana_deep.length > 0 && (
                <div className="mt-1 rounded-lg bg-[#f7f9ff] p-2">
                  {it.rencana_deep.map((r, i) => (
                    <div key={i} className="text-[10px] font-bold text-[#172033]">
                      {r.label_lokasi}
                    </div>
                  ))}
                </div>
              )}
              {it.catatan && (
                <div className="mt-1 text-[10px] font-bold text-[#6b7280]">Catatan: {it.catatan}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}