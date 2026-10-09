"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  no_mobil: string;
  gin_no: string;
  status: string;
  catatan: string;
  tipe_pengeluaran: string;
  nama_pengguna?: string;
  ritase?: number | null;
};

type TransaksiRow = {
  key: string;
  tanggal: string;
  ginShipment: string;
  ginRaw: string;
  nama_driver: string;
  no_mobil: string;
  jumlah_item: number;
  dibuat_oleh: string;
  ritase: number | null;
  status: string;
  tipe_detail: string;
};

const PAGE_SIZE_LOCAL = 10;
const FILTER_KEY = "sailendra_outbound_filter_v1";

const TIPE_OPTIONS = [
  { v: "primary", label: "Primary", dot: "#1D4ED8" },
  { v: "secondary", label: "Secondary", dot: "#D97706" },
  { v: "foc", label: "FOC", dot: "#DB2777" },
  { v: "pemusnahan", label: "Pemusnahan", dot: "#991B1B" },
  { v: "xwh", label: "XWH", dot: "#0D9488" },
] as const;

const STATUS_OPTIONS = [
  { v: "draft", label: "Draft" },
  { v: "pending", label: "Pending" },
  { v: "selesai", label: "Selesai" },
  { v: "canceled", label: "Canceled" },
] as const;

type SavedFilter = { q: string; tipe: string[]; status: string[]; dari: string; sampai: string };

const loadSaved = (): SavedFilter => {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (!raw) return { q: "", tipe: [], status: [], dari: "", sampai: "" };
    const p = JSON.parse(raw) as Partial<SavedFilter>;
    const validTipe: string[] = TIPE_OPTIONS.map((o) => o.v);
    return {
      q: typeof p.q === "string" ? p.q : "",
      tipe: Array.isArray(p.tipe) ? p.tipe.filter((t) => validTipe.includes(t)) : [],
      status: Array.isArray(p.status) ? p.status.filter((s) => STATUS_OPTIONS.some((o) => o.v === s)) : [],
      dari: typeof p.dari === "string" ? p.dari.slice(0, 10) : "",
      sampai: typeof p.sampai === "string" ? p.sampai.slice(0, 10) : "",
    };
  } catch {
    return { q: "", tipe: [], status: [], dari: "", sampai: "" };
  }
};

const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);
const tipeNorm = (v: unknown) => String(v ?? "").trim().toUpperCase();
const kategoriOf = (r: BkRow): string => {
  const t = tipeNorm(r.tipe_pengeluaran);
  if (t === "SECONDARY") return "secondary";
  if (t === "FOC") return "foc";
  if (t === "PEMUSNAHAN") return "pemusnahan";
  if (t === "XWH") return "xwh";
  return "primary";
};

const statusColor = (s: string): { bg: string; color: string } => {
  const st = (s || "").toLowerCase();
  if (st === "selesai" || st === "confirmed") return { bg: "#d1fae5", color: "#065f46" };
  if (st === "canceled" || st === "cancelled" || st === "batal") return { bg: "#fee2e2", color: "#b91c1c" };
  if (st === "pending") return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "#e5e7eb", color: "#4b5563" };
};

const statusKey = (s: string): string => {
  const value = (s || "").trim().toLowerCase();
  if (!value) return "draft";
  if (value === "confirmed") return "selesai";
  if (["cancelled", "batal"].includes(value)) return "canceled";
  return value;
};

type SortKey = "tanggal" | "gin" | "driver" | "mobil" | "item" | "dibuat" | "ritase" | "status";
type SortDir = "asc" | "desc";

