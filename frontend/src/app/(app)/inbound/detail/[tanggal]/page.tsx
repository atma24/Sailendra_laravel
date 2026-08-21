"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { aktifLokasiId, isMultiRole, lokasiParam, useSession } from "@/lib/auth";

type BmRow = {
  id_barang_masuk: number;
  id_pengguna_lokasi: string;
  id_pengguna: number;
  dibuat_oleh: string;
  nama_produk: string;
  id_produk: number;
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
  status: string;      // --- TAMBAHAN BARU ---
  shipment_id: string; // --- TAMBAHAN BARU ---
};

type Plant = { id_plant: string; nama_plant: string };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const bbDisplay = (bb: string, tipe: string) =>
  bb === "9999-12-31" && tipe.toUpperCase() === "REJECT" ? "9999/99/99" : bb;

const PRODUK_TANPA_BATCH = [10516938, 10516939];

const css = `
.inbound-page { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e7ebf3; border-radius: 12px; box-shadow: none; }
.detail-head { padding: 12px; }
.detail-back-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; margin-bottom: 10px; }
.detail-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.25); transform: translateY(-1px); }
.detail-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 9px; }
.detail-title { font-size: 13px; font-weight: 900; color: var(--text-main); letter-spacing: -0.15px; }
.detail-action-btn, .detail-icon-btn { width: 27px; height: 27px; border: 0; background: transparent; color: #4b5563; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; }
.detail-action-btn:hover, .detail-icon-btn:hover { background: #f3f4f6; color: var(--primary); }
.detail-icon-danger:hover { background: #fee2e2; color: #dc2626; }
.detail-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 7px; }
.detail-stat { border: 1px solid #edf0f6; background: #fbfcff; border-radius: 9px; padding: 8px 10px; min-height: 51px; display: flex; flex-direction: column; justify-content: center; }
.detail-stat-wide { grid-column: span 2; }
.detail-stat-label { font-size: 9.5px; color: #8b8fa3; font-weight: 850; margin-bottom: 4px; }
.detail-stat-value { font-size: 11.5px; color: #111827; font-weight: 900; line-height: 1.25; word-break: break-word; }
.detail-item-title { font-size: 13px; font-weight: 900; color: var(--text-main); margin-bottom: 9px; letter-spacing: -0.15px; display: flex; justify-content: space-between; align-items: center; }
.detail-item-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 9px; }
.detail-item-card { border: 1px solid rgba(25,25,112,0.16); border-radius: 11px; background: #fbfcff; padding: 11px 12px; }
.detail-product { font-size: 13px; font-weight: 900; color: #111827; line-height: 1.3; word-break: break-word; display: flex; align-items: center; gap: 6px; }
.detail-item-sub { font-size: 10.5px; font-weight: 750; color: #6b7280; margin-top: 3px; }
.detail-row-actions { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
.detail-item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 9px; }
.detail-empty { padding: 13px; color: var(--text-soft); font-size: 11px; font-weight: 850; }
.detail-alert { border-radius: 9px; padding: 8px 10px; font-size: 11px; font-weight: 850; border: 1px solid transparent; margin-bottom: 10px; }
.detail-alert-success { background: #ecfdf3; border-color: #bbf7d0; color: #166534; }
.detail-alert-error { background: #fff1f2; border-color: #fecdd3; color: #be123c; }

/* Status Badge */
.status-badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
.status-draft { background: #fef3c7; color: #ca8a04; border: 1px solid #fde047; }
.status-pending { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }
.status-selesai { background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; }

/* Form inputs for Draft */
.draft-bb-input { width: 100%; border-radius: 6px; border: 1px solid #e2e7f0; padding: 4px 8px; font-size: 10.5px; font-weight: 750; outline: none; margin-top: 6px; }
.draft-bb-input:focus { border-color: var(--primary); }
.draft-bb-input:disabled { background: #f3f4f6; color: #9ca3af; }

/* --- BUTTONS MIRIP OUTBOUND --- */
.inbound-actions { display: flex; flex-direction: column; gap: 7px; }
.inbound-delete-all { border: 0; width: 100%; min-height: 35px; border-radius: 9px; background: #f43f3a; color: #FFFFFF; font-size: 12px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
.inbound-delete-all:hover { filter: brightness(1.03); }
.inbound-delete-all:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
.inbound-step-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 35px; padding: 0 18px; border-radius: 9px; border: 0; background: #f3f4f6; color: #9ca3af; font-size: 12px; font-weight: 900; cursor: not-allowed; white-space: nowrap; }
.inbound-step-next { background: var(--primary, #1a56db); color: #fff; cursor: pointer; }
.inbound-step-next:hover { filter: brightness(1.08); }

.inbound-dialog { border: 0; border-radius: 12px; padding: 0; width: min(440px, calc(100% - 30px)); max-height: 85vh; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.15); background: #FFFFFF; }
.dialog-box { padding: 20px 24px; max-height: 85vh; overflow-y: auto; }
.dialog-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: var(--text-main); }
.dialog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dialog-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dialog-field-full { grid-column: 1 / -1; }
.dialog-field label { font-size: 12px; font-weight: 600; color: var(--text-main); }
.dialog-field input, .dialog-field textarea, .dialog-field select { width: 100%; min-height: 36px; border: 1px solid #dedede; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; outline: none; background: #fbfcff; color: var(--text-main); }
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
@media (max-width: 768px) {
  .detail-stat-grid, .detail-item-list, .dialog-grid { grid-template-columns: 1fr; }
  .detail-stat-wide { grid-column: span 1; }
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}
`;

