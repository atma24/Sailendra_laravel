"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession, aktifLokasiId } from "@/lib/auth";
import UploadModal from "@/components/UploadModal";
import Pagination, { PAGE_SIZE, paginate, totalPagesOf } from "@/components/Pagination";
import { useToast } from "@/components/ToastProvider";

type BmRow = {
  id_barang_masuk: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  nama_produk: string;
  jumlah: number;
  tanggal_masuk: string;
  nama_driver: string;
  status: string;
  catatan: string;
  tipe_penerimaan: string;
};

type TanggalItem = { tanggal: string; total_item: number; total_qty: number };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);

const css = `
.inbound-page { display: flex; flex-direction: column; gap: 7px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.inbound-toolbar { padding: 8px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; align-items: center; }
.inbound-search-wrap { position: relative; }
.inbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.inbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.inbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.inbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-upload-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
.inbound-upload-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.inbound-page { scroll-behavior: smooth; }
.inbound-grid { display: flex; flex-direction: column; gap: 7px; }
.inbound-3col { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 7px; align-items: start; }
.inbound-col { display: flex; flex-direction: column; gap: 7px; min-width: 0; scroll-margin-top: 12px; }
.inbound-col-head { font-size: 12px; font-weight: 900; color: var(--text-main); display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 10px; border: 1px solid #e9edf5; background: #f8faff; }
.inbound-col-head .tipe-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.inbound-col-head.tipe-primary { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; }
.inbound-col-head.tipe-primary .tipe-dot { background: #1D4ED8; }
.inbound-col-head.tipe-secondary { background: #FFFBEB; border-color: #FDE68A; color: #92400E; }
.inbound-col-head.tipe-secondary .tipe-dot { background: #D97706; }
.inbound-col-head.tipe-xwh { background: #ECFDF5; border-color: #99F6E4; color: #0F766E; }
.inbound-col-head.tipe-xwh .tipe-dot { background: #0F766E; }
.inbound-col-head.tipe-foc { background: #FDF2F8; border-color: #F9A8D4; color: #9D174D; }
.inbound-col-head.tipe-foc .tipe-dot { background: #DB2777; }
.inbound-sub-label { font-size: 10px; font-weight: 900; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
.inbound-sub-label::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: currentColor; opacity: .55; }
.inbound-chip-nav { display: none; }
@media (max-width: 1024px) {
  .inbound-3col { grid-template-columns: 1fr; gap: 18px; }
  .inbound-col { scroll-margin-top: 108px; }
  .inbound-chip-nav { display: flex; gap: 6px; overflow-x: auto; padding: 8px; position: sticky; top: 8px; z-index: 30; background: rgba(255,255,255,.96); backdrop-filter: blur(8px); border: 1px solid #e9edf5; border-radius: 12px; scrollbar-width: none; }
  .inbound-chip-nav::-webkit-scrollbar { display: none; }
  .inbound-chip { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; text-decoration: none; padding: 6px 11px; border-radius: 999px; border: 1px solid; }
  .inbound-chip .tipe-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
  .inbound-chip.chip-primary { color: #1D4ED8; background: #EFF6FF; border-color: #BFDBFE; }
  .inbound-chip.chip-secondary { color: #92400E; background: #FFFBEB; border-color: #FDE68A; }
  .inbound-chip.chip-xwh { color: #0F766E; background: #ECFDF5; border-color: #99F6E4; }
  .inbound-chip.chip-foc { color: #9D174D; background: #FDF2F8; border-color: #F9A8D4; }
  .inbound-col-head { position: sticky; top: 60px; z-index: 20; box-shadow: 0 4px 14px rgba(15,23,42,.07); }
}
.inbound-date-card { padding: 8px 8px 8px 11px; text-decoration: none; color: inherit; display: block; border-left-width: 3px; }
.inbound-date-card.accent-primary { border-left-color: #3B82F6; }
.inbound-date-card.accent-secondary { border-left-color: #F59E0B; }
.inbound-date-card.accent-xwh { border-left-color: #14B8A6; }
.inbound-date-card.accent-foc { border-left-color: #EC4899; }
.inbound-date-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.inbound-card-top { display: flex; align-items: center; gap: 8px; }
.inbound-date-title { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.inbound-meta { font-size: 10px; font-weight: 750; color: var(--text-soft); margin-top: 3px; }
.inbound-section-divider { display: flex; align-items: center; gap: 8px; margin: 14px 0 10px; background: #F5F3FF; border: 1px dashed #C4B5FD; border-radius: 999px; padding: 5px 12px; }
.inbound-section-divider-line { display: none; }
.inbound-section-divider-label { font-size: 10px; font-weight: 900; color: #6D28D9; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; }
.inbound-section-divider-label::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: #7c3aed; }
.inbound-section-count { font-size: 10px; font-weight: 800; color: #374151; background: rgba(255,255,255,.85); border: 1px solid rgba(0,0,0,.06); padding: 2px 8px; border-radius: 10px; }
.inbound-pagination { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 10px; }
.inbound-page-btn { min-width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e2e7f0; background: #fff; color: #374151; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.inbound-page-btn:hover { background: #f3f4f6; border-color: var(--primary); color: var(--primary); }
.inbound-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.inbound-page-info { font-size: 10px; font-weight: 800; color: #9ca3af; }

/* TOAST CSS */
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
@media (max-width: 768px) { .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; } }
`;

