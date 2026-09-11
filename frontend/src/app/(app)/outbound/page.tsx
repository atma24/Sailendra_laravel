"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import UploadModal from "@/components/UploadModal";
import Pagination, { PAGE_SIZE, paginate, totalPagesOf } from "@/components/Pagination";
import { useToast } from "@/components/ToastProvider";

type BkRow = {
  id_barang_keluar: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  nama_produk: string;
  jumlah: number;
  tanggal_keluar: string;
  nama_driver: string;
  status: string;
  tipe_pengeluaran: string;
};

type TanggalItem = { tanggal: string; total_item: number; total_qty: number };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);

function PagedTanggal({ items, emptyMsg, resetKey }: { items: TanggalItem[]; emptyMsg: string; resetKey: string }) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  if (items.length === 0) {
    return <div className="outbound-card outbound-empty">{emptyMsg}</div>;
  }
  const total = totalPagesOf(items.length, PAGE_SIZE);
  const paged = paginate(items, page, PAGE_SIZE);
  return (
    <>
      <div className="outbound-grid">
        {paged.map((item) => (
          <Link key={item.tanggal} className="outbound-card outbound-date-card"
            href={`/outbound/driver/${encodeURIComponent(item.tanggal)}`}>
            <div className="outbound-card-top">
              <i className="bi bi-calendar3" style={{ color: "var(--primary)", fontSize: 16 }}></i>
              <div>
                <div className="outbound-date-title">{item.tanggal}</div>
                <div className="outbound-meta">{item.total_item} item · {item.total_qty} qty</div>
              </div>
              <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
            </div>
          </Link>
        ))}
      </div>
      <Pagination page={page} totalPages={total} totalItems={items.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

const css = `
.outbound-page { display: flex; flex-direction: column; gap: 7px; }
.outbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.outbound-toolbar { padding: 8px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; align-items: center; }
.outbound-search-wrap { position: relative; }
.outbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.outbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.outbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.outbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.outbound-toolbar-right { display: flex; gap: 7px; }
.outbound-grid { display: flex; flex-direction: column; gap: 7px; }
.outbound-date-card { padding: 8px; text-decoration: none; color: inherit; display: block; }
.outbound-date-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.outbound-card-top { display: flex; align-items: center; gap: 8px; }
.outbound-date-title { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; }
.outbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.outbound-meta { font-size: 10px; font-weight: 750; color: var(--text-soft); margin-top: 3px; }
.outbound-section-divider { display: flex; align-items: center; gap: 10px; margin: 14px 0 10px; }
.outbound-section-divider-line { flex: 1; height: 1px; background: #e5e7eb; }
.outbound-section-divider-label { font-size: 11px; font-weight: 900; color: #7c3aed; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.5px; }
.outbound-section-count { font-size: 10px; font-weight: 800; color: #9ca3af; background: #f3f4f6; padding: 2px 8px; border-radius: 10px; }
`;

export default function OutboundTanggalPage() {
  const [progressText, setProgressText] = useState("");
  const { toast } = useToast();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const [rows, setRows] = useState<BkRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<"" | "upload" | "import" | "foc">("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [lokasiList, setLokasiList] = useState<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>([]);
  const [uploadLok, setUploadLok] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams(lokasiParam(session));
        if (keyword.trim()) q.append("cari", keyword.trim());
        const r = await apiGet<BkRow[]>(`/barang-keluar?${q.toString()}`);
        if (!cancelled) setRows(r.data || []);
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, keyword]);

  if (!session || !loaded) return null;

  const q = search.trim().toLowerCase();
  const canAdd = !!session && ["SuperAdmin", "Supervisor", "Checker"].includes(session.user.role);
  const isSuperAdmin = !!session && session.user.role === "SuperAdmin";

  const buildTanggalMap = (source: BkRow[]) => {
    const map: Record<string, TanggalItem> = {};
    source.forEach((row) => {
      const t = dateOnly(row.tanggal_keluar);
      if (!t || t.startsWith("0000")) return;
      const key = `${t} ${row.nama_driver || ""} ${row.nama_produk || ""}`.toLowerCase();
      if (q !== "" && !key.includes(q)) return;
      if (!map[t]) map[t] = { tanggal: t, total_item: 0, total_qty: 0 };
      map[t].total_item++;
      map[t].total_qty += angka(row.jumlah);
    });
    return map;
  };

  const isFoc = (r: BkRow) => (r.tipe_pengeluaran || "").toUpperCase() === "FOC";
  const normalRows = rows.filter((r) => !isFoc(r));
  const focRows = rows.filter((r) => isFoc(r));

  const normalMap = buildTanggalMap(normalRows);
  const focMap = buildTanggalMap(focRows);
  const normalList = Object.values(normalMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const focList = Object.values(focMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const openModal = async (which: "upload" | "import" | "foc") => {
    setUploadMsg("");
    setUploadLok("");
    setProgressText("");
    if (fileRef.current) fileRef.current.value = "";
    if (multi && which !== "foc") {
      try {
        const r = await apiGet<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>("/pengguna-lokasi");
        setLokasiList(r.data || []);
      } catch {
        setLokasiList([]);
      }
    }
    setModal(which);
  };

  const uploadFileSubmit = async (file: File) => {
    const lok = uploadLok || String(session!.user.id_pengguna_lokasi || "");
    if (!lok) { setUploadMsg("Pilih lokasi upload."); return; }
    setUploadBusy(true);
    setUploadMsg("");
    setProgressText("Mengunggah dan memproses data Excel...");

    try {
      const raw = localStorage.getItem("sailendra_session");
      const s = raw ? JSON.parse(raw) : null;
      const headers: HeadersInit = { Accept: "application/json" };
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;
      const uploadUrl = `/api/barang-keluar/${modal === "import" ? "import-file" : "upload-file"}`;

      const fd = new FormData();
      fd.append("file_excel", file);
      fd.append("upload_lokasi", lok);
      fd.append("id_pengguna", String(session!.user.id_pengguna));

      const res = await fetch(uploadUrl, { method: "POST", headers, body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.message || "Upload gagal.");

      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: body.message || "Upload selesai.", type: "success" }));
      setKeyword(" "); setKeyword("");
      window.setTimeout(() => setModal(""), 500);
      window.location.reload();
    } catch (e) {
      setUploadMsg(`Gagal: ${(e as Error).message}`);
      toast((e as Error).message || "Upload gagal.", "error");
    } finally { setUploadBusy(false); }
  };

  const uploadFocSubmit = async (file: File) => {
    setUploadBusy(true);
    setUploadMsg("");
    setProgressText("Mengunggah dan memproses data FOC...");

    try {
      const raw = localStorage.getItem("sailendra_session");
      const s = raw ? JSON.parse(raw) : null;
      const headers: HeadersInit = { Accept: "application/json" };
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;

      const fd = new FormData();
      fd.append("file_excel", file);
      fd.append("id_pengguna", String(session!.user.id_pengguna));

      const res = await fetch("/api/barang-keluar/upload-foc", { method: "POST", headers, body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.message || "Upload FOC gagal.");

      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: body.message || "Upload FOC selesai.", type: "success" }));
      setKeyword(" "); setKeyword("");
      window.setTimeout(() => setModal(""), 500);
      window.location.reload();
    } catch (e) {
      setUploadMsg(`Gagal: ${(e as Error).message}`);
      toast((e as Error).message || "Upload FOC gagal.", "error");
    } finally { setUploadBusy(false); }
  };

  return (
    <div className="outbound-page">
      <style>{css}</style>
      <div className="outbound-card">
        <div className="outbound-toolbar">
          <div className="outbound-search-wrap">
            <input type="text" className="outbound-search-input" value={search}
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
            <div className="outbound-toolbar-right">
              <button type="button" className="outbound-add-btn" style={{ border: "none", cursor: "pointer" }} onClick={() => openModal("upload")}>
                <i className="bi bi-file-earmark-excel"></i>
                Upload Excel
              </button>
              <button type="button" className="outbound-add-btn" style={{ border: "none", cursor: "pointer", background: "#7c3aed" }} onClick={() => openModal("foc")}>
                <i className="bi bi-gift"></i>
                Upload FOC
              </button>
              {isSuperAdmin && (
                <button type="button" className="outbound-add-btn" style={{ border: "none", cursor: "pointer" }} onClick={() => openModal("import")}>
                  <i className="bi bi-clock-history"></i>
                  Import Historical
                </button>
              )}
              <Link className="outbound-add-btn" href="/outbound/form">
                <i className="bi bi-plus-lg"></i>
                Tambah Outbound
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* === SECTION: Normal Outbound === */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-main)", marginBottom: 7, display: "flex", alignItems: "center", gap: 8 }}>
          <i className="bi bi-truck" style={{ color: "var(--primary)" }}></i>
          Pengeluaran Normal
          <span className="outbound-section-count">{normalList.length}</span>
        </div>
        <PagedTanggal items={normalList} emptyMsg="Tidak ada data outbound normal." resetKey={`${search}|${keyword}|${normalRows.length}`} />
      </div>

      {/* === SECTION: FOC === */}
      {focList.length > 0 && (
        <div>
          <div className="outbound-section-divider">
            <div className="outbound-section-divider-line"></div>
            <span className="outbound-section-divider-label">FOC (Free of Charge)</span>
            <span className="outbound-section-count">{focList.length}</span>
            <div className="outbound-section-divider-line"></div>
          </div>
          <PagedTanggal items={focList} emptyMsg="Tidak ada data outbound FOC." resetKey={`${search}|${keyword}|${focRows.length}`} />
        </div>
      )}

      {/* === MODALS === */}
      {modal && modal !== "foc" && (
        <UploadModal
          open={!!modal}
          title={modal === "import" ? "Import Outbound Historical" : "Upload Outbound"}
          note={
            modal === "import"
              ? "Format Excel: GIN NO, NAMA CUSTOMER, DRIVER GUDANG, STATUS (Default Selesai), NO MOBIL, NAMA DRIVER, TANGGAL KELUAR, ID PRODUK, NAMA PRODUK, QTY, NO BATCH, BEST BEFORE, SO NUMBER, SALLE GROUP"
              : "Upload data pengeluaran barang (Outbound) format Excel."
          }
          onClose={() => setModal("")}
          onSubmit={uploadFileSubmit}
          busy={uploadBusy}
          progressText={progressText}
        />
      )}

      {modal === "foc" && (
        <UploadFocModal
          open={modal === "foc"}
          busy={uploadBusy}
          uploadMsg={uploadMsg}
          progressText={progressText}
          onClose={() => setModal("")}
          onSubmit={uploadFocSubmit}
        />
      )}
    </div>
  );
}

