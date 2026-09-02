"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { aktifLokasiId, isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import { useToast } from "@/components/ToastProvider";

type Produk = { id_produk: number; nama_produk: string; satuan: string };

type BmRow = {
  id_barang_masuk: number;
  id_pengguna_lokasi: string;
  id_pengguna: number;
  dibuat_oleh: string;
  id_produk: number;
  nama_produk: string;
  jumlah: number;
  satuan: string;
  tanggal_masuk: string;
  tipe_penerimaan: string;
  best_before: string;
  batch: string;
  asal_pabrik: string;
  no_dn: string;
  nama_driver: string;
  no_mobil: string;
  catatan: string;
  lokasi_block: string;
  stok_sisa: number;
  status: string;
  shipment_id: string;
  waktu_mulai_input?: string;
  durasi_detik?: number;
};

type Plant = { id_plant: string; nama_plant: string };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const PRODUK_TANPA_BATCH = [10516938, 10516939];

const css = `
.inbound-detail-page { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; }
.id-card { background: #FFFFFF; border: 1px solid #e7ebf3; border-radius: 12px; box-shadow: none; }
.id-head { padding: 12px; }
.id-back-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; margin-bottom: 10px; }
.id-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.25); transform: translateY(-1px); }
.id-detail-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 9px; }
.id-section-title { font-size: 13px; font-weight: 900; color: var(--text-main); margin: 0; letter-spacing: -0.15px; }
.id-icon-btn { width: 27px; height: 27px; border: 0; background: transparent; color: #4b5563; border-radius: 8px; display: inline-flex; justify-content: center; align-items: center; font-size: 12px; flex-shrink: 0; cursor: pointer; }
.id-icon-btn:hover { background: #f3f4f6; color: var(--primary); }
.id-detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 7px; }
.id-text-row { border: 1px solid #edf0f6; background: #fbfcff; border-radius: 9px; padding: 8px 10px; min-height: 51px; display: flex; flex-direction: column; justify-content: center; }
.id-text-wide { grid-column: span 2; }
.id-text-label { font-size: 9.5px; color: #8b8fa3; font-weight: 850; margin-bottom: 4px; line-height: 1.1; }
.id-text-value { font-size: 11.5px; color: #111827; font-weight: 900; line-height: 1.25; word-break: break-word; }
.id-actions { display: flex; flex-direction: column; gap: 7px; }
.id-delete-all { border: 0; width: 100%; min-height: 35px; border-radius: 9px; background: #f43f3a; color: #FFFFFF; font-size: 12px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
.id-delete-all:hover { filter: brightness(1.03); }
.id-delete-all:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
.id-status-steps { display: flex; flex-direction: column; gap: 7px; width: 100%; }
.id-step-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 35px; padding: 0 18px; border-radius: 9px; border: 0; background: #f3f4f6; color: #9ca3af; font-size: 12px; font-weight: 900; cursor: not-allowed; white-space: nowrap; }
.id-step-next { background: var(--primary, #1a56db); color: #fff; cursor: pointer; transition: all 0.2s; }
.id-step-next:hover { filter: brightness(1.08); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.id-step-next:disabled { opacity: 0.7; pointer-events: none; }
.id-item-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 9px; }
.id-item-card { padding: 11px; border: 1px solid rgba(25,25,112,0.18); border-radius: 11px; background: #fbfcff; }
.id-item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 9px; margin-bottom: 9px; }
.id-product-name { font-size: 13px; font-weight: 900; color: #111827; line-height: 1.3; letter-spacing: -0.1px; }
.id-item-icons { display: flex; gap: 3px; align-items: center; flex-shrink: 0; }
.id-check { width: 22px; height: 22px; border-radius: 50%; background: #16a34a; color: #FFFFFF; display: inline-flex; justify-content: center; align-items: center; font-size: 11px; }
.id-rencana-box { margin-top: 8px; padding: 9px 10px; border-radius: 9px; background: #f4f6ff; border: 1px solid #e2e7ff; }
.id-rencana-title { color: #191970; font-size: 11px; font-weight: 900; margin-bottom: 6px; }
.id-rencana-line { font-size: 11px; font-weight: 800; color: #374151; margin-bottom: 3px; line-height: 1.35; }
.id-rencana-meta { font-size: 10px; color: #6b7280; font-weight: 750; line-height: 1.35; }
.id-empty { padding: 13px; color: var(--text-soft); font-size: 11px; font-weight: 850; }
.id-item-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }

/* Tambahan Tombol Tambah Item */
.id-add-item-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: var(--primary); color: #fff; border: none; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; }
.id-add-item-btn:hover { filter: brightness(1.1); box-shadow: 0 4px 10px rgba(25,25,112,0.15); }
.id-modal-note { background: #f4f6ff; border: 1px solid #d7dcff; color: #191970; border-radius: 9px; padding: 8px 9px; font-size: 11px; font-weight: 800; margin-bottom: 10px; line-height: 1.4; }

/* Status Badge */
.status-badge { padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 900; white-space: nowrap; text-transform: uppercase; }

/* Form inputs for Draft */
.draft-bb-input { width: 100%; border-radius: 8px; border: 1px solid #e2e7f0; padding: 6px 10px; font-size: 11px; font-weight: 750; outline: none; margin-top: 6px; }
.draft-bb-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.draft-bb-input:disabled { background: #f3f4f6; color: #9ca3af; }

.inbound-dialog { border: 0; border-radius: 12px; padding: 0; width: min(440px, calc(100% - 30px)); max-height: 85vh; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.15); background: #FFFFFF; position: fixed; inset: 0; margin: auto; }
.dialog-box { padding: 20px 24px; max-height: 85vh; overflow-y: auto; }
.dialog-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: var(--text-main); }
.dialog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dialog-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dialog-field-full { grid-column: 1 / -1; }
.dialog-field label { font-size: 12px; font-weight: 600; color: var(--text-main); }
.dialog-field input, .dialog-field textarea, .dialog-field select { width: 100%; min-height: 36px; border: 1px solid #dedede; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; outline: none; background: #fbfcff; color: var(--text-main); box-sizing: border-box; }
.dialog-field textarea { min-height: 72px; resize: vertical; }
.dialog-field input[readonly] { background: #f6f7f9; color: #6b7280; }
.dialog-field input:focus, .dialog-field textarea:focus { border-color: var(--primary); background: #FFFFFF; box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #dedede; }
.dialog-btn { border: 0; border-radius: 8px; min-height: 36px; padding: 0 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.dialog-btn-cancel { background: transparent; color: #6b6380; }
.dialog-btn-cancel:hover { background: #f3f4f6; }
.dialog-btn-save { background: var(--primary); color: #FFFFFF; }
.dialog-btn-save:hover { filter: brightness(1.05); }
.dialog-danger { background: #ef4444; color: #FFFFFF; }
.dialog-danger:hover { filter: brightness(1.05); }

.inbound-picker-wrap { position: relative; }
.inbound-picker-button { width: 100%; min-height: 36px; border-radius: 8px; border: 1px solid #dedede; background: #fbfcff; padding: 8px 12px; font-size: 13px; font-weight: 500; color: var(--text-main); outline: none; display: flex; align-items: center; justify-content: space-between; gap: 7px; cursor: pointer; }
.inbound-picker-panel { display: none; position: absolute; left: 0; right: 0; top: calc(100% + 5px); z-index: 3050; background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 8px; box-shadow: 0 10px 24px rgba(15,23,42,0.12); padding: 8px; }
.inbound-picker-panel.show { display: block; }
.inbound-picker-search { width: 100%; height: 34px; border-radius: 6px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 12px; outline: none; margin-bottom: 6px; }
.inbound-option-list { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.inbound-option { border: 0; outline: 0; width: 100%; text-align: left; background: #FFFFFF; color: var(--text-main); border-radius: 6px; padding: 8px 10px; font-size: 12px; font-weight: 600; display: flex; align-items: flex-start; cursor: pointer; }
.inbound-option:hover, .inbound-option.selected { background: var(--primary-soft); color: var(--primary); }
.inbound-empty-result { padding: 8px; color: var(--text-soft); font-size: 12px; font-weight: 600; text-align: center; }

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

@media (max-width: 1100px) { .id-detail-grid, .id-item-list { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 768px) {
  .id-detail-grid, .id-item-list, .dialog-grid { grid-template-columns: 1fr; }
  .id-text-wide { grid-column: span 1; }
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}
`;

