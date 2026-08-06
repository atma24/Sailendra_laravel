"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Item = {
  id_barang_masuk: number;
  id_produk: number;
  nama_produk: string;
  jumlah: number;
  satuan: string;
  tipe_penerimaan: string;
  best_before: string;
  batch: string;
  asal_pabrik: string;
  no_dn: string;
  no_mobil: string;
  lokasi_block: string;
  catatan: string;
  dibuat_oleh: string;
  stok_sisa: number;
  nama_driver: string;
};

export default function InboundDetailPage() {
  const { tanggal, driver } = useParams<{ tanggal: string; driver: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hapusId, setHapusId] = useState<number | null>(null);
  const [hapusMsg, setHapusMsg] = useState("");
  const drv = decodeURIComponent(driver);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    apiGet<{ data: Item[] }>(
      `/barang-masuk?tanggal=${tanggal}&${lokasiParam(s)}&cari=${encodeURIComponent(drv)}`
    )
      .then((r) => setItems(r.data.filter((x) => x.nama_driver.toLowerCase() === drv.toLowerCase()) || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router, tanggal, drv]);

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;

  const totalQty = items.reduce((a, i) => a + i.jumlah, 0);

  async function hapus(id: number) {
    const resp = await window.confirm("Hapus barang masuk ini? Stok terkait akan ikut dihapus.");
    if (!resp) return;
    setHapusId(id);
    setHapusMsg("");
    try {
      await apiPost("/barang-masuk/hapus", { id_barang_masuk: id });
      setItems((prev) => prev.filter((x) => x.id_barang_masuk !== id));
    } catch (e) {
      setHapusMsg(e instanceof ApiError ? e.message : "Gagal hapus");
    } finally {
      setHapusId(null);
    }
  }

  if (items.length === 0)
    return (
      <div className="p-8 text-center font-semibold text-[#6b7280]">
        {error || "Tidak ada item untuk driver ini."}
      </div>
    );

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <button
          onClick={() => router.push(`/inbound/${tanggal}`)}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali
        </button>
        <div className="ml-auto text-right">
          <div className="text-[13px] font-black text-[#172033]">{drv}</div>
          <div className="text-[10px] font-semibold text-[#6b7280]">
            {tanggal} | {items.length} item | {totalQty}
          </div>
        </div>
      </div>

      {hapusMsg && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[10px] font-extrabold text-[#dc2626]">
          {hapusMsg}
        </div>
      )}

      {items.map((it) => (
        <div key={it.id_barang_masuk} className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[12px] font-extrabold text-[#172033]">{it.nama_produk}</div>
              <div className="mt-0.5 text-[12px] font-black text-[#191970]">
                {it.jumlah} {it.satuan}
                {it.stok_sisa > 0 && ` (sisa ${it.stok_sisa})`}
              </div>
            </div>
            <button
              onClick={() => hapus(it.id_barang_masuk)}
              disabled={hapusId === it.id_barang_masuk}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#fff0f0] text-[12px] text-[#ef4444] transition hover:bg-[#ef4444] hover:text-white disabled:opacity-50"
              title="Hapus"
            >
              <i className="bi bi-trash3" />
            </button>
          </div>
          <div className="mt-2 space-y-1 border-t border-[#e9edf5] pt-2 text-[10px] font-semibold text-[#6b7280]">
            <div>Lokasi: {it.lokasi_block || "-"} | Batch: {it.batch || "-"}</div>
            <div>BB: {it.best_before || "-"} | Asal: {it.asal_pabrik || "-"}</div>
            <div>
              {it.tipe_penerimaan} {it.no_dn && `| DN ${it.no_dn}`} {it.no_mobil && `| ${it.no_mobil}`}
            </div>
            {it.dibuat_oleh && <div>Dibuat oleh: {it.dibuat_oleh}</div>}
            {it.catatan && <div>Catatan: {it.catatan}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}