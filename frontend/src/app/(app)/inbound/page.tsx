"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession, aktifLokasiId } from "@/lib/auth";
import UploadModal from "@/components/UploadModal";
import Pagination, { paginate, totalPagesOf } from "@/components/Pagination";
import { useToast } from "@/components/ToastProvider";

type BmRow = {
  id_barang_masuk: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  nama_produk: string;
  jumlah: number;
  tanggal_masuk: string;
  nama_driver: string;
  no_mobil: string;
  status: string;
  catatan: string;
  tipe_penerimaan: string;
  shipment_id: string;
  dibuat_oleh?: string;
  ritase?: number | null;
};

type TransaksiRow = {
  key: string;
  tanggal: string;
  ginShipment: string;
  nama_driver: string;
  no_mobil: string;
  jumlah_item: number;
  dibuat_oleh: string;
  ritase: number | null;
  status: string;
  shipmentRaw: string;
  tipe_detail: string;
};

const PAGE_SIZE_LOCAL = 10;
const FILTER_KEY = "sailendra_inbound_filter_v1";

const TIPE_OPTIONS = [
  { v: "primary", label: "Primary", dot: "#1D4ED8" },
  { v: "secondary_manual", label: "Secondary Manual", dot: "#D97706" },
  { v: "secondary_outbound", label: "Secondary Dari Outbound", dot: "#92400E" },
  { v: "xwh", label: "Primary XWH", dot: "#0F766E" },
  { v: "foc_manual", label: "FOC Manual", dot: "#DB2777" },
  { v: "foc_outbound", label: "FOC Dari Outbound", dot: "#9D174D" },
  { v: "reject", label: "REJECT", dot: "#DC2626" },
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
const isAutoOutbound = (r: BmRow) => (r.catatan || "").includes("Auto dari Outbound");
const kategoriOf = (r: BmRow): string => {
  const t = tipeNorm(r.tipe_penerimaan);
  const auto = isAutoOutbound(r);
  if (t === "SECONDARY") return auto ? "secondary_outbound" : "secondary_manual";
  if (t === "FOC") return auto ? "foc_outbound" : "foc_manual";
  if (t === "PRIMARY XWH") return "xwh";
  if (t === "REJECT") return "reject";
  return "primary";
};

const statusColor = (s: string): { bg: string; color: string } => {
  const st = (s || "").toLowerCase();
  if (st === "selesai") return { bg: "#d1fae5", color: "#065f46" };
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
.inbound-page { display: flex; flex-direction: column; gap: 7px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.inbound-toolbar { padding: 8px; display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.inbound-search-wrap { position: relative; flex: 1; min-width: 200px; }
.inbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px 0 12px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; box-sizing: border-box; }
.inbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.inbound-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); text-decoration: none; border: 0; background: transparent; cursor: pointer; }
.inbound-reset-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: transparent; border: 1px dashed #cbd5e1; color: var(--text-soft); font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.inbound-reset-btn:hover { color: #DC2626; border-color: #DC2626; }
.inbound-filter-panel { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.inbound-date-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.inbound-date-field { display: flex; flex-direction: column; gap: 4px; }
.inbound-date-field label { font-size: 10px; font-weight: 850; color: var(--text-soft); }
.inbound-date-field input { height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.inbound-date-field input:focus { background: #FFFFFF; border-color: var(--primary); }
.inbound-active-hint { font-size: 10px; font-weight: 750; color: var(--text-soft); }
.inbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.inbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-upload-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
.inbound-upload-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.inbound-filter-title { font-size: 11px; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.4px; }
.inbound-tipe-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.inbound-tipe-check { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-main); border: 1px solid #e2e7f0; background: #fbfcff; border-radius: 999px; padding: 5px 11px; cursor: pointer; user-select: none; }
.inbound-tipe-check input { accent-color: var(--primary); }
.inbound-tipe-check.is-on { background: var(--primary-soft); border-color: rgba(25,25,112,0.3); }
.inbound-status-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.inbound-status-check { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-main); border: 1px solid #e2e7f0; background: #fbfcff; border-radius: 999px; padding: 5px 11px; cursor: pointer; user-select: none; }
.inbound-status-check input { accent-color: var(--primary); }
.inbound-status-check.is-on { background: var(--primary-soft); border-color: rgba(25,25,112,0.3); }
.inbound-tipe-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.inbound-table-wrap { overflow-x: auto; }
.inbound-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.inbound-table th { text-align: left; font-weight: 900; color: var(--text-main); background: #f7f9fd; border-bottom: 1px solid #e9edf5; padding: 8px 10px; white-space: nowrap; }
.inbound-table th.sortable { cursor: pointer; user-select: none; }
.inbound-table th.sortable:hover { background: #eef2fb; }
.inbound-table th .sort-ico { margin-left: 5px; font-size: 9px; color: var(--text-soft); }
.inbound-table th.is-sorted .sort-ico { color: var(--primary); }
.inbound-table td { padding: 8px 10px; border-bottom: 1px solid #f1f4fa; color: var(--text-main); font-weight: 700; white-space: nowrap; }
.inbound-table tbody tr:hover { background: #f9fbff; }
.inbound-table tbody tr { cursor: pointer; }
.inbound-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 850; border-radius: 999px; padding: 2px 8px; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; white-space: nowrap; }
.inbound-badge .inbound-tipe-dot { width: 6px; height: 6px; }
`;

export default function InboundPage() {
  const session = useSession();
  const router = useRouter();
  const multi = !!session && isMultiRole(session.user.role);
  const { toast } = useToast();
  // Filter tersimpan (tetap saat bolak-balik driver/detail).
  // Direset otomatis oleh AppLayout saat pindah ke halaman selain /inbound*.
  const [savedOnce] = useState<SavedFilter>(() =>
    typeof window === "undefined" ? { q: "", tipe: [], status: [], dari: "", sampai: "" } : loadSaved()
  );
  const [rows, setRows] = useState<BmRow[]>([]);
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

  // State untuk Upload Excel OTM
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

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
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah file.", "error");
    } finally {
      setUploading(false);
    }
  };

  if (!session || !loaded) return null;

  const canAdd = session && !["Support", "Forklift"].includes(session.user.role);
  const filterActive = tipe.length > 0 || status.length > 0 || dari !== "" || sampai !== "" || keyword.trim() !== "";

  // Satu baris = satu transaksi (grup driver + shipment), bukan per item produk.
  const mapTrans: Record<string, TransaksiRow> = {};
  const catCount: Record<string, Record<string, number>> = {};
  rows.forEach((row) => {
    const t = dateOnly(row.tanggal_masuk);
    if (!t || t.startsWith("0000")) return;
    const nama = (row.nama_driver || "").trim() || "Tanpa nama driver";
    const ship = (row.shipment_id || "").trim() || "Tanpa Shipment";
    const key = `${nama}::${ship}`;
    if (!mapTrans[key]) {
      mapTrans[key] = {
        key,
        tanggal: t,
        ginShipment: ship,
        nama_driver: nama,
        no_mobil: row.no_mobil || "",
        jumlah_item: 0,
        dibuat_oleh: row.dibuat_oleh || "",
        ritase: row.ritase ?? null,
        status: row.status || "",
        shipmentRaw: row.shipment_id || "",
        tipe_detail: "",
      };
      catCount[key] = {};
    }
    mapTrans[key].jumlah_item++;
    if (!mapTrans[key].no_mobil && row.no_mobil) mapTrans[key].no_mobil = row.no_mobil;
    if (!mapTrans[key].dibuat_oleh && row.dibuat_oleh) mapTrans[key].dibuat_oleh = row.dibuat_oleh;
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
    <div className="inbound-page">
      <style>{css}</style>

      <div className="inbound-card">
        <div className="inbound-toolbar">
          <div className="inbound-search-wrap">
            <input type="text" className="inbound-search-input" value={search}
              placeholder="Cari produk, driver, DN, shipment, batch, blok, catatan..." autoComplete="off"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setKeyword(search.trim()); }} />
            {search.trim() !== "" && (
              <button type="button" className="inbound-search-clear" aria-label="Bersihkan pencarian"
                onClick={() => { setSearch(""); setKeyword(""); }}>
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>

          {filterActive && (
            <button type="button" className="inbound-reset-btn" onClick={resetFilter}>
              <i className="bi bi-arrow-counterclockwise"></i>
              Reset
            </button>
          )}

          {canAdd && (
            <>
              <button type="button" className="inbound-upload-btn" onClick={() => setShowUpload(true)} disabled={uploading}>
                <i className="bi bi-upload"></i>
                Upload OTM
              </button>
              <Link className="inbound-add-btn" href="/inbound/form">
                <i className="bi bi-plus-lg"></i>
                Tambah Inbound
              </Link>
            </>
          )}
        </div>

        <div className="inbound-filter-panel">
          <div>
            <div className="inbound-filter-title" style={{ marginBottom: 6 }}>Tipe Penerimaan</div>
            <div className="inbound-tipe-grid">
              {TIPE_OPTIONS.map((o) => {
                const on = tipe.includes(o.v);
                return (
                  <label key={o.v} className={`inbound-tipe-check ${on ? "is-on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleTipe(o.v)} />
                    <span className="inbound-tipe-dot" style={{ background: o.dot }}></span>
                    {o.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className="inbound-filter-title" style={{ marginBottom: 6 }}>Status</div>
            <div className="inbound-status-grid">
              {STATUS_OPTIONS.map((o) => {
                const on = status.includes(o.v);
                return (
                  <label key={o.v} className={`inbound-status-check ${on ? "is-on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleStatus(o.v)} />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className="inbound-filter-title" style={{ marginBottom: 6 }}>Range Tanggal</div>
            <div className="inbound-date-row">
              <div className="inbound-date-field">
                <label>Dari</label>
                <input type="date" value={dari} max={sampai || undefined} onChange={(e) => setDari(e.target.value)} />
              </div>
              <div className="inbound-date-field">
                <label>Sampai</label>
                <input type="date" value={sampai} min={dari || undefined} onChange={(e) => setSampai(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="inbound-active-hint">
            Filter tersimpan otomatis — tetap aktif saat membuka detail, ter-reset saat pindah halaman lain atau tekan Reset.
          </div>
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

      <div className="inbound-card">
        {paged.length === 0 ? (
          <div className="inbound-empty">
            {filterActive ? "Tidak ada data yang cocok dengan filter/pencarian." : "Tidak ada data inbound."}
          </div>
        ) : (
          <>
            <div className="inbound-table-wrap">
              <table className="inbound-table">
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
                    if (item.shipmentRaw) qp.set("shipment", item.shipmentRaw);
                    if (item.tipe_detail) qp.set("tipe_detail", item.tipe_detail);
                    if (multi) {
                      const l = lokasiParam(session);
                      if (l) { const [k, v] = l.split("="); if (v) qp.set(k, v); }
                    }
                    return (
                      <tr key={item.key}
                        onClick={() => { router.push(`/inbound/detail/${encodeURIComponent(item.tanggal)}?${qp.toString()}`); }}>
                        <td>{item.tanggal}</td>
                        <td><span className="inbound-badge">{item.ginShipment}</span></td>
                        <td>{item.nama_driver}</td>
                        <td>{item.no_mobil || "-"}</td>
                        <td>{item.jumlah_item}</td>
                        <td>{item.dibuat_oleh || "-"}</td>
                        <td>{item.ritase ?? "-"}</td>
                        <td><span className="inbound-badge" style={ss}>{item.status || "Draft"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={sorted.length} pageSize={PAGE_SIZE_LOCAL} onChange={setPage} />
    </div>
  );
}
