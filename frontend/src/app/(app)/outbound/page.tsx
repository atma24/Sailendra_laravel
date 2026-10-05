"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import UploadModal from "@/components/UploadModal";
import Pagination, { paginate, totalPagesOf } from "@/components/Pagination";
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
  catatan: string;
  tipe_pengeluaran: string;
};

type TanggalItem = {
  tanggal: string;
  total_item: number;
  total_qty: number;
  breakdown: Record<string, number>;
};

const PAGE_SIZE_LOCAL = 10;
const FILTER_KEY = "sailendra_outbound_filter_v1";

const TIPE_OPTIONS = [
  { v: "primary", label: "Primary", dot: "#1D4ED8" },
  { v: "secondary", label: "Secondary", dot: "#D97706" },
  { v: "foc", label: "FOC", dot: "#DB2777" },
  { v: "pemusnahan", label: "Pemusnahan", dot: "#991B1B" },
] as const;

type SavedFilter = { q: string; tipe: string[]; dari: string; sampai: string };

const loadSaved = (): SavedFilter => {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (!raw) return { q: "", tipe: [], dari: "", sampai: "" };
    const p = JSON.parse(raw) as Partial<SavedFilter>;
    const validTipe: string[] = TIPE_OPTIONS.map((o) => o.v);
    return {
      q: typeof p.q === "string" ? p.q : "",
      tipe: Array.isArray(p.tipe) ? p.tipe.filter((t) => validTipe.includes(t)) : [],
      dari: typeof p.dari === "string" ? p.dari.slice(0, 10) : "",
      sampai: typeof p.sampai === "string" ? p.sampai.slice(0, 10) : "",
    };
  } catch {
    return { q: "", tipe: [], dari: "", sampai: "" };
  }
};

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);
const tipeNorm = (v: unknown) => String(v ?? "").trim().toUpperCase();
const kategoriOf = (r: BkRow): string => {
  const t = tipeNorm(r.tipe_pengeluaran);
  if (t === "SECONDARY") return "secondary";
  if (t === "FOC") return "foc";
  if (t === "PEMUSNAHAN") return "pemusnahan";
  return "primary";
};
const kategoriLabel = (k: string) => TIPE_OPTIONS.find((o) => o.v === k)?.label || k;
const kategoriDot = (k: string) => TIPE_OPTIONS.find((o) => o.v === k)?.dot || "#6b7280";

const css = `
.outbound-page { display: flex; flex-direction: column; gap: 7px; }
.outbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.outbound-toolbar { padding: 8px; display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.outbound-search-wrap { position: relative; flex: 1; min-width: 200px; }
.outbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px 0 12px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.outbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.outbound-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); border: 0; background: transparent; cursor: pointer; }
.outbound-reset-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: transparent; border: 1px dashed #cbd5e1; color: var(--text-soft); font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.outbound-reset-btn:hover { color: #DC2626; border-color: #DC2626; }
.outbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.outbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.outbound-filter-panel { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.outbound-filter-title { font-size: 11px; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.4px; }
.outbound-tipe-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.outbound-tipe-check { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-main); border: 1px solid #e2e7f0; background: #fbfcff; border-radius: 999px; padding: 5px 11px; cursor: pointer; user-select: none; }
.outbound-tipe-check input { accent-color: var(--primary); }
.outbound-tipe-check.is-on { background: var(--primary-soft); border-color: rgba(25,25,112,0.3); }
.outbound-tipe-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.outbound-date-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.outbound-date-field { display: flex; flex-direction: column; gap: 4px; }
.outbound-date-field label { font-size: 10px; font-weight: 850; color: var(--text-soft); }
.outbound-date-field input { height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.outbound-date-field input:focus { background: #FFFFFF; border-color: var(--primary); }
.outbound-active-hint { font-size: 10px; font-weight: 750; color: var(--text-soft); }
.outbound-grid { display: flex; flex-direction: column; gap: 7px; }
.outbound-date-card { padding: 8px 8px 8px 11px; text-decoration: none; color: inherit; display: block; border-left: 3px solid #3B82F6; }
.outbound-date-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.outbound-card-top { display: flex; align-items: center; gap: 8px; }
.outbound-date-title { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; }
.outbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.outbound-meta { font-size: 10px; font-weight: 750; color: var(--text-soft); margin-top: 3px; }
.outbound-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.outbound-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 850; border-radius: 999px; padding: 2px 8px; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; white-space: nowrap; }
.outbound-badge .outbound-tipe-dot { width: 6px; height: 6px; }
.outbound-toolbar-right { display: flex; gap: 6px; flex-wrap: wrap; }
.outbound-upload-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; white-space: nowrap; }
.outbound-upload-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
`;

