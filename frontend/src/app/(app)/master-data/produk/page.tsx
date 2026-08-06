"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiGet, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Produk = {
  id_produk: string;
  nama_produk: string;
  satuan: string;
  isi_per_pcs: number;
};

export default function MasterProdukPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Produk[]>([]);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ id_produk: "", nama_produk: "", satuan: "GALLON", isi_per_pcs: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    apiGet<{ data: Produk[] }>(`/produk?limit=100`)
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    load();
  }, [router]);

  const filtered = rows.filter(
    (r) =>
      !keyword ||
      `${r.id_produk} ${r.nama_produk}`.toLowerCase().includes(keyword.toLowerCase())
  );

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      if (editId) {
        await api(`/produk/${editId}`, { method: "PUT", body: JSON.stringify({
          id_produk: f.id_produk,
          nama_produk: f.nama_produk,
          satuan: f.satuan,
          isi_per_pcs: +f.isi_per_pcs,
        }) });
        setMsg("Produk diperbarui.");
      } else {
        await api("/produk", { method: "POST", body: JSON.stringify({
          id_produk: +f.id_produk,
          nama_produk: f.nama_produk,
          satuan: f.satuan,
          isi_per_pcs: +f.isi_per_pcs,
        }) });
        setMsg("Produk disimpan.");
      }
      setShowForm(false);
      setEditId(null);
      setF({ id_produk: "", nama_produk: "", satuan: "GALLON", isi_per_pcs: "" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal simpan");
    } finally {
      setSaving(false);
    }
  }

  async function hapus(id: string) {
    const ok = await window.confirm(`Hapus produk ${id}?`);
    if (!ok) return;
    try {
      await api(`/produk/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal hapus");
    }
  }

  const inputCls =
    "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";
  const labelCls = "mb-1 block text-[10px] font-extrabold text-[#172033]";

  return (
    <div className="flex flex-col gap-[7px]">
      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[10px] font-extrabold text-[#dc2626]">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-extrabold text-[#15803d]">
          {msg}
        </div>
      )}

      <div className="rounded-[11px] border border-[#e9edf5] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e9edf5] p-2.5">
          <div className="relative min-w-[200px] flex-1">
            <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#6b7280]" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari ID atau nama produk"
              className={`${inputCls} pl-[31px]`}
            />
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditId(null);
              setF({ id_produk: "", nama_produk: "", satuan: "GALLON", isi_per_pcs: "" });
            }}
            className="inline-flex h-[31px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#191970] px-2.5 text-[11px] font-extrabold text-white"
          >
            <i className="bi bi-plus-lg" />
            Tambah Produk
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="bg-[#fbfcff]">
                <th className="w-[90px] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#6b7280]">ID</th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#6b7280]">Nama Produk</th>
                <th className="w-[120px] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#6b7280]">Satuan</th>
                <th className="w-[120px] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#6b7280]">Isi / PCS</th>
                <th className="w-[120px] px-3 py-2 text-right text-[10px] font-black uppercase tracking-wide text-[#6b7280]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[11px] font-bold text-[#6b7280]">
                    Tidak ada data produk.
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => (
                <tr key={r.id_produk} className={i % 2 ? "bg-[#fbfcff]" : "bg-white"}>
                  <td className="px-3 py-2 text-[12px] font-black text-[#172033]">{r.id_produk}</td>
                  <td className="px-3 py-2 text-[12px] font-bold text-[#172033]">{r.nama_produk}</td>
                  <td className="px-3 py-2 text-[12px] font-semibold text-[#6b7280]">{r.satuan}</td>
                  <td className="px-3 py-2 text-[12px] font-semibold text-[#6b7280]">{r.isi_per_pcs}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditId(r.id_produk);
                          setF({ id_produk: r.id_produk, nama_produk: r.nama_produk, satuan: r.satuan, isi_per_pcs: String(r.isi_per_pcs) });
                          setShowForm(true);
                        }}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-[#eef0ff] text-[12px] text-[#191970]"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        onClick={() => hapus(r.id_produk)}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-[#fff0f0] text-[12px] text-[#ef4444]"
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={simpan} className="w-full max-w-[420px] rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[15px] font-black tracking-tight text-[#191970]">{editId ? `Edit Produk ${editId}` : "Tambah Produk"}</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>ID Produk</label>
                <input className={inputCls} value={f.id_produk} onChange={(e) => setF({ ...f, id_produk: e.target.value })} required disabled={!!editId} />
              </div>
              <div>
                <label className={labelCls}>Satuan</label>
                <select className={inputCls} value={f.satuan} onChange={(e) => setF({ ...f, satuan: e.target.value })}>
                  <option value="GALLON">GALLON</option>
                  <option value="BOX">BOX</option>
                  <option value="MP">MP</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Nama Produk</label>
                <input className={inputCls} value={f.nama_produk} onChange={(e) => setF({ ...f, nama_produk: e.target.value })} required />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Isi per PCS</label>
                <input type="number" min="1" className={inputCls} value={f.isi_per_pcs} onChange={(e) => setF({ ...f, isi_per_pcs: e.target.value })} required />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="submit" disabled={saving} className="flex h-[32px] flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#191970] text-[11px] font-black text-white disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="flex h-[32px] cursor-pointer items-center justify-center rounded-lg border border-[#e2e7f0] bg-white px-3 text-[11px] font-extrabold text-[#172033]">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}