"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Produk = { id_produk: string; nama_produk: string; satuan: string };
type Plant = { id_plant: string; nama_plant: string };
type Preview = {
  qty_diminta: number;
  qty_teralokasi: number;
  rekomendasi: {
    id_deep: number;
    label_line: string;
    label_lokasi: string;
    alokasi: number;
  }[];
};

type Item = {
  id_produk: string;
  jumlah: string;
  satuan: string;
  best_before: string;
  asal_pabrik: string;
  preview: Preview | null;
  previewMsg: string;
  previewing: boolean;
};

const PRODUK_TANPA_BATCH = ["10516938", "10516939"];
const EMPTY_PREVIEW: Preview = { qty_diminta: 0, qty_teralokasi: 0, rekomendasi: [] };

export default function InboundFormPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);

  const [produk, setProduk] = useState<Produk[]>([]);
  const [plant, setPlant] = useState<Plant[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ nama: string; lokasi: string }[]>([]);
  const [fail, setFail] = useState<{ nama: string; msg: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [tanggalMasuk, setTanggalMasuk] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipe, setTipe] = useState("Primary");
  const [noDn, setNoDn] = useState("");
  const [noMobil, setNoMobil] = useState("");
  const [namaDriver, setNamaDriver] = useState("");
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);

  const [openPick, setOpenPick] = useState<string | null>(null);
  const [pickQ, setPickQ] = useState("");

  const timerRef = useRef<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [startTime] = useState(() => Date.now());

  function newItem(): Item {
    return {
      id_produk: "",
      jumlah: "",
      satuan: "",
      best_before: "",
      asal_pabrik: "",
      preview: null,
      previewMsg: "",
      previewing: false,
    };
  }

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setTimer(Math.round((Date.now() - startTime) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    apiGet<{ data: Produk[] }>("/produk")
      .then((r) => setProduk(r.data || []))
      .catch((e) => setError(e.message));
    apiGet<{ data: Plant[] }>("/plant")
      .then((r) => setPlant(r.data || []))
      .catch(() => {});
  }, [router]);

  if (!session) return null;

  const produkLabel = (id: string) => {
    const p = produk.find((x) => String(x.id_produk) === id);
    return p ? `${p.id_produk} - ${p.nama_produk}` : "Produk";
  };
  const isNoBatch = (id: string) => PRODUK_TANPA_BATCH.includes(id);

  const filteredProduk = produk.filter((p) =>
    `${p.id_produk} ${p.nama_produk}`.toUpperCase().includes(pickQ.toUpperCase())
  );
  const filteredPlant = plant.filter((p) =>
    `${p.id_plant} ${p.nama_plant}`.toUpperCase().includes(pickQ.toUpperCase())
  );

  const fmtDurasi = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  };

  function selectProduk(idx: number, id_produk: string) {
    const p = produk.find((x) => String(x.id_produk) === id_produk);
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              id_produk,
              satuan: p?.satuan || it.satuan,
              asal_pabrik: isNoBatch(id_produk) ? "-" : it.asal_pabrik,
            }
          : it
      )
    );
    setOpenPick(null);
  }

  function selectPlant(idx: number, label: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, asal_pabrik: label } : it)));
    setOpenPick(null);
  }

  async function cekPreview(idx: number) {
    const it = items[idx];
    if (!it.id_produk || !it.jumlah) return;
    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, previewing: true, previewMsg: "" } : x)));
    try {
      const r = await apiPost<{ data: Preview }>("/barang-masuk/preview", {
        id_pengguna_lokasi: session!.user.id_pengguna_lokasi,
        id_produk: +it.id_produk,
        qty: +it.jumlah,
        best_before: isNoBatch(it.id_produk) || tipe === "REJECT" ? "" : it.best_before,
        tipe_penerimaan: tipe,
      });
      setItems((prev) =>
        prev.map((x, i) => (i === idx ? { ...x, preview: r.data, previewing: false } : x))
      );
    } catch (e) {
      setItems((prev) =>
        prev.map((x, i) =>
          i === idx
            ? { ...x, preview: EMPTY_PREVIEW, previewMsg: e instanceof ApiError ? e.message : "Gagal cek lokasi", previewing: false }
            : x
        )
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess([]);
    setFail([]);
    setShowResult(false);
    const validItems = items.filter((i) => i.id_produk && i.jumlah);
    if (validItems.length === 0) {
      setError("Minimal satu item diisi.");
      return;
    }
    setSubmitting(true);
    const ok: typeof success = [];
    const ng: typeof fail = [];
    for (const it of validItems) {
      const p = produk.find((x) => String(x.id_produk) === it.id_produk);
      const nama = p ? p.nama_produk : it.id_produk;
      const payload: any = {
        id_pengguna_lokasi: session!.user.id_pengguna_lokasi,
        id_pengguna: session!.user.id_pengguna,
        id_produk: +it.id_produk,
        jumlah: +it.jumlah,
        satuan: it.satuan || "PCS",
        tanggal_masuk: tanggalMasuk,
        tipe_penerimaan: tipe,
        no_dn: noDn,
        no_mobil: noMobil,
        nama_driver: namaDriver,
        catatan: catatan,
        batch: isNoBatch(it.id_produk) || tipe === "REJECT" ? "" : "",
        waktu_mulai_input: new Date(startTime).toISOString().slice(0, 19).replace("T", " "),
        durasi_detik: timer,
      };
      if (isNoBatch(it.id_produk)) {
        payload.best_before = "9999-12-31";
        payload.asal_pabrik = "-";
      } else if (tipe === "REJECT") {
        payload.best_before = "9999-12-31";
        payload.asal_pabrik = it.asal_pabrik;
      } else {
        payload.best_before = it.best_before;
        payload.asal_pabrik = it.asal_pabrik;
      }
      if (it.preview?.rekomendasi?.length) {
        // kirim alokasi hasil preview agar lokasi konsisten dengan yang ditampilkan
        payload.alokasi = it.preview.rekomendasi.map((r) => ({ id_deep: r.id_deep, jumlah: r.alokasi }));
      }
      try {
        const res = await apiPost("/barang-masuk", payload);
        const lokasi = res?.data?.lokasi_block || it.preview?.rekomendasi?.map((r) => r.label_line).join(", ") || "-";
        ok.push({ nama, lokasi });
      } catch (err) {
        ng.push({ nama, msg: err instanceof ApiError ? err.message : "Gagal simpan" });
      }
    }
    setSubmitting(false);
    setSuccess(ok);
    setFail(ng);
    setShowResult(true);
    if (ng.length === 0) {
      setItems([newItem()]);
      setTanggalMasuk(new Date().toISOString().slice(0, 10));
      setNoDn("");
      setNoMobil("");
      setNamaDriver("");
      setCatatan("");
    }
  }

  const inputCls =
    "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";
  const labelCls = "mb-1 block text-[10px] font-extrabold text-[#172033]";

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between rounded-[11px] border border-[#e9edf5] bg-white px-3 py-2">
        <button
          onClick={() => router.push("/inbound")}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe3f5] bg-[#f0f4ff] px-2.5 text-[11px] font-black tabular-nums text-[#191970]">
          <i className="bi bi-stopwatch" />
          {fmtDurasi(timer)}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[10px] font-extrabold text-[#dc2626]">
          {error}
        </div>
      )}

      {showResult && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-extrabold text-[#15803d]">
          <i className="bi bi-check-circle-fill mr-1" />
          {fail.length === 0 ? "Semua inbound tersimpan." : `${success.length} tersimpan, ${fail.length} gagal.`}
        </div>
      )}

      {showResult && success.length > 0 && (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-1 text-[12px] font-black text-[#191970]">Tersimpan</div>
          {success.map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b border-[#e9edf5] py-1.5 text-[11px] last:border-0">
              <span className="font-extrabold text-[#172033]">{s.nama}</span>
              <span className="text-[10px] font-semibold text-[#6b7280]">→ {s.lokasi}</span>
            </div>
          ))}
        </div>
      )}

      {showResult && fail.length > 0 && (
        <div className="rounded-[11px] border border-[#fecaca] bg-[#fff7f7] p-3">
          <div className="mb-1 text-[12px] font-black text-[#dc2626]">Gagal</div>
          {fail.map((f, i) => (
            <div key={i} className="border-b border-[#fecaca] py-1.5 text-[10px] font-extrabold text-[#dc2626] last:border-0">
              {f.nama}: {f.msg}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-[7px]">
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="flex flex-col gap-[7px]">
            <div>
              <label className={labelCls}>Tanggal Masuk</label>
              <input type="date" className={inputCls} value={tanggalMasuk} onChange={(e) => setTanggalMasuk(e.target.value)} required />
            </div>

            <div>
              <label className={labelCls}>Tipe Penerimaan</label>
              <select className={inputCls} value={tipe} onChange={(e) => setTipe(e.target.value)}>
                <option value="Primary">Penerimaan Primary</option>
                <option value="Primary XWH">Penerimaan Primary XWH</option>
                <option value="Secondary">Penerimaan Secondary</option>
                <option value="REJECT">Penerimaan REJECT</option>
              </select>
            </div>

            <input className={inputCls} placeholder="No DN" value={noDn} onChange={(e) => setNoDn(e.target.value)} disabled={tipe === "Secondary" || tipe === "REJECT"} />
            <input className={inputCls} placeholder="No Mobil" value={noMobil} onChange={(e) => setNoMobil(e.target.value)} required />
            <input className={inputCls} placeholder="Nama Driver" value={namaDriver} onChange={(e) => setNamaDriver(e.target.value)} required />

            <textarea
              className="min-h-[58px] w-full resize-y rounded-lg border border-[#e2e7f0] bg-[#fbfcff] p-2.5 text-[11px] font-bold outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]"
              placeholder="Catatan (opsional)"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-2 text-[12px] font-black text-[#191970]">Item</div>
          <div className="flex flex-col gap-2 rounded-[11px] border border-[#e0e7f7] bg-[#eef3ff] p-2.5">
            {items.map((it, idx) => (
              <div key={idx} className="flex flex-col gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#d7dce6] bg-white text-[12px] text-[#6b7280] transition hover:border-[#ef4444] hover:text-[#ef4444]"
                    title={items.length <= 1 ? "Minimal satu item" : "Hapus item"}
                  >
                    <i className="bi bi-dash-lg" />
                  </button>
                </div>

                <div className="relative">
                  <label className={labelCls}>Produk</label>
                  <button
                    type="button"
                    onClick={() => setOpenPick(openPick === `product${idx}` ? null : `product${idx}`)}
                    className={`${inputCls} flex items-center justify-between text-left`}
                  >
                    <span className="truncate">{produkLabel(it.id_produk)}</span>
                    <i className="bi bi-search shrink-0" />
                  </button>
                  {openPick === `product${idx}` && (
                    <div className="absolute left-0 right-0 top-[calc(100%+5px)] z-50 rounded-lg border border-[#e2e7f0] bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                      <input
                        placeholder="Cari ID atau nama produk"
                        className="mb-1.5 h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold outline-none focus:border-[#191970]"
                        value={pickQ}
                        onChange={(e) => setPickQ(e.target.value)}
                      />
                      <div className="flex max-h-[210px] flex-col gap-[3px] overflow-y-auto">
                        {filteredProduk.length === 0 && <div className="p-2 text-center text-[10px] font-extrabold text-[#6b7280]">Produk tidak ditemukan</div>}
                        {filteredProduk.map((p) => (
                          <button
                            key={p.id_produk}
                            type="button"
                            onClick={() => selectProduk(idx, p.id_produk)}
                            className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[10px] font-extrabold text-[#172033] hover:bg-[#eef0ff] hover:text-[#191970]"
                          >
                            {p.id_produk} - {p.nama_produk}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="Jumlah"
                  value={it.jumlah}
                  onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, jumlah: e.target.value } : x)))}
                  required
                />

                {!isNoBatch(it.id_produk) && (
                  <>
                    <div>
                      <label className={labelCls}>{tipe === "REJECT" ? "Best Before" : "Best Before"}</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={it.best_before}
                        onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, best_before: e.target.value } : x)))}
                      />
                    </div>

                    <div className="relative">
                      <label className={labelCls}>Asal Pabrik</label>
                      <button
                        type="button"
                        onClick={() => setOpenPick(openPick === `plant${idx}` ? null : `plant${idx}`)}
                        className={`${inputCls} flex items-center justify-between text-left`}
                      >
                        <span className="truncate">{it.asal_pabrik || "Asal Pabrik"}</span>
                        <i className="bi bi-search shrink-0" />
                      </button>
                      {openPick === `plant${idx}` && (
                        <div className="absolute left-0 right-0 top-[calc(100%+5px)] z-50 rounded-lg border border-[#e2e7f0] bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                          <input
                            placeholder="Cari asal pabrik"
                            className="mb-1.5 h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold outline-none focus:border-[#191970]"
                            value={pickQ}
                            onChange={(e) => setPickQ(e.target.value)}
                          />
                          <div className="flex max-h-[210px] flex-col gap-[3px] overflow-y-auto">
                            {filteredPlant.length === 0 && <div className="p-2 text-center text-[10px] font-extrabold text-[#6b7280]">Asal pabrik tidak ditemukan</div>}
                            {filteredPlant.map((p) => (
                              <button
                                key={p.id_plant}
                                type="button"
                                onClick={() => selectPlant(idx, `${p.id_plant} - ${p.nama_plant}`)}
                                className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[10px] font-extrabold text-[#172033] hover:bg-[#eef0ff] hover:text-[#191970]"
                              >
                                {p.id_plant} - {p.nama_plant}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => cekPreview(idx)}
                  disabled={it.previewing}
                  className="inline-flex h-[30px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#191970] bg-white px-2.5 text-[11px] font-extrabold text-[#191970] transition hover:-translate-y-px hover:bg-[#eef0ff] disabled:opacity-50"
                >
                  <i className="bi bi-geo-alt" />
                  {it.previewing ? "Mengecek lokasi..." : "Cek Lokasi"}
                </button>

                {it.preview && it.preview.rekomendasi.length > 0 && (
                  <div className="rounded-lg bg-[#f7f9ff] p-2">
                    <div className="text-[10px] font-black text-[#191970]">
                      Lokasi ({it.preview.qty_teralokasi}/{it.preview.qty_diminta})
                    </div>
                    {it.preview.rekomendasi.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] font-bold text-[#172033]">
                        <span>{r.label_lokasi}</span>
                        <span className="font-black text-[#191970]">{r.alokasi}</span>
                      </div>
                    ))}
                  </div>
                )}
                {it.previewMsg && (
                  <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2 py-1.5 text-[10px] font-extrabold text-[#dc2626]">
                    {it.previewMsg}
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setItems([...items, newItem()])}
              className="mr-auto inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border border-[#191970] bg-white px-2.5 text-[11px] font-extrabold text-[#191970] transition hover:-translate-y-px hover:bg-[#eef0ff] hover:shadow-[0_6px_14px_rgba(25,25,112,0.08)]"
            >
              <i className="bi bi-plus-lg" />
              Tambah Item
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[33px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#191970] px-2.5 text-[11px] font-black text-white transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)] disabled:bg-[#ddddeb] disabled:text-[#8f91a3]"
        >
          {submitting ? "Menyimpan..." : "Simpan Semua"}
        </button>
      </form>
    </div>
  );
}