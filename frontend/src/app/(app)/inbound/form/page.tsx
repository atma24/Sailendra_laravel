"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiPost, apiGet } from "@/lib/api";
import { isMultiRole, useSession } from "@/lib/auth";

type Produk = { id_produk: number; nama_produk: string; satuan: string };
type Plant = { id_plant: string; nama_plant: string };
type PreviewRec = { id_deep: number; alokasi: number; label_lokasi: string; kode_block: string; nomor_line: number; label_line: string };

type Item = {
  id_produk: number;
  nama_produk: string;
  satuan: string;
  jumlah: string;
  best_before: string;
  asal_pabrik: string;
  lokasi_line: string;
  alokasi: { id_deep: number; jumlah: number }[];
  block_preview: string;
  no_batch: boolean;
};

type ResultItem = { nama_produk: string; message: string; lokasi?: string; slot?: string };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const PRODUK_TANPA_BATCH = [10516938, 10516939];

const css = `
.inbound-form-page { display: flex; flex-direction: column; gap: 7px; padding-bottom: 12px; }
.inbound-form-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; padding: 10px 12px; }
.inbound-top-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.inbound-back-btn { min-height: 30px; border-radius: 8px; padding: 0 9px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; }
.inbound-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.22); transform: translateY(-1px); }
.inbound-timer-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; border-radius: 999px; padding: 0 11px; background: #f0f4ff; border: 1px solid #dbe3f5; color: var(--primary); font-size: 11px; font-weight: 900; font-variant-numeric: tabular-nums; white-space: nowrap; }
.inbound-alert { border-radius: 9px; padding: 7px 9px; background: #fff0f0; color: #dc2626; border: 1px solid #fecaca; font-size: 10px; font-weight: 800; }
.inbound-card-title { font-size: 12px; font-weight: 950; color: var(--primary); margin-bottom: 8px; letter-spacing: -0.2px; }
.inbound-stack { display: flex; flex-direction: column; gap: 7px; }
.inbound-label { display: block; font-size: 10px; font-weight: 850; color: var(--text-main); margin-bottom: 4px; }
.inbound-input, .inbound-select, .inbound-textarea { width: 100%; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); font-size: 11px; font-weight: 750; outline: none; box-sizing: border-box; }
.inbound-input, .inbound-select { height: 31px; padding: 0 10px; }
.inbound-textarea { min-height: 58px; padding: 7px 9px; resize: vertical; }
.inbound-input:focus, .inbound-select:focus, .inbound-textarea:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.inbound-input:disabled, .inbound-input[readonly] { background: #f1f3f7; color: #777; }
.inbound-select-wrap { position: relative; }
.inbound-select-icon { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); font-size: 11px; color: var(--text-main); pointer-events: none; }
.inbound-item-card { background: #f7f5fb; border: 1px solid #ece9f4; border-radius: 11px; padding: 10px; display: flex; flex-direction: column; gap: 7px; }
.inbound-item-head { display: flex; align-items: center; justify-content: flex-end; }
.inbound-item-remove { width: 28px; height: 28px; border-radius: 8px; border: 0; background: #fff0f0; color: #ef4444; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer; }
.inbound-item-remove:hover { background: #ef4444; color: #FFFFFF; }
.inbound-picker-wrap { position: relative; }
.inbound-picker-button { width: 100%; min-height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 800; color: var(--text-main); outline: none; display: flex; align-items: center; justify-content: space-between; gap: 7px; cursor: pointer; }
.inbound-picker-button.disabled { background: #f1f3f7; color: #777; pointer-events: none; }
.inbound-picker-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.inbound-picker-panel { display: none; position: absolute; left: 0; right: 0; top: calc(100% + 5px); z-index: 80; background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 10px; box-shadow: 0 10px 24px rgba(15,23,42,0.12); padding: 7px; }
.inbound-picker-panel.show { display: block; }
.inbound-picker-search { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; outline: none; margin-bottom: 6px; box-sizing: border-box; }
.inbound-option-list { max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.inbound-option { border: 0; outline: 0; width: 100%; text-align: left; background: #FFFFFF; color: var(--text-main); border-radius: 8px; padding: 6px 8px; font-size: 10px; font-weight: 750; display: flex; align-items: flex-start; cursor: pointer; }
.inbound-option:hover, .inbound-option.selected { background: var(--primary-soft); color: var(--primary); }
.inbound-option-label { flex: 1; min-width: 0; color: inherit; font-weight: 800; line-height: 1.3; }
.inbound-empty-result { padding: 7px; color: var(--text-soft); font-size: 10px; font-weight: 800; text-align: center; }
.d-none { display: none !important; }
.inbound-add-item-btn { width: fit-content; min-height: 30px; border-radius: 999px; border: 1px solid #d7dce6; background: #FFFFFF; color: var(--primary); padding: 0 11px; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.inbound-add-item-btn:hover { border-color: var(--primary); background: var(--primary-soft); }
.inbound-submit-btn { width: 100%; border: 0; outline: 0; border-radius: 9px; background: var(--primary); color: #FFFFFF; min-height: 33px; padding: 7px 11px; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.inbound-submit-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-submit-btn:disabled { opacity: 0.7; pointer-events: none; }
.inbound-success-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15,23,42,0.58); display: flex; align-items: center; justify-content: center; padding: 16px; }
.inbound-success-modal { width: min(850px, 95%); background: #f4f7fb; border-radius: 10px; padding: 24px; box-shadow: 0 20px 54px rgba(15,23,42,0.25); max-height: 90vh; overflow-y: auto; }
.inbound-success-title { display: flex; align-items: center; gap: 8px; color: var(--text-main); font-size: 18px; font-weight: 900; letter-spacing: -0.25px; margin-bottom: 14px; }
.inbound-success-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
.inbound-success-item { padding: 14px; border: 1px solid #d7dce6; border-radius: 10px; background: #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.04); }
.inbound-success-product { color: var(--text-main); font-size: 13px; font-weight: 800; text-transform: uppercase; line-height: 1.35; }
.inbound-success-location { margin-top: 5px; color: #475569; font-size: 12px; font-weight: 500; display: flex; align-items: flex-start; gap: 5px; line-height: 1.35; }
.inbound-success-chip-wrap { margin-top: 7px; display: flex; flex-wrap: wrap; gap: 6px; }
.inbound-success-slot { display: inline-flex; align-items: center; min-height: 27px; border: 1px solid #e2e7f0; border-radius: 6px; padding: 0 10px; color: var(--text-main); font-size: 12px; font-weight: 500; background: #FFFFFF; }
.inbound-failed-message { margin-top: 5px; color: #dc2626; font-size: 11px; font-weight: 750; line-height: 1.35; }
.inbound-success-action { margin-top: 16px; display: flex; justify-content: flex-end; }
.inbound-success-close { border: 0; outline: 0; border-radius: 10px; background: var(--primary); color: #FFFFFF; min-height: 34px; padding: 0 17px; font-size: 12px; font-weight: 900; cursor: pointer; }
.inbound-loading-overlay { position: fixed; inset: 0; z-index: 99999; background: rgba(255,255,255,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.inbound-spinner { width: 45px; height: 45px; border: 4px solid #e2e7f0; border-top: 4px solid var(--primary, #191970); border-radius: 50%; animation: ibSpin 1s linear infinite; margin-bottom: 14px; }
@keyframes ibSpin { to { transform: rotate(360deg); } }
.inbound-loading-text { color: var(--primary, #191970); font-size: 14px; font-weight: 800; }
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

export default function InboundFormPage() {
  const session = useSession();
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [plantList, setPlantList] = useState<Plant[]>([]);
  const [loaded, setLoaded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [tipe, setTipe] = useState("Primary");
  const [noDn, setNoDn] = useState("");
  const [noMobil, setNoMobil] = useState("");
  const [namaDriver, setNamaDriver] = useState("");
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ success: ResultItem[]; failed: ResultItem[] } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  const toastSeq = useRef(0);

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

  const idPenggunaLokasi = isMultiRole(session.user.role)
    ? String(session.lokasi[0] ?? "")
    : String(session.user.id_pengguna_lokasi || "");

  const isReject = tipe === "REJECT";
  const isNoBatchGlobal = (id: number) => PRODUK_TANPA_BATCH.includes(id);

  const emptyItem = (): Item => ({
    id_produk: 0, nama_produk: "", satuan: "", jumlah: "", best_before: "",
    asal_pabrik: "", lokasi_line: "", alokasi: [], block_preview: "", no_batch: false,
  });

  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (idx: number) => setItems((arr) => arr.filter((_, i) => i !== idx));

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const pickProduk = (idx: number, p: Produk) => {
    const noBatch = isNoBatchGlobal(p.id_produk) ||
      /JUG (AQUA|VIT) 19L PC 55 MM/i.test(p.nama_produk || "");
    updateItem(idx, {
      id_produk: p.id_produk,
      nama_produk: `${p.id_produk} - ${p.nama_produk}`,
      satuan: (p.satuan || "").toUpperCase(),
      no_batch: noBatch,
      best_before: noBatch ? "-" : "",
      asal_pabrik: noBatch ? "-" : "",
    });
  };

  const autoBlock = async (idx: number) => {
    const it = items[idx];
    if (!it || it.id_produk <= 0 || angka(it.jumlah) <= 0) return;
    const item = it;
    try {
      const r = await apiPost<{ rekomendasi?: PreviewRec[]; lokasi_line?: string; message?: string }>(
        "/barang-masuk/preview",
        {
          id_pengguna_lokasi: idPenggunaLokasi,
          id_produk: item.id_produk,
          qty: angka(item.jumlah),
          best_before: item.best_before && item.best_before !== "-" ? item.best_before : "9999-12-31",
          tipe_penerimaan: tipe,
        }
      );
      const recs = r.data?.rekomendasi || [];
      const alokasi = recs
        .filter((x) => angka(x.id_deep) > 0 && angka(x.alokasi) > 0)
        .map((x) => ({ id_deep: x.id_deep, jumlah: angka(x.alokasi) }));
      const lokasiLine = r.data?.lokasi_line || (recs.length ? `${recs[0].kode_block}-${recs[0].nomor_line}` : "");
      updateItem(idx, { alokasi, lokasi_line: lokasiLine, block_preview: lokasiLine || "-" });
    } catch {
      updateItem(idx, { alokasi: [], lokasi_line: "", block_preview: "-" });
    }
  };

  const batchPreview = (it: Item) => {
    if (it.no_batch) return "-";
    if (isReject) return "999999" + (it.asal_pabrik.split(" - ")[0] || "");
    const bb = norm(it.best_before).replace(/-/g, "").slice(2);
    const kodePlant = it.asal_pabrik.split(" - ")[0] || "";
    return bb && kodePlant ? bb + kodePlant : "";
  };

  const simpan = async () => {
    if (!items.length) { setResults({ success: [], failed: [{ nama_produk: "Produk", message: "Belum ada item yang diisi." }] }); return; }
    if (tipe !== "Secondary" && tipe !== "REJECT" && norm(noDn) === "") { notify("error", "No DN wajib diisi untuk Penerimaan Primary / Primary XWH."); return; }
    if (norm(noMobil) === "") { notify("error", "No Mobil wajib diisi."); return; }
    if (norm(namaDriver) === "") { notify("error", "Nama Driver wajib diisi."); return; }

    setBusy(true);
    const success: ResultItem[] = [];
    const failed: ResultItem[] = [];
    const waktuMulai = `${startTime.current.getFullYear()}-${pad2(startTime.current.getMonth() + 1)}-${pad2(startTime.current.getDate())} ${pad2(startTime.current.getHours())}:${pad2(startTime.current.getMinutes())}:${pad2(startTime.current.getSeconds())}`;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const no = i + 1;
      if (it.id_produk <= 0) { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Produk pada item ke-${no} belum dipilih.` }); continue; }
      if (angka(it.jumlah) <= 0) { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Jumlah pada item ke-${no} belum benar.` }); continue; }
      if (!it.no_batch && norm(it.best_before) === "") { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Best before pada item ke-${no} belum diisi.` }); continue; }
      if (!it.no_batch && norm(it.asal_pabrik) === "") { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Asal pabrik pada item ke-${no} belum dipilih.` }); continue; }

      const bb = it.no_batch ? "9999-12-31" : (isReject ? "9999-12-31" : norm(it.best_before));
      const asal = it.no_batch ? "-" : (isReject ? (norm(it.asal_pabrik) || "-") : norm(it.asal_pabrik));
      const batch = batchPreview(it);

      try {
        if (!it.alokasi.length) await autoBlock(i);
        const refreshed = items[i];
        if (!refreshed.alokasi.length) {
          failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: "Line produk tidak tersedia. Silakan buat layout baru atau tunggu line kembali." });
          continue;
        }
        const r = await apiPost<{ lokasi_akhir?: { line: string; qty: number }[]; lokasi_akhir_str?: string }>("/barang-masuk", {
          id_pengguna: session.user.id_pengguna,
          id_pengguna_lokasi: idPenggunaLokasi,
          id_produk: it.id_produk,
          jumlah: angka(it.jumlah),
          satuan: it.satuan || "BOX",
          tanggal_masuk: tanggal,
          tipe_penerimaan: tipe,
          best_before: bb,
          batch,
          asal_pabrik: asal,
          no_dn: (tipe === "Secondary" || tipe === "REJECT") ? "" : noDn,
          no_mobil: noMobil,
          nama_driver: namaDriver || "Tanpa nama driver",
          catatan: catatan,
          lokasi_line: refreshed.lokasi_line,
          alokasi: refreshed.alokasi,
          waktu_mulai_input: waktuMulai,
          durasi_detik: timer,
        });
        const lokasi = r.data?.lokasi_akhir_str || r.data?.lokasi_akhir?.map((l) => l.line).join(", ") || "-";
        success.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: "OK", lokasi, slot: lokasi });
      } catch (e) {
        let m = (e as Error).message || `Gagal menyimpan item ke-${no}.`;
        const low = m.toLowerCase();
        if (low.includes("kirim: alokasi") || low.includes("lokasi_line") || low.includes("lokasi_block")) {
          m = "Line produk tidak tersedia. Silakan buat layout baru atau tunggu line kembali.";
        }
        if (low.includes("kapasitas line tidak cukup") || low.includes("kapasitas slot") || low.includes("alokasi deep kosong")) {
          m = "Kapasitas line tidak cukup. Silakan buat layout baru atau tunggu line kembali.";
        }
        failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: m });
      }
    }
    setBusy(false);
    setResults({ success, failed });
  };

  const notify = (type: string, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, type, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : 6000);
  };
  const closeToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className="inbound-form-page">
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

      <div className="inbound-form-card inbound-top-card">
        <Link className="inbound-back-btn" href="/inbound">
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>
        <span className="inbound-timer-badge">
          <i className="bi bi-stopwatch"></i>
          {fmtDurasi(timer)}
        </span>
      </div>

      <div className="inbound-form-card">
        <div className="inbound-stack">
          <div>
            <label className="inbound-label">Tanggal Masuk</label>
            <input type="date" className="inbound-input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div>
            <label className="inbound-label">Tipe Penerimaan</label>
            <div className="inbound-select-wrap">
              <select className="inbound-select" value={tipe} onChange={(e) => { setTipe(e.target.value); if (e.target.value === "Secondary" || e.target.value === "REJECT") setNoDn(""); }}>
                <option value="Primary">Penerimaan Primary</option>
                <option value="Primary XWH">Penerimaan Primary XWH</option>
                <option value="Secondary">Penerimaan Secondary</option>
                <option value="REJECT">Penerimaan REJECT</option>
              </select>
              <i className="bi bi-chevron-down inbound-select-icon"></i>
            </div>
          </div>
          <input type="text" className="inbound-input" value={noDn} onChange={(e) => setNoDn(e.target.value)}
            placeholder="No DN" disabled={tipe === "Secondary" || tipe === "REJECT"} />
          <input type="text" className="inbound-input" value={noMobil} onChange={(e) => setNoMobil(e.target.value)} placeholder="No Mobil" />
          <input type="text" className="inbound-input" value={namaDriver} onChange={(e) => setNamaDriver(e.target.value)} placeholder="Nama Driver" />
          <textarea className="inbound-textarea" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" />
        </div>
      </div>

      {items.map((it, idx) => (
        <div className="inbound-form-card" key={idx}>
          <div className="inbound-card-title">Item</div>
          <div className="inbound-item-card">
            <div className="inbound-item-head">
              <button type="button" className="inbound-item-remove" title="Hapus Item" onClick={() => removeItem(idx)}>
                <i className="bi bi-trash3"></i>
              </button>
            </div>

            <ProdukPicker produkList={produkList} value={it.nama_produk}
              onChange={(p) => pickProduk(idx, p)} />

            <input type="number" min={1} className="inbound-input" placeholder="Jumlah" value={it.jumlah}
              onChange={(e) => updateItem(idx, { jumlah: e.target.value })} onBlur={() => autoBlock(idx)} />

            <input type={isReject || it.no_batch ? "text" : "date"} className="inbound-input"
              value={isReject ? "9999/99/99" : it.best_before}
              readOnly={isReject || it.no_batch}
              onChange={(e) => updateItem(idx, { best_before: e.target.value })}
              placeholder={it.no_batch ? "Best Before" : "Best Before"} />

            <PlantPicker plantList={plantList} value={it.asal_pabrik}
              disabled={it.no_batch}
              onChange={(v) => updateItem(idx, { asal_pabrik: v })} />

            <input type="text" className="inbound-input" value={batchPreview(it)} placeholder="Batch" readOnly />

            <input type="text" className="inbound-input" value={it.block_preview || ""} placeholder="Block (otomatis saat simpan)" readOnly />
          </div>
        </div>
      ))}

      <button type="button" className="inbound-add-item-btn" onClick={addItem}>
        <i className="bi bi-plus-lg"></i>
        <span>Tambah Item</span>
      </button>

      <button type="button" className="inbound-submit-btn" disabled={busy} onClick={simpan}>
        <i className="bi bi-save2"></i>
        <span>{busy ? "Menyimpan..." : "Simpan Semua"}</span>
      </button>

      {busy && (
        <div className="inbound-loading-overlay">
          <div className="inbound-spinner"></div>
          <div className="inbound-loading-text">Menyimpan Data...</div>
        </div>
      )}

      {results && (
        <div className="inbound-success-overlay">
          <div className="inbound-success-modal">
            <div className="inbound-success-title">
              <i className={`bi ${results.failed.length ? "bi-info-circle-fill" : "bi-check-circle-fill"}`}></i>
              <span>{results.failed.length ? "Sebagian Gagal" : "Inbound Disimpan"}</span>
            </div>
            <div className="inbound-success-list">
              {results.success.map((s, i) => (
                <div className="inbound-success-item" key={`s${i}`}>
                  <div className="inbound-success-product">{s.nama_produk}</div>
                  <div className="inbound-success-location">
                    <i className="bi bi-geo-alt"></i>
                    <span>Lokasi akhir: {s.lokasi || "-"}</span>
                  </div>
                  {s.slot && (
                    <div className="inbound-success-chip-wrap">
                      {s.slot.split(",").map((x) => <div className="inbound-success-slot" key={x}>{x.trim()}</div>)}
                    </div>
                  )}
                </div>
              ))}
              {results.failed.map((f, i) => (
                <div className="inbound-success-item" key={`f${i}`}>
                  <div className="inbound-success-product">{f.nama_produk}</div>
                  <div className="inbound-failed-message">Gagal: {f.message}</div>
                </div>
              ))}
            </div>
            <div className="inbound-success-action">
              <button type="button" className="inbound-success-close" onClick={() => { setResults(null); window.location.href = "/inbound"; }}>Tutup</button>
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
    <div className="inbound-picker-wrap">
      <button type="button" className="inbound-picker-button" onClick={() => setOpen((o) => !o)}>
        <span className="inbound-picker-text">{norm(value) || "Pilih produk"}</span>
        <i className="bi bi-search"></i>
      </button>
      {open && (
        <div className="inbound-picker-panel show">
          <input type="text" className="inbound-picker-search" placeholder="Cari ID atau nama produk" value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="inbound-option-list">
            {filtered.map((p) => (
              <button key={p.id_produk} type="button" className="inbound-option"
                onClick={() => { onChange(p); setOpen(false); setQ(""); }}>
                <span className="inbound-option-label">{p.id_produk} - {p.nama_produk}</span>
              </button>
            ))}
            {!filtered.length && <div className="inbound-empty-result">Produk tidak ditemukan</div>}
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
    <div className="inbound-picker-wrap">
      <button type="button" className={`inbound-picker-button ${disabled ? "disabled" : ""}`} onClick={() => !disabled && setOpen((o) => !o)}>
        <span className="inbound-picker-text">{norm(value) || "Asal Pabrik"}</span>
        <i className="bi bi-search"></i>
      </button>
      {open && !disabled && (
        <div className="inbound-picker-panel show">
          <input type="text" className="inbound-picker-search" placeholder="Cari asal pabrik" value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="inbound-option-list">
            {filtered.map((p) => (
              <button key={p.id_plant} type="button" className="inbound-option"
                onClick={() => { onChange(`${p.id_plant} - ${p.nama_plant}`); setOpen(false); setQ(""); }}>
                <span className="inbound-option-label">{p.id_plant} - {p.nama_plant}</span>
              </button>
            ))}
            {!filtered.length && <div className="inbound-empty-result">Asal pabrik tidak ditemukan</div>}
          </div>
        </div>
      )}
    </div>
  );
}