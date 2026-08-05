"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Produk = { id_produk: string; nama_produk: string; satuan: string };
type Plant = { id_plant: string; nama_plant: string };

type Item = {
  id_produk: string;
  jumlah: string;
  satuan: string;
};

export default function OutboundFormPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);

  const [produk, setProduk] = useState<Produk[]>([]);
  const [plant, setPlant] = useState<Plant[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [tipe, setTipe] = useState("Primary");
  const [tujuan, setTujuan] = useState("");
  const [tanggalKeluar, setTanggalKeluar] = useState(() => new Date().toISOString().slice(0, 10));
  const [tanggalPengiriman, setTanggalPengiriman] = useState(() => new Date().toISOString().slice(0, 10));
  const [noMobil, setNoMobil] = useState("");
  const [namaDriver, setNamaDriver] = useState("");
  const [ginNo, setGinNo] = useState("");
  const [ritase, setRitase] = useState(1);
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<Item[]>([{ id_produk: "", jumlah: "", satuan: "" }]);

  // picker visibility
  const [openPick, setOpenPick] = useState<"product0" | "plant" | null>(null);
  const [pickQ, setPickQ] = useState("");

  const timerRef = useRef<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [startTime] = useState(() => Date.now());

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

  function selectProduk(idx: number, id_produk: string) {
    const p = produk.find((x) => String(x.id_produk) === id_produk);
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, id_produk, satuan: p?.satuan || it.satuan } : it)));
    setOpenPick(null);
  }

  function selectPlant(id_plant: string) {
    const p = plant.find((x) => String(x.id_plant) === id_plant);
    setTujuan(p ? `${p.id_plant} - ${p.nama_plant}` : "");
    setOpenPick(null);
  }

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = {
        id_pengguna_lokasi: session!.user.id_pengguna_lokasi,
        id_pengguna: session!.user.id_pengguna,
        tipe_pengeluaran: tipe,
        tujuan: tipe === "Primary" ? tujuan : "",
        tanggal_keluar: tanggalKeluar,
        tanggal_pengiriman: tanggalPengiriman,
        no_mobil: noMobil,
        nama_driver: namaDriver,
        gin_no: ginNo,
        ritase,
        catatan,
        status: "Pending",
        waktu_mulai_input: new Date(startTime).toISOString().slice(0, 19).replace("T", " "),
        durasi_detik: timer,
        items: items
          .filter((i) => i.id_produk && i.jumlah)
          .map((i) => ({ id_produk: +i.id_produk, jumlah: +i.jumlah, satuan: i.satuan || "PCS" })),
      };
      const res = await apiPost("/barang-keluar", payload);
      const first = res.data?.items?.[0];
      setSubmittedId(first?.id_barang_keluar ?? null);
      setSubmitted(true);
      setSuccess("Outbound berhasil disubmit. Silahkan konfirmasi untuk memotong stok.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal submit");
    }
  }

  async function konfirmasi() {
    if (!submittedId) return;
    setConfirming(true);
    setError("");
    try {
      await apiPost("/barang-keluar/update", {
        id_barang_keluar: submittedId,
        id_pengguna_lokasi: session!.user.id_pengguna_lokasi,
        aksi: "konfirmasi",
        waktu_mulai_input: new Date(startTime).toISOString().slice(0, 19).replace("T", " "),
        durasi_detik: timer,
      });
      setSuccess("Outbound berhasil dikonfirmasi. Stok telah dipotong.");
      router.push("/outbound");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal konfirmasi");
      setConfirming(false);
    }
  }

  const inputCls =
    "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";
  const labelCls = "mb-1 block text-[10px] font-extrabold text-[#172033]";

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between rounded-[11px] border border-[#e9edf5] bg-white px-3 py-2">
        <button
          onClick={() => router.push("/outbound")}
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
      {success && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-extrabold text-[#15803d]">
          <i className="bi bi-check-circle-fill mr-1" />
          {success}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-[7px]">
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="flex flex-col gap-[7px]">
            <div>
              <label className={labelCls}>Tanggal Keluar</label>
              <input type="date" className={inputCls} value={tanggalKeluar} onChange={(e) => setTanggalKeluar(e.target.value)} required />
            </div>

            <div>
              <label className={labelCls}>Tipe Pengeluaran</label>
              <select className={inputCls} value={tipe} onChange={(e) => setTipe(e.target.value)}>
                <option value="Primary">Pengeluaran Primary</option>
                <option value="Secondary">Pengeluaran Secondary</option>
                <option value="Pemusnahan">Pemusnahan</option>
              </select>
            </div>

            {tipe === "Primary" && (
              <div className="relative">
                <label className={labelCls}>Tujuan</label>
                <button
                  type="button"
                  onClick={() => setOpenPick(openPick === "plant" ? null : "plant")}
                  className={`${inputCls} flex items-center justify-between text-left`}
                >
                  <span className="truncate">{tujuan || "Tujuan"}</span>
                  <i className="bi bi-search shrink-0" />
                </button>
                {openPick === "plant" && (
                  <div className="absolute left-0 right-0 top-[calc(100%+5px)] z-50 rounded-lg border border-[#e2e7f0] bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                    <input
                      placeholder="Cari tujuan"
                      className="mb-1.5 h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold outline-none focus:border-[#191970]"
                      value={pickQ}
                      onChange={(e) => setPickQ(e.target.value)}
                    />
                    <div className="flex max-h-[210px] flex-col gap-[3px] overflow-y-auto">
                      {filteredPlant.length === 0 && <div className="p-2 text-center text-[10px] font-extrabold text-[#6b7280]">Tujuan tidak ditemukan</div>}
                      {filteredPlant.map((p) => (
                        <button
                          key={p.id_plant}
                          type="button"
                          onClick={() => selectPlant(p.id_plant)}
                          className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[10px] font-extrabold text-[#172033] hover:bg-[#eef0ff] hover:text-[#191970]"
                        >
                          {p.id_plant} - {p.nama_plant}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={labelCls}>Tanggal Pengiriman</label>
              <input type="date" className={inputCls} value={tanggalPengiriman} onChange={(e) => setTanggalPengiriman(e.target.value)} required />
            </div>
            <input className={inputCls} placeholder="No Mobil" value={noMobil} onChange={(e) => setNoMobil(e.target.value)} required />
            <input className={inputCls} placeholder="Nama Driver" value={namaDriver} onChange={(e) => setNamaDriver(e.target.value)} required />
            <input className={inputCls} placeholder="No GIN" value={ginNo} onChange={(e) => setGinNo(e.target.value)} required />

            <div>
              <label className={labelCls}>Ritase</label>
              <select className={inputCls} value={ritase} onChange={(e) => setRitase(+e.target.value)}>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>{r} Rit</option>
                ))}
              </select>
            </div>

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
                    onClick={() => setOpenPick(openPick === (`product${idx}` as any) ? null : `product${idx}` as any)}
                    className={`${inputCls} flex items-center justify-between text-left`}
                  >
                    <span className="truncate">{produkLabel(it.id_produk)}</span>
                    <i className="bi bi-search shrink-0" />
                  </button>
                  {openPick === (`product${idx}` as any) && (
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
              </div>
            ))}

            <button
              type="button"
              onClick={() => setItems([...items, { id_produk: "", jumlah: "", satuan: "" }])}
              className="mr-auto inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border border-[#191970] bg-white px-2.5 text-[11px] font-extrabold text-[#191970] transition hover:-translate-y-px hover:bg-[#eef0ff] hover:shadow-[0_6px_14px_rgba(25,25,112,0.08)]"
            >
              <i className="bi bi-plus-lg" />
              Tambah Item
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitted}
          className="flex min-h-[33px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#191970] px-2.5 text-[11px] font-black text-white transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)] disabled:bg-[#ddddeb] disabled:text-[#8f91a3]"
        >
          Submit
        </button>

        <div className="flex min-h-[31px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-extrabold text-[#172033]">
          <i className="bi bi-info-circle" />
          Konfirmasi untuk memotong stok
        </div>

        <button
          type="button"
          onClick={konfirmasi}
          disabled={!submitted || !submittedId || confirming}
          className="flex min-h-[33px] w-full cursor-pointer items-center justify-center rounded-lg bg-[#191970] px-2.5 text-[11px] font-black text-white transition hover:-translate-y-px hover:shadow-[0_7px_16px_rgba(25,25,112,0.15)] disabled:bg-[#ddddeb] disabled:text-[#8f91a3]"
        >
          {confirming ? "Mengonfirmasi..." : "Konfirmasi Outbound"}
        </button>
      </form>
    </div>
  );
}
