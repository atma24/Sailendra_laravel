"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, getUploadUrl } from "@/lib/api";
import { isMultiRole, useSession } from "@/lib/auth";
import UploadModal from "@/components/UploadModal";
import { useToast } from "@/components/ToastProvider";
import { chunkExcelFile } from "@/lib/excelChunk";

type TraceRow = {
  id_traceability: number;
  id_pengguna_lokasi: string;
  nama_depo: string;
  nama_driver: string;
  driver_gudang: string;
  sales_group: string;
  nama_customer: string;
  so_number: string;
  gin_no: string;
  nama_produk: string;
  jumlah: number;
  best_before: string;
  batch_number: string;
  nama_plant: string;
};

type Produk = { id_produk: number; nama_produk: string };

type TraceResp = {
  success: boolean;
  data: TraceRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

const norm = (v: unknown) => String(v ?? "").trim();
const stripPlant = (name: unknown) => norm(name).replace(/^9000\s+ID\s+/i, "");
const stripDash = (s: string) => s.replace(/[-/\s]/g, "");

const css = `
.trace-page { display: flex; flex-direction: column; gap: 7px; }
.trace-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; }
.trace-toolbar { padding: 8px; display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
.trace-search-wrap { flex: 1; min-width: 140px; position: relative; }
.trace-search-icon { position: absolute; top: 50%; left: 11px; transform: translateY(-50%); color: #8a93a3; font-size: 13px; }
.trace-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: #172033; outline: none; }
.trace-search-input:focus { background: #FFFFFF; border-color: #191970; box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.trace-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: #191970; color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer; white-space: nowrap; }
.trace-add-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(25,25,112,0.20); }
.btn-export-excel { background: #2f8f46 !important; color: #fff !important; }
.btn-export-pdf { background: #d33b3e !important; color: #fff !important; }
.filter-wrap { position: relative; }
.filter-popup { position: absolute; top: 38px; right: 0; width: 280px; background: #fff; border: 1px solid #e2e7f0; border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,0.12); z-index: 1000; display: flex; flex-direction: column; overflow: hidden; }
.filter-popup-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e9edf5; background: #fbfcff; }
.filter-group { border-bottom: 1px solid #e9edf5; }
.filter-group-header { padding: 10px 16px; font-size: 11px; font-weight: 800; color: #172033; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.filter-group-content { padding: 0 16px 12px; }
.filter-search-box { position: relative; margin: 5px 0 10px; }
.filter-search-box i { position: absolute; top: 50%; left: 10px; transform: translateY(-50%); color: #8a93a3; font-size: 11px; }
.filter-search-box input { width: 100%; padding: 6px 10px 6px 28px; border: 1px solid #e2e7f0; border-radius: 6px; font-size: 11px; font-weight: 600; outline: none; background: #fbfcff; box-sizing: border-box; }
.filter-list-container { max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; padding-right: 5px; }
.filter-label { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: #172033; cursor: pointer; }
.filter-label input[type="checkbox"] { accent-color: #191970; width: 14px; height: 14px; cursor: pointer; }
.trace-table-wrap { overflow-x: auto; padding: 0 8px 8px; }
.trace-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.trace-table th { text-align: left; padding: 9px 8px; font-size: 9.5px; font-weight: 850; color: #8a93a3; border-bottom: 1px solid #e9edf5; white-space: nowrap; }
.trace-table td { padding: 9px 8px; font-size: 11px; font-weight: 700; color: #172033; border-bottom: 1px solid #f1f4fa; white-space: nowrap; }
.trace-table tbody tr { cursor: pointer; }
.trace-table tbody tr:hover td { background: #fbfcff; }
.trace-empty { padding: 30px; text-align: center; color: #8a93a3; font-size: 12px; font-weight: 700; }
.trace-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 0; flex-wrap: wrap; gap: 8px; }
.trace-pagination { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; }
.trace-pagination span { font-size: 11px; font-weight: 700; color: #6b7280; }
.trace-page-btn { height: 28px; padding: 0 10px; font-size: 10px; }
.filter-badge { background: #191970; color: #fff; padding: 1px 5px; border-radius: 10px; font-size: 9px; margin-left: 3px; }
.trace-upload-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 16px; }
.trace-upload-modal { background: #fff; border-radius: 11px; padding: 20px; width: 480px; max-width: 100%; box-shadow: 0 12px 32px rgba(15,23,42,0.12); }
@media (max-width: 768px) {
  .trace-toolbar { align-items: stretch; }
  .filter-popup { position: fixed; top: auto; right: 16px; left: 16px; width: auto; }
}
`;

export default function TraceabilityPage() {
  const { toast } = useToast();
  const session = useSession();
  const router = useRouter();
  const multi = !!session && isMultiRole(session.user.role);

  const [rows, setRows] = useState<TraceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [tanggalList, setTanggalList] = useState<string[]>([]);
  const [selProduk, setSelProduk] = useState<number[]>([]);
  const [selTanggal, setSelTanggal] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [qProduk, setQProduk] = useState("");
  const [qTanggal, setQTanggal] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadLok, setUploadLok] = useState("");
  const [lokasiList, setLokasiList] = useState<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const canEdit = !!session && ["Supervisor", "SuperAdmin"].includes(session.user.role);

  const idLokasi = () =>
    multi ? "" : String(session?.user.id_pengguna_lokasi || "");

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const [pr, tr] = await Promise.all([
          apiGet<Produk[]>("/produk?limit=2000"),
          apiGet<string[]>(`/traceability/best-before${idLokasi() ? `?id_pengguna_lokasi=${idLokasi()}` : ""}`),
        ]);
        if (cancelled) return;
        setProdukList((pr.data || []).sort((a, b) => a.nama_produk.localeCompare(b.nama_produk)));
        setTanggalList(tr.data || []);
      } catch { /* keep empty */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(p));
      sp.set("limit", "100");
      if (!multi && session!.user.id_pengguna_lokasi) {
        sp.set("id_pengguna_lokasi", String(session!.user.id_pengguna_lokasi));
      }
      if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
      selTanggal.forEach((t) => sp.append("best_before[]", t));
      selProduk.forEach((id) => sp.append("id_produk[]", String(id)));
      const r = await apiGet<TraceRow[]>(`/traceability?${sp.toString()}`);
      const resp = r as unknown as TraceResp;
      setRows(resp.data || []);
      setTotal(resp.total || 0);
      setPages(resp.pages || 1);
      setPage(resp.page || 1);
    } catch {
      setRows([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, selTanggal, selProduk, session]);

  useEffect(() => {
    if (!session) return;
    load(1);
  }, [load, session]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  if (!session) return null;

  const filterCount = selProduk.length + selTanggal.length;

  const fetchAll = async () => {
    const sp = new URLSearchParams();
    sp.set("page", "1");
    sp.set("limit", "999999");
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    selTanggal.forEach((t) => sp.append("best_before[]", t));
    selProduk.forEach((id) => sp.append("id_produk[]", String(id)));
    const r = await apiGet<TraceRow[]>(`/traceability?${sp.toString()}`);
    return (r as unknown as TraceResp).data || [];
  };

  const cell = (v: unknown) => `<td>${String(norm(v)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`;

  const exportExcel = async () => {
    const data = await fetchAll();
    const tanggal = new Date().toISOString().slice(0, 10);
    const heads = ["Nama Depo", "Nama Driver", "Sales Group", "Nama Customer", "No SO", "No Gin", "Produk", "Qty", "Best Before", "Batch", "Plant"];
    const body = data.map((x) =>
      `<tr>${cell(x.nama_depo)}${cell(x.nama_driver || x.driver_gudang)}${cell(x.sales_group)}${cell(x.nama_customer)}`
      + `${cell(x.so_number)}${cell(x.gin_no)}${cell(x.nama_produk)}${cell(x.jumlah)}${cell(x.best_before)}${cell(x.batch_number)}${cell(stripPlant(x.nama_plant))}</tr>`
    ).join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
      <table border="1">
        <thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table></body></html>`;
    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Laporan_Traceability_${tanggal}.xls`;
    a.click();
  };

  const exportPdf = async () => {
    const data = await fetchAll();
    const tanggal = new Date().toISOString().slice(0, 10);
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = data.map((x, i) =>
      `<tr><td>${i + 1}</td>${cell(x.nama_depo)}${cell(x.nama_driver || x.driver_gudang)}${cell(x.sales_group)}`
      + `${cell(x.nama_customer)}${cell(x.so_number)}${cell(x.gin_no)}${cell(x.nama_produk)}${cell(x.jumlah)}${cell(x.best_before)}${cell(x.batch_number)}${cell(stripPlant(x.nama_plant))}</tr>`
    ).join("");
    w.document.write(`<!doctype html><html><head><title>Laporan Traceability</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111}
        h2{margin:0;font-size:16px;font-weight:bold}
        .sub{font-size:11px;color:#555;margin:6px 0 16px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th,td{border:1px solid #999;padding:4px 6px;text-align:left}
        th{background:#f0f0f0;font-weight:bold}
        .toolbar{position:fixed;top:0;left:0;right:0;background:#191970;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;z-index:999}
        .toolbar span{font-size:13px;font-weight:bold}
        .toolbar button{margin-left:auto;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:bold;cursor:pointer;background:#2f8f46;color:#fff}
        .toolbar button:hover{filter:brightness(1.1)}
        body.toolbar-pad{padding-top:54px}
        @media print{.toolbar{display:none}body.toolbar-pad{padding-top:0}}
      </style></head><body class="toolbar-pad">
      <div class="toolbar"><span>Template Laporan Traceability</span><button onclick="window.print()">Download PDF</button></div>
      <h1>Laporan Traceability</h1>
      <div class="sub">Periode Tanggal: <b>${tanggal}</b> &mdash; Total: ${data.length} data</div>
      <table><thead><tr><th>No</th>${["Nama Depo","Nama Driver","Sales Group","Nama Customer","No SO","No Gin","Produk","Qty","Best Before","Batch","Plant"].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
  };

  const [progressText, setProgressText] = useState("");

  const openUpload = async () => {
    setUploadMsg("");
    setUploadLok("");
    setProgressText("");
    if (fileRef.current) fileRef.current.value = "";
    if (multi) {
      try {
        const r = await apiGet<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>("/pengguna-lokasi");
        setLokasiList(r.data || []);
      } catch { setLokasiList([]); }
    }
    setShowUpload(true);
  };

  const doUploadSubmit = async (file: File) => {
    const lok = uploadLok || String(session!.user.id_pengguna_lokasi || "");
    if (!lok) { setUploadMsg("Pilih lokasi upload."); return; }
    setUploadBusy(true);
    setUploadMsg("");
    setProgressText("Membaca file Excel...");

    try {
      const chunks = await chunkExcelFile(file, 50);
      const totalChunks = chunks.length;

      const raw = localStorage.getItem("sailendra_session");
      const s = raw ? JSON.parse(raw) : null;
      const headers: HeadersInit = { Accept: "application/json" };
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;

      let lastMsg = "Upload selesai.";

      for (let i = 0; i < totalChunks; i++) {
        const currentChunk = chunks[i];
        if (totalChunks > 1) {
          setProgressText(`Memproses bagian ${i + 1} dari ${totalChunks} batch data...`);
        } else {
          setProgressText("Memproses data...");
        }

        const fd = new FormData();
        fd.append("file_excel", currentChunk);
        fd.append("upload_lokasi", lok);

        const res = await fetch("/api/traceability/upload-file", { method: "POST", headers, body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.success === false) throw new Error(`Batch ${i + 1}/${totalChunks} gagal: ${body.message || "Upload gagal."}`);
        const unmapped = body.unmapped ? ` (${body.unmapped} produk tak dikenal)` : "";
        lastMsg = `${body.message || "Upload selesai."}${unmapped}`;
      }

      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: lastMsg, type: "success" }));
      window.location.reload();
    } catch (e) {
      setUploadMsg(`Gagal: ${(e as Error).message}`);
      toast((e as Error).message || "Upload gagal.", "error");
    } finally {
      setUploadBusy(false);
      setProgressText("");
    }
  };

  const toggleTanggal = (t: string) =>
    setSelTanggal((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]);
  const toggleProduk = (id: number) =>
    setSelProduk((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const clearFilters = () => {
    setSelProduk([]);
    setSelTanggal([]);
    setQProduk("");
    setQTanggal("");
  };

  const filteredProduk = produkList.filter((p) =>
    stripDash(qProduk) === "" || stripDash(p.nama_produk).includes(stripDash(qProduk)));
  const filteredTanggal = tanggalList.filter((t) =>
    stripDash(qTanggal) === "" || stripDash(t).includes(stripDash(qTanggal)) || t.includes(qTanggal));

  return (
    <div className="trace-page">
      <style>{css}</style>

      <div className="trace-card">
        <div className="trace-header">
          <h3 style={{ fontSize: 13, fontWeight: 900, color: "#172033", margin: 0 }}>Traceability</h3>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="trace-add-btn btn-export-excel" onClick={exportExcel}>
              <i className="bi bi-file-earmark-excel"></i><span>Export Excel</span>
            </button>
            <button type="button" className="trace-add-btn btn-export-pdf" onClick={exportPdf}>
              <i className="bi bi-file-earmark-pdf"></i><span>Export PDF</span>
            </button>
            {canEdit && (
              <button type="button" className="trace-add-btn" onClick={openUpload}>
                <i className="bi bi-cloud-upload"></i><span>Upload Excel</span>
              </button>
            )}
          </div>
        </div>

        <div className="trace-toolbar">
          <div className="trace-search-wrap">
            <i className="bi bi-search trace-search-icon"></i>
            <input type="text" className="trace-search-input" placeholder="Cari SO, produk, batch, customer..."
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="filter-wrap">
            <button type="button" className="trace-add-btn" style={{ background: "#fff", color: "#172033", border: "1px solid #e2e7f0" }}
              onClick={() => setFilterOpen((o) => !o)}>
              <i className="bi bi-funnel"></i>
              <span>Filters{filterCount > 0 ? <span className="filter-badge">{filterCount}</span> : ""}</span>
            </button>

            {filterOpen && (
              <div className="filter-popup" onClick={(e) => e.stopPropagation()}>
                <div className="filter-popup-header">
                  <span style={{ fontWeight: 850, fontSize: 12, color: "#172033" }}>Filters</span>
                  <button type="button" onClick={clearFilters} style={{ fontSize: 10, color: "#191970", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}>Clear all</button>
                </div>

                <div className="filter-group">
                  <div className="filter-group-header" onClick={() => { /* open by default */ }}>
                    <i className="bi bi-chevron-down" style={{ fontSize: 10, width: 12 }}></i> Daftar Produk
                  </div>
                  <div className="filter-group-content">
                    <div className="filter-search-box">
                      <i className="bi bi-search"></i>
                      <input type="text" placeholder="Search produk..." value={qProduk} onChange={(e) => setQProduk(e.target.value)} />
                    </div>
                    <div className="filter-list-container">
                      {filteredProduk.map((p) => (
                        <label key={p.id_produk} className="filter-label">
                          <input type="checkbox" checked={selProduk.includes(p.id_produk)} onChange={() => toggleProduk(p.id_produk)} />
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nama_produk}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="filter-group">
                  <div className="filter-group-header">
                    <i className="bi bi-chevron-down" style={{ fontSize: 10, width: 12 }}></i> Tanggal (Best Before)
                  </div>
                  <div className="filter-group-content">
                    <div className="filter-search-box">
                      <i className="bi bi-search"></i>
                      <input type="text" placeholder="Ketik angka (misal: 0725)..." value={qTanggal} onChange={(e) => setQTanggal(e.target.value)} />
                    </div>
                    <div className="filter-list-container">
                      {filteredTanggal.length === 0 && <span style={{ fontSize: 10, color: "#8a93a3", textAlign: "center" }}>Tidak ada tanggal tersedia</span>}
                      {filteredTanggal.map((t) => (
                        <label key={t} className="filter-label">
                          <input type="checkbox" checked={selTanggal.includes(t)} onChange={() => toggleTanggal(t)} />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="trace-empty">Memuat data...</div>
        ) : rows.length === 0 ? (
          <div className="trace-empty">Belum ada data traceability.</div>
        ) : (
          <div className="trace-table-wrap">
            <table className="trace-table">
              <thead>
                <tr>
                  <th>Nama Depo</th><th>Nama Driver</th><th>Sales Group</th><th>Nama Customer</th>
                  <th>No SO</th><th>No Gin</th><th>Produk</th><th>Qty</th><th>Best Before</th><th>Batch</th><th>Plant</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id_traceability} onClick={() => router.push(`/traceability/detail/${r.id_traceability}`)}>
                    <td>{norm(r.nama_depo)}</td>
                    <td>{norm(r.nama_driver || r.driver_gudang)}</td>
                    <td>{norm(r.sales_group)}</td>
                    <td>{norm(r.nama_customer)}</td>
                    <td><strong>{norm(r.so_number)}</strong></td>
                    <td>{norm(r.gin_no)}</td>
                    <td>{norm(r.nama_produk)}</td>
                    <td>{norm(r.jumlah)}</td>
                    <td>{norm(r.best_before)}</td>
                    <td>{norm(r.batch_number)}</td>
                    <td>{stripPlant(r.nama_plant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="trace-pagination">
              <span>Total: {total} data</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" className="trace-add-btn trace-page-btn" disabled={page <= 1} onClick={() => load(page - 1)}>« Prev</button>
                <span>Page {page} of {pages}</span>
                <button type="button" className="trace-add-btn trace-page-btn" disabled={page >= pages} onClick={() => load(page + 1)}>Next »</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          open={showUpload}
          title="Upload Data Traceability"
          note="Upload file Excel traceability. Format kolom: DEPO, DRIVER GUDANG, DRIVER, NO GIN, SO NUMBER, NAMA CUSTOMER, ID PRODUK, NAMA PRODUK, QTY, PLANT, BEST BEFORE, BATCH NUMBER, SALES GROUP"
          onClose={() => setShowUpload(false)}
          onSubmit={doUploadSubmit}
          busy={uploadBusy}
          progressText={progressText}
        />
      )}
    </div>
  );
}