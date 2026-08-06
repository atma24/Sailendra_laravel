"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Item = {
  id_opname: number;
  id_pengguna_lokasi: string;
  tanggal_opname: string;
  id_produk: number;
  nama_produk: string;
  lokasi_block: string;
  best_before: string;
  satuan: string;
  stok_fisik: number;
  stok_sistem: number;
  selisih: number;
  alasan: string;
  jenis_opname: string;
  created_at: string;
  stok_sebelumnya: number | null;
  dirubah_oleh: string;
};

export default function StockOpnameDetailPage() {
  const { createdAt } = useParams<{ createdAt: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editFisik, setEditFisik] = useState("0");
  const [editAlasan, setEditAlasan] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const created = decodeURIComponent(createdAt);

  const lokasiId = () => {
    const s = getSession();
    if (!s) return "";
    if (Array.isArray(s.lokasi) && s.lokasi.length > 0) return String(s.lokasi[0]);
    return String(s.user.id_pengguna_lokasi || "");
  };

  function load() {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    const lid = lokasiId();
    apiGet<{ data: Item[] }>(`/stok-opname?mode=detail&id_pengguna_lokasi=${lid}&created_at=${encodeURIComponent(created)}`)
      .then((r) => setItems(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [router, created]);

  if (loading) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  const selisih = items.reduce((a, i) => a + i.selisih, 0);

  async function simpanEdit(it: Item) {
    setSaving(true);
    setMsg("");
    const s = getSession();
    if (!s) return;
    try {
      await apiPost("/stok-opname", {
        mode: "edit_item",
        id_opname: it.id_opname,
        id_pengguna_lokasi: it.id_pengguna_lokasi,
        stok_fisik: +editFisik,
        alasan: editAlasan,
        dirubah_oleh: s.user.username,
      });
      setEditId(null);
      load();
      setMsg("Data berhasil diperbarui.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Gagal simpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <button
          onClick={() => router.push("/stock-opname")}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali
        </button>
        <div className="ml-auto text-right">
          <div className="text-[13px] font-black text-[#172033]">{items[0]?.tanggal_opname || "-"}</div>
          <div className="text-[10px] font-semibold text-[#6b7280]">
            {items[0]?.jenis_opname || "-"} | {items.length} item | selisih {selisih}
          </div>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-extrabold text-[#15803d]">
          {msg}
        </div>
      )}

      {items.map((it) => (
        <div key={it.id_opname} className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[12px] font-extrabold text-[#172033]">{it.nama_produk}</div>
              <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">
                {it.lokasi_block} | BB {it.best_before || "-"} | {it.satuan}
              </div>
            </div>
            <button
              onClick={() => {
                setEditId(it.id_opname);
                setEditFisik(String(it.stok_fisik));
                setEditAlasan(it.alasan || "");
              }}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#eef0ff] text-[12px] text-[#191970] transition hover:bg-[#191970] hover:text-white"
              title="Edit"
            >
              <i className="bi bi-pencil" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[#e9edf5] pt-2 text-center">
            <div>
              <div className="text-[9px] font-extrabold text-[#6b7280]">FISIK</div>
              <div className="text-[13px] font-black text-[#172033]">{it.stok_fisik}</div>
            </div>
            <div>
              <div className="text-[9px] font-extrabold text-[#6b7280]">SISTEM</div>
              <div className="text-[13px] font-black text-[#172033]">{it.stok_sistem}</div>
            </div>
            <div>
              <div className="text-[9px] font-extrabold text-[#6b7280]">SELISIH</div>
              <div className={`text-[13px] font-black ${it.selisih === 0 ? "text-[#16a34a]" : "text-[#ef2b2d]"}`}>
                {it.selisih > 0 ? `+${it.selisih}` : it.selisih}
              </div>
            </div>
          </div>

          {it.alasan && (
            <div className="mt-2 rounded-lg bg-[#fff7ed] px-2 py-1.5 text-[10px] font-bold text-[#92400e]">
              Catatan: {it.alasan}
            </div>
          )}
          {(it.stok_sebelumnya != null || it.dirubah_oleh) && (
            <div className="mt-1 text-[9px] font-semibold text-[#9ca3af]">
              Sebelumnya {it.stok_sebelumnya ?? "-"} {it.dirubah_oleh ? `| diubah oleh ${it.dirubah_oleh}` : ""}
            </div>
          )}

          {editId === it.id_opname && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] p-2">
              <input
                type="number"
                min="0"
                value={editFisik}
                onChange={(e) => setEditFisik(e.target.value)}
                placeholder="Stok fisik baru"
                className="h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-white px-2.5 text-[11px] font-bold outline-none focus:border-[#191970]"
              />
              <textarea
                value={editAlasan}
                onChange={(e) => setEditAlasan(e.target.value)}
                placeholder="Catatan wajib jika stok fisik diubah"
                className="min-h-[50px] w-full resize-y rounded-lg border border-[#e2e7f0] bg-white p-2 text-[11px] font-bold outline-none focus:border-[#191970]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => simpanEdit(it)}
                  disabled={saving}
                  className="flex h-[30px] flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#191970] text-[11px] font-black text-white disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="flex h-[30px] cursor-pointer items-center justify-center rounded-lg border border-[#e2e7f0] bg-white px-3 text-[11px] font-extrabold text-[#172033]"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
