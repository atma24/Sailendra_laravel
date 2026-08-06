"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Cat = {
  id_produk: number;
  nama_produk: string;
  satuan: string;
  lokasi_block: string;
  best_before: string;
  stok_sistem: number;
};

type Picked = Cat & { stok_fisik: string; alasan: string };

type PreviewItem = {
  id_produk: number;
  nama_produk: string;
  lokasi_block: string;
  best_before: string;
  satuan: string;
  stok_fisik: number;
  stok_sistem: number;
  selisih: number;
};

export default function StockOpnameFormPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [catalog, setCatalog] = useState<Cat[]>([]);
  const [keyword, setKeyword] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [tanggalOpname, setTanggalOpname] = useState(() => new Date().toISOString().slice(0, 10));
  const [jenisOpname, setJenisOpname] = useState("Akurasi");
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    apiGet<{ data: Cat[] }>(`/stok-opname?mode=stok_catalog&id_pengguna_lokasi=${s.user.id_pengguna_lokasi}`)
      .then((r) => setCatalog(r.data || []))
      .catch((e) => setError(e.message));
  }, [router]);

  if (!session) return null;

  const filtered = catalog.filter(
    (c) =>
      !keyword ||
      `${c.id_produk} ${c.nama_produk} ${c.lokasi_block}`.toLowerCase().includes(keyword.toLowerCase())
  );

  const lokasiId = () =>
    Array.isArray(session.lokasi) && session.lokasi.length > 0
      ? String(session.lokasi[0])
      : String(session.user.id_pengguna_lokasi || "");

  function toggle(c: Cat) {
    setPicked((prev) => {
      if (prev.find((p) => p.id_produk === c.id_produk && p.lokasi_block === c.lokasi_block && p.best_before === c.best_before)) {
        return prev.filter((p) => !(p.id_produk === c.id_produk && p.lokasi_block === c.lokasi_block && p.best_before === c.best_before));
      }
      return [...prev, { ...c, stok_fisik: String(c.stok_sistem), alasan: "" }];
    });
  }

  function buildItems() {
    return picked.map((p) => ({
      id_produk: p.id_produk,
      lokasi_block: p.lokasi_block,
      best_before: p.best_before,
      stok_fisik: +(p.stok_fisik || 0),
      alasan: p.alasan,
      nama_produk: p.nama_produk,
      satuan: p.satuan,
    }));
  }

  async function runPreview() {
    setError("");
    setPreviewErrors([]);
    try {
      const r = await apiPost<{ data: { items: PreviewItem[]; errors: string[] } }>("/stok-opname", {
        mode: "preview",
        id_pengguna: session!.user.id_pengguna,
        id_pengguna_lokasi: lokasiId(),
        tanggal_opname: tanggalOpname,
        jenis_opname: jenisOpname,
        items: buildItems(),
      });
      setPreview(r.data.items || []);
      setPreviewErrors(r.data.errors || []);
    } catch (e) {
      setPreview(null);
      setPreviewErrors([e instanceof ApiError ? e.message : "Gagal preview"]);
    }
  }

  async function runSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiPost("/stok-opname", {
        mode: "save",
        id_pengguna: session!.user.id_pengguna,
        id_pengguna_lokasi: lokasiId(),
        tanggal_opname: tanggalOpname,
        jenis_opname: jenisOpname,
        items: buildItems(),
      });
      setSuccess("Stock opname berhasil disimpan.");
      setPicked([]);
      setPreview(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal simpan");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";
  const labelCls = "mb-1 block text-[10px] font-extrabold text-[#172033]";

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between rounded-[11px] border border-[#e9edf5] bg-white px-3 py-2">
        <button
          onClick={() => router.push("/stock-opname")}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[10px] font-extrabold text-[#dc2626]">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-extrabold text-[#15803d]">
          <i className="bi bi-check-circle-fill mr-1" />
          {success}
        </div>
      )}

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
        <div className="grid grid-cols-2 gap-[7px]">
          <div>
            <label className={labelCls}>Tanggal Opname</label>
            <input type="date" className={inputCls} value={tanggalOpname} onChange={(e) => setTanggalOpname(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Jenis Opname</label>
            <input className={inputCls} value={jenisOpname} onChange={(e) => setJenisOpname(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
        <div className="mb-2 text-[12px] font-black text-[#191970]">Pilih Stok ({picked.length} dipilih)</div>
        <div className="relative mb-2">
          <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#6b7280]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari produk atau lokasi"
            className={`${inputCls} pl-[31px]`}
          />
        </div>
        <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto">
          {filtered.length === 0 && <div className="p-2 text-center text-[10px] font-extrabold text-[#6b7280]">Tidak ada stok.</div>}
          {filtered.map((c) => {
            const isPicked = picked.find(
              (p) => p.id_produk === c.id_produk && p.lokasi_block === c.lokasi_block && p.best_before === c.best_before
            );
            return (
              <button
                key={`${c.id_produk}_${c.lokasi_block}_${c.best_before}`}
                type="button"
                onClick={() => toggle(c)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                  isPicked ? "border-[#191970] bg-[#eef0ff]" : "border-[#e2e7f0] bg-white hover:bg-[#f7f9ff]"
                }`}
              >
                <span className={`text-[13px] ${isPicked ? "text-[#191970]" : "text-[#6b7280]"}`}>
                  <i className={`bi ${isPicked ? "bi-check-circle-fill" : "bi-circle"}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-extrabold text-[#172033]">{c.nama_produk}</span>
                  <span className="block text-[9px] font-semibold text-[#6b7280]">
                    {c.lokasi_block} | BB {c.best_before || "-"} | sistem {c.stok_sistem} {c.satuan}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {picked.length > 0 && (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-2 text-[12px] font-black text-[#191970]">Input Stok Fisik</div>
          {picked.map((p, idx) => (
            <div key={`${p.id_produk}_${p.lokasi_block}_${p.best_before}`} className="mb-2 border-b border-[#e9edf5] pb-2 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-extrabold text-[#172033]">{p.nama_produk}</div>
                  <div className="text-[9px] font-semibold text-[#6b7280]">
                    {p.lokasi_block} | BB {p.best_before || "-"} | sistem {p.stok_sistem}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  className="h-[31px] w-[90px] shrink-0 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-black outline-none focus:border-[#191970]"
                  value={p.stok_fisik}
                  onChange={(e) =>
                    setPicked(picked.map((x, i) => (i === idx ? { ...x, stok_fisik: e.target.value } : x)))
                  }
                />
              </div>
              <input
                className="mt-1 h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-bold outline-none focus:border-[#191970]"
                placeholder="Alasan / catatan (opsional)"
                value={p.alasan}
                onChange={(e) => setPicked(picked.map((x, i) => (i === idx ? { ...x, alasan: e.target.value } : x)))}
              />
            </div>
          ))}
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-2 text-[12px] font-black text-[#191970]">Preview Selisih</div>
          {preview.map((p, i) => (
            <div key={i} className="flex items-center justify-between border-b border-[#e9edf5] py-1.5 text-[10px] last:border-0">
              <span className="min-w-0 flex-1 truncate font-extrabold text-[#172033]">
                {p.nama_produk} <span className="font-semibold text-[#6b7280]">({p.lokasi_block})</span>
              </span>
              <span className="shrink-0 font-bold text-[#6b7280]">
                {p.stok_sistem} → {p.stok_fisik}
              </span>
              <span className={`ml-2 w-[70px] shrink-0 text-right font-black ${p.selisih === 0 ? "text-[#16a34a]" : "text-[#ef2b2d]"}`}>
                {p.selisih > 0 ? `+${p.selisih}` : p.selisih}
              </span>
            </div>
          ))}
        </div>
      )}

      {previewErrors.length > 0 && (
        <div className="rounded-[11px] border border-[#fecaca] bg-[#fff7f7] p-3">
          {previewErrors.map((e, i) => (
            <div key={i} className="text-[10px] font-extrabold text-[#dc2626]">- {e}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={runPreview}
        disabled={picked.length === 0}
        className="flex min-h-[33px] w-full cursor-pointer items-center justify-center rounded-lg bg-[#eef0ff] text-[11px] font-black text-[#191970] transition hover:bg-[#191970] hover:text-white disabled:bg-[#ddddeb] disabled:text-[#8f91a3]"
      >
        Preview Selisih
      </button>

      <button
        type="button"
        onClick={runSave}
        disabled={picked.length === 0 || saving}
        className="flex min-h-[33px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#191970] px-2.5 text-[11px] font-black text-white transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)] disabled:bg-[#ddddeb] disabled:text-[#8f91a3]"
      >
        {saving ? "Menyimpan..." : "Simpan Opname"}
      </button>
    </div>
  );
}
