"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import Pagination, { PAGE_SIZE, paginate, totalPagesOf } from "@/components/Pagination";

export type StokTraceRow = {
  id_produk: number;
  nama_produk: string;
  satuan: string;
  batch: string | null;
  best_before: string | null;
  id_plant: string | null;
  nama_plant: string | null;
  asal_pabrik: string | null;
  lokasi: string;
  jumlah: number;
};

export type StokTraceDetailRow = {
  lokasi_detail: string;
  best_before: string | null;
  jumlah: number;
};

const norm = (v: unknown) => String(v ?? "").trim();
const stripPlant = (name: unknown) => norm(name).replace(/^9000\s+ID\s+/i, "");

const css = `
.stok-trace-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; }
.stok-trace-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 0; flex-wrap: wrap; gap: 8px; }
.stok-trace-title { font-size: 13px; font-weight: 900; color: #172033; margin: 0; }
.stok-trace-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px; }
.stok-trace-search-wrap { position: relative; max-width: 300px; width: 100%; }
.stok-trace-search-wrap i { position: absolute; top: 50%; left: 11px; transform: translateY(-50%); color: #8a93a3; font-size: 13px; }
.stok-trace-search { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: #172033; outline: none; }
.stok-trace-search:focus { background: #fff; border-color: #191970; box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.stok-trace-count { font-size: 10px; font-weight: 750; color: #8a93a3; }
.stok-trace-table-wrap { overflow-x: auto; }
.stok-trace-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.stok-trace-table th { padding: 7px 8px; text-align: left; font-weight: 850; color: #8a93a3; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; border-bottom: 1px solid #e9edf5; white-space: nowrap; }
.stok-trace-table td { padding: 6px 8px; border-bottom: 1px solid #f4f6fb; vertical-align: middle; }
.stok-trace-table tbody tr:hover { background: #f9fafb; }
.stok-trace-table tbody tr.stok-trace-clickable { cursor: pointer; }
.stok-trace-empty { padding: 24px; text-align: center; color: #8a93a3; font-size: 11px; font-weight: 750; }
.stok-trace-err { background: #fff0f0; color: #dc3545; font-size: 11px; font-weight: 700; border-radius: 8px; padding: 8px 10px; margin: 0 8px 8px; }
.stok-trace-back { height: 31px; border-radius: 8px; padding: 0 14px; border: none; font-size: 11px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: #f0f2f5; color: #172033; font-family: inherit; }
.stok-trace-back:hover { background: #e5e8ee; }
.stok-trace-info { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 10px 12px; background: #fbfcff; border-top: 1px solid #e9edf5; border-bottom: 1px solid #e9edf5; font-size: 11px; }
.stok-trace-info-item { display: flex; gap: 6px; }
.stok-trace-info-label { color: #8a93a3; font-weight: 750; }
.stok-trace-info-value { color: #172033; font-weight: 800; }
`;

function plantLabel(r: StokTraceRow): string {
  const id = norm(r.id_plant);
  const nama = stripPlant(r.nama_plant);
  if (id && nama) return `${id} - ${nama}`;
  if (nama) return nama;
  if (id) return id;
  const asal = norm(r.asal_pabrik);
  return asal || "-";
}

