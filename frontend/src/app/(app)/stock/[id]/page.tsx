"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Item = {
  id_stok: number;
  id_produk: number;
  nama_produk: string;
  id_barang_masuk: number;
  qty_sisa: number;
  satuan: string;
  best_before: string;
  lokasi_block: string;
  zone: string;
};

export default function StockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const zona = search.get("zona") || "normal";
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    apiGet<{ data: Item[] }>(`/stok?mode=detail&id_produk=${id}&${lokasiParam(s)}`)
      .then((r) => setItems(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router, id]);

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  const total = items.reduce((a, i) => a + i.qty_sisa, 0);
  const nama = items[0]?.nama_produk || `Produk ${id}`;

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <button
          onClick={() => router.push("/stock")}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali
        </button>
        <div className="ml-auto text-right">
          <div className="text-[13px] font-black text-[#172033]">{nama}</div>
          <div className="text-[10px] font-semibold text-[#6b7280]">
            ID {id} | Zona {zona} | {items.length} batch | {total}
          </div>
        </div>
      </div>

      {items.map((it) => (
        <div key={it.id_stok} className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-extrabold text-[#172033]">Lokasi: {it.lokasi_block}</div>
            <div className="shrink-0 text-[12px] font-black text-[#191970]">
              {it.qty_sisa} {it.satuan}
            </div>
          </div>
          <div className="mt-2 space-y-1 border-t border-[#e9edf5] pt-2 text-[10px] font-semibold text-[#6b7280]">
            <div>Best Before: {it.best_before || "-"}</div>
            <div>Zona: {it.zone || "-"}</div>
            <div>ID Barang Masuk: {it.id_barang_masuk || "-"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