const statusStyle = (s: string): { bg: string; color: string; border: string } => {
  const st = (s || "").toLowerCase();
  if (st === "pending") return { bg: "#e0f2fe", color: "#0284c7", border: "1px solid #bae6fd" };
  if (st === "selesai" || st === "confirmed") return { bg: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" };
  return { bg: "#fef3c7", color: "#ca8a04", border: "1px solid #fde047" }; 
};

export default function InboundDetailPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const router = useRouter();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const driver = searchParams.get("driver") || "";
  const shipment = searchParams.get("shipment") || "";
  const lok = searchParams.get("lok") || "";

  const [rows, setRows] = useState<BmRow[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]); // Untuk Tambah Item
  const [loaded, setLoaded] = useState(false);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [showItem, setShowItem] = useState<BmRow | null>(null);
  
  // State untuk Tambah Item Baru
  const [showAddItem, setShowAddItem] = useState(false);
  const [aProduk, setAProduk] = useState(0);
  const [aJumlah, setAJumlah] = useState("");
  const [aSatuan, setASatuan] = useState("");

  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmOne, setConfirmOne] = useState<BmRow | null>(null);

  const waktuMulaiRef = useRef<Date | null>(null);
  const [draftBb, setDraftBb] = useState<Record<number, string>>({});
  const [draftCatatan, setDraftCatatan] = useState<Record<number, string>>({});

  const [hTanggal, setHTanggal] = useState("");
  const [hMobil, setHMobil] = useState("");
  const [hDn, setHDn] = useState("");
  const [hDriver, setHDriver] = useState("");
  const [hAsal, setHAsal] = useState("");
  const [hCatatan, setHCatatan] = useState("");
  const [hBestBefore, setHBestBefore] = useState("");

  const [iJumlah, setIJumlah] = useState("");
  const [iBestBefore, setIBestBefore] = useState("");
  const [iCatatan, setICatatan] = useState("");

  let toastSeq = 0;
  const notify = (type: string, msg: string) => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, type, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : 6000);
  };
  const closeToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  useEffect(() => {
    if (!session || !tanggal) return;
    let cancelled = false;
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.append("tanggal", tanggal);
        if (multi) {
          if (lok) sp.append("id_pengguna_lokasi", lok);
          else {
            const l = lokasiParam(session);
            if (l) sp.set("id_pengguna_lokasi_multi", l.split("=")[1] || "");
          }
        } else {
          sp.append("id_pengguna_lokasi", String(session.user.id_pengguna_lokasi || ""));
        }
        
        // Load Inbound, Plants, dan Produk List (untuk Add Item)
        const [r, pr, prodRes] = await Promise.all([
          apiGet<BmRow[]>(`/barang-masuk?${sp.toString()}`),
          apiGet<Plant[]>("/plant"),
          apiGet<Produk[]>("/produk?limit=2000"),
        ]);
        
        if (cancelled) return;
        
        const fetchedRows = r.data || [];
        setRows(fetchedRows);
        setPlants((pr.data || []).sort((a, b) => String(a.id_plant).localeCompare(String(b.id_plant))));
        setProdukList((prodRes.data || []).sort((a, b) => angka(a.id_produk) - angka(b.id_produk)));

        // Pre-fill draftBb dari best_before yang sudah ada
        const bbMap: Record<number, string> = {};
        fetchedRows.forEach((row: BmRow) => {
          if ((row.status || "").toLowerCase() === "draft" && norm(row.best_before) && norm(row.best_before) !== "9999-12-31") {
            bbMap[row.id_barang_masuk] = norm(row.best_before).slice(0, 10);
          }
        });
        if (Object.keys(bbMap).length > 0) setDraftBb(bbMap);

        // Inisialisasi Timer
        const reqShip = !shipment || shipment === "Tanpa Shipment" ? "" : shipment.trim();
        const reqDriver = !driver || driver === "Tanpa nama driver" ? "" : driver.trim();

        const filtered = fetchedRows.filter((x: BmRow) => {
          const rowDriver = (x.nama_driver || "").trim();
          const rowShip = (x.shipment_id || "").trim();
          const sameDriver = reqDriver === "" ? (rowDriver === "" || rowDriver === "Tanpa nama driver") : rowDriver === reqDriver;
          const sameShip = reqShip === "" ? (rowShip === "" || rowShip === "Tanpa Shipment") : rowShip === reqShip;
          return sameDriver && sameShip;
        });

        const firstRow = filtered[0];
        if (firstRow) {
           if (firstRow.waktu_mulai_input) {
              const parsedDate = new Date(firstRow.waktu_mulai_input.replace(/-/g, '/'));
              waktuMulaiRef.current = parsedDate;
           } else {
              waktuMulaiRef.current = new Date();
           }
        }

      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, tanggal, lok, driver, shipment, multi]);

  if (!session || !loaded) return null;

  const reqShip = !shipment || shipment === "Tanpa Shipment" ? "" : shipment.trim();
  const reqDriver = !driver || driver === "Tanpa nama driver" ? "" : driver.trim();

  const items = rows.filter((r) => {
    const rowDriver = (r.nama_driver || "").trim();
    const rowShip = (r.shipment_id || "").trim();
    const sameDriver = reqDriver === "" ? (rowDriver === "" || rowDriver === "Tanpa nama driver") : rowDriver === reqDriver;
    const sameShip = reqShip === "" ? (rowShip === "" || rowShip === "Tanpa Shipment") : rowShip === reqShip;
    return sameDriver && sameShip;
  }).sort((a, b) => angka(b.id_barang_masuk) - angka(a.id_barang_masuk));

  const first = items[0];
  const canCrud = ["SuperAdmin", "Supervisor", "Checker"].includes(session.user.role);
  const backHref = `/inbound/driver/${encodeURIComponent(tanggal)}${lok ? `?lok=${encodeURIComponent(lok)}` : ""}`;

  const hasDraft = items.some(i => (i.status || "").toLowerCase() === "draft");
  const hasPending = items.some(i => (i.status || "").toLowerCase() === "pending");
  const isSelesaiAll = items.every(i => (i.status || "selesai").toLowerCase() === "selesai");
  const totalQty = items.reduce((s, it) => s + angka(it.jumlah), 0);
  
  const globalStatus = hasDraft ? 'Draft' : hasPending ? 'Pending' : 'Selesai';
  const ss = statusStyle(globalStatus);

  const getTimerPayload = (aksi: "submit" | "konfirmasi") => {
    let waktuMulaiStr: string | undefined = undefined;
    let durasiDetik: number | undefined = undefined;

    if (waktuMulaiRef.current) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      const d = waktuMulaiRef.current;
      waktuMulaiStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      if (aksi === "konfirmasi") {
         const waktuSelesai = new Date();
         durasiDetik = Math.floor((waktuSelesai.getTime() - d.getTime()) / 1000);
      } else {
         durasiDetik = 0;
      }
    }
    return { waktu_mulai_input: waktuMulaiStr, durasi_detik: durasiDetik };
  };

  const submitDraftBooking = async () => {
    setBusy(true);
    try {
      const draftItems = items.filter(i => (i.status || "").toLowerCase() === "draft");

      for (const i of draftItems) {
         const isRej = (i.tipe_penerimaan || "").toUpperCase() === "REJECT";
         const noBatch = PRODUK_TANPA_BATCH.includes(angka(i.id_produk)) || /JUG (AQUA|VIT) 19L PC 55 MM/i.test(i.nama_produk || "");
         const bb = isRej || noBatch ? "9999-12-31" : (draftBb[i.id_barang_masuk] || "");
         if (!bb) throw new Error(`Best before untuk ${i.nama_produk} belum diisi.`);

         const isSecondary = (i.tipe_penerimaan || "").toUpperCase() === "SECONDARY";
         const catatanVal = draftCatatan[i.id_barang_masuk] || "";
         if (angka(i.jumlah) === 0 && isSecondary && !catatanVal) {
            throw new Error(`Catatan wajib diisi untuk ${i.nama_produk} (jumlah 0).`);
         }
         if (angka(i.jumlah) === 0 && isSecondary && catatanVal) {
            await apiPost('/barang-masuk/update', {
               id_barang_masuk: i.id_barang_masuk,
               id_pengguna_lokasi: aktifLokasiId(session),
               nama_pengguna: session.user.username,
               catatan: catatanVal
            });
         }
      }

      const payloadItems = draftItems.map(i => {
         const isRej = (i.tipe_penerimaan || "").toUpperCase() === "REJECT";
         const noBatch = PRODUK_TANPA_BATCH.includes(angka(i.id_produk)) || /JUG (AQUA|VIT) 19L PC 55 MM/i.test(i.nama_produk || "");
         const bb = isRej || noBatch ? "9999-12-31" : (draftBb[i.id_barang_masuk] || "");
         return { id_barang_masuk: i.id_barang_masuk, best_before: bb };
      });
      
      const timerData = getTimerPayload("submit");

      await apiPost('/barang-masuk/submit', {
         shipment_id: first.shipment_id || "",
         id_pengguna_lokasi: aktifLokasiId(session),
         items: payloadItems,
         waktu_mulai_input: timerData.waktu_mulai_input,
         durasi_detik: timerData.durasi_detik
      });
      
      notify("success", "Booking lokasi berhasil! Status berubah menjadi Pending.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      notify("error", e.message || "Gagal melakukan submit booking.");
    } finally {
      setBusy(false);
    }
  };

  const revertToDraft = async () => {
    setBusy(true);
    try {
      await apiPost('/barang-masuk/update', {
        aksi: 'revert_to_draft',
        shipment_id: first.shipment_id || "",
        id_pengguna_lokasi: aktifLokasiId(session),
      });
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Berhasil dikembalikan ke Draft.", type: "success" }));
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Gagal revert ke Draft.");
    } finally {
      setBusy(false);
    }
  };

  const konfirmasiPending = async () => {
    setBusy(true);
    try {
      const timerData = getTimerPayload("konfirmasi");

      await apiPost('/barang-masuk/konfirmasi', {
         shipment_id: first.shipment_id || "",
         id_barang_masuk: first.shipment_id ? 0 : first.id_barang_masuk,
         id_pengguna_lokasi: aktifLokasiId(session),
         waktu_mulai_input: timerData.waktu_mulai_input,
         durasi_detik: timerData.durasi_detik
      });
      notify("success", "Konfirmasi berhasil! Stok telah fisik ditambahkan.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      notify("error", e.message || "Gagal melakukan konfirmasi.");
    } finally {
      setBusy(false);
    }
  };

  // --- FUNGSI TAMBAH ITEM BARU ---
  const openAddItem = () => {
    setAProduk(0); setAJumlah(""); setASatuan("");
    setShowAddItem(true);
  };

  const simpanAddItem = async () => {
    if (aProduk <= 0) { notify("error", "Produk wajib dipilih."); return; }
    if (angka(aJumlah) <= 0) { notify("error", "Jumlah tidak valid."); return; }
    setBusy(true);
    try {
      await apiPost("/barang-masuk/update", {
        aksi: "tambah_item",
        shipment_id: first.shipment_id,
        id_barang_masuk_ref: first.id_barang_masuk,
        id_pengguna_lokasi: aktifLokasiId(session),
        id_pengguna: session.user.id_pengguna,
        id_produk: aProduk,
        jumlah: angka(aJumlah),
        satuan: aSatuan || "PCS",
      });
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Item baru berhasil ditambahkan sebagai Draft.", type: "success" }));
      setShowAddItem(false);
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Gagal menambahkan item baru.");
    } finally { setBusy(false); }
  };
  // ------------------------------

  const openHeader = () => {
    if (!first) return;
    setHTanggal(norm(first.tanggal_masuk).slice(0, 10));
    setHMobil(norm(first.no_mobil));
    setHDn(norm(first.no_dn));
    setHDriver(norm(first.nama_driver));
    setHAsal(norm(first.asal_pabrik));
    setHCatatan(norm(first.catatan));
    setHBestBefore(norm(first.best_before).slice(0, 10));
    setShowHeader(true);
  };

  const simpanHeader = async () => {
    if (!first || !items.length) return;
    const isReject = (first.tipe_penerimaan || "").toUpperCase() === "REJECT";
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        id_pengguna_lokasi: aktifLokasiId(session),
        nama_pengguna: session.user.username,
        tanggal_masuk: hTanggal,
        nama_driver: hDriver || "Tanpa nama driver",
        no_mobil: hMobil,
      };
      if (norm(hDn)) payload.no_dn = hDn;
      if (norm(hAsal)) payload.asal_pabrik = hAsal;
      if (norm(hBestBefore) && !isReject) payload.best_before = hBestBefore;
      if (norm(hCatatan)) payload.catatan = hCatatan;

      for (const item of items) {
        await apiPost("/barang-masuk/update", { ...payload, id_barang_masuk: item.id_barang_masuk });
      }
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Detail inbound berhasil diperbarui.", type: "success" }));
      setShowHeader(false);
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Detail inbound gagal diperbarui.");
    } finally { setBusy(false); }
  };

  const openItem = (item: BmRow) => {
    setShowItem(item);
    setIJumlah(String(item.jumlah));
    setIBestBefore(norm(item.best_before).slice(0, 10));
    setICatatan(norm(item.catatan));
  };

  const simpanJumlah = async () => {
    if (!showItem) return;
    const j = angka(iJumlah);
    const isSecondary = (showItem.tipe_penerimaan || "").toUpperCase() === "SECONDARY";
    if (j < 0) { notify("error", "Jumlah tidak valid."); return; }
    if (j === 0 && isSecondary && !norm(iCatatan)) { notify("error", "Catatan wajib diisi jika jumlah 0."); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        id_barang_masuk: showItem.id_barang_masuk,
        id_pengguna_lokasi: aktifLokasiId(session),
        nama_pengguna: session.user.username,
        jumlah: j,
      };
      const isReject = (showItem.tipe_penerimaan || "").toUpperCase() === "REJECT";
      if (!isReject && norm(iBestBefore)) payload.best_before = iBestBefore;
      if (j === 0 && isSecondary) payload.catatan = iCatatan;
      await apiPost("/barang-masuk/update", payload);
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Item inbound berhasil diperbarui.", type: "success" }));
      setShowItem(null);
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Item inbound gagal diperbarui.");
    } finally { setBusy(false); }
  };

  const hapusSatu = async () => {
    if (!confirmOne) return;
    setBusy(true);
    try {
      await apiPost("/barang-masuk/hapus", { id_barang_masuk: confirmOne.id_barang_masuk });
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Item inbound berhasil dihapus.", type: "success" }));
      setConfirmOne(null);
      window.location.reload();
    } catch (e) {
      toast((e as Error).message || "Item ini tidak bisa dihapus karena sudah dipakai.", "error");
    } finally { setBusy(false); }
  };

  const hapusSemua = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      for (const item of items) {
        await apiPost("/barang-masuk/hapus", { id_barang_masuk: item.id_barang_masuk });
      }
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Semua item inbound berhasil dihapus.", type: "success" }));
      setConfirmAll(false);
      router.push(backHref);
    } catch (e) {
      toast((e as Error).message || "Sebagian item tidak bisa dihapus karena sudah dipakai.", "error");
    } finally { setBusy(false); }
  };

  return (
    <div className="inbound-detail-page">
      <style>{css}</style>
      <div id="toastWrap" className="sailendra-toast-wrap" aria-live="polite">
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

      <div className="id-card id-head">
        <Link className="id-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali ke driver</span>
        </Link>

        <div className="id-detail-top">
          <h3 className="id-section-title">Detail Penerimaan</h3>
          {canCrud && !!items.length && (
            <button type="button" className="id-icon-btn" title="Edit Detail Inbound" onClick={openHeader}>
              <i className="bi bi-pencil-fill"></i>
            </button>
          )}
        </div>

        {!first ? (
          <div className="id-empty">Detail inbound tidak ditemukan.</div>
        ) : (
          <>
            <div className="id-detail-grid">
              <div className="id-text-row">
                <div className="id-text-label">Tanggal Masuk</div>
                <div className="id-text-value">{tanggal || "-"}</div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">Status</div>
                <div className="id-text-value">
                  <span className="status-badge" style={ss}>
                    {globalStatus || "-"}
                  </span>
                </div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">Tipe Penerimaan</div>
                <div className="id-text-value">{norm(first.tipe_penerimaan) || "-"}</div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">No Mobil</div>
                <div className="id-text-value">{norm(first.no_mobil) || "-"}</div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">Nama Driver</div>
                <div className="id-text-value">{driver || "-"}</div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">No DN</div>
                <div className="id-text-value">{norm(first.no_dn) || "-"}</div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">Shipment ID</div>
                <div className="id-text-value">{norm(first.shipment_id) || "-"}</div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">Dibuat oleh</div>
                <div className="id-text-value">{norm(first.dibuat_oleh) || "-"}</div>
              </div>
              <div className="id-text-row">
                <div className="id-text-label">Total Qty</div>
                <div className="id-text-value">{totalQty}</div>
              </div>
              <div className="id-text-row id-text-wide">
                <div className="id-text-label">Asal Pabrik</div>
                <div className="id-text-value">{norm(first.asal_pabrik) || "-"}</div>
              </div>
            </div>

            {!isSelesaiAll && (
              <div className="id-actions" style={{ marginTop: 8 }}>
                {canCrud && items.length > 0 && (
                  <button type="button" className="id-delete-all" onClick={() => setConfirmAll(true)}>
                    <i className="bi bi-trash"></i>
                    <span>Hapus Semua ({items.length})</span>
                  </button>
                )}
                {canCrud && (
                  <button type="button" className={`id-step-btn ${hasPending && !hasDraft ? "id-step-next" : ""}`}
                    disabled={!(hasPending && !hasDraft)} onClick={() => (hasPending && !hasDraft) && revertToDraft()}>
                    <i className="bi bi-file-earmark-text-fill"></i>
                    <span>Draft</span>
                  </button>
                )}
                {canCrud && (
                  <button type="button" className={`id-step-btn ${hasDraft ? "id-step-next" : ""}`}
                    disabled={!hasDraft} onClick={() => hasDraft && submitDraftBooking()}>
                    <i className="bi bi-hourglass-split"></i>
                    <span>Submit Booking</span>
                  </button>
                )}
                {(canCrud || session.user.role === "Forklift") && (
                  <button type="button" className={`id-step-btn ${hasPending && !hasDraft ? "id-step-next" : ""}`}
                    disabled={!(hasPending && !hasDraft)} onClick={() => (hasPending && !hasDraft) && konfirmasiPending()}>
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Konfirmasi Inbound</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="id-item-title-row">
        <h3 className="id-section-title" style={{ margin: 0 }}>Item</h3>
        {canCrud && !isSelesaiAll && (
          <button type="button" className="id-add-item-btn" onClick={openAddItem}>
            <i className="bi bi-plus-lg"></i>
            Tambah Item
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="id-card id-empty">Daftar item tidak ditemukan.</div>
      ) : (
        <div className="id-item-list">
          {items.map((item) => {
            const itemStatus = (item.status || "selesai").toLowerCase();
            const isItemReject = (item.tipe_penerimaan || "").toUpperCase() === "REJECT";
            const noBatch = PRODUK_TANPA_BATCH.includes(angka(item.id_produk)) || /JUG (AQUA|VIT) 19L PC 55 MM/i.test(item.nama_produk || "");

            return (
              <div key={item.id_barang_masuk} className="id-item-card">
                <div className="id-item-top">
                  <div className="id-product-name">
                    {norm(item.nama_produk) || "-"}
                  </div>
                  <div className="id-item-icons">
                    {canCrud && (
                      <button type="button" className="id-icon-btn" title="Edit item" onClick={() => openItem(item)}>
                        <i className="bi bi-pencil-fill"></i>
                      </button>
                    )}
                    {canCrud ? (
                      <button type="button" className="id-icon-btn" title="Hapus item" onClick={() => setConfirmOne(item)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    ) : (
                      <button type="button" className="id-icon-btn" disabled style={{ opacity: 0.4, cursor: "not-allowed" }}>
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                    {itemStatus === 'selesai' && <span className="id-check"><i className="bi bi-check-lg"></i></span>}
                  </div>
                </div>

                <div className="id-text-row" style={{ minHeight: 'auto', padding: '6px 8px', marginBottom: 4 }}>
                  <div className="id-text-label">Jumlah</div>
                  <div className="id-text-value">{angka(item.jumlah)} {norm(item.satuan)}</div>
                </div>

                {itemStatus !== 'draft' && (
                  <div className="id-rencana-box">
                    <div className="id-rencana-title">Lokasi Penyimpanan:</div>
                    <div className="id-rencana-line">
                      {norm(item.lokasi_block) || "Menunggu lokasi"}
                    </div>
                    <div className="id-rencana-meta">
                      Batch: {norm(item.batch) || "-"} | BB: {norm(item.best_before) || "-"}
                    </div>
                  </div>
                )}

                {itemStatus === 'draft' && (
                  <div style={{ marginTop: 8, borderTop: '1px dashed #dbe3f5', paddingTop: 8 }}>
                    <label className="id-text-label" style={{marginBottom: 4}}>Isi Best Before</label>
                    <input 
                      type={(isItemReject || noBatch) ? "text" : "date"} 
                      className="draft-bb-input"
                      value={(isItemReject || noBatch) ? "9999/99/99" : (draftBb[item.id_barang_masuk] || "")} 
                      disabled={isItemReject || noBatch}
                      placeholder={noBatch ? "Produk Tanpa BB" : "Pilih Best Before"}
                      onChange={(e) => setDraftBb({...draftBb, [item.id_barang_masuk]: e.target.value})} 
                    />
                    {(item.tipe_penerimaan || "").toUpperCase() === "SECONDARY" && (
                      <div style={{ marginTop: 6 }}>
                        <label className="id-text-label" style={{marginBottom: 4}}>Catatan (wajib jika qty 0)</label>
                        <input 
                          type="text" 
                          className="draft-bb-input"
                          value={draftCatatan[item.id_barang_masuk] || ""}
                          placeholder="Isi catatan jika qty 0"
                          maxLength={250}
                          onChange={(e) => setDraftCatatan({...draftCatatan, [item.id_barang_masuk]: e.target.value})} 
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOGS */}
      {showAddItem && (
        <dialog open className="inbound-dialog">
          <div className="dialog-box">
            <h3 className="dialog-title">Tambah Item Baru</h3>
            <div className="id-modal-note">
              Item baru akan ditambahkan dengan status <strong>Draft</strong>. Lakukan "Submit Booking" setelah selesai menambahkan item ini.
            </div>
            <div className="dialog-grid">
              <div className="dialog-field dialog-field-full">
                <label>Pilih Produk</label>
                <select value={aProduk} onChange={(e) => {
                  const p = produkList.find((x) => x.id_produk === angka(e.target.value));
                  setAProduk(angka(e.target.value));
                  setASatuan(p?.satuan || "");
                }}>
                  <option value="0">-- Pilih Produk --</option>
                  {produkList.map((p) => (
                    <option key={p.id_produk} value={p.id_produk}>{p.id_produk} - {p.nama_produk}</option>
                  ))}
                </select>
              </div>
              <div className="dialog-field dialog-field-full">
                <label>Jumlah ({aSatuan || "PCS"})</label>
                <input type="number" min={1} value={aJumlah} onChange={(e) => setAJumlah(e.target.value)} />
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-cancel" onClick={() => setShowAddItem(false)}>Batal</button>
              <button type="button" className="dialog-btn dialog-btn-save" disabled={busy} onClick={simpanAddItem}>Simpan Item Baru</button>
            </div>
          </div>
        </dialog>
      )}

      {showHeader && first && (
        <dialog open className="inbound-dialog">
          <div className="dialog-box">
            <h3 className="dialog-title">Edit Detail Inbound</h3>
            <div className="dialog-grid">
              <div className="dialog-field">
                <label>Tanggal Masuk</label>
                <input type="date" value={hTanggal} onChange={(e) => setHTanggal(e.target.value)} />
              </div>
              <div className="dialog-field">
                <label>No Mobil</label>
                <input type="text" value={hMobil} onChange={(e) => setHMobil(e.target.value)} maxLength={30} />
              </div>
              <div className="dialog-field">
                <label>No DN</label>
                <input type="text" value={hDn} onChange={(e) => setHDn(e.target.value)}
                  readOnly={["Secondary", "REJECT"].includes(norm(first.tipe_penerimaan))} maxLength={30} />
              </div>
              <div className="dialog-field">
                <label>Nama Driver</label>
                <input type="text" value={hDriver} onChange={(e) => setHDriver(e.target.value)} maxLength={30} />
              </div>
              <div className="dialog-field dialog-field-full">
                <label>Asal Pabrik</label>
                <PlantPicker plants={plants} value={hAsal} onChange={setHAsal} />
              </div>
              <div className="dialog-field dialog-field-full">
                <label>Catatan</label>
                <textarea value={hCatatan} onChange={(e) => setHCatatan(e.target.value)} maxLength={250} />
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-cancel" onClick={() => setShowHeader(false)}>Batal</button>
              <button type="button" className="dialog-btn dialog-btn-save" disabled={busy} onClick={simpanHeader}>Simpan Perubahan</button>
            </div>
          </div>
        </dialog>
      )}

      {showItem && (
        <dialog open className="inbound-dialog">
          <div className="dialog-box">
            <h3 className="dialog-title">Edit Item Inbound</h3>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)", marginBottom: 12, textTransform: "uppercase" }}>
              {norm(showItem.nama_produk)}
            </div>
            <div className="dialog-grid">
              <div className="dialog-field dialog-field-full">
                <label>Jumlah Saat Ini</label>
                <input type="text" value={`${showItem.jumlah} ${norm(showItem.satuan)}`} readOnly />
              </div>
              <div className="dialog-field">
                <label>Jumlah Baru</label>
                <input type="number" min={0} value={iJumlah} onChange={(e) => setIJumlah(e.target.value)} />
              </div>
              <div className="dialog-field">
                <label>Best Before</label>
                <input type={(showItem.tipe_penerimaan || "").toUpperCase() === "REJECT" ? "text" : "date"}
                  value={(showItem.tipe_penerimaan || "").toUpperCase() === "REJECT" ? "9999/99/99" : iBestBefore}
                  readOnly={(showItem.tipe_penerimaan || "").toUpperCase() === "REJECT" || showItem.status.toLowerCase() === "selesai"}
                  onChange={(e) => setIBestBefore(e.target.value)} />
              </div>
              {angka(iJumlah) === 0 && (showItem.tipe_penerimaan || "").toUpperCase() === "SECONDARY" && (
                <div className="dialog-field dialog-field-full">
                  <label>Catatan <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="text" value={iCatatan} onChange={(e) => setICatatan(e.target.value)}
                    placeholder="Wajib diisi jika jumlah 0 (contoh: Tidak diterima / Rusak)" maxLength={250} />
                </div>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-cancel" onClick={() => setShowItem(null)}>Batal</button>
              <button type="button" className="dialog-btn dialog-btn-save" disabled={busy} onClick={simpanJumlah}>Simpan Jumlah</button>
            </div>
          </div>
        </dialog>
      )}

      {confirmAll && (
        <ConfirmDialog title="Hapus Semua Item"
          message={`Hapus semua item inbound (<strong>${items.length}</strong>)?`}
          onCancel={() => setConfirmAll(false)} onOk={hapusSemua} busy={busy} />
      )}
      {confirmOne && (
        <ConfirmDialog title="Hapus Item"
          message={`Hapus item <strong>${norm(confirmOne.nama_produk)}</strong>?`}
          onCancel={() => setConfirmOne(null)} onOk={hapusSatu} busy={busy} />
      )}
    </div>
  );
}

function ConfirmDialog({ title, message, onCancel, onOk, busy }: {
  title: string; message: string; onCancel: () => void; onOk: () => void; busy?: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 18, width: "100%", maxWidth: 440, boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)", overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 14px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            <i className="bi bi-trash3"></i>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.2px" }}>{title}</div>
        </div>
        <div style={{ padding: "0 22px 20px", fontSize: 13, fontWeight: 600, color: "#475569", lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: message }} />
        <div style={{ padding: "14px 22px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onCancel} disabled={busy}
            style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Batal
          </button>
          <button type="button" onClick={onOk} disabled={busy}
            style={{ height: 38, padding: "0 20px", borderRadius: 10, border: 0, background: "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(239, 68, 68, 0.25)" }}>
            {busy ? "Memproses..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlantPicker({ plants, value, onChange }: { plants: Plant[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = plants.filter((p) => {
    const label = `${p.id_plant} - ${p.nama_plant}`.toUpperCase();
    return q.trim() === "" || label.includes(q.trim().toUpperCase());
  });
  return (
    <div className="inbound-picker-wrap">
      <button type="button" className="inbound-picker-button" onClick={() => setOpen((o) => !o)}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {norm(value) || "Pilih asal pabrik"}
        </span>
        <i className="bi bi-search"></i>
      </button>
      {open && (
        <div className="inbound-picker-panel show">
          <input type="text" className="inbound-picker-search" placeholder="Cari asal pabrik" value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="inbound-option-list">
            {filtered.map((p) => (
              <button key={p.id_plant} type="button" className={`inbound-option ${value === `${p.id_plant} - ${p.nama_plant}` ? "selected" : ""}`}
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