export default function StokTracePanel({ lokasiQuery }: { lokasiQuery: string }) {
  const [rows, setRows] = useState<StokTraceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StokTraceRow | null>(null);
  const [detail, setDetail] = useState<StokTraceDetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [detailPage, setDetailPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    apiGet<StokTraceRow[]>(`/traceability/stok-snapshot${lokasiQuery ? `?${lokasiQuery}` : ""}`)
      .then((r) => {
        if (cancelled) return;
        setRows(r.data || []);
        setPage(1);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        setErr(e?.message || "Gagal memuat traceability stok gudang.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lokasiQuery]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((r) =>
      [r.nama_produk, r.batch, r.best_before, plantLabel(r)]
        .some((v) => norm(v).toLowerCase().includes(keyword))
    );
  }, [rows, q]);

  const openDetail = (r: StokTraceRow) => {
    setSelected(r);
    setDetail([]);
    setDetailErr("");
    setDetailPage(1);
    setDetailLoading(true);
    const sp = new URLSearchParams(lokasiQuery);
    sp.set("id_produk", String(r.id_produk));
    sp.set("batch", norm(r.batch));
    apiGet<StokTraceDetailRow[]>(`/traceability/stok-snapshot/detail?${sp.toString()}`)
      .then((res) => setDetail(res.data || []))
      .catch((e) => setDetailErr(e?.message || "Gagal memuat rincian lokasi."))
      .finally(() => setDetailLoading(false));
  };

  if (selected) {
    const nf = (n: number) => new Intl.NumberFormat("id-ID").format(n);
    return (
      <div className="stok-trace-card">
        <style>{css}</style>
        <div className="stok-trace-head">
          <h2 className="stok-trace-title">Rincian Lokasi — {norm(selected.nama_produk)}</h2>
          <button type="button" className="stok-trace-back" onClick={() => setSelected(null)}>
            <i className="bi bi-arrow-left"></i> Kembali
          </button>
        </div>
        <div className="stok-trace-info" style={{ marginTop: 10 }}>
          <span className="stok-trace-info-item"><span className="stok-trace-info-label">Produk:</span><span className="stok-trace-info-value">{norm(selected.nama_produk)}</span></span>
          <span className="stok-trace-info-item"><span className="stok-trace-info-label">Jumlah:</span><span className="stok-trace-info-value">{nf(selected.jumlah)} {norm(selected.satuan)}</span></span>
          <span className="stok-trace-info-item"><span className="stok-trace-info-label">Batch:</span><span className="stok-trace-info-value">{norm(selected.batch) || "-"}</span></span>
          <span className="stok-trace-info-item"><span className="stok-trace-info-label">BB:</span><span className="stok-trace-info-value">{norm(selected.best_before) || "-"}</span></span>
          <span className="stok-trace-info-item"><span className="stok-trace-info-label">Plant:</span><span className="stok-trace-info-value">{plantLabel(selected)}</span></span>
        </div>
        {detailErr && <div className="stok-trace-err" style={{ marginTop: 8 }}>{detailErr}</div>}
        {detailLoading ? (
          <div className="stok-trace-empty">Memuat rincian lokasi...</div>
        ) : detail.length === 0 ? (
          <div className="stok-trace-empty">Tidak ada rincian lokasi.</div>
        ) : (
          <>
            <div className="stok-trace-table-wrap">
              <table className="stok-trace-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>No</th>
                    <th>Lokasi (Block-Line-Level-Deep)</th>
                    <th>BB</th>
                    <th style={{ textAlign: "right" }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(detail, detailPage, PAGE_SIZE).map((d, i) => (
                    <tr key={`${d.lokasi_detail}|${d.best_before}|${i}`}>
                      <td>{(detailPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td><span style={{ fontWeight: 700 }}>{norm(d.lokasi_detail)}</span></td>
                      <td>{norm(d.best_before) || "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: 800 }}>{nf(d.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={detailPage}
              totalPages={totalPagesOf(detail.length, PAGE_SIZE)}
              totalItems={detail.length}
              pageSize={PAGE_SIZE}
              onChange={setDetailPage}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="stok-trace-card">
      <style>{css}</style>
      <div className="stok-trace-head">
        <h2 className="stok-trace-title">Traceability Stok Gudang</h2>
      </div>
      <div className="stok-trace-toolbar">
        <div className="stok-trace-search-wrap">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="stok-trace-search"
            placeholder="Cari produk, batch, BB, plant..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <span className="stok-trace-count">
          {filtered.length} baris • klik baris untuk rincian lokasi
        </span>
      </div>
      {err && <div className="stok-trace-err">{err}</div>}
      {loading ? (
        <div className="stok-trace-empty">Memuat traceability stok gudang...</div>
      ) : filtered.length === 0 ? (
        <div className="stok-trace-empty">Tidak ada stok (stok kosong disembunyikan).</div>
      ) : (
        <>
          <div className="stok-trace-table-wrap">
            <table className="stok-trace-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>No</th>
                  <th>Nama Produk</th>
                  <th style={{ textAlign: "right" }}>Jumlah</th>
                  <th>Batch</th>
                  <th>BB</th>
                  <th>Plant</th>
                </tr>
              </thead>
              <tbody>
                {paginate(filtered, page, PAGE_SIZE).map((r, i) => (
                  <tr key={`${r.id_produk}|${r.batch}|${i}`} className="stok-trace-clickable" onClick={() => openDetail(r)} title="Klik untuk rincian lokasi">
                    <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td><strong style={{ color: "#111827" }}>{norm(r.nama_produk)}</strong></td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{new Intl.NumberFormat("id-ID").format(r.jumlah)}</td>
                    <td>{norm(r.batch) || "-"}</td>
                    <td>{norm(r.best_before) || "-"}</td>
                    <td>{plantLabel(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPagesOf(filtered.length, PAGE_SIZE)}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
