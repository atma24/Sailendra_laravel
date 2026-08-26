"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { aktifLokasiId, isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import { useToast } from "@/components/ToastProvider";

type Produk = { id_produk: number; nama_produk: string; satuan: string };
type Rencana = {
  block: string; line: string; level: string; deep: string;
  jumlah_rencana: number; batch: string; best_before: string; label_lokasi?: string;
};
type BkDetail = {
  id_barang_keluar: number;
  id_pengguna_lokasi: string;
  id_pengguna: number;
  id_produk: number;
  dibuat_oleh: string;
  nama_produk: string;
  jumlah: number;
  satuan: string;
  tanggal_keluar: string;
  tipe_pengeluaran: string;
  tujuan: string;
  best_before: string;
  batch: string;
  lokasi_block: string;
  catatan: string;
  no_mobil: string;
  nama_driver: string;
  gin_no: string;
  so_number: string;
  ritase: string;
  status: string;
  waktu_mulai_input: string;
  rencana_deep?: Rencana[];
  catatan_perubahan?: string;
  diperbarui_nama?: string;
  diperbarui_pada?: string;
};

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();

const css = `
.outbound-detail-page { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; }
.od-card { background: #FFFFFF; border: 1px solid #e7ebf3; border-radius: 12px; box-shadow: none; }
.od-head { padding: 12px; }
.od-back-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; margin-bottom: 10px; }
.od-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.25); transform: translateY(-1px); }
.od-detail-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 9px; }
.od-section-title { font-size: 13px; font-weight: 900; color: var(--text-main); margin: 0; letter-spacing: -0.15px; }
.od-icon-btn { width: 27px; height: 27px; border: 0; background: transparent; color: #4b5563; border-radius: 8px; display: inline-flex; justify-content: center; align-items: center; font-size: 12px; flex-shrink: 0; cursor: pointer; }
.od-icon-btn:hover { background: #f3f4f6; color: var(--primary); }
.od-detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 7px; }
.od-text-row { border: 1px solid #edf0f6; background: #fbfcff; border-radius: 9px; padding: 8px 10px; min-height: 51px; display: flex; flex-direction: column; justify-content: center; }
.od-text-label { font-size: 9.5px; color: #8b8fa3; font-weight: 850; margin-bottom: 4px; line-height: 1.1; }
.od-text-value { font-size: 11.5px; color: #111827; font-weight: 900; line-height: 1.25; word-break: break-word; }
.od-actions { display: flex; flex-direction: column; gap: 7px; }
.od-delete-all { border: 0; width: 100%; min-height: 35px; border-radius: 9px; background: #f43f3a; color: #FFFFFF; font-size: 12px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
.od-delete-all:hover { filter: brightness(1.03); }
.od-delete-all:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
.od-status-steps { display: flex; flex-direction: column; gap: 7px; width: 100%; }
.od-step-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 35px; padding: 0 18px; border-radius: 9px; border: 0; background: #f3f4f6; color: #9ca3af; font-size: 12px; font-weight: 900; cursor: not-allowed; white-space: nowrap; }
.od-step-next { background: var(--primary, #1a56db); color: #fff; cursor: pointer; }
.od-step-next:hover { filter: brightness(1.08); }
.od-item-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 9px; }
.od-item-card { padding: 11px; border: 1px solid rgba(25,25,112,0.18); border-radius: 11px; background: #fbfcff; }
.od-item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 9px; margin-bottom: 9px; }
.od-product-name { font-size: 13px; font-weight: 900; color: #111827; line-height: 1.3; letter-spacing: -0.1px; }
.od-item-icons { display: flex; gap: 3px; align-items: center; flex-shrink: 0; }
.od-check { width: 22px; height: 22px; border-radius: 50%; background: #1f2937; color: #FFFFFF; display: inline-flex; justify-content: center; align-items: center; font-size: 11px; }
.od-rencana-box { margin-top: 8px; padding: 9px 10px; border-radius: 9px; background: #f4f6ff; border: 1px solid #e2e7ff; }
.od-rencana-title { color: #191970; font-size: 11px; font-weight: 900; margin-bottom: 6px; }
.od-rencana-line { font-size: 11px; font-weight: 800; color: #374151; margin-bottom: 3px; line-height: 1.35; }
.od-rencana-meta { font-size: 10px; color: #6b7280; font-weight: 750; line-height: 1.35; }
.od-qr-btn { margin-top: 8px; border: 1px solid #191970; color: #191970; background: #FFFFFF; border-radius: 8px; min-height: 29px; padding: 0 10px; font-size: 11px; font-weight: 900; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.od-qr-btn:hover { background: #f4f6ff; }
.od-empty { padding: 13px; color: var(--text-soft); font-size: 11px; font-weight: 850; }
.od-item-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.od-add-item-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: var(--primary); color: #fff; border: none; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.od-modal-note { background: #f4f6ff; border: 1px solid #d7dcff; color: #191970; border-radius: 9px; padding: 8px 9px; font-size: 11px; font-weight: 800; margin-bottom: 10px; }
.od-item-card hr { margin: 9px 0 0; border-color: #dfe3ee; }
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
.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; white-space: nowrap; }
.penyesuaian-box { font-size: 10.5px; color: #6b7280; font-weight: 750; line-height: 1.5; margin-top: 9px; padding-top: 9px; border-top: 1px solid #dfe3ee; }
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
@media (max-width: 1100px) { .od-detail-grid, .od-item-list { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 768px) {
  .od-detail-grid, .od-item-list, .dialog-grid { grid-template-columns: 1fr; }
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}
`;

