"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";

type BkRow = {
  id_barang_keluar: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  nama_produk: string;
  jumlah: number;
  tanggal_keluar: string;
  nama_driver: string;
  status: string;
};

type TanggalItem = { tanggal: string; total_item: number; total_qty: number };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);

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
`;

export default function OutboundTanggalPage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const [rows, setRows] = useState<BkRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<"" | "upload" | "import">("");
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
  const singleMap: Record<string, TanggalItem> = {};
  const lokasiMap: Record<string, { nama: string; tanggal_map: Record<string, TanggalItem> }> = {};

  const push = (map: Record<string, TanggalItem>, tgl: string, row: BkRow) => {
    if (!map[tgl]) map[tgl] = { tanggal: tgl, total_item: 0, total_qty: 0 };
    map[tgl].total_item++;
    map[tgl].total_qty += angka(row.jumlah);
  };

  rows.forEach((row) => {
    const t = dateOnly(row.tanggal_keluar);
    if (!t || t.startsWith("0000")) return;
    const key = `${t} ${row.nama_driver || ""} ${row.nama_produk || ""}`.toLowerCase();
    if (q !== "" && !key.includes(q)) return;

    if (multi) {
      const lok = String(row.id_pengguna_lokasi || "");
      if (!lokasiMap[lok]) lokasiMap[lok] = { nama: row.nama_pengguna_lokasi || lok, tanggal_map: {} };
      push(lokasiMap[lok].tanggal_map, t, row);
    } else {
      push(singleMap, t, row);
    }
  });

  const singleList = Object.values(singleMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const canAdd = !!session && ["SuperAdmin", "Supervisor", "Checker"].includes(session.user.role);
  const isSuperAdmin = !!session && session.user.role === "SuperAdmin";

  const openModal = async (which: "upload" | "import") => {
    setUploadMsg("");
    setUploadLok("");
    if (fileRef.current) fileRef.current.value = "";
    if (multi) {
      try {
        const r = await apiGet<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>("/pengguna-lokasi");
        setLokasiList(r.data || []);
      } catch {
        setLokasiList([]);
      }
    }
    setModal(which);
  };

  const uploadFile = async () => {
    if (!fileRef.current?.files?.[0]) { setUploadMsg("Pilih file terlebih dahulu."); return; }
    const lok = uploadLok || String(session!.user.id_pengguna_lokasi || "");
    if (!lok) { setUploadMsg("Pilih lokasi upload."); return; }
    setUploadBusy(true);
    setUploadMsg("");
    const fd = new FormData();
    fd.append("file_excel", fileRef.current.files[0]);
    fd.append("upload_lokasi", lok);
    fd.append("id_pengguna", String(session!.user.id_pengguna));
    try {
      const raw = localStorage.getItem("sailendra_session");
      const s = raw ? JSON.parse(raw) : null;
      const headers: HeadersInit = { Accept: "application/json" };
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;
      const res = await fetch(`/api/barang-keluar/${modal === "import" ? "import-file" : "upload-file"}`, {
        method: "POST",
        headers,
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) {
        throw new Error(body.message || "Upload gagal.");
      }
      setUploadMsg(`Sukses: ${body.message || "Upload selesai."}`);
      setKeyword(" ");
      setKeyword("");
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setUploadMsg(`Gagal: ${(e as Error).message}`);
    } finally {
      setUploadBusy(false);
    }
  };

  const renderTanggal = (list: TanggalItem[], lokasiName?: string) =>
    list.length === 0 ? (
      <div className="outbound-card outbound-empty">
        {lokasiName ? "Tidak ada data outbound untuk lokasi ini." : "Tidak ada data tanggal outbound."}
      </div>
    ) : (
      <div className="outbound-grid">
        {list.map((item) => (
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
    );

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

      {multi ? (
        Object.entries(lokasiMap).map(([lok, g]) => (
          <div key={lok} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--primary)", marginBottom: 7 }}>
              <i className="bi bi-geo-alt" style={{ marginRight: 6 }}></i>
              {lok} - {g.nama}
            </div>
            {renderTanggal(Object.values(g.tanggal_map).sort((a, b) => b.tanggal.localeCompare(a.tanggal)), g.nama)}
          </div>
        ))
      ) : (
        renderTanggal(singleList)
      )}

      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 11, padding: 20, width: 400, maxWidth: "90%", boxShadow: "0 12px 32px rgba(15,23,42,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>
                {modal === "import" ? "Import Data Historical Outbound" : "Upload Data Outbound"}
              </h3>
              <button type="button" onClick={() => setModal("")} style={{ background: "none", border: "none", fontSize: 20, fontWeight: "bold", color: "#8a93a3", cursor: "pointer" }}>&times;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              {multi && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 750, color: "var(--text-main)", marginBottom: 4, display: "block" }}>
                    Pilih Lokasi Upload {modal === "import" ? <span style={{ color: "red" }}>*</span> : ""}
                  </label>
                  <select value={uploadLok} onChange={(e) => setUploadLok(e.target.value)} required
                    style={{ width: "100%", height: 38, padding: "0 10px", border: "1px solid #e2e7f0", borderRadius: 8, background: "#fff", fontSize: 12, fontWeight: 700, color: "var(--text-main)", outline: "none" }}>
                    <option value="">-- Pilih Lokasi --</option>
                    {lokasiList.map((l) => (
                      <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                        {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-soft)", display: "block", marginBottom: 5 }}>
                  Pilih File (Format .XLSX / .CSV)
                </label>
                <input ref={fileRef} type="file" accept=".csv, .xlsx" required
                  style={{ width: "100%", padding: 8, border: "1px solid #e2e7f0", borderRadius: 8, fontSize: 12, outline: "none" }} />
                {modal === "import" ? (
                  <small style={{ fontSize: 10, color: "#8a93a3", marginTop: 5, display: "block" }}>
                    <i className="bi bi-info-circle"></i>
                    Kolom wajib: Picking_List_No, No_Truck, Driver, Delivery_Date, Batch_No, Material_Desc, Quantity_Order_LoadedToTruck.
                    <br />Data masuk status <strong>Selesai</strong>. Stok <strong>TIDAK</strong> dikurangi.
                  </small>
                ) : (
                  <small style={{ fontSize: 10, color: "#8a93a3", marginTop: 5, display: "block" }}>
                    *Mendukung format file <strong>.xlsx</strong> dan <strong>.csv</strong>.
                  </small>
                )}
              </div>

              {uploadMsg && (
                <div style={{ borderRadius: 9, padding: "8px 10px", fontSize: 11, fontWeight: 800,
                  background: uploadMsg.startsWith("Sukses") ? "#ecfdf5" : "#fff1f2",
                  border: `1px solid ${uploadMsg.startsWith("Sukses") ? "#bbf7d0" : "#fecdd3"}`,
                  color: uploadMsg.startsWith("Sukses") ? "#166534" : "#be123c" }}>
                  {uploadMsg}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setModal("")} disabled={uploadBusy}
                  style={{ padding: "8px 15px", border: "1px solid #e2e7f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  Batal
                </button>
                <button type="button" onClick={uploadFile} disabled={uploadBusy}
                  style={{ padding: "8px 15px", border: "none", borderRadius: 8, background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  <i className="bi bi-upload" style={{ marginRight: 4 }}></i>
                  {uploadBusy ? "Memproses..." : modal === "import" ? "Import Sekarang" : "Upload Sekarang"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}