export default function InboundDetailPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const driver = searchParams.get("driver") || "";
  const shipment = searchParams.get("shipment") || "";
  const lok = searchParams.get("lok") || "";

  const [rows, setRows] = useState<BmRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [showItem, setShowItem] = useState<BmRow | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmOne, setConfirmOne] = useState<BmRow | null>(null);

  // State untuk Draft -> Pending (Submit BB)
  const [draftBb, setDraftBb] = useState<Record<number, string>>({});

  // header form state
  const [hTanggal, setHTanggal] = useState("");
  const [hMobil, setHMobil] = useState("");
  const [hDn, setHDn] = useState("");
  const [hDriver, setHDriver] = useState("");
  const [hAsal, setHAsal] = useState("");
  const [hCatatan, setHCatatan] = useState("");
  const [hBestBefore, setHBestBefore] = useState("");

  // item form state
  const [iJumlah, setIJumlah] = useState("");
  const [iBestBefore, setIBestBefore] = useState("");

  let toastSeq = 0;
  const notify = (type: string, msg: string) => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, type, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : 6000);
  };

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
        const [r, pr] = await Promise.all([
          apiGet<BmRow[]>(`/barang-masuk?${sp.toString()}`),
          apiGet<Plant[]>("/plant"),
        ]);
        if (cancelled) return;
        setRows(r.data || []);
        setPlants((pr.data || []).sort((a, b) => String(a.id_plant).localeCompare(String(b.id_plant))));
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, tanggal, lok, multi]);

  if (!session || !loaded) return null;

  const items = rows.filter((r) => {
    const sameDriver = ((r.nama_driver || "").trim() || "Tanpa nama driver") === driver;
    const sameShip = !shipment || (r.shipment_id || "") === shipment;
    return sameDriver && sameShip;
  }).sort((a, b) => angka(b.id_barang_masuk) - angka(a.id_barang_masuk));

  const first = items[0];
  const isSupervisor = ["Supervisor", "SuperAdmin"].includes(session.user.role);
  const backHref = `/inbound/driver/${encodeURIComponent(tanggal)}${lok ? `?lok=${encodeURIComponent(lok)}` : ""}`;

  // Cek Status Group
  const hasDraft = items.some(i => (i.status || "").toLowerCase() === "draft");
  const hasPending = items.some(i => (i.status || "").toLowerCase() === "pending");
  const isSelesaiAll = items.every(i => (i.status || "selesai").toLowerCase() === "selesai");

  // ==========================================
  // FUNGSI MULTI-STEP INBOUND (DRAFT -> PENDING -> SELESAI)
  // ==========================================
  const submitDraftBooking = async () => {
    setBusy(true);
    try {
      const payloadItems = items.filter(i => (i.status || "").toLowerCase() === "draft").map(i => {
         const isRej = (i.tipe_penerimaan || "").toUpperCase() === "REJECT";
         const noBatch = PRODUK_TANPA_BATCH.includes(angka(i.id_produk)) || /JUG (AQUA|VIT) 19L PC 55 MM/i.test(i.nama_produk || "");
         
         const bb = isRej || noBatch ? "9999-12-31" : (draftBb[i.id_barang_masuk] || "");
         if (!bb) throw new Error(`Best before untuk ${i.nama_produk} belum diisi.`);
         
         return { id_barang_masuk: i.id_barang_masuk, best_before: bb };
      });
      
      await apiPost('/barang-masuk/submit', {
         shipment_id: first.shipment_id || "",
         id_pengguna_lokasi: aktifLokasiId(session),
         items: payloadItems
      });
      
      notify("success", "Booking lokasi berhasil! Status berubah menjadi Pending.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      notify("error", e.message || "Gagal melakukan submit booking.");
    } finally {
      setBusy(false);
    }
  };

  const konfirmasiPending = async () => {
    setBusy(true);
    try {
      await apiPost('/barang-masuk/konfirmasi', {
         shipment_id: first.shipment_id || "",
         id_barang_masuk: first.shipment_id ? 0 : first.id_barang_masuk,
         id_pengguna_lokasi: aktifLokasiId(session)
      });
      notify("success", "Konfirmasi berhasil! Stok telah fisik ditambahkan.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      notify("error", e.message || "Gagal melakukan konfirmasi.");
    } finally {
      setBusy(false);
    }
  };
  // ==========================================

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
      notify("success", "Detail inbound berhasil diperbarui.");
      setShowHeader(false);
      router.refresh();
      window.location.reload();
    } catch (e) {
      notify("error", (e as Error).message || "Detail inbound gagal diperbarui.");
    } finally { setBusy(false); }
  };

  const openItem = (item: BmRow) => {
    setShowItem(item);
    setIJumlah(String(item.jumlah));
    setIBestBefore(norm(item.best_before).slice(0, 10));
  };

  const simpanJumlah = async () => {
    if (!showItem) return;
    const j = angka(iJumlah);
    if (j <= 0) { notify("error", "Jumlah baru tidak valid."); return; }
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
      await apiPost("/barang-masuk/update", payload);
      notify("success", "Item inbound berhasil diperbarui.");
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
      notify("success", "Item inbound berhasil dihapus.");
      setConfirmOne(null);
      window.location.reload();
    } catch (e) {
      const m = (e as Error).message || "";
      const lower = m.toLowerCase();
      notify("error", (lower.includes("outbound") || lower.includes("dipakai") || lower.includes("rencana"))
        ? "Item ini tidak bisa dihapus karena sudah dipakai untuk outbound."
        : m);
    } finally { setBusy(false); }
  };

  const hapusSemua = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      for (const item of items) {
        await apiPost("/barang-masuk/hapus", { id_barang_masuk: item.id_barang_masuk });
      }
      notify("success", "Semua item inbound berhasil dihapus.");
      setConfirmAll(false);
      window.location.reload();
    } catch (e) {
      const m = (e as Error).message || "";
      const lower = m.toLowerCase();
      notify("error", (lower.includes("outbound") || lower.includes("dipakai") || lower.includes("rencana"))
        ? "Sebagian item tidak bisa dihapus karena sudah dipakai untuk outbound."
        : m);
    } finally { setBusy(false); }
  };

  const closeToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className="inbound-page">
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

      <div className="inbound-card detail-head">
        <Link className="detail-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali ke driver</span>
        </Link>

        <div className="detail-top">
          <div className="detail-title">Detail Penerimaan</div>
          {isSupervisor && !!items.length && (
            <button type="button" className="detail-action-btn" title="Edit detail inbound" onClick={openHeader}>
              <i className="bi bi-pencil-fill"></i>
            </button>
          )}
        </div>

        {!items.length ? (
          <div className="detail-empty">Detail inbound tidak ditemukan.</div>
        ) : (
          <>
            <div className="detail-stat-grid">
              <div className="detail-stat detail-stat-wide">
                <div className="detail-stat-label">Shipment ID</div>
                <div className="detail-stat-value">{norm(first.shipment_id) || "-"}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Tanggal Masuk</div>
                <div className="detail-stat-value">{tanggal || "-"}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Status</div>
                <div className="detail-stat-value">
                  <span className={`status-badge status-${(hasDraft ? 'draft' : hasPending ? 'pending' : 'selesai')}`}>
                    {hasDraft ? "Draft" : hasPending ? "Pending" : "Selesai"}
                  </span>
                </div>
              </div>
              <div className="detail-stat detail-stat-wide">
                <div className="detail-stat-label">Asal Pabrik</div>
                <div className="detail-stat-value">{norm(first.asal_pabrik) || "-"}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">No Mobil</div>
                <div className="detail-stat-value">{norm(first.no_mobil) || "-"}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Nama Driver</div>
                <div className="detail-stat-value">{driver || "-"}</div>
              </div>
            </div>

            {isSupervisor && (
              <div className="inbound-actions" style={{ marginTop: 8 }}>
                <button type="button" className="inbound-delete-all"
                  onClick={() => setConfirmAll(true)}>
                  <i className="bi bi-trash"></i>
                  <span>Hapus Semua ({items.length})</span>
                </button>
              </div>
            )}

            {/* ACTION BUTTONS (SUBMIT / KONFIRMASI) di atas Daftar Item */}
            <div className="inbound-actions" style={{ marginTop: 8 }}>
              {hasDraft && (
                <button type="button" className="inbound-step-btn inbound-step-next" disabled={busy} onClick={submitDraftBooking}>
                  {busy ? <i className="bi bi-arrow-clockwise stock-loader"></i> : <i className="bi bi-send-check-fill"></i>}
                  {busy ? "Memproses..." : "Submit Booking (Cari Lokasi)"}
                </button>
              )}

              {hasPending && !hasDraft && (
                <button type="button" className="inbound-step-btn inbound-step-next" disabled={busy} onClick={konfirmasiPending}>
                  {busy ? <i className="bi bi-arrow-clockwise stock-loader"></i> : <i className="bi bi-check2-all"></i>}
                  {busy ? "Mengonfirmasi..." : "Konfirmasi & Selesai"}
                </button>
              )}
            </div>

          </>
        )}
      </div>

      {/* ITEM LIST CARD TERPISAH (seperti outbound) */}
      {!!items.length && (
      <div className="inbound-card" style={{ padding: 12 }}>
        <div className="detail-item-title">
          Daftar Item
        </div>

        <div className="detail-item-list">
          {items.map((item) => {
            const itemStatus = (item.status || "selesai").toLowerCase();
            const isItemReject = (item.tipe_penerimaan || "").toUpperCase() === "REJECT";
            const noBatch = PRODUK_TANPA_BATCH.includes(angka(item.id_produk)) || /JUG (AQUA|VIT) 19L PC 55 MM/i.test(item.nama_produk || "");

            return (
              <div key={item.id_barang_masuk} className="detail-item-card">
                <div className="detail-item-top">
                  <div style={{ minWidth: 0 }}>
                    <div className="detail-product">
                      {norm(item.nama_produk) || "-"}
                      {itemStatus === 'draft' && <i className="bi bi-hourglass-split" style={{color: '#ca8a04', fontSize: 12}}></i>}
                      {itemStatus === 'pending' && <i className="bi bi-geo-fill" style={{color: '#0284c7', fontSize: 12}}></i>}
                      {itemStatus === 'selesai' && <i className="bi bi-check-circle-fill" style={{color: '#16a34a', fontSize: 12}}></i>}
                    </div>
                    <div className="detail-item-sub">
                      Jumlah: {item.jumlah} {norm(item.satuan)} 
                      {itemStatus !== 'draft' && <><br/>Lokasi: {norm(item.lokasi_block) || "-"}</>}
                    </div>
                  </div>
                  
                  {isSupervisor && (
                    <div className="detail-row-actions">
                      <button type="button" className="detail-icon-btn" title="Edit item" onClick={() => openItem(item)}>
                        <i className="bi bi-pencil-fill"></i>
                      </button>
                      <button type="button" className="detail-icon-btn detail-icon-danger" title="Hapus item" onClick={() => setConfirmOne(item)}>
                        <i className="bi bi-trash3-fill"></i>
                      </button>
                    </div>
                  )}
                </div>

                {/* INPUT BEST BEFORE KHUSUS STATUS DRAFT */}
                {itemStatus === 'draft' && (
                  <div style={{ marginTop: 8, borderTop: '1px dashed #dbe3f5', paddingTop: 8 }}>
                    <label className="detail-stat-label">Isi Best Before</label>
                    <input 
                      type={(isItemReject || noBatch) ? "text" : "date"} 
                      className="draft-bb-input"
                      value={(isItemReject || noBatch) ? "9999/99/99" : (draftBb[item.id_barang_masuk] || "")} 
                      disabled={isItemReject || noBatch}
                      placeholder={noBatch ? "Produk Tanpa BB" : "Pilih Best Before"}
                      onChange={(e) => setDraftBb({...draftBb, [item.id_barang_masuk]: e.target.value})} 
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* --- DIALOG EDIT HEADER --- */}
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
                <input type="text" value={hMobil} onChange={(e) => setHMobil(e.target.value)} />
              </div>
              <div className="dialog-field">
                <label>No DN</label>
                <input type="text" value={hDn} onChange={(e) => setHDn(e.target.value)}
                  readOnly={["Secondary", "REJECT"].includes(norm(first.tipe_penerimaan))} />
              </div>
              <div className="dialog-field">
                <label>Nama Driver</label>
                <input type="text" value={hDriver} onChange={(e) => setHDriver(e.target.value)} />
              </div>
              <div className="dialog-field dialog-field-full">
                <label>Asal Pabrik</label>
                <PlantPicker plants={plants} value={hAsal} onChange={setHAsal} />
              </div>
              <div className="dialog-field dialog-field-full">
                <label>Catatan</label>
                <textarea value={hCatatan} onChange={(e) => setHCatatan(e.target.value)} />
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-cancel" onClick={() => setShowHeader(false)}>Batal</button>
              <button type="button" className="dialog-btn dialog-btn-save" disabled={busy} onClick={simpanHeader}>Simpan Perubahan</button>
            </div>
          </div>
        </dialog>
      )}

      {/* --- DIALOG EDIT ITEM --- */}
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
                <input type="number" min={1} value={iJumlah} onChange={(e) => setIJumlah(e.target.value)} />
              </div>
              <div className="dialog-field">
                <label>Best Before</label>
                <input type={(showItem.tipe_penerimaan || "").toUpperCase() === "REJECT" ? "text" : "date"}
                  value={(showItem.tipe_penerimaan || "").toUpperCase() === "REJECT" ? "9999/99/99" : iBestBefore}
                  readOnly={(showItem.tipe_penerimaan || "").toUpperCase() === "REJECT" || showItem.status.toLowerCase() === "selesai"}
                  onChange={(e) => setIBestBefore(e.target.value)} />
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-btn dialog-btn-cancel" onClick={() => setShowItem(null)}>Batal</button>
              <button type="button" className="dialog-btn dialog-btn-save" disabled={busy} onClick={simpanJumlah}>Simpan Jumlah</button>
            </div>
          </div>
        </dialog>
      )}

      {/* --- DIALOG HAPUS --- */}
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
    <dialog open className="inbound-dialog">
      <div className="dialog-box">
        <h3 className="dialog-title">{title}</h3>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-main)", lineHeight: 1.5, margin: 0 }}
          dangerouslySetInnerHTML={{ __html: message }} />
        <div className="dialog-actions">
          <button type="button" className="dialog-btn dialog-btn-cancel" onClick={onCancel} disabled={busy}>Batal</button>
          <button type="button" className="dialog-btn dialog-danger" onClick={onOk} disabled={busy}>
            {busy ? "Memproses..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </dialog>
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