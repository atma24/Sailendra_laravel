"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiPost, apiGet } from "@/lib/api";
import { aktifLokasiId, useSession } from "@/lib/auth";

type Produk = { id_produk: number; nama_produk: string; satuan: string };
type Plant = { id_plant: string; nama_plant: string };
type Rencana = {
  block: string; line: string; level: string; deep: string;
  jumlah_rencana: number; batch: string; best_before: string; label_lokasi?: string;
};

type Item = {
  id_produk: number;
  nama_produk: string;
  satuan: string;
  jumlah: string;
  id_line: number;
  batch: string;
  best_before: string;
};

type LackingItem = { nama_produk: string; diminta: number; tersedia: number; satuan: string };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();

const css = `
.outbound-form-page { display: flex; flex-direction: column; gap: 7px; padding-bottom: 12px; }
.outbound-form-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; padding: 10px 12px; }
.outbound-top-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.outbound-back-btn { min-height: 30px; border-radius: 8px; padding: 0 9px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; }
.outbound-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.22); transform: translateY(-1px); }
.outbound-timer-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; border-radius: 999px; padding: 0 11px; background: #f0f4ff; border: 1px solid #dbe3f5; color: var(--primary); font-size: 11px; font-weight: 900; font-variant-numeric: tabular-nums; white-space: nowrap; }
.outbound-alert { border-radius: 9px; padding: 7px 9px; background: #fff0f0; color: #dc2626; border: 1px solid #fecaca; font-size: 10px; font-weight: 800; }
.outbound-card-title { font-size: 12px; font-weight: 950; color: var(--primary); margin-bottom: 8px; letter-spacing: -0.2px; }
.outbound-stack { display: flex; flex-direction: column; gap: 7px; }
.outbound-label { display: block; font-size: 10px; font-weight: 850; color: var(--text-main); margin-bottom: 4px; }
.outbound-input, .outbound-select, .outbound-textarea { width: 100%; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); font-size: 11px; font-weight: 750; outline: none; box-sizing: border-box; }
.outbound-input, .outbound-select { height: 31px; padding: 0 10px; }
.outbound-textarea { min-height: 58px; padding: 7px 9px; resize: vertical; }
.outbound-input:focus, .outbound-select:focus, .outbound-textarea:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.outbound-input:disabled, .outbound-input[readonly] { background: #f1f3f7; color: #777; }
.outbound-select-wrap { position: relative; }
.outbound-select-icon { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); font-size: 11px; color: var(--text-main); pointer-events: none; }
.outbound-item-card { background: #eef3ff; border: 1px solid #e0e7f7; border-radius: 11px; padding: 10px; display: flex; flex-direction: column; gap: 7px; }
.outbound-item-inner { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; padding: 8px; display: flex; flex-direction: column; gap: 7px; }
.outbound-item-head { display: flex; align-items: center; justify-content: flex-end; }
.outbound-item-remove { width: 24px; height: 24px; border-radius: 999px; border: 1px solid #d7dce6; background: #FFFFFF; color: var(--text-soft); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; }
.outbound-item-remove:hover { border-color: #ef4444; color: #ef4444; }
.outbound-picker-wrap { position: relative; }
.outbound-picker-button { width: 100%; min-height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 800; color: var(--text-main); outline: none; display: flex; align-items: center; justify-content: space-between; gap: 7px; cursor: pointer; }
.outbound-picker-button.disabled { background: #f1f3f7; color: #777; pointer-events: none; }
.outbound-picker-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.outbound-picker-panel { display: none; position: absolute; left: 0; right: 0; top: calc(100% + 5px); z-index: 80; background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 10px; box-shadow: 0 10px 24px rgba(15,23,42,0.12); padding: 7px; }
.outbound-picker-panel.show { display: block; }
.outbound-picker-search { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; outline: none; margin-bottom: 6px; box-sizing: border-box; }
.outbound-option-list { max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.outbound-option { border: 0; outline: 0; width: 100%; text-align: left; background: #FFFFFF; color: var(--text-main); border-radius: 8px; padding: 6px 8px; font-size: 10px; font-weight: 750; display: flex; align-items: flex-start; cursor: pointer; }
.outbound-option:hover, .outbound-option.selected { background: var(--primary-soft); color: var(--primary); }
.outbound-option-label { flex: 1; min-width: 0; color: inherit; font-weight: 800; line-height: 1.3; }
.outbound-empty-result { padding: 7px; color: var(--text-soft); font-size: 10px; font-weight: 800; text-align: center; }
.outbound-add-item-btn { width: fit-content; min-height: 30px; border-radius: 999px; border: 1px solid var(--primary); background: #FFFFFF; color: var(--primary); padding: 0 11px; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.outbound-add-item-btn:hover { background: var(--primary-soft); color: var(--primary); }
.outbound-submit-btn { width: 100%; border: 0; outline: 0; border-radius: 9px; background: var(--primary); color: #FFFFFF; min-height: 33px; padding: 7px 11px; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.outbound-submit-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.outbound-submit-btn:disabled { background: #ddddeb; color: #8f91a3; cursor: not-allowed; }
.outbound-info-box { border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); border-radius: 9px; min-height: 31px; padding: 7px 10px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 7px; }
.outbound-confirm-btn { width: 100%; border: 0; outline: 0; border-radius: 9px; background: #ddddeb; color: #8f91a3; min-height: 33px; padding: 7px 11px; font-size: 11px; font-weight: 900; cursor: not-allowed; }
.outbound-confirm-btn:not(:disabled) { background: var(--primary); color: #FFFFFF; cursor: pointer; }
.outbound-location-btn { width: fit-content; min-height: 31px; border: 0; outline: 0; border-radius: 8px; background: var(--primary); color: #FFFFFF; padding: 0 12px; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.outbound-location-btn:disabled { background: #ddddeb; color: #8f91a3; cursor: not-allowed; }
.outbound-manual-box { display: none; flex-direction: column; gap: 7px; border-top: 1px dashed #d7dce6; padding-top: 7px; }
.outbound-manual-box.show { display: flex; }
.outbound-manual-select { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); font-size: 11px; font-weight: 750; padding: 0 10px; outline: none; box-sizing: border-box; }
.outbound-manual-info { font-size: 10px; font-weight: 800; color: var(--text-soft); line-height: 1.35; }
.outbound-preview-box { border: 1px solid #e2e7f0; background: #f7f9ff; border-radius: 9px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.outbound-preview-title { font-size: 11px; font-weight: 900; color: var(--primary); }
.outbound-preview-row { border-top: 1px dashed #d7dce6; padding-top: 6px; display: flex; flex-direction: column; gap: 2px; }
.outbound-preview-row:first-of-type { border-top: 0; padding-top: 0; }
.outbound-preview-location { font-size: 11px; font-weight: 800; color: var(--text-main); }
.outbound-preview-batch { font-size: 10px; font-weight: 750; color: var(--text-soft); }
.outbound-error-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15,23,42,0.58); display: flex; align-items: center; justify-content: center; padding: 16px; }
.outbound-error-modal { width: min(850px, 95%); background: #f4f7fb; border-radius: 10px; padding: 24px; box-shadow: 0 20px 54px rgba(15,23,42,0.25); max-height: 90vh; overflow-y: auto; }
.outbound-error-title { display: flex; align-items: center; gap: 8px; color: var(--text-main); font-size: 18px; font-weight: 900; letter-spacing: -0.25px; margin-bottom: 14px; }
.outbound-error-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
.outbound-error-item { padding: 14px; border: 1px solid #d7dce6; border-radius: 10px; background: #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.04); }
.outbound-error-product { color: var(--text-main); font-size: 13px; font-weight: 800; text-transform: uppercase; line-height: 1.35; }
.outbound-error-detail { margin-top: 5px; color: #dc2626; font-size: 11px; font-weight: 750; line-height: 1.35; }
.outbound-error-action { margin-top: 16px; display: flex; justify-content: flex-end; }
.outbound-error-close { border: 0; outline: 0; border-radius: 10px; background: var(--primary); color: #FFFFFF; min-height: 34px; padding: 0 17px; font-size: 12px; font-weight: 900; cursor: pointer; }
.sailendra-toast-wrap { position: fixed; top: 18px; right: 18px; z-index: 3000; display: flex; flex-direction: column; gap: 10px; width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.sailendra-toast { pointer-events: auto; background: #FFFFFF; border: 1px solid #e5e7eb; border-left: 5px solid var(--primary); border-radius: 14px; box-shadow: 0 16px 34px rgba(15,23,42,0.16); padding: 12px 13px; display: flex; align-items: flex-start; gap: 10px; }
.sailendra-toast-icon { width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
.sailendra-toast-content { min-width: 0; flex: 1; }
.sailendra-toast-title { font-size: 12px; font-weight: 900; color: var(--text-main); margin-bottom: 2px; }
.sailendra-toast-message { font-size: 11px; font-weight: 700; color: var(--text-soft); line-height: 1.35; }
.sailendra-toast-close { border: 0; background: transparent; color: #9ca3af; font-size: 14px; line-height: 1; padding: 2px; cursor: pointer; }
.sailendra-toast.success { border-left-color: #2E7D32; }
.sailendra-toast.success .sailendra-toast-icon { background: rgba(46,125,50,0.12); color: #2E7D32; }
.sailendra-toast.error { border-left-color: #D32F2F; }
.sailendra-toast.error .sailendra-toast-icon { background: rgba(211,47,47,0.12); color: #D32F2F; }
@media (max-width: 768px) {
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}
`;

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDurasi = (sec: number) => `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`;