const css = `
.outbound-page { display: flex; flex-direction: column; gap: 7px; }
.outbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.outbound-toolbar { padding: 8px; display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.outbound-search-wrap { position: relative; flex: 1; min-width: 200px; }
.outbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px 0 12px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; box-sizing: border-box; }
.outbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.outbound-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); border: 0; background: transparent; cursor: pointer; }
.outbound-reset-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: transparent; border: 1px dashed #cbd5e1; color: var(--text-soft); font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.outbound-reset-btn:hover { color: #DC2626; border-color: #DC2626; }
.outbound-filter-panel { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.outbound-date-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.outbound-date-field { display: flex; flex-direction: column; gap: 4px; }
.outbound-date-field label { font-size: 10px; font-weight: 850; color: var(--text-soft); }
.outbound-date-field input { height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.outbound-date-field input:focus { background: #FFFFFF; border-color: var(--primary); }
.outbound-active-hint { font-size: 10px; font-weight: 750; color: var(--text-soft); }
.outbound-toolbar-right { display: flex; gap: 6px; flex-wrap: wrap; }
.outbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.outbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.outbound-upload-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; white-space: nowrap; }
.outbound-upload-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.outbound-filter-title { font-size: 11px; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.4px; }
.outbound-tipe-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.outbound-tipe-check { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-main); border: 1px solid #e2e7f0; background: #fbfcff; border-radius: 999px; padding: 5px 11px; cursor: pointer; user-select: none; }
.outbound-tipe-check input { accent-color: var(--primary); }
.outbound-tipe-check.is-on { background: var(--primary-soft); border-color: rgba(25,25,112,0.3); }
.outbound-status-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.outbound-status-check { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-main); border: 1px solid #e2e7f0; background: #fbfcff; border-radius: 999px; padding: 5px 11px; cursor: pointer; user-select: none; }
.outbound-status-check input { accent-color: var(--primary); }
.outbound-status-check.is-on { background: var(--primary-soft); border-color: rgba(25,25,112,0.3); }
.outbound-tipe-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.outbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.outbound-table-wrap { overflow-x: auto; }
.outbound-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.outbound-table th { text-align: left; font-weight: 900; color: var(--text-main); background: #f7f9fd; border-bottom: 1px solid #e9edf5; padding: 8px 10px; white-space: nowrap; }
.outbound-table th.sortable { cursor: pointer; user-select: none; }
.outbound-table th.sortable:hover { background: #eef2fb; }
.outbound-table th .sort-ico { margin-left: 5px; font-size: 9px; color: var(--text-soft); }
.outbound-table th.is-sorted .sort-ico { color: var(--primary); }
.outbound-table td { padding: 8px 10px; border-bottom: 1px solid #f1f4fa; color: var(--text-main); font-weight: 700; white-space: nowrap; }
.outbound-table tbody tr:hover { background: #f9fbff; }
.outbound-table tbody tr { cursor: pointer; }
.outbound-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 850; border-radius: 999px; padding: 2px 8px; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; white-space: nowrap; }
`;

