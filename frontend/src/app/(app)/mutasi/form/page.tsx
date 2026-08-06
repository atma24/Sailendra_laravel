"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Produk = { id_produk: string; nama_produk: string; satuan: string };
type Lokasi = { id_lokasi: string; nama_lokasi: string; kategori: string };
type Block = { id_block: string; kode_block: string };
type Line = { id_line: string; nomor_line: number };

const JENIS: Record<string, string> = {
  GS_GS: "Goods Stock - Goods Stock",
  GS_BAD: "Goods Stock - Bad Stock",
  BAD_GS: "Bad Stock - Goods Stock",
  GS_REJ: "Goods Stock - Reject",
  BAD_REJ: "Bad Stock - Reject",
};

export default function MutasiFormPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [produk, setProduk] = useState<Produk[]>([]);
  const [lokasi, setLokasi] = useState<Lokasi[]>([]);
  const [openPick, setOpenPick] = useState<string | null>(null);
  const [pickQ, setPickQ] = useState("");

  const [jenis, setJenis] = useState("");
  const [idProduk, setIdProduk] = useState("");
  const [satuan, setSatuan] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [catatan, setCatatan] = useState("");

  const [dariLokasi, setDariLokasi] = useState("");
  const [dariBlock, setDariBlock] = useState("");
  const [dariLine, setDariLine] = useState("");
  const [dariBlocks, setDariBlocks] = useState<Block[]>([]);
  const [dariLines, setDariLines] = useState<Line[]>([]);

  const [keLokasi, setKeLokasi] = useState("");
  const [keBlock, setKeBlock] = useState("");
  const [keLine, setKeLine] = useState("");
  const [keBlocks, setKeBlocks] = useState<Block[]>([]);
  const [keLines, setKeLines] = useState<Line[]>([]);

  const [bbList, setBbList] = useState<string[]>([]);
  const [bestBefore, setBestBefore] = useState("");

  const [preview, setPreview] = useState<any>(null);
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
    apiGet<{ data: Produk[] }>("/produk").then((r) => setProduk(r.data || [])).catch((e) => setError(e.message));
    apiGet<{ data: Lokasi[] }>("/lokasi").then((r) => setLokasi(r.data || [])).catch(() => {});
  }, [router]);

  const lokasiId = () => {
    const s = getSession();
    if (!s) return "";
    return Array.isArray(s.lokasi) && s.lokasi.length > 0
      ? String(s.lokasi[0])
      : String(s.user.id_pengguna_lokasi || "");
  };

  const produkLabel = produk.find((p) => String(p.id_produk) === idProduk);
  const filteredProduk = produk.filter((p) =>
    `${p.id_produk} ${p.nama_produk}`.toUpperCase().includes(pickQ.toUpperCase())
  );

  async function loadBlocks(side: "dari" | "ke", idLokasi: string) {
    const r = await apiGet<{ data: Block[] }>(`/block?id_pengguna_lokasi=${lokasiId()}&id_lokasi=${idLokasi}`).catch(() => null);
    const list = r?.data || [];
    if (side === "dari") {
      setDariBlocks(list);
      setDariBlock("");
      setDariLine("");
      setDariLines([]);
    } else {
      setKeBlocks(list);
      setKeBlock("");
      setKeLine("");
      setKeLines([]);
    }
  }

  async function loadLines(side: "dari" | "ke", idBlock: string) {
    const r = await apiGet<{ data: Line[] }>(`/line?id_pengguna_lokasi=${lokasiId()}&id_block=${idBlock}`).catch(() => null);
    const list = r?.data || [];
    if (side === "dari") {
      setDariLines(list);
      setDariLine("");
    } else {
      setKeLines(list);
      setKeLine("");
    }
  }

  async function loadBB() {
    if (!dariLine || !idProduk || bestBefore === "9999-12-31") return;
    const r = await apiGet<{ data: { bb_list: string[] } }>(
      `/mutasi/bb-line?id_pengguna_lokasi=${lokasiId()}&id_line=${dariLine}&id_produk=${idProduk}`
    ).catch(() => null);
    setBbList(r?.data?.bb_list || []);
  }

  useEffect(() => {
    if (dariLine) loadBB();
    else setBbList([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dariLine, idProduk]);

  const produkNoBatch = idProduk === "10516938" || idProduk === "10516939";

  async function doMutasi(mode: "preview" | "commit") {
    setError("");
    setSuccess("");
    setSaving(true);
    const payload: any = {
      mode,
      id_pengguna_lokasi: lokasiId(),
      catatan,
      id_produk: +idProduk,
      jumlah: +jumlah,
      jenis_mutasi: jenis,
      best_before: produkNoBatch ? "9999-12-31" : bestBefore,
      id_line_sumber: dariLine,
      id_line_tujuan: keLine,
    };
    if (mode === "commit") {
      payload.id_pengguna = session!.user.id_pengguna;
      payload.satuan = satuan || "BOX";
    }
    try {
      const r = await apiPost<{ data: any; message?: string }>("/mutasi/proses", payload);
      if (mode === "preview") {
        setPreview(r.data);
      } else {
        setSuccess(r.message || "Mutasi berhasil disimpan.");
        setPreview(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal proses mutasi");
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
          onClick={() => router.push("/mutasi")}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali ke Riwayat Mutasi
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
        <div className="flex flex-col gap-[7px]">
          <div>
            <label className={labelCls}>Jenis Mutasi</label>
            <select className={inputCls} value={jenis} onChange={(e) => setJenis(e.target.value)}>
              <option value="">Pilih status mutasi</option>
              {Object.entries(JENIS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className={labelCls}>Produk</label>
            <button
              type="button"
              onClick={() => setOpenPick(openPick === "product" ? null : "product")}
              className={`${inputCls} flex items-center justify-between text-left`}
            >
              <span className="truncate">{produkLabel ? `${produkLabel.id_produk} - ${produkLabel.nama_produk}` : "Pilih produk"}</span>
              <i className="bi bi-search shrink-0" />
            </button>
            {openPick === "product" && (
              <div className="absolute left-0 right-0 top-[calc(100%+5px)] z-50 rounded-lg border border-[#e2e7f0] bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                <input
                  placeholder="Cari ID atau nama produk"
                  className="mb-1.5 h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold outline-none focus:border-[#191970]"
                  value={pickQ}
                  onChange={(e) => setPickQ(e.target.value)}
                />
                <div className="flex max-h-[210px] flex-col gap-[3px] overflow-y-auto">
                  {filteredProduk.map((p) => (
                    <button
                      key={p.id_produk}
                      type="button"
                      onClick={() => {
                        setIdProduk(p.id_produk);
                        setSatuan(p.satuan);
                        setOpenPick(null);
                      }}
                      className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[10px] font-extrabold text-[#172033] hover:bg-[#eef0ff] hover:text-[#191970]"
                    >
                      {p.id_produk} - {p.nama_produk}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input type="number" min="1" className={inputCls} placeholder="Jumlah yang mau dipindah" value={jumlah} onChange={(e) => setJumlah(e.target.value)} required />

          {!produkNoBatch && (
            <div className="relative">
              <label className={labelCls}>Best Before</label>
              <button
                type="button"
                onClick={() => setOpenPick(openPick === "bb" ? null : "bb")}
                className={`${inputCls} flex items-center justify-between text-left`}
              >
                <span className="truncate">{bestBefore || "Pilih BB"}</span>
                <i className="bi bi-chevron-down shrink-0" />
              </button>
              {openPick === "bb" && (
                <div className="absolute left-0 right-0 top-[calc(100%+5px)] z-50 rounded-lg border border-[#e2e7f0] bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                  <div className="flex max-h-[210px] flex-col gap-[3px] overflow-y-auto">
                    {bbList.length === 0 && <div className="p-2 text-center text-[10px] font-extrabold text-[#6b7280]">Tidak ada BB tersedia</div>}
                    {bbList.map((bb) => (
                      <button
                        key={bb}
                        type="button"
                        onClick={() => {
                          setBestBefore(bb);
                          setOpenPick(null);
                        }}
                        className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[10px] font-extrabold text-[#172033] hover:bg-[#eef0ff] hover:text-[#191970]"
                      >
                        {bb}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
        <div className="mb-1 text-[12px] font-black text-[#191970]">Dari</div>
        <div className="flex flex-col gap-[7px]">
          <select className={inputCls} value={dariLokasi} onChange={(e) => { setDariLokasi(e.target.value); loadBlocks("dari", e.target.value); }}>
            <option value="">Lokasi</option>
            {lokasi.map((l) => (
              <option key={l.id_lokasi} value={l.id_lokasi}>{(l.kategori || l.nama_lokasi).toUpperCase()}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-[7px]">
            <select className={inputCls} value={dariBlock} onChange={(e) => { setDariBlock(e.target.value); loadLines("dari", e.target.value); }}>
              <option value="">Block</option>
              {dariBlocks.map((b) => (
                <option key={b.id_block} value={b.id_block}>{b.kode_block}</option>
              ))}
            </select>
            <select className={inputCls} value={dariLine} onChange={(e) => setDariLine(e.target.value)}>
              <option value="">Line</option>
              {dariLines.map((l) => (
                <option key={l.id_line} value={l.id_line}>Line {l.nomor_line}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
        <div className="mb-1 text-[12px] font-black text-[#191970]">Ke</div>
        <div className="flex flex-col gap-[7px]">
          <select className={inputCls} value={keLokasi} onChange={(e) => { setKeLokasi(e.target.value); loadBlocks("ke", e.target.value); }}>
            <option value="">Lokasi</option>
            {lokasi.map((l) => (
              <option key={l.id_lokasi} value={l.id_lokasi}>{(l.kategori || l.nama_lokasi).toUpperCase()}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-[7px]">
            <select className={inputCls} value={keBlock} onChange={(e) => { setKeBlock(e.target.value); loadLines("ke", e.target.value); }}>
              <option value="">Block</option>
              {keBlocks.map((b) => (
                <option key={b.id_block} value={b.id_block}>{b.kode_block}</option>
              ))}
            </select>
            <select className={inputCls} value={keLine} onChange={(e) => setKeLine(e.target.value)}>
              <option value="">Line</option>
              {keLines.map((l) => (
                <option key={l.id_line} value={l.id_line}>Line {l.nomor_line}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
        <label className={labelCls}>Catatan</label>
        <textarea
          className="min-h-[68px] w-full resize-y rounded-lg border border-[#e2e7f0] bg-[#fbfcff] p-2.5 text-[11px] font-bold outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]"
          placeholder="Tulis catatan mutasi"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          required
        />
      </div>

      {preview && (
        <div className="rounded-[11px] border border-[#191970] bg-white p-3">
          <div className="mb-1 text-[11px] font-black text-[#191970]">Ringkasan Mutasi</div>
          <div className="space-y-1 text-[11px] font-bold text-[#172033]">
            <div>Dari: {preview.lokasi_sumber || "-"}</div>
            <div>Ke: {preview.lokasi_tujuan || "-"}</div>
            <div>BB: {preview.best_before || "-"}</div>
            <div>Jumlah: {preview.jumlah} {satuan} → {preview.jumlah_tujuan} {preview.satuan_tujuan || satuan || ""}</div>
            {(preview.alokasi_tujuan || []).length > 0 && (
              <div>
                Alokasi:{" "}
                {preview.alokasi_tujuan.map((a: any, i: number) => (
                  <span key={i} className="mr-1 rounded bg-[#eef0ff] px-1.5 py-0.5 text-[10px] font-extrabold text-[#191970]">
                    DEEP-{a.id_deep} ({a.jumlah})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => doMutasi("preview")}
        disabled={saving}
        className="flex min-h-[33px] w-full cursor-pointer items-center justify-center rounded-lg bg-[#eef0ff] text-[11px] font-black text-[#191970] transition hover:bg-[#191970] hover:text-white disabled:opacity-50"
      >
        Preview
      </button>

      <button
        type="button"
        onClick={() => doMutasi("commit")}
        disabled={saving}
        className="flex min-h-[33px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#191970] px-2.5 text-[11px] font-black text-white transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)] disabled:opacity-50"
      >
        {saving ? "Menyimpan..." : "Simpan Mutasi"}
      </button>
    </div>
  );
}