export default function OutboundFormPage() {
  const session = useSession();
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [plantList, setPlantList] = useState<Plant[]>([]);
  const [loaded, setLoaded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [tanggalKeluar, setTanggalKeluar] = useState(today);
  const [tanggalPengiriman, setTanggalPengiriman] = useState(today);
  const [tipe, setTipe] = useState("Primary");
  const [tujuan, setTujuan] = useState("");
  const [noMobil, setNoMobil] = useState("");
  const [namaDriver, setNamaDriver] = useState("");
  const [ginNo, setGinNo] = useState("");
  const [ritase, setRitase] = useState(1);
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  const toastSeq = useRef(0);

  const [submittedId, setSubmittedId] = useState<number>(0);
  const [previewItems, setPreviewItems] = useState<{ id_barang_keluar: number; nama_produk: string; rencana_deep: Rencana[] }[]>([]);
  const [lacking, setLacking] = useState<LackingItem[]>([]);

  const startTime = useRef(new Date());
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const [pr, pl] = await Promise.all([
          apiGet<Produk[]>("/produk?limit=100"),
          apiGet<Plant[]>("/plant"),
        ]);
        if (cancelled) return;
        setProdukList((pr.data || []).sort((a, b) => angka(a.id_produk) - angka(b.id_produk)));
        setPlantList((pl.data || []).sort((a, b) => String(a.id_plant).localeCompare(String(b.id_plant))));
        setItems([emptyItem()]);
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    const iv = window.setInterval(() => setTimer(Math.round((Date.now() - startTime.current.getTime()) / 1000)), 1000);
    return () => { cancelled = true; window.clearInterval(iv); };
  }, [session]);

  if (!session || !loaded) return null;

  const idPenggunaLokasi = aktifLokasiId(session);

  const emptyItem = (): Item => ({ id_produk: 0, nama_produk: "", satuan: "", jumlah: "", id_line: 0, batch: "", best_before: "" });

  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (idx: number) => setItems((arr) => arr.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const pickProduk = (idx: number, p: Produk) =>
    updateItem(idx, { id_produk: p.id_produk, nama_produk: `${p.id_produk} - ${p.nama_produk}`, satuan: (p.satuan || "").toUpperCase() });

  const notify = (type: string, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, type, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : 6000);
  };
  const closeToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const simpan = async () => {
    if (!items.length || !items.some((it) => it.id_produk > 0)) { notify("error", "Belum ada item yang diisi."); return; }
    if (norm(noMobil) === "") { notify("error", "No Mobil wajib diisi."); return; }
    if (norm(namaDriver) === "") { notify("error", "Nama Driver wajib diisi."); return; }
    if (norm(ginNo) === "") { notify("error", "No GIN wajib diisi."); return; }
    if (tipe === "Primary" && norm(tujuan) === "") { notify("error", "Tujuan wajib diisi untuk Primary."); return; }
    const payloadItems = items
      .filter((it) => it.id_produk > 0 && angka(it.jumlah) > 0)
      .map((it) => {
        const p: Record<string, unknown> = { id_produk: it.id_produk, jumlah: angka(it.jumlah), satuan: it.satuan || "PCS" };
        if (it.id_line > 0 && it.batch !== "") {
          p.id_line = it.id_line;
          p.batch = it.batch;
          if (it.best_before !== "") p.best_before = it.best_before;
        }
        return p;
      });
    if (!payloadItems.length) { notify("error", "Item belum lengkap."); return; }

    setBusy(true);
    setLacking([]);
    setPreviewItems([]);
    setSubmittedId(0);
    try {
      const r = await apiPost<{ items: { id_barang_keluar: number; id_produk: number; jumlah: number; rencana_deep: Rencana[] }[] }>("/barang-keluar", {
        id_pengguna: session.user.id_pengguna,
        id_pengguna_lokasi: idPenggunaLokasi,
        tipe_pengeluaran: tipe,
        tujuan: tipe === "Primary" ? tujuan : "",
        no_mobil: noMobil,
        nama_driver: namaDriver,
        gin_no: ginNo,
        catatan: catatan,
        tanggal_keluar: tanggalKeluar,
        tanggal_pengiriman: tanggalPengiriman,
        ritase,
        status: "Pending",
        items: payloadItems,
        waktu_mulai_input: `${startTime.current.getFullYear()}-${pad2(startTime.current.getMonth() + 1)}-${pad2(startTime.current.getDate())} ${pad2(startTime.current.getHours())}:${pad2(startTime.current.getMinutes())}:${pad2(startTime.current.getSeconds())}`,
        durasi_detik: timer,
      });
      const list = r.data?.items || [];
      setSubmittedId(angka(list[0]?.id_barang_keluar));
      setPreviewItems(list.map((li) => ({ id_barang_keluar: li.id_barang_keluar, nama_produk: `Produk ${li.id_produk}`, rencana_deep: li.rencana_deep || [] })));
      notify("success", "Outbound berhasil disubmit. Silakan konfirmasi untuk memotong stok.");
    } catch (e) {
      const m = (e as Error).message || "Gagal menyimpan outbound.";
      notify("error", m);
      if (m.toLowerCase().includes("tidak mencukupi") || m.toLowerCase().includes("tersedia")) {
        setLacking([{ nama_produk: "Produk", diminta: 0, tersedia: 0, satuan: "" }]);
      }
    } finally { setBusy(false); }
  };

  const konfirmasi = async () => {
    if (submittedId <= 0) return;
    setBusy(true);
    try {
      await apiPost("/barang-keluar/update", {
        id_barang_keluar: submittedId,
        id_pengguna_lokasi: idPenggunaLokasi,
        aksi: "konfirmasi",
        status: "Selesai",
        waktu_mulai_input: `${startTime.current.getFullYear()}-${pad2(startTime.current.getMonth() + 1)}-${pad2(startTime.current.getDate())} ${pad2(startTime.current.getHours())}:${pad2(startTime.current.getMinutes())}:${pad2(startTime.current.getSeconds())}`,
        durasi_detik: timer,
      });
      notify("success", "Konfirmasi outbound berhasil. Stok telah dipotong.");
      window.location.href = "/outbound";
    } catch (e) {
      notify("error", (e as Error).message || "Gagal konfirmasi outbound.");
    } finally { setBusy(false); }
  };

  return (
    <div className="outbound-form-page">
      <style>{css}</style>
      <div className="sailendra-toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`sailendra-toast ${t.type === "success" ? "success" : "error"}`}>
            <div className="sailendra-toast-icon">
              <i className={`bi ${t.type === "success" ? "bi-check-lg" : "bi-exclamation-lg"}`}></i>
            </div>
            <div className="sailendra-toast-content">
              <div className="sailendra-toast-title">{t.type === "success" ? "Berhasil" : "Gagal"}</div>
              <div className="sailendra-toast-message">{t.msg}</div>
            </div>
            <button type="button" className="sailendra-toast-close" onClick={() => closeToast(t.id)}><i className="bi bi-x-lg"></i></button>
          </div>
        ))}
      </div>

      <div className="outbound-form-card outbound-top-card">
        <Link className="outbound-back-btn" href="/outbound">
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>
        <span className="outbound-timer-badge">
          <i className="bi bi-stopwatch"></i>
          {fmtDurasi(timer)}
        </span>
      </div>

      <div className="outbound-form-card">
        <div className="outbound-stack">
          <div>
            <label className="outbound-label">Tanggal Keluar</label>
            <input type="date" className="outbound-input" value={tanggalKeluar} onChange={(e) => setTanggalKeluar(e.target.value)} />
          </div>
          <div>
            <label className="outbound-label">Tipe Pengeluaran</label>
            <div className="outbound-select-wrap">
              <select className="outbound-select" value={tipe} onChange={(e) => { setTipe(e.target.value); if (e.target.value !== "Primary") setTujuan(""); }}>
                <option value="Primary">Pengeluaran Primary</option>
                <option value="Secondary">Pengeluaran Secondary</option>
                <option value="Pemusnahan">Pemusnahan</option>
              </select>
              <i className="bi bi-chevron-down outbound-select-icon"></i>
            </div>
          </div>
          <PlantPicker plantList={plantList} value={tujuan} disabled={tipe !== "Primary"}
            onChange={setTujuan} />
          <div>
            <label className="outbound-label">Tanggal Pengiriman</label>
            <input type="date" className="outbound-input" value={tanggalPengiriman} onChange={(e) => setTanggalPengiriman(e.target.value)} />
          </div>
          <input type="text" className="outbound-input" value={noMobil} onChange={(e) => setNoMobil(e.target.value)} placeholder="No Mobil" />
          <input type="text" className="outbound-input" value={namaDriver} onChange={(e) => setNamaDriver(e.target.value)} placeholder="Nama Driver" />
          <input type="text" className="outbound-input" value={ginNo} onChange={(e) => setGinNo(e.target.value)} placeholder="No GIN" />
          <div>
            <label className="outbound-label">Ritase</label>
            <div className="outbound-select-wrap">
              <select className="outbound-select" value={ritase} onChange={(e) => setRitase(angka(e.target.value))}>
                {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r} Rit</option>)}
              </select>
              <i className="bi bi-chevron-down outbound-select-icon"></i>
            </div>
          </div>
          <textarea className="outbound-textarea" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" />
        </div>
      </div>

      <div className="outbound-form-card">
        <div className="outbound-card-title">Item</div>
        <div className="outbound-item-card">
          {items.map((it, idx) => (
            <div className="outbound-item-inner" key={idx}>
              <div className="outbound-item-head">
                <button type="button" className="outbound-item-remove" title="Hapus item"
                  style={{ opacity: items.length <= 1 ? 0.55 : 1 }} onClick={() => removeItem(idx)}>
                  <i className="bi bi-dash-lg"></i>
                </button>
              </div>

              <ProdukPicker produkList={produkList} value={it.nama_produk}
                onChange={(p) => pickProduk(idx, p)} />

              <input type="number" min={1} className="outbound-input" placeholder="Jumlah" value={it.jumlah}
                onChange={(e) => updateItem(idx, { jumlah: e.target.value })} />

              {submittedId <= 0 && <ManualPicker item={it} onPick={(idLine, batch, bestBefore) =>
                updateItem(idx, { id_line: idLine, batch, best_before: bestBefore })} />}

              {previewItems.length > 0 && previewItems[idx]?.rencana_deep?.length > 0 && (
                <div className="outbound-preview-box">
                  <div className="outbound-preview-title">Lokasi yang akan diambil:</div>
                  {previewItems[idx].rencana_deep.map((r, ri) => (
                    <div className="outbound-preview-row" key={ri}>
                      <div className="outbound-preview-location">
                        Block {r.block || "-"} - Line {r.line || "-"} - L{r.level || "-"} - Deep {r.deep || "-"} = {angka(r.jumlah_rencana)}
                      </div>
                      <div className="outbound-preview-batch">
                        Batch: {norm(r.batch) || "-"} | BB: {norm(r.best_before) || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button type="button" className="outbound-add-item-btn" onClick={addItem}>
            <i className="bi bi-plus-lg"></i>
            <span>Tambah Item</span>
          </button>
        </div>
      </div>

      {submittedId <= 0 && (
        <button type="button" className="outbound-submit-btn" disabled={busy} onClick={simpan}>
          <i className="bi bi-send-fill"></i>
          <span>{busy ? "Menyimpan..." : "Submit"}</span>
        </button>
      )}

      <div className="outbound-info-box">
        <i className="bi bi-info-circle"></i>
        <span>Konfirmasi untuk memotong stok</span>
      </div>

      {submittedId > 0 && (
        <button type="button" className="outbound-confirm-btn" disabled={busy} onClick={konfirmasi}>
          <i className="bi bi-check-circle-fill"></i>
          <span>{busy ? "Memproses..." : "Konfirmasi Outbound"}</span>
        </button>
      )}

      {lacking.length > 0 && (
        <div className="outbound-error-overlay">
          <div className="outbound-error-modal">
            <div className="outbound-error-title">
              <i className="bi bi-info-circle-fill"></i>
              <span>Stok Tidak Mencukupi</span>
            </div>
            <div className="outbound-error-list">
              <div className="outbound-error-item">
                <div className="outbound-error-product">Stok tidak mencukupi</div>
                <div className="outbound-error-detail">
                  <span>Silakan periksa kembali jumlah atau pilih lokasi manual.</span>
                </div>
              </div>
            </div>
            <div className="outbound-error-action">
              <button type="button" className="outbound-error-close" onClick={() => setLacking([])}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProdukPicker({ produkList, value, onChange }: {
  produkList: Produk[]; value: string; onChange: (p: Produk) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = produkList.filter((p) => {
    const label = `${p.id_produk} - ${p.nama_produk}`.toUpperCase();
    return q.trim() === "" || label.includes(q.trim().toUpperCase());
  });
  return (
    <div className="outbound-picker-wrap">
      <button type="button" className="outbound-picker-button" onClick={() => setOpen((o) => !o)}>
        <span className="outbound-picker-text">{norm(value) || "Produk"}</span>
        <i className="bi bi-search"></i>
      </button>
      {open && (
        <div className="outbound-picker-panel show">
          <input type="text" className="outbound-picker-search" placeholder="Cari ID atau nama produk" value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="outbound-option-list">
            {filtered.map((p) => (
              <button key={p.id_produk} type="button" className="outbound-option"
                onClick={() => { onChange(p); setOpen(false); setQ(""); }}>
                <span className="outbound-option-label">{p.id_produk} - {p.nama_produk}</span>
              </button>
            ))}
            {!filtered.length && <div className="outbound-empty-result">Produk tidak ditemukan</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function PlantPicker({ plantList, value, onChange, disabled }: {
  plantList: Plant[]; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = plantList.filter((p) => {
    const label = `${p.id_plant} - ${p.nama_plant}`.toUpperCase();
    return q.trim() === "" || label.includes(q.trim().toUpperCase());
  });
  return (
    <div className="outbound-picker-wrap">
      <button type="button" className={`outbound-picker-button ${disabled ? "disabled" : ""}`} onClick={() => !disabled && setOpen((o) => !o)}>
        <span className="outbound-picker-text">{norm(value) || "Tujuan"}</span>
        <i className="bi bi-search"></i>
      </button>
      {open && !disabled && (
        <div className="outbound-picker-panel show">
          <input type="text" className="outbound-picker-search" placeholder="Cari tujuan" value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="outbound-option-list">
            {filtered.map((p) => (
              <button key={p.id_plant} type="button" className="outbound-option"
                onClick={() => { onChange(`${p.id_plant} - ${p.nama_plant}`); setOpen(false); setQ(""); }}>
                <span className="outbound-option-label">{p.id_plant} - {p.nama_plant}</span>
              </button>
            ))}
            {!filtered.length && <div className="outbound-empty-result">Tujuan tidak ditemukan</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualPicker({ item, onPick }: {
  item: Item; onPick: (idLine: number, batch: string, bestBefore: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loks, setLoks] = useState<{ id_lokasi: number; nama_lokasi: string }[]>([]);
  const [blocks, setBlocks] = useState<{ id_block: number; kode_block: string }[]>([]);
  const [lines, setLines] = useState<{ id_line: number; nomor_line: string }[]>([]);
  const [batches, setBatches] = useState<{ batch: string; best_before: string }[]>([]);

  const stokUrl = (mode: string, extra: Record<string, unknown>) => {
    const p = new URLSearchParams();
    p.set("mode", mode);
    p.set("id_produk", String(item.id_produk || 0));
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    return `/stok?${p.toString()}`;
  };

  const loadLokasi = async () => {
    if (item.id_produk <= 0) { alert("Pilih produk terlebih dahulu."); return; }
    setOpen(true);
    try {
      const r = await apiGet<{ data?: { id_lokasi: number; nama_lokasi: string }[] }>(stokUrl("manual_lokasi", {}));
      setLoks(r.data?.data || []);
    } catch { /* ignore */ }
  };

  const pickBlock = async (idLokasi: number) => {
    const r = await apiGet<{ data?: { id_block: number; kode_block: string }[] }>(stokUrl("manual_block", { id_lokasi: idLokasi }));
    setBlocks(r.data?.data || []);
    setLines([]); setBatches([]);
  };

  const pickLine = async (idBlock: number) => {
    const r = await apiGet<{ data?: { id_line: number; nomor_line: string }[] }>(stokUrl("manual_line", { id_block: idBlock }));
    setLines(r.data?.data || []);
    setBatches([]);
  };

  const pickBatch = async (idLine: number) => {
    const r = await apiGet<{ data?: { batch: string; best_before: string }[] }>(stokUrl("manual_batch", { id_line: idLine }));
    setBatches(r.data?.data || []);
  };

  return (
    <div>
      <button type="button" className="outbound-location-btn" disabled={item.id_produk <= 0} onClick={loadLokasi}>
        <i className="bi bi-geo-alt"></i>
        Pilih Lokasi
      </button>

      {open && (
        <div className="outbound-manual-box show">
          <button type="button" className="outbound-location-btn" onClick={() => {
            setOpen(false); setLoks([]); setBlocks([]); setLines([]); setBatches([]); onPick(0, "", "");
          }}>
            Batalkan Lokasi
          </button>

          <select className="outbound-manual-select" value="" onChange={(e) => pickBlock(angka(e.target.value))}>
            <option value="">Pilih Lokasi</option>
            {loks.map((l) => <option key={l.id_lokasi} value={l.id_lokasi}>{l.nama_lokasi}</option>)}
          </select>
          <select className="outbound-manual-select" disabled={!blocks.length} value="" onChange={(e) => pickLine(angka(e.target.value))}>
            <option value="">Pilih Block</option>
            {blocks.map((b) => <option key={b.id_block} value={b.id_block}>Block {b.kode_block}</option>)}
          </select>
          <select className="outbound-manual-select" disabled={!lines.length} value={item.id_line} onChange={(e) => {
            const idLine = angka(e.target.value);
            onPick(idLine, "", "");
            pickBatch(idLine);
          }}>
            <option value="">Pilih Line</option>
            {lines.map((l) => <option key={l.id_line} value={l.id_line}>Line {l.nomor_line}</option>)}
          </select>
          <select className="outbound-manual-select" disabled={!batches.length} value={item.batch} onChange={(e) => {
            const sel = batches.find((b) => b.batch === e.target.value);
            onPick(item.id_line, e.target.value, sel?.best_before || "");
          }}>
            <option value="">Pilih Batch</option>
            {batches.map((b) => <option key={b.batch} value={b.batch}>{b.batch} | BB {b.best_before || "-"}</option>)}
          </select>

          <div className="outbound-manual-info">Jika lokasi tidak dipilih, sistem akan menggunakan FEFO otomatis.</div>
        </div>
      )}
    </div>
  );
}