export default function OutboundTanggalPage() {
  const [progressText, setProgressText] = useState("");
  const { toast } = useToast();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  // Filter tersimpan (tetap saat bolak-balik driver/detail).
  // Direset otomatis oleh AppLayout saat pindah ke halaman selain /outbound*.
  const [savedOnce] = useState<SavedFilter>(() =>
    typeof window === "undefined" ? { q: "", tipe: [], dari: "", sampai: "" } : loadSaved()
  );
  const [rows, setRows] = useState<BkRow[]>([]);
  const [search, setSearch] = useState(savedOnce.q);
  const [keyword, setKeyword] = useState(savedOnce.q);
  const [tipe, setTipe] = useState<string[]>(savedOnce.tipe);
  const [dari, setDari] = useState(savedOnce.dari);
  const [sampai, setSampai] = useState(savedOnce.sampai);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<"" | "upload" | "primary" | "import" | "foc">("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  // Simpan setiap perubahan filter.
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({ q: keyword, tipe, dari, sampai }));
    } catch { /* abaikan */ }
  }, [keyword, tipe, dari, sampai]);

  // Debounce search → keyword (search server-side ke semua kolom).
  useEffect(() => {
    const t = setTimeout(() => setKeyword(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  const tipeKey = useMemo(() => [...tipe].sort().join(","), [tipe]);

  const fetchData = async (signal?: AbortSignal) => {
    if (!session) return;
    try {
      const q = new URLSearchParams(lokasiParam(session));
      if (keyword.trim()) q.append("cari", keyword.trim());
      if (tipeKey) q.append("tipe_detail", tipeKey);
      if (dari) q.append("tanggal_dari", dari);
      if (sampai) q.append("tanggal_sampai", sampai);
      const r = await apiGet<BkRow[]>(`/barang-keluar?${q.toString()}`);
      if (!signal?.aborted) setRows(r.data || []);
    } catch {
      /* keep old */
    } finally {
      if (!signal?.aborted) setLoaded(true);
    }
  };

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch syncs server data into state
    fetchData(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, keyword, tipeKey, dari, sampai]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination on filter/data change
    setPage(1);
  }, [keyword, tipeKey, dari, sampai, rows]);

  const toggleTipe = (v: string) => {
    setTipe((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));
  };

  const resetFilter = () => {
    setSearch("");
    setKeyword("");
    setTipe([]);
    setDari("");
    setSampai("");
    setPage(1);
    try { sessionStorage.removeItem(FILTER_KEY); } catch { /* abaikan */ }
  };

  const openModal = (which: "upload" | "primary" | "import" | "foc") => {
    setUploadMsg("");
    setProgressText("");
    setModal(which);
  };

  const uploadFileSubmit = async (file: File) => {
    const lok = String(session!.user.id_pengguna_lokasi || "");
    if (!lok) { setUploadMsg("Pilih lokasi upload."); return; }
    setUploadBusy(true);
    setUploadMsg("");
    setProgressText("Mengunggah dan memproses data Excel...");

    try {
      const raw = localStorage.getItem("sailendra_session");
      const s = raw ? JSON.parse(raw) : null;
      const headers: HeadersInit = { Accept: "application/json" };
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;
      const uploadUrl = `/api/barang-keluar/${modal === "import" ? "import-file" : modal === "primary" ? "upload-primary" : "upload-file"}`;

      const fd = new FormData();
      fd.append("file_excel", file);
      fd.append("upload_lokasi", lok);
      fd.append("id_pengguna", String(session!.user.id_pengguna));

      const res = await fetch(uploadUrl, { method: "POST", headers, body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.message || "Upload gagal.");

      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: body.message || "Upload selesai.", type: "success" }));
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
      window.setTimeout(() => setModal(""), 500);
      window.location.reload();
    } catch (e) {
      setUploadMsg(`Gagal: ${(e as Error).message}`);
      toast((e as Error).message || "Upload FOC gagal.", "error");
    } finally { setUploadBusy(false); }
  };

  if (!session || !loaded) return null;

  const canAdd = !!session && ["SuperAdmin", "Supervisor", "Checker"].includes(session.user.role);
  const isSuperAdmin = !!session && session.user.role === "SuperAdmin";
  const filterActive = tipe.length > 0 || dari !== "" || sampai !== "" || keyword.trim() !== "";

  // All data campur: satu kartu per tanggal berisi semua tipe pengeluaran.
  // 1 transaksi = 1 driver pada tanggal itu, sama seperti halaman driver
  // (bukan jumlah baris item). Badge per tipe = jumlah driver (klasifikasi
  // kategori terbanyak milik driver) sehingga total badge = total transaksi.
  const map: Record<string, TanggalItem> = {};
  const groupCat: Record<string, Record<string, Record<string, number>>> = {};
  rows.forEach((row) => {
    const t = dateOnly(row.tanggal_keluar);
    if (!t || t.startsWith("0000")) return;
    const g = (row.nama_driver || "").trim() || "Tanpa nama driver";
    if (!map[t]) {
      map[t] = { tanggal: t, total_item: 0, total_qty: 0, breakdown: {} };
      groupCat[t] = {};
    }
    if (!groupCat[t][g]) {
      groupCat[t][g] = {};
      map[t].total_item++;
    }
    const k = kategoriOf(row);
    groupCat[t][g][k] = (groupCat[t][g][k] || 0) + 1;
    map[t].total_qty += angka(row.jumlah);
  });
  Object.entries(groupCat).forEach(([t, groups]) => {
    Object.values(groups).forEach((catCounts) => {
      let best = "";
      let bestN = -1;
      Object.entries(catCounts).forEach(([c, n]) => {
        if (n > bestN) { best = c; bestN = n; }
      });
      if (best) map[t].breakdown[best] = (map[t].breakdown[best] || 0) + 1;
    });
  });
  const list = Object.values(map).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const totalPages = totalPagesOf(list.length, PAGE_SIZE_LOCAL);
  const paged = paginate(list, page, PAGE_SIZE_LOCAL);

  return (
    <div className="outbound-page">
      <style>{css}</style>
      <div className="outbound-card">
        <div className="outbound-toolbar">
          <div className="outbound-search-wrap">
            <input type="text" className="outbound-search-input" value={search}
              placeholder="Cari produk, driver, GIN, SO, tujuan, catatan..." autoComplete="off"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setKeyword(search.trim()); }} />
            {search.trim() !== "" && (
              <button type="button" className="outbound-search-clear" aria-label="Bersihkan pencarian"
                onClick={() => { setSearch(""); setKeyword(""); }}>
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>
          {filterActive && (
            <button type="button" className="outbound-reset-btn" onClick={resetFilter}>
              <i className="bi bi-arrow-counterclockwise"></i>
              Reset
            </button>
          )}
          {canAdd && (
            <div className="outbound-toolbar-right">
              <button type="button" className="outbound-upload-btn" onClick={() => openModal("upload")}>
                <i className="bi bi-file-earmark-excel"></i>
                Upload Excel
              </button>
              <button type="button" className="outbound-upload-btn" onClick={() => openModal("primary")}>
                <i className="bi bi-file-earmark-excel"></i>
                Upload Primary
              </button>
              <button type="button" className="outbound-upload-btn" onClick={() => openModal("foc")}>
                <i className="bi bi-file-earmark-excel"></i>
                Upload FOC
              </button>
              {isSuperAdmin && (
                <button type="button" className="outbound-upload-btn" onClick={() => openModal("import")}>
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

        <div className="outbound-filter-panel">
          <div>
            <div className="outbound-filter-title" style={{ marginBottom: 6 }}>Tipe Pengeluaran</div>
            <div className="outbound-tipe-grid">
              {TIPE_OPTIONS.map((o) => {
                const on = tipe.includes(o.v);
                return (
                  <label key={o.v} className={`outbound-tipe-check ${on ? "is-on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleTipe(o.v)} />
                    <span className="outbound-tipe-dot" style={{ background: o.dot }}></span>
                    {o.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className="outbound-filter-title" style={{ marginBottom: 6 }}>Range Tanggal</div>
            <div className="outbound-date-row">
              <div className="outbound-date-field">
                <label>Dari</label>
                <input type="date" value={dari} max={sampai || undefined} onChange={(e) => setDari(e.target.value)} />
              </div>
              <div className="outbound-date-field">
                <label>Sampai</label>
                <input type="date" value={sampai} min={dari || undefined} onChange={(e) => setSampai(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="outbound-active-hint">
            Filter tersimpan otomatis — tetap aktif saat membuka driver/detail, ter-reset saat pindah halaman lain atau tekan Reset.
          </div>
        </div>
      </div>

      {paged.length === 0 ? (
        <div className="outbound-card outbound-empty">
          {filterActive ? "Tidak ada data yang cocok dengan filter/pencarian." : "Tidak ada data tanggal outbound."}
        </div>
      ) : (
        <div className="outbound-grid">
          {paged.map((item) => {
            const qp = new URLSearchParams();
            if (tipeKey) qp.set("tipe_detail", tipeKey);
            if (multi) {
              const l = lokasiParam(session);
              if (l) { const [k, v] = l.split("="); if (v) qp.set(k, v); }
            }
            const qs = qp.toString();
            return (
              <Link key={item.tanggal} className="outbound-card outbound-date-card"
                href={`/outbound/driver/${encodeURIComponent(item.tanggal)}${qs ? `?${qs}` : ""}`}>
                <div className="outbound-card-top">
                  <i className="bi bi-calendar3" style={{ color: "var(--primary)", fontSize: 16 }}></i>
                  <div>
                    <div className="outbound-date-title">{item.tanggal}</div>
                    <div className="outbound-meta">{item.total_item} transaksi</div>
                  </div>
                  <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
                </div>
                <div className="outbound-badges">
                  {Object.entries(item.breakdown).sort().map(([k, c]) => (
                    <span key={k} className="outbound-badge">
                      <span className="outbound-tipe-dot" style={{ background: kategoriDot(k) }}></span>
                      {kategoriLabel(k)} · {c}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} totalItems={list.length} pageSize={PAGE_SIZE_LOCAL} onChange={setPage} />

      {/* === MODALS === */}
      {modal && modal !== "foc" && (
        <UploadModal
          open={!!modal}
          title={modal === "import" ? "Import Outbound Historical" : modal === "primary" ? "Upload Outbound Primary" : "Upload Outbound"}
          note={
            modal === "import"
              ? "Format Excel: GIN NO, NAMA CUSTOMER, DRIVER GUDANG, STATUS (Default Selesai), NO MOBIL, NAMA DRIVER, TANGGAL KELUAR, ID PRODUK, NAMA PRODUK, QTY, NO BATCH, BEST BEFORE, SO NUMBER, SALLE GROUP"
              : modal === "primary"
                ? "Format Excel: No, No DN, Type Doc, No Polisi, Pengemudi, Ritase, Material Desc, Quantity, Tgl Buat. Tipe otomatis Primary, Batch auto-FEFO, Tujuan diisi manual di Detail."
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
        .foc-note-box { background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 12px; padding: 12px 14px; font-size: 12px; font-weight: 600; color: var(--primary-navy, #191970); line-height: 1.5; }
        .foc-note-box strong { color: var(--primary-navy, #191970); }
        .foc-file-wrap { width: 100%; border: 1px solid #CBD5E1; border-radius: 10px; padding: 6px; background: #F8FAFC; display: flex; align-items: center; gap: 10px; }
        .foc-file-wrap:focus-within { border-color: var(--primary-navy, #191970); background: #FFFFFF; }
        .foc-file-btn { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #334155; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .foc-file-btn:hover { background: #F1F5F9; }
        .foc-file-name { font-size: 12px; font-weight: 600; color: #64748B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .foc-modal-footer { padding: 14px 22px; border-top: 1px solid #E2E8F0; background: #F8FAFC; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
        .foc-cancel-btn { height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-size: 13px; font-weight: 700; cursor: pointer; }
        .foc-cancel-btn:hover { background: #F1F5F9; }
        .foc-submit-btn { height: 38px; padding: 0 20px; border-radius: 10px; border: 0; background: var(--primary-navy, #191970); color: #FFFFFF; font-size: 13px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(25, 25, 112, 0.2); }
        .foc-submit-btn:hover:not(:disabled) { background: #121254; transform: translateY(-1px); }
        .foc-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .foc-loading { position: absolute; inset: 0; background: rgba(255,255,255,0.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 10; border-radius: 18px; backdrop-filter: blur(2px); }
        .foc-spinner { width: 56px; height: 56px; border-radius: 50%; border: 4px solid #E2E8F0; border-top-color: var(--primary-navy, #191970); animation: focSpin 0.8s linear infinite; }
        @keyframes focSpin { to { transform: rotate(360deg); } }
        .foc-loading-title { font-size: 15px; font-weight: 800; color: #0F172A; margin: 0; }
        .foc-loading-sub { font-size: 12px; font-weight: 600; color: #64748B; margin: 0; }
        .foc-progress { width: 180px; height: 5px; background: #E2E8F0; border-radius: 99px; overflow: hidden; }
        .foc-progress-fill { width: 100%; height: 100%; background: linear-gradient(90deg, transparent, var(--primary-navy, #191970), transparent); animation: focProgress 1.5s ease-in-out infinite; }
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
