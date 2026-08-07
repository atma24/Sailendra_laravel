"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { isMultiRole, useSession, type Session } from "@/lib/auth";

type Row = Record<string, string | number | null>;
type Preview = { success: boolean; is_gabungan?: boolean; periode?: string; count?: number; items?: Row[]; inbound?: Row[]; outbound?: Row[] };
type Loc = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };

const TYPES = [
  { key: "inbound", label: "Inbound", icon: "bi-box-arrow-in-down" },
  { key: "outbound", label: "Outbound", icon: "bi-box-arrow-up" },
  { key: "gabungan", label: "Gabungan", icon: "bi-file-earmark-text" },
  { key: "mutasi", label: "Mutasi", icon: "bi-arrow-left-right" },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];

const ENDPOINT: Record<TypeKey, string> = {
  inbound: "/laporan/barang-masuk",
  outbound: "/laporan/barang-keluar",
  gabungan: "/laporan/gabungan",
  mutasi: "/laporan/mutasi",
};

const norm = (v: unknown) => String(v ?? "").trim();
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const COL_LABEL: Record<string, string> = {
  no: "No", id_pengguna_lokasi: "ID Lokasi", nama_pengguna_lokasi: "Nama Lokasi", dibuat_oleh: "Dibuat Oleh",
  tanggal_masuk: "Tanggal Masuk", tanggal_keluar: "Tanggal Keluar", created_at: "Tanggal Mutasi",
  nama_driver: "Driver", no_mobil: "No Mobil", no_dn: "No DN", tipe_penerimaan: "Tipe", asal_pabrik: "Asal Pabrik",
  tipe_pengeluaran: "Tipe", tujuan: "Tujuan", nama_produk: "Produk", jumlah: "Jumlah", satuan: "Satuan",
  best_before: "Best Before", batch: "Batch", status: "Status", durasi_input: "Durasi Input", catatan: "Catatan",
  jenis_mutasi: "Jenis Mutasi", lokasi_sumber: "Lokasi Sumber", lokasi_tujuan: "Lokasi Tujuan",
  diperbarui_oleh: "Diubah Oleh", diperbarui_pada: "Waktu Diubah", catatan_perubahan: "Alasan Diubah",
};

const base = ["id_pengguna_lokasi", "nama_pengguna_lokasi", "dibuat_oleh"];
const aud = ["diperbarui_oleh", "diperbarui_pada", "catatan_perubahan"];

function columnsFor(type: TypeKey): string[] {
  if (type === "mutasi") return ["no", ...base, "created_at", "nama_produk", "jumlah", "satuan", "best_before", "jenis_mutasi", "lokasi_sumber", "lokasi_tujuan", "catatan"];
  if (type === "inbound") return ["no", ...base, "tanggal_masuk", "nama_driver", "no_mobil", "no_dn", "tipe_penerimaan", "asal_pabrik", "nama_produk", "jumlah", "satuan", "best_before", "batch", "durasi_input", "catatan", ...aud];
  return ["no", ...base, "tanggal_keluar", "nama_driver", "no_mobil", "tipe_pengeluaran", "tujuan", "nama_produk", "jumlah", "satuan", "best_before", "batch", "status", "durasi_input", "catatan", ...aud];
}