export default function InboundTanggalPage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const { toast } = useToast();
  const [rows, setRows] = useState<BmRow[]>([]);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [primaryPage, setPrimaryPage] = useState(1);
  const [secManualPage, setSecManualPage] = useState(1);
  const [secOutboundPage, setSecOutboundPage] = useState(1);
  const [xwhPage, setXwhPage] = useState(1);
  const [focPage, setFocPage] = useState(1);
  const [focOutboundPage, setFocOutboundPage] = useState(1);
  
  // State untuk Upload Excel OTM
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const fetchData = async (signal?: AbortSignal) => {
    try {
      const q = new URLSearchParams(lokasiParam(session as any));
      if (keyword.trim()) q.append("cari", keyword.trim());
      const r = await apiGet<BmRow[]>(`/barang-masuk?${q.toString()}`);
      if (!signal?.aborted) setRows(r.data || []);
    } catch {
      // keep old
    } finally {
      if (!signal?.aborted) setLoaded(true);
    }
  };

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [session, keyword]);

  useEffect(() => {
    setPrimaryPage(1);
    setSecManualPage(1);
    setSecOutboundPage(1);
    setXwhPage(1);
    setFocPage(1);
    setFocOutboundPage(1);
  }, [search, keyword, rows]);

  const handleFileUploadSubmit = async (file: File) => {
    if (!file || !session) return;

    setUploading(true);
    const fd = new FormData();
    fd.append("file_excel", file);
    fd.append("id_pengguna", String(session.user.id_pengguna));
    fd.append("upload_lokasi", String(aktifLokasiId(session))); 

    try {
      const raw = localStorage.getItem("sailendra_session");
      const s = raw ? JSON.parse(raw) : null;
      const headers: HeadersInit = { Accept: "application/json" };
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;

      const res = await fetch("/api/barang-masuk/upload", {
        method: "POST",
        headers,
        body: fd
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal mengunggah file OTM.");

      toast(json.message || "Berhasil upload file OTM.", "success");
      setShowUpload(false);
      fetchData();
    } catch (err: any) {
      toast(err.message || "Terjadi kesalahan saat mengunggah file.", "error");
    } finally {
      setUploading(false);
    }
  };

  if (!session || !loaded) return null;

  const q = search.trim().toLowerCase();
  const canAdd = session && !["Support", "Forklift"].includes(session.user.role);

  // Split rows ke 3 kolom: Primary (kiri, +REJECT/fallback) | Secondary (tengah) | XWH (kanan).
  // Kolom tengah dipecah lagi: Secondary Manual vs Dari Outbound (copas logika lama).
  const tipeNorm = (v: unknown) => String(v ?? "").trim().toUpperCase();
  const isAutoOutbound = (r: BmRow) => (r.catatan || "").includes("Auto dari Outbound");
  const primaryRows = rows.filter((r) => {
    const t = tipeNorm(r.tipe_penerimaan);
    return t === "PRIMARY" || t === "REJECT" || t === "";
  });
  const secManualRows = rows.filter((r) => tipeNorm(r.tipe_penerimaan) === "SECONDARY" && !isAutoOutbound(r));
  const secOutboundRows = rows.filter((r) => tipeNorm(r.tipe_penerimaan) === "SECONDARY" && isAutoOutbound(r));
  const xwhRows = rows.filter((r) => tipeNorm(r.tipe_penerimaan) === "PRIMARY XWH");
  const focRows = rows.filter((r) => tipeNorm(r.tipe_penerimaan) === "FOC" && !isAutoOutbound(r));
  const focOutboundRows = rows.filter((r) => tipeNorm(r.tipe_penerimaan) === "FOC" && isAutoOutbound(r));

  const buildTanggalMap = (source: BmRow[]) => {
    const map: Record<string, TanggalItem> = {};
    source.forEach((row) => {
      const t = dateOnly(row.tanggal_masuk);
      if (!t || t.startsWith("0000")) return;
      const key = `${t} ${row.nama_driver || ""} ${row.nama_produk || ""}`.toLowerCase();
      if (q !== "" && !key.includes(q)) return;
      if (!map[t]) map[t] = { tanggal: t, total_item: 0, total_qty: 0 };
      map[t].total_item++;
      map[t].total_qty += angka(row.jumlah);
    });
    return map;
  };

  const primaryMap = buildTanggalMap(primaryRows);
  const secManualMap = buildTanggalMap(secManualRows);
  const secOutboundMap = buildTanggalMap(secOutboundRows);
  const xwhMap = buildTanggalMap(xwhRows);
  const focMap = buildTanggalMap(focRows);
  const focOutboundMap = buildTanggalMap(focOutboundRows);
  const primaryList = Object.values(primaryMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const secManualList = Object.values(secManualMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const secOutboundList = Object.values(secOutboundMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const xwhList = Object.values(xwhMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const focList = Object.values(focMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const focOutboundList = Object.values(focOutboundMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const primaryTotalPages = totalPagesOf(primaryList.length, PAGE_SIZE);
  const secManualTotalPages = totalPagesOf(secManualList.length, PAGE_SIZE);
  const secOutboundTotalPages = totalPagesOf(secOutboundList.length, PAGE_SIZE);
  const xwhTotalPages = totalPagesOf(xwhList.length, PAGE_SIZE);
  const focTotalPages = totalPagesOf(focList.length, PAGE_SIZE);
  const focOutboundTotalPages = totalPagesOf(focOutboundList.length, PAGE_SIZE);
  const primaryPaged = paginate(primaryList, primaryPage, PAGE_SIZE);
  const secManualPaged = paginate(secManualList, secManualPage, PAGE_SIZE);
  const secOutboundPaged = paginate(secOutboundList, secOutboundPage, PAGE_SIZE);
  const xwhPaged = paginate(xwhList, xwhPage, PAGE_SIZE);
  const focPaged = paginate(focList, focPage, PAGE_SIZE);
  const focOutboundPaged = paginate(focOutboundList, focOutboundPage, PAGE_SIZE);

  const ACCENT: Record<string, { card: string; icon: string }> = {
    primary: { card: "accent-primary", icon: "#1D4ED8" },
    secondary: { card: "accent-secondary", icon: "#D97706" },
    xwh: { card: "accent-xwh", icon: "#0F766E" },
    foc: { card: "accent-foc", icon: "#DB2777" },
  };
  const renderTanggal = (list: TanggalItem[], sumber?: string, tipe?: string) => {
    const acc = ACCENT[String(tipe || "").toLowerCase()] || ACCENT.primary;
    return list.length === 0 ? (
      <div className="inbound-card inbound-empty">Tidak ada data tanggal inbound.</div>
    ) : (
      <div className="inbound-grid">
        {list.map((item) => {
          const qp = new URLSearchParams();
          if (sumber) qp.set("sumber", sumber);
          if (tipe) qp.set("tipe", tipe);
          const qs = qp.toString();
          return (
          <Link key={item.tanggal} className={`inbound-card inbound-date-card ${acc.card}`}
            href={`/inbound/driver/${encodeURIComponent(item.tanggal)}${qs ? `?${qs}` : ""}`}>
            <div className="inbound-card-top">
              <i className="bi bi-calendar3" style={{ color: acc.icon, fontSize: 16 }}></i>
              <div>
                <div className="inbound-date-title">{item.tanggal}</div>
                <div className="inbound-meta">{item.total_item} item · {item.total_qty} qty</div>
              </div>
              <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
            </div>
          </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className="inbound-page">
      <style>{css}</style>

      <div className="inbound-card">
        <div className="inbound-toolbar">
          <div className="inbound-search-wrap">
            <input type="text" className="inbound-search-input" value={search}
              placeholder="Cari tanggal contoh: 2026-05-09" autoComplete="off"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setKeyword(search); }} />
            {keyword.trim() !== "" && (
              <a href="#" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-soft)", textDecoration: "none" }}
                onClick={(e) => { e.preventDefault(); setSearch(""); setKeyword(""); }}>
                <i className="bi bi-x-lg"></i>
              </a>
            )}
          </div>
          
          {canAdd && (
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" className="inbound-upload-btn" onClick={() => setShowUpload(true)} disabled={uploading}>
                <i className="bi bi-upload"></i>
                Upload OTM
              </button>
              <Link className="inbound-add-btn" href="/inbound/form">
                <i className="bi bi-plus-lg"></i>
                Tambah Inbound
              </Link>
            </div>
          )}
        </div>
      </div>

      <UploadModal
        open={showUpload}
        title="Upload File OTM Inbound"
        note="Pilih file Excel (.xlsx / .xls) data OTM Inbound yang akan diproses ke dalam sistem."
        onClose={() => setShowUpload(false)}
        onSubmit={handleFileUploadSubmit}
        busy={uploading}
      />

      {/* === Chip navigasi antar seksi (mobile only, sticky) === */}
      <nav className="inbound-chip-nav" aria-label="Navigasi seksi inbound">
        <a className="inbound-chip chip-primary" href="#seksi-primary"><span className="tipe-dot"></span>Primary · {primaryList.length}</a>
        <a className="inbound-chip chip-secondary" href="#seksi-secondary"><span className="tipe-dot"></span>Secondary · {secManualList.length + secOutboundList.length}</a>
        <a className="inbound-chip chip-xwh" href="#seksi-xwh"><span className="tipe-dot"></span>XWH · {xwhList.length}</a>
        <a className="inbound-chip chip-foc" href="#seksi-foc"><span className="tipe-dot"></span>FOC · {focList.length + focOutboundList.length}</a>
      </nav>

      {/* === 4 KOLOM: Primary | Secondary | XWH | FOC === */}
      <div className="inbound-3col">
        {/* KOLOM KIRI: Primary (+REJECT) */}
        <div className="inbound-col" id="seksi-primary">
          <div className="inbound-col-head tipe-primary">
            <span className="tipe-dot"></span>
            <i className="bi bi-inbox"></i>
            Primary
            <span className="inbound-section-count">{primaryList.length}</span>
          </div>
          {renderTanggal(primaryPaged, "normal", "primary")}
          <Pagination page={primaryPage} totalPages={primaryTotalPages} totalItems={primaryList.length} pageSize={PAGE_SIZE} onChange={setPrimaryPage} />
        </div>

        {/* KOLOM TENGAH: Secondary Manual + Dari Outbound */}
        <div className="inbound-col" id="seksi-secondary">
          <div className="inbound-col-head tipe-secondary">
            <span className="tipe-dot"></span>
            <i className="bi bi-arrow-repeat"></i>
            Secondary
            <span className="inbound-section-count">{secManualList.length + secOutboundList.length}</span>
          </div>
          <div className="inbound-sub-label">Secondary Manual</div>
          {renderTanggal(secManualPaged, "normal", "secondary")}
          <Pagination page={secManualPage} totalPages={secManualTotalPages} totalItems={secManualList.length} pageSize={PAGE_SIZE} onChange={setSecManualPage} />
          {secOutboundList.length > 0 && (
            <>
              <div className="inbound-section-divider">
                <span className="inbound-section-divider-label">Dari Outbound</span>
                <span className="inbound-section-count">{secOutboundList.length}</span>
              </div>
              {renderTanggal(secOutboundPaged, "outbound", "secondary")}
              <Pagination page={secOutboundPage} totalPages={secOutboundTotalPages} totalItems={secOutboundList.length} pageSize={PAGE_SIZE} onChange={setSecOutboundPage} />
            </>
          )}
        </div>

        {/* KOLOM KANAN: XWH */}
        <div className="inbound-col" id="seksi-xwh">
          <div className="inbound-col-head tipe-xwh">
            <span className="tipe-dot"></span>
            <i className="bi bi-box-seam"></i>
            XWH
            <span className="inbound-section-count">{xwhList.length}</span>
          </div>
          {renderTanggal(xwhPaged, "normal", "xwh")}
          <Pagination page={xwhPage} totalPages={xwhTotalPages} totalItems={xwhList.length} pageSize={PAGE_SIZE} onChange={setXwhPage} />
        </div>

        {/* KOLOM PALING KANAN: FOC Manual + Dari Outbound */}
        <div className="inbound-col" id="seksi-foc">
          <div className="inbound-col-head tipe-foc">
            <span className="tipe-dot"></span>
            <i className="bi bi-gift"></i>
            FOC
            <span className="inbound-section-count">{focList.length + focOutboundList.length}</span>
          </div>
          <div className="inbound-sub-label">FOC Manual</div>
          {renderTanggal(focPaged, "normal", "foc")}
          <Pagination page={focPage} totalPages={focTotalPages} totalItems={focList.length} pageSize={PAGE_SIZE} onChange={setFocPage} />
          {focOutboundList.length > 0 && (
            <>
              <div className="inbound-section-divider">
                <span className="inbound-section-divider-label">Dari Outbound</span>
                <span className="inbound-section-count">{focOutboundList.length}</span>
              </div>
              {renderTanggal(focOutboundPaged, "outbound", "foc")}
              <Pagination page={focOutboundPage} totalPages={focOutboundTotalPages} totalItems={focOutboundList.length} pageSize={PAGE_SIZE} onChange={setFocOutboundPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}