const statusStyle = (s: string): { bg: string; color: string } => {
  const st = (s || "").toLowerCase();
  if (st === "pending") return { bg: "#fef3c7", color: "#92400e" };
  if (st === "selesai" || st === "confirmed") return { bg: "#d1fae5", color: "#065f46" };
  return { bg: "#e5e7eb", color: "#4b5563" };
};

export default function OutboundDetailPage() {
  const { toast } = useToast();
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const router = useRouter();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const driver = searchParams.get("driver") || "";
  const lok = searchParams.get("lok") || "";

  const [items, setItems] = useState<BkDetail[]>([]);
  const [header, setHeader] = useState<BkDetail | null>(null);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  const toastSeq = useRef(0);

  const [showHeader, setShowHeader] = useState(false);
  const [showItem, setShowItem] = useState<BkDetail | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmOne, setConfirmOne] = useState<BkDetail | null>(null);
  // --- Script Tambahan Timer ---
  const waktuMulaiRef = useRef<Date | null>(null);

  // header form
  const [hMobil, setHMobil] = useState("");
  const [hDriver, setHDriver] = useState("");
  const [hCatatan, setHCatatan] = useState("");

  // item form (edit)
  const [iJumlah, setIJumlah] = useState("");
  const [iCatatan, setICatatan] = useState("");
  const [iMode, setIMode] = useState("fefo");
  const [iProdukBaru, setIProdukBaru] = useState(0);
  const [iLine, setILine] = useState(0);
  const [iBatch, setIBatch] = useState("");
  const [iBestBefore, setIBestBefore] = useState("");
  const [manualLok, setManualLok] = useState<{ id_lokasi: number; nama_lokasi: string }[]>([]);
  const [manualBlock, setManualBlock] = useState<{ id_block: number; kode_block: string }[]>([]);
  const [manualLine, setManualLine] = useState<{ id_line: number; nomor_line: string }[]>([]);
  const [manualBatch, setManualBatch] = useState<{ batch: string; best_before: string }[]>([]);

  // add item form
  const [aProduk, setAProduk] = useState(0);
  const [aJumlah, setAJumlah] = useState("");
  const [aSatuan, setASatuan] = useState("");
  const [aCatatan, setACatatan] = useState("");

  const notify = (type: string, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, type, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : 6000);
  };
  const closeToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const idPenggunaLokasi = () => (session ? aktifLokasiId(session) : "");

  useEffect(() => {
    if (!session || !tanggal || !driver) return;
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
        const r = await apiGet<BkDetail[]>(`/barang-keluar?${sp.toString()}`);
        if (cancelled) return;
        const rows = r.data || [];
        const myRows = rows.filter((x) => (norm(x.nama_driver) || "Tanpa nama driver") === driver);
        const firstId = angka(myRows[0]?.id_barang_keluar);

        const [pr] = await Promise.all([
          apiGet<Produk[]>("/produk?limit=2000"),
        ]);
        if (firstId > 0) {
          const dsp = new URLSearchParams();
          dsp.append("id_barang_keluar", String(firstId));
          dsp.append("id_pengguna_lokasi", String(myRows[0]?.id_pengguna_lokasi || idPenggunaLokasi()));
          const d = await apiGet<{ data: BkDetail; items: BkDetail[] }>(`/barang-keluar/detail?${dsp.toString()}`);
          if (!cancelled) {
            const fetchedHeader = d.data?.data || null;
            setHeader(fetchedHeader);
            setItems(d.data?.items || []);
            
            // --- Script Tambahan Timer (Revisi) ---
            if (fetchedHeader?.waktu_mulai_input) {
              // Jika di DB sudah ada waktu mulainya, teruskan dari waktu tersebut
              // Replace '-' dengan '/' agar aman di-parse oleh browser Safari/iOS
              const parsedDate = new Date(fetchedHeader.waktu_mulai_input.replace(/-/g, '/'));
              waktuMulaiRef.current = parsedDate;
            } else {
              // Jika belum ada sama sekali di DB (baru pertama buka Draft), catat waktu sekarang
              waktuMulaiRef.current = new Date();
            }
            // --------------------------------------
          }
        }
        if (!cancelled) setProdukList((pr.data || []).sort((a, b) => angka(a.id_produk) - angka(b.id_produk)));
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tanggal, driver, lok, multi]);

  if (!session || !loaded) return null;

  const status = norm(header?.status || "");
  const statusLower = status.toLowerCase();
  const isSelesai = statusLower === "selesai" || statusLower === "confirmed";
  const isDraft = statusLower === "draft";
  const isPending = statusLower === "pending";
  const canCrud = ["SuperAdmin", "Supervisor", "Checker"].includes(session.user.role);
  const canEditHeader = isDraft && canCrud;
  const canEditItem = (isDraft || isSelesai) && canCrud;
  const canDelete = (isDraft || isPending) && canCrud;
  const firstId = angka(header?.id_barang_keluar || items[0]?.id_barang_keluar || 0);
  const totalQty = items.reduce((s, it) => s + angka(it.jumlah), 0);
  const backHref = `/outbound/driver/${encodeURIComponent(tanggal)}${lok ? `?lok=${encodeURIComponent(lok)}` : ""}`;

  const openHeader = () => {
    setHMobil(norm(header?.no_mobil));
    setHDriver(norm(header?.nama_driver) || driver);
    setHCatatan(norm(header?.catatan));
    setShowHeader(true);
  };

  const simpanHeader = async () => {
    if (!header || firstId <= 0) return;
    if (norm(hMobil) === "" || norm(hDriver) === "") { notify("error", "No Mobil dan Nama Driver wajib diisi."); return; }
    setBusy(true);
    try {
      await apiPost("/barang-keluar/update", {
        id_barang_keluar: firstId,
        id_pengguna_lokasi: String(header.id_pengguna_lokasi || idPenggunaLokasi()),
        no_mobil: hMobil,
        nama_driver: hDriver,
        catatan: hCatatan,
      });
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Detail outbound berhasil diperbarui.", type: "success" }));
      setShowHeader(false);
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Detail outbound gagal diperbarui.");
    } finally { setBusy(false); }
  };

  const openItem = (it: BkDetail) => {
    setShowItem(it);
    setIJumlah(String(it.jumlah));
    setICatatan(norm(it.catatan_perubahan));
    setIMode("fefo");
    setIProdukBaru(0);
    setILine(0);
    setIBatch("");
    setIBestBefore("");
    setManualLok([]); setManualBlock([]); setManualLine([]); setManualBatch([]);
  };

  const simpanItem = async () => {
    if (!showItem) return;
    const j = angka(iJumlah);
    if (j < 0 || (j <= 0 && !isDraft)) { notify("error", "Jumlah tidak valid."); return; }
    if (isSelesai && norm(iCatatan) === "") { notify("error", "Catatan penyesuaian wajib diisi."); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        id_barang_keluar: showItem.id_barang_keluar,
        id_pengguna_lokasi: String(showItem.id_pengguna_lokasi || idPenggunaLokasi()),
        jumlah: j,
        jumlah_item: j,
        mode_lokasi: iMode,
      };
      if (isSelesai) {
        payload.aksi = "ubah_item_selesai";
        payload.catatan_perubahan = iCatatan;
        payload.diperbarui_oleh = session.user.username;
      } else if (isDraft) {
        payload.aksi = "ubah_item_jumlah";
        if (iProdukBaru > 0) payload.id_produk_baru = iProdukBaru;
        if (iMode === "manual") {
          payload.id_line = iLine;
          payload.batch = iBatch;
          payload.best_before = iBestBefore;
        }
      }
      await apiPost("/barang-keluar/update", payload);
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Item outbound berhasil diperbarui.", type: "success" }));
      setShowItem(null);
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Item outbound gagal diperbarui.");
    } finally { setBusy(false); }
  };

  const stokUrl = (mode: string, extra: Record<string, unknown>) => {
    const p = new URLSearchParams();
    p.set("mode", mode);
    p.set("id_produk", String(showItem?.id_produk || 0));
    p.set("id_pengguna_lokasi", String(showItem?.id_pengguna_lokasi || idPenggunaLokasi()));
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    return `/stok?${p.toString()}`;
  };

  const loadManualLokasi = async () => {
    if (!showItem) return;
    setBusy(true);
    try {
      const r = await apiGet<{ data?: { id_lokasi: number; nama_lokasi: string }[] }>(stokUrl("manual_lokasi", {}));
      setManualLok(r.data?.data || []);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const pickManualBlock = async (idLokasi: number) => {
    setBusy(true);
    try {
      const r = await apiGet<{ data?: { id_block: number; kode_block: string }[] }>(stokUrl("manual_block", { id_lokasi: idLokasi }));
      setManualBlock(r.data?.data || []);
      setManualLine([]); setManualBatch([]);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const pickManualLine = async (idBlock: number) => {
    setBusy(true);
    try {
      const r = await apiGet<{ data?: { id_line: number; nomor_line: string }[] }>(stokUrl("manual_line", { id_block: idBlock }));
      setManualLine(r.data?.data || []);
      setManualBatch([]);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const pickManualBatch = async (idLine: number) => {
    setBusy(true);
    try {
      const r = await apiGet<{ data?: { batch: string; best_before: string }[] }>(stokUrl("manual_batch", { id_line: idLine }));
      setManualBatch(r.data?.data || []);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const openAddItem = () => {
    setAProduk(0); setAJumlah(""); setASatuan(""); setACatatan("");
    setShowAddItem(true);
  };

  const simpanAddItem = async () => {
    if (aProduk <= 0) { notify("error", "Produk wajib dipilih."); return; }
    if (angka(aJumlah) <= 0) { notify("error", "Jumlah tidak valid."); return; }
    if (isSelesai && norm(aCatatan) === "") { notify("error", "Catatan penambahan wajib diisi."); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        id_pengguna_lokasi: String(header?.id_pengguna_lokasi || idPenggunaLokasi()),
        id_pengguna: session.user.id_pengguna,
        id_produk: aProduk,
        jumlah: angka(aJumlah),
        satuan: aSatuan || "PCS",
        status_saat_ini: statusLower,
        tanggal,
        nama_driver: driver,
        no_mobil: norm(header?.no_mobil),
        tipe_pengeluaran: norm(header?.tipe_pengeluaran),
      };
      if (isSelesai) {
        payload.aksi = "tambah_item_selesai";
        payload.id_barang_keluar_ref = firstId;
        payload.catatan_perubahan = aCatatan;
        payload.diperbarui_oleh = session.user.username;
      } else {
        payload.aksi = "tambah_item_draft";
        payload.id_barang_keluar = firstId;
        payload.status = "Draft";
      }
      await apiPost("/barang-keluar/update", payload);
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Item baru berhasil ditambahkan.", type: "success" }));
      setShowAddItem(false);
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Gagal menambahkan item baru.");
    } finally { setBusy(false); }
  };

  const hapusSatu = async () => {
    if (!confirmOne) return;
    setBusy(true);
    try {
      await apiPost("/barang-keluar/hapus", {
        id_barang_keluar: confirmOne.id_barang_keluar,
        id_pengguna_lokasi: String(confirmOne.id_pengguna_lokasi || aktifLokasiId(session)),
      });
      sessionStorage.setItem(
        "sailendra_flash_toast",
        JSON.stringify({
          message: "Item outbound berhasil dihapus.",
          type: "success",
        })
      );
      setConfirmOne(null);
      window.location.reload();
    } catch (e) {
      toast((e as Error).message || "Gagal menghapus item.", "error");
    } finally { setBusy(false); }
  };

  const hapusSemua = async () => {
    setBusy(true);
    try {
      for (const it of items) {
        await apiPost("/barang-keluar/hapus", {
          id_barang_keluar: it.id_barang_keluar,
          id_pengguna_lokasi: String(it.id_pengguna_lokasi || aktifLokasiId(session)),
        });
      }
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Semua item outbound berhasil dihapus.", type: "success" }));
      setConfirmAll(false);
      router.push(backHref);
    } catch (e) {
      toast((e as Error).message || "Gagal menghapus semua item.", "error");
    } finally { setBusy(false); }
  };

  const ubahStatus = async (aksi: string) => {
    if (firstId <= 0) return;
    setBusy(true);
    try {
      // --- Script Tambahan Timer (Revisi) ---
      let waktuMulaiStr: string | undefined = undefined;
      let durasiDetik: number | undefined = undefined;

      if (waktuMulaiRef.current) {
        // Format Date ke YYYY-MM-DD HH:mm:ss untuk dikirim ke database
        const pad = (n: number) => n.toString().padStart(2, "0");
        const d = waktuMulaiRef.current;
        waktuMulaiStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

        // Durasi HANYA dihitung jika aksinya konfirmasi
        if (aksi === "konfirmasi") {
          const waktuSelesai = new Date();
          durasiDetik = Math.floor((waktuSelesai.getTime() - d.getTime()) / 1000);
        }
      }
      // --------------------------------------

      await apiPost("/barang-keluar/update", {
        id_barang_keluar: firstId,
        id_pengguna_lokasi: String(header?.id_pengguna_lokasi || idPenggunaLokasi()),
        aksi,
        // --- Sisipkan payload timer ---
        waktu_mulai_input: waktuMulaiStr, 
        durasi_detik: durasiDetik,
      });

      sessionStorage.setItem(
        "sailendra_flash_toast",
        JSON.stringify({
          message: aksi === "revert_to_draft" ? "Outbound dikembalikan ke Draft." : aksi === "konfirmasi" ? "Konfirmasi outbound berhasil." : "Outbound disubmit ke Pending.",
          type: "success",
        })
      );
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Gagal mengubah status.");
    } finally { setBusy(false); }
  };

  const ss = statusStyle(status);

  return (
    <div className="outbound-detail-page">
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

      <div className="od-card od-head">
        <Link className="od-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali ke driver</span>
        </Link>

        <div className="od-detail-top">
          <h3 className="od-section-title">Detail Pengeluaran</h3>
          {canEditHeader && (
            <button type="button" className="od-icon-btn" title="Edit Detail Outbound" onClick={openHeader}>
              <i className="bi bi-pencil-fill"></i>
            </button>
          )}
        </div>

        {!header ? (
          <div className="od-empty">Detail outbound tidak ditemukan.</div>
        ) : (
          <>
            <div className="od-detail-grid">
              <div className="od-text-row">
                <div className="od-text-label">Tanggal</div>
                <div className="od-text-value">{tanggal || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">Status</div>
                <div className="od-text-value">
                  <span className="status-badge" style={ss}>{status || "-"}</span>
                </div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">Tipe Pengeluaran</div>
                <div className="od-text-value">{norm(header.tipe_pengeluaran) || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">Trip/Ritase</div>
                <div className="od-text-value">{norm(header.ritase) || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">No Mobil</div>
                <div className="od-text-value">{norm(header.no_mobil) || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">Nama Driver</div>
                <div className="od-text-value">{driver || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">Tujuan</div>
                <div className="od-text-value">{norm(header.tujuan) || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">GIN No</div>
                <div className="od-text-value">{norm(header.gin_no) || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">Dibuat oleh</div>
                <div className="od-text-value">{norm(header.dibuat_oleh) || "-"}</div>
              </div>
              <div className="od-text-row">
                <div className="od-text-label">Total Qty</div>
                <div className="od-text-value">{totalQty}</div>
              </div>
              <div className="od-text-row" style={{ gridColumn: "span 2" }}>
                <div className="od-text-label">Catatan</div>
                <div className="od-text-value">{norm(header.catatan) || "-"}</div>
              </div>
            </div>

            {!isSelesai && (
              <div className="od-actions" style={{ marginTop: 8 }}>
                {canDelete && items.length > 0 && (
                  <button type="button" className="od-delete-all" onClick={() => setConfirmAll(true)}>
                    <i className="bi bi-trash"></i>
                    <span>Hapus Semua</span>
                  </button>
                )}
                {canCrud && (
                  <button type="button" className={`od-step-btn ${isPending ? "od-step-next" : ""}`}
                    disabled={!isPending} onClick={() => isPending && ubahStatus("revert_to_draft")}>
                    <i className="bi bi-file-earmark-text-fill"></i>
                    <span>Draft</span>
                  </button>
                )}
                {canCrud && (
                  <button type="button" className={`od-step-btn ${isDraft ? "od-step-next" : ""}`}
                    disabled={!isDraft} onClick={() => isDraft && ubahStatus("submit_draft")}>
                    <i className="bi bi-hourglass-split"></i>
                    <span>Submit</span>
                  </button>
                )}
                {(canCrud || session.user.role === "Forklift") && (
                  <button type="button" className={`od-step-btn ${isPending ? "od-step-next" : ""}`}
                    disabled={!isPending} onClick={() => isPending && ubahStatus("konfirmasi")}>
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Konfirmasi Outbound</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="od-item-title-row">
        <h3 className="od-section-title" style={{ margin: 0 }}>Item</h3>
        {canEditItem && (
          <button type="button" className="od-add-item-btn" onClick={openAddItem}>
            <i className="bi bi-plus-lg"></i>
            Tambah Item
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="od-card od-empty">Detail outbound tidak ditemukan.</div>
      ) : (
        <div className="od-item-list">
          {items.map((it) => {
            const rencana = it.rencana_deep || [];
            const penCatatan = norm(it.catatan_perubahan);
            const penOleh = norm(it.diperbarui_nama || "");
            const penPada = norm(it.diperbarui_pada);
            return (
              <div key={it.id_barang_keluar} className="od-item-card">
                <div className="od-item-top">
                  <div className="od-product-name">{norm(it.nama_produk) || "-"}</div>
                  <div className="od-item-icons">
                    {canEditItem && (
                      <button type="button" className="od-icon-btn" title="Edit Item" onClick={() => openItem(it)}>
                        <i className="bi bi-pencil-fill"></i>
                      </button>
                    )}
                    {canDelete ? (
                      <button type="button" className="od-icon-btn" title="Hapus Item" onClick={() => setConfirmOne(it)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    ) : (
                      <button type="button" className="od-icon-btn" disabled style={{ opacity: 0.4, cursor: "not-allowed" }}>
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                    {isSelesai && (
                      <span className="od-check"><i className="bi bi-check-lg"></i></span>
                    )}
                  </div>
                </div>
                <div className="od-text-row">
                  <div className="od-text-label">Jumlah</div>
                  <div className="od-text-value">{angka(it.jumlah)} {norm(it.satuan)}</div>
                </div>
                {!isDraft && (
                  <div className="od-rencana-box">
                    <div className="od-rencana-title">Lokasi yang akan diambil:</div>
                    {rencana.length > 0 ? (
                      rencana.map((r, ri) => (
                        <div key={ri}>
                          <div className="od-rencana-line">
                            Block {r.block || "-"} - Line {r.line || "-"} - L{r.level || "-"} - Deep {r.deep || "-"} = {angka(r.jumlah_rencana)}
                          </div>
                          <div className="od-rencana-meta">
                            Batch: {norm(r.batch) || "-"} | BB: {norm(r.best_before) || "-"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="od-rencana-line">Lokasi pengambilan belum tersedia.</div>
                    )}
                  </div>
                )}
                {(penCatatan !== "" || penOleh !== "") && (
                  <div className="penyesuaian-box">
                    {penOleh !== "" && (
                      <div><i className="bi bi-person-fill" style={{ color: "#374151" }}></i> Diubah oleh: <strong style={{ color: "#374151" }}>{penOleh}</strong>{penPada !== "" ? ` (${penPada})` : ""}</div>
                    )}
                    {penCatatan !== "" && (
                      <div style={{ marginTop: 2 }}><i className="bi bi-card-text" style={{ color: "#374151" }}></i> {penCatatan}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showHeader && header && (
        <dialog open className="inbound-dialog">
          <div className="dialog-box">
            <h3 className="dialog-title">Edit Detail Outbound</h3>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", margin: "0 0 10px" }}>
              <strong>Tipe Pengeluaran:</strong> {norm(header.tipe_pengeluaran) || "-"} · <strong>Tujuan:</strong> {norm(header.tujuan) || "-"}
            </p>
            <div className="dialog-grid">
              <div className="dialog-field dialog-field-full">
                <label>No Mobil</label>
                <input type="text" value={hMobil} onChange={(e) => setHMobil(e.target.value)} maxLength={30} />
              </div>
              <div className="dialog-field dialog-field-full">
                <label>Nama Driver</label>
                <input type="text" value={hDriver} onChange={(e) => setHDriver(e.target.value)} maxLength={30} />
              </div>
              <div className="dialog-field dialog-field-full">
                <label>Catatan (opsional)</label>
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
            <h3 className="dialog-title">Edit Item</h3>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)", marginBottom: 12, textTransform: "uppercase" }}>
              {norm(showItem.nama_produk)}
            </div>
            {isSelesai && (
              <div className="od-modal-note">
                Outbound sudah selesai. Sistem akan menghitung selisih jumlah baru dengan jumlah saat ini, lalu membuat &quot;Card Penyesuaian&quot; otomatis.
              </div>
            )}
            <div className="dialog-grid">
              {isDraft && (
                <div className="dialog-field dialog-field-full">
                  <label>Nama Produk</label>
                  <select value={iProdukBaru} onChange={(e) => setIProdukBaru(angka(e.target.value))}>
                    <option value="0">-- Tetap produk saat ini --</option>
                    {produkList.map((p) => (
                      <option key={p.id_produk} value={p.id_produk}>{p.id_produk} - {p.nama_produk}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="dialog-field dialog-field-full">
                <label>Jumlah Akhir ({norm(showItem.satuan)})</label>
                <input type="number" min={0} value={iJumlah} onChange={(e) => setIJumlah(e.target.value)} />
              </div>
              {isSelesai && (
                <div className="dialog-field dialog-field-full">
                  <label>Catatan Penyesuaian (Wajib)</label>
                  <textarea value={iCatatan} onChange={(e) => setICatatan(e.target.value)} placeholder="Contoh: Barang pecah 2 pcs saat dimuat..." maxLength={250} />
                </div>
              )}
              {isDraft && (
                <>
                  <div className="dialog-field dialog-field-full">
                    <label>Mode Lokasi Pengambilan</label>
                    <select value={iMode} onChange={(e) => { setIMode(e.target.value); if (e.target.value === "manual") loadManualLokasi(); }}>
                      <option value="fefo">Otomatis FEFO</option>
                      <option value="manual">Pilih Manual</option>
                    </select>
                  </div>
                  {iMode === "manual" && (
                    <>
                      <div className="dialog-field">
                        <label>Lokasi</label>
                        <select onChange={(e) => pickManualBlock(angka(e.target.value))}>
                          <option value="0">Pilih Lokasi</option>
                          {manualLok.map((l) => <option key={l.id_lokasi} value={l.id_lokasi}>{l.nama_lokasi}</option>)}
                        </select>
                      </div>
                      <div className="dialog-field">
                        <label>Block</label>
                        <select onChange={(e) => pickManualLine(angka(e.target.value))}>
                          <option value="0">Pilih Block</option>
                          {manualBlock.map((b) => <option key={b.id_block} value={b.id_block}>Block {b.kode_block}</option>)}
                        </select>
                      </div>
                      <div className="dialog-field">
                        <label>Line</label>
                        <select onChange={(e) => pickManualBatch(angka(e.target.value))}>
                          <option value="0">Pilih Line</option>
                          {manualLine.map((l) => <option key={l.id_line} value={l.id_line}>Line {l.nomor_line}</option>)}
                        </select>
                      </div>
                      <div className="dialog-field">
                        <label>Batch</label>
                        <select value={iBatch} onChange={(e) => {
                          const sel = manualBatch.find((b) => b.batch === e.target.value);
                          setIBatch(e.target.value);
                          setIBestBefore(sel?.best_before || "");
                        }}>
                          <option value="">Pilih Batch</option>
                          {manualBatch.map((b) => <option key={b.batch} value={b.batch}>{b.batch} | BB {b.best_before || "-"}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-cancel" onClick={() => setShowItem(null)}>Batal</button>
              <button type="button" className="dialog-btn dialog-btn-save" disabled={busy} onClick={simpanItem}>Simpan Perubahan</button>
            </div>
          </div>
        </dialog>
      )}

      {showAddItem && (
        <dialog open className="inbound-dialog">
          <div className="dialog-box">
            <h3 className="dialog-title">Tambah Item Baru</h3>
            {isSelesai && (
              <div className="od-modal-note">
                Outbound sudah selesai. Item baru akan memotong stok otomatis (FEFO) dan tercatat sebagai penambahan baru di history.
              </div>
            )}
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
              <div className="dialog-field">
                <label>Jumlah ({aSatuan || "PCS"})</label>
                <input type="number" min={1} value={aJumlah} onChange={(e) => setAJumlah(e.target.value)} />
              </div>
              {isSelesai && (
                <div className="dialog-field dialog-field-full">
                  <label>Catatan Penambahan (Wajib)</label>
                  <textarea value={aCatatan} onChange={(e) => setACatatan(e.target.value)} placeholder="Contoh: Ada produk baru susulan..." />
                </div>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-cancel" onClick={() => setShowAddItem(false)}>Batal</button>
              <button type="button" className="dialog-btn dialog-btn-save" disabled={busy} onClick={simpanAddItem}>Simpan Item Baru</button>
            </div>
          </div>
        </dialog>
      )}

      {showQr && (
        <dialog open className="inbound-dialog" style={{ width: "min(360px, calc(100% - 30px))" }}>
          <div className="dialog-box" style={{ textAlign: "center" }}>
            <h3 className="dialog-title">QR Batch</h3>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(showQr)}`}
              alt="QR Batch" style={{ width: 200, height: 200, border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }} />
            <div style={{ fontSize: 13, marginTop: 12 }}>Batch: <strong>{showQr}</strong></div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-save" style={{ width: "100%" }} onClick={() => setShowQr(null)}>Tutup</button>
            </div>
          </div>
        </dialog>
      )}

      {confirmAll && (
        <ConfirmDialog title="Hapus Semua Item"
          message={`Yakin ingin menghapus SEMUA item outbound ini (<strong>${items.length}</strong>)?`}
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