const css = `
.report-page-container { display: flex; flex-direction: column; gap: 12px; padding-bottom: 20px; }
.report-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 12px; padding: 24px 28px; }
.report-title { font-size: 16px; font-weight: 950; color: var(--primary); margin-bottom: 20px; letter-spacing: -0.2px; }
.report-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.report-label { display: block; font-size: 11px; font-weight: 850; color: var(--text-main); margin-bottom: 2px; }
.report-type-selector { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 4px; }
.report-type-option { position: relative; }
.report-type-option input[type="radio"] { position: absolute; opacity: 0; width: 0; height: 0; }
.report-type-label { display: flex; align-items: center; justify-content: center; gap: 8px; height: 40px; border: 1px solid #e2e7f0; border-radius: 8px; background: #fbfcff; color: var(--text-main); font-size: 12px; font-weight: 800; cursor: pointer; transition: .15s ease; user-select: none; }
.report-type-label:hover { background: var(--primary); border-color: var(--primary); color: #fff; }
.report-type-option input[type="radio"]:checked + .report-type-label { background: var(--primary); border-color: var(--primary); color: #fff; box-shadow: 0 4px 12px rgba(25,25,112,.15); font-weight: 900; }
.report-date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.report-input-date { width: 100%; height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); font-size: 12px; font-weight: 750; outline: none; cursor: pointer; transition: .18s ease; }
.report-input-date:focus { background: #fff; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,.07); }
.fake-select-report { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); font-size: 12px; font-weight: 750; cursor: pointer; }
.report-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
.report-btn-preview { border: 1px solid var(--primary); outline: 0; border-radius: 9px; background: #fff; color: var(--primary); height: 42px; padding: 0 16px; font-size: 13px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: transform .18s ease, background .18s ease; font-family: inherit; }
.report-btn-preview:hover { background: #f4f6fa; transform: translateY(-1px); }
.report-btn-preview:disabled { opacity: .6; cursor: not-allowed; transform: none; }
.report-btn-submit { border: 0; outline: 0; border-radius: 9px; background: var(--primary); color: #fff; height: 42px; padding: 0 16px; font-size: 13px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; font-family: inherit; }
.report-btn-submit:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,.15); }
.report-btn-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }
.report-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 9px; padding: 10px 14px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
.preview-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,.45); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 24px; backdrop-filter: blur(2px); }
.preview-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 95%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(15,23,42,.18); overflow: hidden; }
.preview-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e9edf5; flex-shrink: 0; }
.preview-modal-title { font-size: 15px; font-weight: 950; color: var(--primary); letter-spacing: -0.2px; }
.preview-modal-close { width: 36px; height: 36px; border: 1px solid #e2e7f0; border-radius: 10px; background: #fbfcff; color: var(--text-main); font-size: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: .15s ease; }
.preview-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.preview-table-wrap { margin-top: 14px; border: 1px solid #e2e7f0; border-radius: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.preview-table { width: auto; min-width: 1000px; border-collapse: collapse; font-size: 11px; text-align: left; table-layout: auto; }
.preview-table th { background: #fbfcff; color: var(--text-main); font-weight: 850; padding: 10px; border-bottom: 2px solid #e2e7f0; white-space: nowrap; }
.preview-table td { padding: 8px 10px; border-bottom: 1px solid #e9edf5; color: var(--text-main); font-weight: 700; white-space: nowrap; }
.preview-badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 900; background: #eef2f7; color: var(--primary); margin-bottom: 10px; margin-right: 6px; }
.preview-status { font-size: 11px; font-weight: 800; color: var(--text-soft); text-align: center; padding: 20px 0; }
.preview-status.err { color: #dc2626; }
.section-title { font-weight: 700; color: var(--text-main); font-size: 12px; margin: 6px 0 10px; }
.loc-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,.5); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
.loc-modal-content { background: #fff; width: 100%; max-width: 440px; border-radius: 12px; display: flex; flex-direction: column; max-height: 85vh; margin: 20px; box-shadow: 0 20px 50px rgba(15,23,42,.2); overflow: hidden; }
.loc-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 16px; border-bottom: 1px solid #f1f5f9; }
.loc-modal-title { font-weight: 800; color: var(--primary); font-size: 15px; margin: 0; }
.loc-modal-action { color: var(--primary); font-size: 12px; cursor: pointer; font-weight: 700; background: none; border: 0; font-family: inherit; }
.loc-modal-search { padding: 16px 20px; position: relative; }
.loc-modal-search i { position: absolute; left: 34px; top: 26px; color: var(--text-soft); }
.loc-search-input { width: 100%; padding: 10px 14px 10px 40px; border-radius: 8px; border: 1px solid #e2e7f0; outline: none; font-size: 13px; color: var(--text-main); background: #fbfcff; font-family: inherit; }
.loc-search-input:focus { border-color: var(--primary); background: #fff; }
.loc-modal-body { flex: 1; overflow-y: auto; padding: 0 20px 20px; }
.loc-cb-item { display: flex; align-items: center; padding: 12px; border: 1px solid #e2e7f0; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: .2s; }
.loc-cb-item:hover { border-color: var(--primary); }
.loc-cb-item.checked { border-color: var(--primary); background: #f7f9ff; }
.loc-cb-item input { display: none; }
.loc-cb-item .loc-box { width: 18px; height: 18px; border: 2px solid #e2e7f0; border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center; transition: all .2s; }
.loc-cb-item.checked .loc-box { background: var(--primary); border-color: var(--primary); }
.loc-cb-item.checked .loc-box::after { content: '✓'; color: #fff; font-size: 10px; font-weight: bold; }
.loc-cb-text { font-size: 13px; font-weight: 600; color: var(--text-main); }
.loc-modal-footer { padding: 16px 20px; background: #fff; border-top: 1px solid #f1f5f9; }
.loc-btn-apply { width: 100%; padding: 12px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: .2s; font-family: inherit; }
.loc-btn-apply:hover { filter: brightness(1.1); }
.loc-empty { padding: 20px; text-align: center; color: var(--text-soft); font-size: 12px; font-weight: 700; }
@media (max-width: 768px) { .preview-modal-overlay, .loc-modal-overlay { padding: 12px; } .preview-modal, .loc-modal-content { max-height: 90vh; border-radius: 12px; } .preview-modal-header, .loc-modal-header { padding: 16px 18px; } .preview-modal-body, .loc-modal-search, .loc-modal-body { padding-left: 18px; padding-right: 18px; } .report-date-row, .report-actions-grid { grid-template-columns: 1fr; } }
`;