function UploadFocModal({ open, busy, uploadMsg, progressText, onClose, onSubmit }: {
  open: boolean; busy: boolean; uploadMsg: string; progressText: string;
  onClose: () => void; onSubmit: (file: File) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!file || busy) return;
    await onSubmit(file);
    setFile(null);
  };

  return (
    <>
      <style>{`
        .foc-modal-overlay { position: fixed; inset: 0; z-index: 1050; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px); }
        .foc-modal-card { background: #FFFFFF; border-radius: 18px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; position: relative; }
        .foc-modal-header { padding: 18px 22px; border-bottom: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: space-between; }
        .foc-modal-title { margin: 0; font-size: 16px; font-weight: 800; color: #0F172A; }
        .foc-modal-close { border: 0; background: transparent; color: #94A3B8; font-size: 18px; padding: 4px; cursor: pointer; border-radius: 6px; }
        .foc-modal-close:hover { color: #0F172A; background: #F1F5F9; }
        .foc-modal-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
        .foc-note-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 12px 14px; font-size: 12px; font-weight: 600; color: #166534; line-height: 1.5; }
        .foc-note-box strong { color: #15803D; }
        .foc-file-wrap { width: 100%; border: 1px solid #CBD5E1; border-radius: 10px; padding: 6px; background: #F8FAFC; display: flex; align-items: center; gap: 10px; }
        .foc-file-wrap:focus-within { border-color: #7c3aed; background: #FFFFFF; }
        .foc-file-btn { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #334155; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .foc-file-btn:hover { background: #F1F5F9; }
        .foc-file-name { font-size: 12px; font-weight: 600; color: #64748B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .foc-modal-footer { padding: 14px 22px; border-top: 1px solid #E2E8F0; background: #F8FAFC; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
        .foc-cancel-btn { height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-size: 13px; font-weight: 700; cursor: pointer; }
        .foc-cancel-btn:hover { background: #F1F5F9; }
        .foc-submit-btn { height: 38px; padding: 0 20px; border-radius: 10px; border: 0; background: #7c3aed; color: #FFFFFF; font-size: 13px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(124,58,237,0.2); }
        .foc-submit-btn:hover:not(:disabled) { background: #6d28d9; transform: translateY(-1px); }
        .foc-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .foc-loading { position: absolute; inset: 0; background: rgba(255,255,255,0.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 10; border-radius: 18px; backdrop-filter: blur(2px); }
        .foc-spinner { width: 56px; height: 56px; border-radius: 50%; border: 4px solid #E2E8F0; border-top-color: #7c3aed; animation: focSpin 0.8s linear infinite; }
        @keyframes focSpin { to { transform: rotate(360deg); } }
        .foc-loading-title { font-size: 15px; font-weight: 800; color: #0F172A; margin: 0; }
        .foc-loading-sub { font-size: 12px; font-weight: 600; color: #64748B; margin: 0; }
        .foc-progress { width: 180px; height: 5px; background: #E2E8F0; border-radius: 99px; overflow: hidden; }
        .foc-progress-fill { width: 100%; height: 100%; background: linear-gradient(90deg, transparent, #7c3aed, transparent); animation: focProgress 1.5s ease-in-out infinite; }
        @keyframes focProgress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .foc-upload-msg { font-size: 12px; font-weight: 700; color: #DC2626; margin: 0; }
      `}</style>
      <div className="foc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
        <div className="foc-modal-card">
          {busy && (
            <div className="foc-loading">
              <div className="foc-spinner"></div>
              <div style={{ textAlign: "center" }}>
                <p className="foc-loading-title">Mengunggah & Memproses Data FOC...</p>
                <p className="foc-loading-sub">{progressText || "Mohon tunggu sejenak."}</p>
              </div>
              <div className="foc-progress"><div className="foc-progress-fill"></div></div>
            </div>
          )}
          <div className="foc-modal-header">
            <h5 className="foc-modal-title">Upload Pengeluaran FOC</h5>
            <button type="button" className="foc-modal-close" onClick={onClose} disabled={busy}><i className="bi bi-x-lg"></i></button>
          </div>
          <div className="foc-modal-body">
            <div className="foc-note-box">
              <strong>Format kolom Excel:</strong><br />
              Tanggal Pengambilan · Lokasi Pengambilan · Jumlah Pengambilan Gallon · Nama Pengaju · Danone ID · Nama Pengambil · Nomor DN<br /><br />
              <strong>Auto 5 GALLON AQUA LOCAL</strong> per baris. Tipe: FOC.
            </div>
            <div className="foc-file-wrap">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]); }} />
              <button type="button" className="foc-file-btn" onClick={() => fileInputRef.current?.click()}>Choose File</button>
              <span className="foc-file-name">{file ? file.name : "No file chosen"}</span>
            </div>
            {uploadMsg && <p className="foc-upload-msg">{uploadMsg}</p>}
          </div>
          <div className="foc-modal-footer">
            <button type="button" className="foc-cancel-btn" onClick={onClose} disabled={busy}>Batal</button>
            <button type="button" className="foc-submit-btn" onClick={handleSubmit} disabled={busy || !file}>
              <i className="bi bi-upload"></i>
              <span>{busy ? "Memproses..." : "Upload FOC"}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