export default function OutboundPage() {
  const [progressText, setProgressText] = useState("");
  const { toast } = useToast();
  const session = useSession();
  const router = useRouter();
  const multi = !!session && isMultiRole(session.user.role);

  // Filter tersimpan (tetap saat bolak-balik driver/detail).
  // Direset otomatis oleh AppLayout saat pindah ke halaman selain /outbound*.
  const [savedOnce] = useState<SavedFilter>(() =>
    typeof window === "undefined" ? { q: "", tipe: [], status: [], dari: "", sampai: "" } : loadSaved()
  );
  const [rows, setRows] = useState<BkRow[]>([]);
  const [search, setSearch] = useState(savedOnce.q);
  const [keyword, setKeyword] = useState(savedOnce.q);
  const [tipe, setTipe] = useState<string[]>(savedOnce.tipe);
  const [status, setStatus] = useState<string[]>(savedOnce.status);
  const [dari, setDari] = useState(savedOnce.dari);
  const [sampai, setSampai] = useState(savedOnce.sampai);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("tanggal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [modal, setModal] = useState<"" | "upload" | "primary" | "import" | "foc">("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  // Simpan setiap perubahan filter.
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({ q: keyword, tipe, status, dari, sampai }));
    } catch { /* abaikan */ }
  }, [keyword, tipe, status, dari, sampai]);

  // Debounce search → keyword (search server-side ke semua kolom).
  useEffect(() => {
    const t = setTimeout(() => setKeyword(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  const tipeKey = useMemo(() => [...tipe].sort().join(","), [tipe]);
  const statusKeyFilter = useMemo(() => [...status].sort().join(","), [status]);

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
  }, [keyword, tipeKey, statusKeyFilter, dari, sampai, rows]);

  const toggleTipe = (v: string) => {
    setTipe((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));
  };

  const toggleStatus = (v: string) => {
    setStatus((prev) => (prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]));
  };

  const resetFilter = () => {
    setSearch("");
    setKeyword("");
    setTipe([]);
    setStatus([]);
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
  const filterActive = tipe.length > 0 || status.length > 0 || dari !== "" || sampai !== "" || keyword.trim() !== "";

  // Satu baris = satu transaksi (grup driver + GIN), bukan per item produk.
  const mapTrans: Record<string, TransaksiRow> = {};
  const catCount: Record<string, Record<string, number>> = {};
  rows.forEach((row) => {
    const t = dateOnly(row.tanggal_keluar);
    if (!t || t.startsWith("0000")) return;
    const nama = (row.nama_driver || "").trim() || "Tanpa nama driver";
    const gin = (row.gin_no || "").trim() || "Tanpa GIN";
    const key = `${nama}::${gin}`;
    if (!mapTrans[key]) {
      mapTrans[key] = {
        key,
        tanggal: t,
        ginShipment: gin,
        ginRaw: (row.gin_no || "").trim(),
        nama_driver: nama,
        no_mobil: row.no_mobil || "",
        jumlah_item: 0,
        dibuat_oleh: row.nama_pengguna || "",
        ritase: row.ritase ?? null,
        status: row.status || "",
        tipe_detail: "",
      };
      catCount[key] = {};
    }
    mapTrans[key].jumlah_item++;
    if (!mapTrans[key].no_mobil && row.no_mobil) mapTrans[key].no_mobil = row.no_mobil;
    if (!mapTrans[key].dibuat_oleh && row.nama_pengguna) mapTrans[key].dibuat_oleh = row.nama_pengguna;
    if (mapTrans[key].ritase == null && row.ritase != null) mapTrans[key].ritase = row.ritase;
    if (!mapTrans[key].status && row.status) mapTrans[key].status = row.status;
    const k = kategoriOf(row);
    catCount[key][k] = (catCount[key][k] || 0) + 1;
  });
  Object.entries(catCount).forEach(([key, counts]) => {
    let best = "";
    let bestN = -1;
    Object.entries(counts).forEach(([c, n]) => {
      if (n > bestN) { best = c; bestN = n; }
    });
    if (mapTrans[key]) mapTrans[key].tipe_detail = best;
  });

  const list = Object.values(mapTrans);
  const statusFiltered = status.length ? list.filter((item) => status.includes(statusKey(item.status))) : list;
  const sorted = [...statusFiltered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "tanggal": return dir * a.tanggal.localeCompare(b.tanggal);
      case "gin": return dir * a.ginShipment.localeCompare(b.ginShipment, "id");
      case "driver": return dir * a.nama_driver.localeCompare(b.nama_driver, "id");
      case "mobil": return dir * a.no_mobil.localeCompare(b.no_mobil, "id");
      case "item": return dir * (a.jumlah_item - b.jumlah_item);
      case "dibuat": return dir * a.dibuat_oleh.localeCompare(b.dibuat_oleh, "id");
      case "ritase": return dir * ((a.ritase ?? 0) - (b.ritase ?? 0));
      case "status": return dir * a.status.localeCompare(b.status, "id");
      default: return 0;
    }
  });

  const totalPages = totalPagesOf(sorted.length, PAGE_SIZE_LOCAL);
  const paged = paginate(sorted, page, PAGE_SIZE_LOCAL);

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
    setPage(1);
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "tanggal", label: "Tanggal" },
    { key: "gin", label: "GIN/Shipment" },
    { key: "driver", label: "Nama Driver" },
    { key: "mobil", label: "Nomor Mobil" },
    { key: "item", label: "Jumlah Item" },
    { key: "dibuat", label: "Dibuat Oleh" },
    { key: "ritase", label: "Trip/Ritase" },
    { key: "status", label: "Status" },
  ];

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
            <div className="outbound-filter-title" style={{ marginBottom: 6 }}>Status</div>
            <div className="outbound-status-grid">
              {STATUS_OPTIONS.map((o) => {
                const on = status.includes(o.v);
                return (
                  <label key={o.v} className={`outbound-status-check ${on ? "is-on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleStatus(o.v)} />
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
            Filter tersimpan otomatis — tetap aktif saat membuka detail, ter-reset saat pindah halaman lain atau tekan Reset.
          </div>
        </div>
      </div>

      <div className="outbound-card">
        {paged.length === 0 ? (
          <div className="outbound-empty">
            {filterActive ? "Tidak ada data yang cocok dengan filter/pencarian." : "Tidak ada data outbound."}
          </div>
        ) : (
          <div className="outbound-table-wrap">
            <table className="outbound-table">
              <thead>
                <tr>
                  {columns.map((c) => {
                    const active = sortKey === c.key;
                    return (
                      <th key={c.key} className={`sortable ${active ? "is-sorted" : ""}`}
                        onClick={() => onSort(c.key)}
                        title={`Urutkan ${c.label}`}>
                        {c.label}
                        <i className={`bi ${active ? (sortDir === "asc" ? "bi-caret-up-fill" : "bi-caret-down-fill") : "bi-arrow-down-up"} sort-ico`}></i>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paged.map((item) => {
                  const ss = statusColor(item.status);
                  const qp = new URLSearchParams();
                  qp.set("driver", item.nama_driver);
                  if (item.ginRaw) qp.set("gin", item.ginRaw);
                  if (item.tipe_detail) qp.set("tipe_detail", item.tipe_detail);
                  if (multi) {
                    const l = lokasiParam(session);
                    if (l) { const [k, v] = l.split("="); if (v) qp.set(k, v); }
                  }
                  return (
                    <tr key={item.key}
                      onClick={() => { router.push(`/outbound/detail/${encodeURIComponent(item.tanggal)}?${qp.toString()}`); }}>
                      <td>{item.tanggal}</td>
                      <td><span className="outbound-badge">{item.ginShipment}</span></td>
                      <td>{item.nama_driver}</td>
                      <td>{item.no_mobil || "-"}</td>
                      <td>{item.jumlah_item}</td>
                      <td>{item.dibuat_oleh || "-"}</td>
                      <td>{item.ritase ?? "-"}</td>
                      <td><span className="outbound-badge" style={ss}>{item.status || "Draft"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={sorted.length} pageSize={PAGE_SIZE_LOCAL} onChange={setPage} />

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