function makeToken(): string {
  try {
    const raw = localStorage.getItem("sailendra_session");
    if (raw) { const s = JSON.parse(raw); if (s?.token) return s.token; }
  } catch { /* ignore */ }
  return "";
}

export default function ReportPage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const [type, setType] = useState<TypeKey>("inbound");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");

  const [picking, setPicking] = useState(false);
  const [locSearch, setLocSearch] = useState("");
  const [locs, setLocs] = useState<Loc[]>([]);
  const [selIds, setSelIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pv, setPv] = useState<Preview | null>(null);

  useEffect(() => {
    if (!multi) return;
    let live = true;
    apiGet<Loc[]>("/pengguna-lokasi").then((r) => { if (live) setLocs(r.data || []); }).catch(() => {});
    return () => { live = false; };
  }, [multi]);

  const filtered = useMemo(
    () => locs.filter((l) => `${l.id_pengguna_lokasi} ${l.nama_pengguna_lokasi}`.toLowerCase().includes(locSearch.toLowerCase())),
    [locs, locSearch]
  );

  if (!session) return null;

  const allChecked = locs.length > 0 && selIds.size === locs.length;
  const locTrigger = selIds.size === 0
    ? "Pilih 1 atau lebih lokasi"
    : allChecked ? "-- Semua Lokasi --" : `${selIds.size} lokasi dipilih`;

  const toggleLoc = (id: string) => {
    setSelIds((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelIds(allChecked ? new Set() : new Set(locs.map((l) => l.id_pengguna_lokasi)));
  };

  const locParams = () => {
    const sp = new URLSearchParams();
    if (multi) {
      if (allChecked || selIds.size === 0) {
        sp.set("id_pengguna_lokasi", "all");
      } else {
        selIds.forEach((id) => sp.append("id_pengguna_lokasi[]", id));
      }
    } else {
      sp.append("id_pengguna_lokasi", String(session.user.id_pengguna_lokasi ?? ""));
    }
    return sp;
  };

  const toQuery = () => {
    const sp = locParams();
    sp.set("from", start);
    sp.set("to", end);
    sp.set("start_date", start);
    sp.set("end_date", end);
    if (type !== "gabungan") sp.set("mode", "range");
    return sp;
  };

  const doPreview = async () => {
    setLoading(true); setError("");
    try {
      const sp = toQuery();
      sp.set("format", "json");
      const res = await apiGet<Preview>(`${ENDPOINT[type]}?${sp.toString()}`);
      setPv(res.data || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat preview.");
    } finally { setLoading(false); }
  };

  const doDownload = async () => {
    setDownloading(true); setError("");
    try {
      const sp = toQuery();
      const res = await fetch(`/api${ENDPOINT[type]}?${sp.toString()}`, {
        headers: { Accept: "application/vnd.ms-excel", Authorization: `Bearer ${makeToken()}` },
      });
      if (!res.ok) { setError((await res.text()).slice(0, 200)); return; }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const name = m ? m[1] : `Laporan_${type}_${start}_sd_${end}.xls`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunduh.");
    } finally { setDownloading(false); }
  };

  const today = new Date().toISOString().slice(0, 10);

  const renderTable = (key: TypeKey, items: Row[] | undefined) => {
    const cols = columnsFor(key);
    if (!items || items.length === 0) return <div className="preview-status">Tidak ada catatan aktivitas operasional pada tanggal ini.</div>;
    return (
      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>{cols.map((c) => <th key={c}>{COL_LABEL[c] || c}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => <td key={c}>{c === "no" ? i + 1 : esc(row[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="report-page-container">
      <style>{css}</style>

      <div className="report-card">
        <div className="report-title">Unduh Report</div>

        {error && <div className="report-error">{error}</div>}

        <div className="report-group">
          <label className="report-label">Pilih Jenis Laporan</label>
          <div className="report-type-selector">
            {TYPES.map((t) => (
              <div key={t.key} className="report-type-option">
                <input type="radio" name="jenis_laporan" id={`rep_${t.key}`} value={t.key} checked={type === t.key} onChange={() => setType(t.key)} />
                <label htmlFor={`rep_${t.key}`} className="report-type-label">
                  <i className={t.icon}></i> {t.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {multi && (
          <div className="report-group">
            <label className="report-label">Pilih Lokasi</label>
            <div className="fake-select-report" onClick={() => setPicking(true)}>
              <span>{locTrigger}</span>
              <i className="bi bi-caret-down-fill" style={{ fontSize: 10 }}></i>
            </div>
          </div>
        )}

        <div className="report-group">
          <div className="report-date-row">
            <div>
              <label htmlFor="start_date" className="report-label" style={{ marginBottom: 4 }}>Dari Tanggal</label>
              <input type="date" id="start_date" className="report-input-date" value={start || today} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="end_date" className="report-label" style={{ marginBottom: 4 }}>Sampai Tanggal</label>
              <input type="date" id="end_date" className="report-input-date" value={end || today} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className="report-actions-grid">
          <button type="button" className="report-btn-preview" onClick={doPreview} disabled={loading}>
            <i className="bi bi-eye"></i>
            <span>{loading ? "Memuat..." : "Preview Data"}</span>
          </button>
          <button type="button" className="report-btn-submit" onClick={doDownload} disabled={downloading}>
            <i className="bi bi-file-earmark-excel"></i>
            <span>{downloading ? "Mengunduh..." : "Unduh Laporan"}</span>
          </button>
        </div>
      </div>

      {picking && (
        <div className="loc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPicking(false); }}>
          <div className="loc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="loc-modal-header">
              <h3 className="loc-modal-title">Pilih Lokasi</h3>
              <button type="button" className="loc-modal-action" onClick={toggleAll}>{allChecked ? "Deselect All" : "Select All"}</button>
            </div>
            <div className="loc-modal-search">
              <i className="bi bi-search"></i>
              <input type="text" className="loc-search-input" placeholder="Cari ID atau Nama Lokasi" value={locSearch} onChange={(e) => setLocSearch(e.target.value)} />
            </div>
            <div className="loc-modal-body">
              {filtered.length === 0 && <div className="loc-empty">Tidak ada lokasi</div>}
              {filtered.map((l) => {
                const id = l.id_pengguna_lokasi;
                const checked = selIds.has(id);
                return (
                  <label key={id} className={`loc-cb-item${checked ? " checked" : ""}`} onClick={() => toggleLoc(id)}>
                    <input type="checkbox" checked={checked} readOnly />
                    <div className="loc-box"></div>
                    <span className="loc-cb-text">{id} - {l.nama_pengguna_lokasi}</span>
                  </label>
                );
              })}
            </div>
            <div className="loc-modal-footer">
              <button type="button" className="loc-btn-apply" onClick={() => setPicking(false)}>
                {selIds.size === 0 ? "Pilih Lokasi" : allChecked ? "Gunakan Semua Lokasi" : `Gunakan ${selIds.size} Lokasi`}
              </button>
            </div>
          </div>
        </div>
      )}

      {pv && (
        <div className="preview-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPv(null); }}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <div className="preview-modal-title">Preview Data Terpilih</div>
              <button type="button" className="preview-modal-close" onClick={() => setPv(null)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="preview-modal-body">
              {pv.is_gabungan ? (
                <>
                  <span className="preview-badge">Total Inbound: {(pv.inbound || []).length} data</span>
                  <span className="preview-badge">Total Outbound: {(pv.outbound || []).length} data</span>
                  <div className="section-title">[ Data Inbound ]</div>
                  {renderTable("inbound", pv.inbound)}
                  <div className="section-title">[ Data Outbound ]</div>
                  {renderTable("outbound", pv.outbound)}
                </>
              ) : (
                <>
                  <span className="preview-badge">Total Ditemukan: {(pv.items || []).length} baris data</span>
                  {renderTable(type, pv.items)}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
