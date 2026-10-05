"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  status: string;
  catatan: string;
  tipe_penerimaan: string;
  shipment_id: string;
};

type TanggalItem = {
  tanggal: string;
  total_item: number;
  total_qty: number;
  breakdown: Record<string, number>;
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
const kategoriLabel = (k: string) => TIPE_OPTIONS.find((o) => o.v === k)?.label || k;
const kategoriDot = (k: string) => TIPE_OPTIONS.find((o) => o.v === k)?.dot || "#6b7280";

const css = `
.inbound-page { display: flex; flex-direction: column; gap: 7px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.inbound-toolbar { padding: 8px; display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.inbound-search-wrap { position: relative; flex: 1; min-width: 200px; }
.inbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px 0 12px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.inbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.inbound-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); text-decoration: none; border: 0; background: transparent; cursor: pointer; }
.inbound-reset-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: transparent; border: 1px dashed #cbd5e1; color: var(--text-soft); font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.inbound-reset-btn:hover { color: #DC2626; border-color: #DC2626; }
.inbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.inbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-upload-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
.inbound-upload-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.inbound-filter-panel { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.inbound-filter-title { font-size: 11px; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.4px; }
.inbound-tipe-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.inbound-tipe-check { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-main); border: 1px solid #e2e7f0; background: #fbfcff; border-radius: 999px; padding: 5px 11px; cursor: pointer; user-select: none; }
.inbound-tipe-check input { accent-color: var(--primary); }
.inbound-tipe-check.is-on { background: var(--primary-soft); border-color: rgba(25,25,112,0.3); }
.inbound-tipe-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.inbound-date-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.inbound-date-field { display: flex; flex-direction: column; gap: 4px; }
.inbound-date-field label { font-size: 10px; font-weight: 850; color: var(--text-soft); }
.inbound-date-field input { height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.inbound-date-field input:focus { background: #FFFFFF; border-color: var(--primary); }
.inbound-active-hint { font-size: 10px; font-weight: 750; color: var(--text-soft); }
.inbound-grid { display: flex; flex-direction: column; gap: 7px; }
.inbound-date-card { padding: 8px 8px 8px 11px; text-decoration: none; color: inherit; display: block; border-left: 3px solid #3B82F6; }
.inbound-date-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.inbound-card-top { display: flex; align-items: center; gap: 8px; }
.inbound-date-title { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.inbound-meta { font-size: 10px; font-weight: 750; color: var(--text-soft); margin-top: 3px; }
.inbound-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.inbound-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 850; border-radius: 999px; padding: 2px 8px; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; white-space: nowrap; }
.inbound-badge .inbound-tipe-dot { width: 6px; height: 6px; }
`;

export default function InboundTanggalPage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const { toast } = useToast();
  // Filter tersimpan (tetap saat bolak-balik driver/detail).
  // Direset otomatis oleh AppLayout saat pindah ke halaman selain /inbound*.
  const [savedOnce] = useState<SavedFilter>(() =>
    typeof window === "undefined" ? { q: "", tipe: [], dari: "", sampai: "" } : loadSaved()
  );
  const [rows, setRows] = useState<BmRow[]>([]);
  const [search, setSearch] = useState(savedOnce.q);
  const [keyword, setKeyword] = useState(savedOnce.q);
  const [tipe, setTipe] = useState<string[]>(savedOnce.tipe);
  const [dari, setDari] = useState(savedOnce.dari);
  const [sampai, setSampai] = useState(savedOnce.sampai);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  // State untuk Upload Excel OTM
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

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
  const filterActive = tipe.length > 0 || dari !== "" || sampai !== "" || keyword.trim() !== "";

  // All data campur: satu kartu per tanggal berisi semua tipe penerimaan.
  // 1 transaksi = 1 grup (driver + shipment), sama seperti halaman driver
  // (bukan jumlah baris item). Badge per tipe = jumlah grup (klasifikasi
  // kategori terbanyak di grup) sehingga total badge = total transaksi.
  const map: Record<string, TanggalItem> = {};
  const groupCat: Record<string, Record<string, Record<string, number>>> = {};
  rows.forEach((row) => {
    const t = dateOnly(row.tanggal_masuk);
    if (!t || t.startsWith("0000")) return;
    const g = `${(row.nama_driver || "").trim() || "Tanpa nama driver"}::${(row.shipment_id || "").trim() || "Tanpa Shipment"}`;
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
              Filter tersimpan otomatis — tetap aktif saat membuka driver/detail, ter-reset saat pindah halaman lain atau tekan Reset.
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

      {paged.length === 0 ? (
        <div className="inbound-card inbound-empty">
          {filterActive ? "Tidak ada data yang cocok dengan filter/pencarian." : "Tidak ada data tanggal inbound."}
        </div>
      ) : (
        <div className="inbound-grid">
          {paged.map((item) => {
            const qp = new URLSearchParams();
            if (tipeKey) qp.set("tipe_detail", tipeKey);
            if (multi) {
              const l = lokasiParam(session);
              if (l) { const [k, v] = l.split("="); if (v) qp.set(k, v); }
            }
            const qs = qp.toString();
            return (
              <Link key={item.tanggal} className="inbound-card inbound-date-card"
                href={`/inbound/driver/${encodeURIComponent(item.tanggal)}${qs ? `?${qs}` : ""}`}>
                <div className="inbound-card-top">
                  <i className="bi bi-calendar3" style={{ color: "var(--primary)", fontSize: 16 }}></i>
                  <div>
                    <div className="inbound-date-title">{item.tanggal}</div>
                    <div className="inbound-meta">{item.total_item} transaksi</div>
                  </div>
                  <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
                </div>
                <div className="inbound-badges">
                  {Object.entries(item.breakdown).sort().map(([k, c]) => (
                    <span key={k} className="inbound-badge">
                      <span className="inbound-tipe-dot" style={{ background: kategoriDot(k) }}></span>
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
    </div>
  );
}
