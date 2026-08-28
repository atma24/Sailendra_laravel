"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiPost, apiGet } from "@/lib/api";
import { aktifLokasiId, useSession } from "@/lib/auth";

type Produk = { id_produk: number; nama_produk: string; satuan: string };
type Plant = { id_plant: string; nama_plant: string };
type PreviewRec = { id_deep: number; alokasi: number; label_lokasi: string; kode_block: string; nomor_line: number; label_line: string };
type KonversiLevel = { level: number; jumlah_deep: number };
type KonversiLine = { id_line: number; kode_block: string; nomor_line: number; label_line: string; produk_lama: string; levels: KonversiLevel[]; jumlah_deep: number; kapasitas_baru: number; kapasitas_total: number };

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
  konversi: number[];
};

type ResultItem = { nama_produk: string; message: string; lokasi?: string; slot?: string };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const PRODUK_TANPA_BATCH = [10516938, 10516939];

const css = `
.inbound-form-page { display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; max-width: 1100px; margin: 0 auto; }
.inbound-form-card { background: #FFFFFF; border: 1px solid var(--border-light, #E2E8F0); border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.02); padding: 18px 20px; }
.inbound-top-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.inbound-back-btn { min-height: 38px; border-radius: 10px; padding: 0 14px; background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; transition: all 0.2s ease; }
.inbound-back-btn:hover { color: var(--primary-navy, #191970); border-color: var(--primary-navy, #191970); background: #EEF2FF; }
.inbound-timer-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; border-radius: 999px; padding: 0 14px; background: #EEF2FF; border: 1px solid #C7D2FE; color: var(--primary-navy, #191970); font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.inbound-alert { border-radius: 12px; padding: 12px 16px; background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.inbound-card-title { font-size: 15px; font-weight: 800; color: var(--primary-navy, #191970); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; letter-spacing: -0.2px; }
.inbound-stack { display: flex; flex-direction: column; gap: 14px; }
.inbound-label { display: block; font-size: 12px; font-weight: 800; color: #334155; margin-bottom: 6px; }
.inbound-input, .inbound-select, .inbound-textarea { width: 100%; border-radius: 10px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #0F172A; font-size: 13px; font-weight: 600; outline: none; transition: all 0.2s ease; box-sizing: border-box; }
.inbound-input, .inbound-select { height: 38px; padding: 0 12px; }
.inbound-select { appearance: none; -webkit-appearance: none; -moz-appearance: none; }
.inbound-textarea { min-height: 72px; padding: 10px 12px; resize: vertical; }
.inbound-input:focus, .inbound-select:focus, .inbound-textarea:focus { background: #FFFFFF; border-color: var(--primary-navy, #191970); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.08); }
.inbound-input:disabled, .inbound-input[readonly] { background: #F1F5F9; color: #64748B; cursor: not-allowed; }
.inbound-select-wrap { position: relative; }
.inbound-select-icon { position: absolute; top: 50%; right: 14px; transform: translateY(-50%); font-size: 12px; color: #64748B; pointer-events: none; }
.inbound-item-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; position: relative; transition: border-color 0.2s ease; }
.inbound-item-card:hover { border-color: #CBD5E1; }
.inbound-item-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 4px; }
.inbound-item-number { font-size: 13px; font-weight: 800; color: var(--primary-navy, #191970); display: flex; align-items: center; gap: 6px; }
.inbound-item-remove { width: 32px; height: 32px; border-radius: 8px; border: 0; background: #FEF2F2; color: #DC2626; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; transition: all 0.18s ease; }
.inbound-item-remove:hover { background: #DC2626; color: #FFFFFF; }
.inbound-picker-wrap { position: relative; }
.inbound-picker-button { width: 100%; min-height: 38px; border-radius: 10px; border: 1px solid #CBD5E1; background: #F8FAFC; padding: 0 12px; font-size: 13px; font-weight: 700; color: #0F172A; outline: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; transition: all 0.2s ease; }
.inbound-picker-button:hover:not(.disabled) { border-color: var(--primary-navy, #191970); background: #FFFFFF; }
.inbound-picker-button.disabled { background: #F1F5F9; color: #64748B; pointer-events: none; }
.inbound-picker-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.inbound-picker-panel { display: none; position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 80; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12); padding: 8px; }
.inbound-picker-panel.show { display: block; }
.inbound-picker-search { width: 100%; height: 36px; border-radius: 8px; border: 1px solid #CBD5E1; background: #F8FAFC; padding: 0 12px; font-size: 12px; font-weight: 600; outline: none; margin-bottom: 6px; box-sizing: border-box; }
.inbound-picker-search:focus { background: #FFFFFF; border-color: var(--primary-navy, #191970); }
.inbound-option-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.inbound-option { border: 0; outline: 0; width: 100%; text-align: left; background: #FFFFFF; color: #0F172A; border-radius: 8px; padding: 8px 10px; font-size: 12px; font-weight: 700; display: flex; align-items: flex-start; cursor: pointer; transition: all 0.15s ease; }
.inbound-option:hover, .inbound-option.selected { background: #EEF2FF; color: var(--primary-navy, #191970); }
.inbound-option-label { flex: 1; min-width: 0; color: inherit; font-weight: 700; line-height: 1.35; }
.inbound-empty-result { padding: 12px; color: #64748B; font-size: 12px; font-weight: 600; text-align: center; }
.d-none { display: none !important; }
.inbound-add-item-btn { width: fit-content; min-height: 38px; border-radius: 10px; border: 1px solid #C7D2FE; background: #EEF2FF; color: var(--primary-navy, #191970); padding: 0 16px; font-size: 13px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; }
.inbound-add-item-btn:hover { border-color: var(--primary-navy, #191970); background: var(--primary-navy, #191970); color: #FFFFFF; transform: translateY(-1px); }
.inbound-submit-btn { width: 100%; border: 0; outline: 0; border-radius: 10px; background: var(--primary-navy, #191970); color: #FFFFFF; min-height: 42px; padding: 8px 16px; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(25, 25, 112, 0.2); }
.inbound-submit-btn:hover { background: #121254; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(25, 25, 112, 0.3); }
.inbound-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.inbound-success-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
.inbound-success-modal { width: min(850px, 95%); background: #FFFFFF; border-radius: 18px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); max-height: 90vh; overflow-y: auto; }
.inbound-success-title { display: flex; align-items: center; gap: 10px; color: #0F172A; font-size: 18px; font-weight: 800; letter-spacing: -0.25px; margin-bottom: 16px; }
.inbound-success-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
.inbound-success-item { padding: 16px; border: 1px solid #E2E8F0; border-radius: 12px; background: #F8FAFC; }
.inbound-success-product { color: #0F172A; font-size: 13px; font-weight: 800; text-transform: uppercase; line-height: 1.35; }
.inbound-success-location { margin-top: 6px; color: #475569; font-size: 12px; font-weight: 600; display: flex; align-items: flex-start; gap: 6px; line-height: 1.35; }
.inbound-success-chip-wrap { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.inbound-success-slot { display: inline-flex; align-items: center; min-height: 28px; border: 1px solid #CBD5E1; border-radius: 8px; padding: 0 10px; color: #0F172A; font-size: 12px; font-weight: 700; background: #FFFFFF; }
.inbound-failed-message { margin-top: 6px; color: #DC2626; font-size: 12px; font-weight: 700; line-height: 1.35; }
.inbound-success-action { margin-top: 20px; display: flex; justify-content: flex-end; }
.inbound-success-close { border: 0; outline: 0; border-radius: 10px; background: var(--primary-navy, #191970); color: #FFFFFF; min-height: 38px; padding: 0 20px; font-size: 13px; font-weight: 800; cursor: pointer; }
.inbound-loading-overlay { position: fixed; inset: 0; z-index: 99999; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(2px); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.inbound-spinner { width: 44px; height: 44px; border: 4px solid #E2E8F0; border-top: 4px solid var(--primary-navy, #191970); border-radius: 50%; animation: ibSpin 1s linear infinite; margin-bottom: 14px; }
@keyframes ibSpin { to { transform: rotate(360deg); } }
.inbound-loading-text { color: var(--primary-navy, #191970); font-size: 14px; font-weight: 800; }
.sailendra-toast-wrap { position: fixed; top: 20px; right: 20px; z-index: 3000; display: flex; flex-direction: column; gap: 8px; width: 340px; pointer-events: none; }
.sailendra-toast { pointer-events: auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid var(--primary-navy, #191970); border-radius: 12px; padding: 12px 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); display: flex; align-items: flex-start; gap: 10px; }
.sailendra-toast-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
.sailendra-toast-content { min-width: 0; flex: 1; }
.sailendra-toast-title { font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 2px; }
.sailendra-toast-message { font-size: 12px; font-weight: 600; color: #64748B; line-height: 1.35; }
.sailendra-toast-close { border: 0; background: transparent; color: #94A3B8; font-size: 14px; padding: 0; cursor: pointer; }
.sailendra-toast.success { border-left-color: #10B981; }
.sailendra-toast.success .sailendra-toast-icon { background: #ECFDF5; color: #10B981; }
.sailendra-toast.error { border-left-color: #DC2626; }
.sailendra-toast.error .sailendra-toast-icon { background: #FEF2F2; color: #DC2626; }
.sailendra-toast.warning { border-left-color: #F59E0B; }
.sailendra-toast.warning .sailendra-toast-icon { background: #FFFBEB; color: #F59E0B; }
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
  const [shipmentId, setShipmentId] = useState("");
  const [noDn, setNoDn] = useState("");
  const [noMobil, setNoMobil] = useState("");
  const [namaDriver, setNamaDriver] = useState("");
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ success: ResultItem[]; failed: ResultItem[] } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  const toastSeq = useRef(0);
  const [konfirmasiKonversi, setKonfirmasiKonversi] = useState<{ idx: number; lines: KonversiLine[]; alokasi: { id_deep: number; jumlah: number }[]; lokasi_line: string } | null>(null);

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

  const idPenggunaLokasi = aktifLokasiId(session);

  const isReject = tipe === "REJECT";
  const isNoBatchGlobal = (id: number) => PRODUK_TANPA_BATCH.includes(id);

  const emptyItem = (): Item => ({
    id_produk: 0, nama_produk: "", satuan: "", jumlah: "", best_before: "",
    asal_pabrik: "", lokasi_line: "", alokasi: [], block_preview: "", no_batch: false, konversi: [],
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
      alokasi: [],
      lokasi_line: "",
      block_preview: "",
      konversi: [],
    });
  };

  // --- PERBAIKAN: AUTO BLOCK DENGAN VALIDASI TANGGAL KOSONG ---
  const autoBlock = async (idx: number, overrideBB?: string) => {
    const it = items[idx];
    if (!it || it.id_produk <= 0 || angka(it.jumlah) <= 0) return;

    const bbValue = overrideBB !== undefined ? overrideBB : it.best_before;
    const bb = (it.no_batch || isReject) ? "9999-12-31" : (bbValue && bbValue !== "-" ? norm(bbValue) : null);

    try {
      const r = await apiPost<{ rekomendasi?: PreviewRec[]; lokasi_line?: string; konversi?: KonversiLine[]; message?: string }>(
        "/barang-masuk/preview",
        {
          id_pengguna_lokasi: idPenggunaLokasi,
          id_produk: it.id_produk,
          qty: angka(it.jumlah),
          best_before: bb, // Kirim null jika belum diisi, BUKAN 9999-12-31
          tipe_penerimaan: tipe,
        }
      );
      const recs = r.data?.rekomendasi || [];
      const alokasi = recs
        .filter((x) => angka(x.id_deep) > 0 && angka(x.alokasi) > 0)
        .map((x) => ({ id_deep: x.id_deep, jumlah: angka(x.alokasi) }));
      const lokasiLine = r.data?.lokasi_line || (recs.length ? `${recs[0].kode_block}-${recs[0].nomor_line}` : "");
      const konversi = r.data?.konversi || [];

      if (konversi.length) {
        setKonfirmasiKonversi({ idx, lines: konversi, alokasi, lokasi_line: lokasiLine });
        return;
      }
      updateItem(idx, { alokasi, lokasi_line: lokasiLine, block_preview: lokasiLine || "-", konversi: [] });
    } catch {
      updateItem(idx, { alokasi: [], lokasi_line: "", block_preview: "-", konversi: [] });
    }
  };

  const terimaKonversi = () => {
    if (!konfirmasiKonversi) return;
    const { idx, lines, alokasi, lokasi_line } = konfirmasiKonversi;
    updateItem(idx, { alokasi, lokasi_line, block_preview: lokasi_line || "-", konversi: lines.map((l) => l.id_line) });
    notify("success", `${lines.length} line kosong dikonversi ke produk ini (${lines[0].label_line}${lines.length > 1 ? ", dst" : ""}).`);
    setKonfirmasiKonversi(null);
  };

  const tolakKonversi = () => {
    if (!konfirmasiKonversi) return;
    const { idx } = konfirmasiKonversi;
    updateItem(idx, { alokasi: [], lokasi_line: "", block_preview: "-", konversi: [] });
    notify("error", "Konversi dibatalkan. Kapasitas line tidak cukup.");
    setKonfirmasiKonversi(null);
  };

  const batchPreview = (it: Item) => {
    if (it.no_batch) return "-";
    if (isReject) return "999999" + (it.asal_pabrik.split(" - ")[0] || "");
    const bb = norm(it.best_before).replace(/-/g, "").slice(2);
    const kodePlant = it.asal_pabrik.split(" - ")[0] || "";
    return bb && kodePlant ? bb + kodePlant : "";
  };

  // --- PERBAIKAN: SIMPAN SEMUA DENGAN KONVERSI OTOMATIS TERSINKRONISASI ---
  const simpan = async () => {
    if (!items.length) { setResults({ success: [], failed: [{ nama_produk: "Produk", message: "Belum ada item yang diisi." }] }); return; }
    if (tipe !== "Secondary" && tipe !== "REJECT" && norm(noDn) === "") { notify("error", "No DN wajib diisi untuk Penerimaan Primary / Primary XWH."); return; }
    if (norm(noMobil) === "") { notify("error", "No Mobil wajib diisi."); return; }
    if (norm(namaDriver) === "") { notify("error", "Nama Driver wajib diisi."); return; }

    setBusy(true);
    const success: ResultItem[] = [];
    const failed: ResultItem[] = [];
    const waktuMulai = `${startTime.current.getFullYear()}-${pad2(startTime.current.getMonth() + 1)}-${pad2(startTime.current.getDate())} ${pad2(startTime.current.getHours())}:${pad2(startTime.current.getMinutes())}:${pad2(startTime.current.getSeconds())}`;

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const no = idx + 1;
      if (it.id_produk <= 0) { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Produk pada item ke-${no} belum dipilih.` }); continue; }
      if (angka(it.jumlah) <= 0) { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Jumlah pada item ke-${no} belum benar.` }); continue; }
      if (!isReject && !it.no_batch && norm(it.best_before) === "") { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Best before pada item ke-${no} belum diisi.` }); continue; }
      if (!it.no_batch && norm(it.asal_pabrik) === "") { failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: `Asal pabrik pada item ke-${no} belum dipilih.` }); continue; }

      const bb = it.no_batch ? "9999-12-31" : (isReject ? "9999-12-31" : norm(it.best_before));
      const asal = it.no_batch ? "-" : (isReject ? (norm(it.asal_pabrik) || "-") : norm(it.asal_pabrik));
      const batch = batchPreview(it);

      try {
        const rRec = await apiPost<{ rekomendasi?: PreviewRec[]; lokasi_line?: string; konversi?: KonversiLine[]; message?: string }>(
          "/barang-masuk/preview",
          {
            id_pengguna_lokasi: idPenggunaLokasi,
            id_produk: it.id_produk,
            qty: angka(it.jumlah),
            best_before: bb,
            tipe_penerimaan: tipe,
          }
        );

        const recs = rRec.data?.rekomendasi || [];
        const freshAlokasi = recs
          .filter((x) => angka(x.id_deep) > 0 && angka(x.alokasi) > 0)
          .map((x) => ({ id_deep: x.id_deep, jumlah: angka(x.alokasi) }));
        const freshLokasiLine = rRec.data?.lokasi_line || (recs.length ? `${recs[0].kode_block}-${recs[0].nomor_line}` : "");
        const konvLines = rRec.data?.konversi || [];

        // Sinkronkan ID line konversi langsung dari rekomendasi backend terkini
        const idKonversiKirim = konvLines.length 
          ? konvLines.map((l) => l.id_line) 
          : (it.konversi || []);

        if (konvLines.length && !(it.konversi || []).length) {
          failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: "Kapasitas kurang. Konfirmasi konversi line kosong (blur jumlah untuk preview) terlebih dahulu." });
          continue;
        }

        if (!freshAlokasi.length) {
          failed.push({ nama_produk: it.nama_produk || `Produk ID ${it.id_produk}`, message: "Line produk tidak tersedia atau kapasitas penuh. Silakan buat layout baru." });
          continue;
        }

        const r = await apiPost<{ lokasi_akhir?: { line: string; qty: number }[]; lokasi_akhir_str?: string }>("/barang-masuk", {
          shipment_id: shipmentId,
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
          lokasi_line: freshLokasiLine,
          alokasi: freshAlokasi,
          konversi: idKonversiKirim.length ? idKonversiKirim : undefined,
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
            <input 
              type="date" 
              className="inbound-input" 
              value={tanggal} 
              onChange={(e) => setTanggal(e.target.value)} 
              onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()} 
            />
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
          <input type="text" className="inbound-input" value={shipmentId} onChange={(e) => setShipmentId(e.target.value)} placeholder="Shipment ID (Opsional, otomatis jika kosong)" maxLength={30} />
          <input type="text" className="inbound-input" value={noDn} onChange={(e) => setNoDn(e.target.value)}
            placeholder="No DN" disabled={tipe === "Secondary" || tipe === "REJECT"} maxLength={30} />
          <input type="text" className="inbound-input" value={noMobil} onChange={(e) => setNoMobil(e.target.value)} placeholder="No Mobil" maxLength={30} />
          <input type="text" className="inbound-input" value={namaDriver} onChange={(e) => setNamaDriver(e.target.value)} placeholder="Nama Driver" maxLength={30} />
          <textarea className="inbound-textarea" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" maxLength={250} />
        </div>
      </div>

      {items.map((it, idx) => (
        <div className="inbound-form-card" key={idx}>
          <div className="inbound-card-title">Item {idx + 1}</div>
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

            <input 
              type={isReject || it.no_batch ? "text" : "date"} 
              className="inbound-input"
              value={isReject ? "9999-12-31" : it.best_before}
              readOnly={isReject || it.no_batch}
              onChange={(e) => {
                const val = e.target.value;
                updateItem(idx, { best_before: val });
                if (val && angka(it.jumlah) > 0) {
                  autoBlock(idx, val);
                }
              }}
              onClick={(e) => {
                if (!isReject && !it.no_batch && e.currentTarget.showPicker) {
                  e.currentTarget.showPicker();
                }
              }}
              placeholder={it.no_batch ? "Best Before (-)" : "Best Before"} 
            />

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

      {konfirmasiKonversi && (
        <div className="inbound-success-overlay">
          <div className="inbound-success-modal">
            <div className="inbound-success-title">
              <i className="bi bi-arrow-left-right"></i>
              <span>Konversi Line Kosong</span>
            </div>
            <div className="inbound-failed-message" style={{ marginTop: 0 }}>
              Kapasitas milik <b>{items[konfirmasiKonversi.idx]?.nama_produk || "produk ini"}</b> tidak cukup.
              Line kosong milik produk lain berikut akan dikonversi (kepemilikan + kapasitas deep) ke produk ini:
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {konfirmasiKonversi.lines.map((l) => (
                <div key={l.id_line} className="inbound-success-item" style={{ padding: 10 }}>
                  <div className="inbound-success-product">{l.label_line} <span style={{ fontWeight: 600, textTransform: "none" }}>({l.produk_lama})</span></div>
                  <div className="inbound-success-location">
                    <i className="bi bi-layers"></i>
                    <span>{l.jumlah_deep} deep × {l.kapasitas_baru} = <b>{l.kapasitas_total}</b> kapasitas</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="inbound-success-action" style={{ display: "flex", gap: 8 }}>
              <button type="button" className="inbound-back-btn" onClick={tolakKonversi} style={{ minHeight: 34, padding: "0 17px", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
                Batal
              </button>
              <button type="button" className="inbound-success-close" onClick={terimaKonversi}>
                Lanjut Konversi
              </button>
            </div>
          </div>
        </div>
      )}

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