"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";

type MutasiRow = {
  id_mutasi: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi?: string;
  nama_pengguna: string;
  nama_produk: string;
  jumlah: number;
  jumlah_lama?: number | null;
  satuan: string;
  jenis_mutasi: string;
  lokasi_sumber: string;
  lokasi_tujuan: string;
  best_before: string;
  best_before_lama?: string | null;
  plant_lama?: string | null;
  plant_baru?: string | null;
  batch_lama?: string | null;
  batch_baru?: string | null;
  catatan: string;
  created_at: string;
};

const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);
const norm = (v: unknown) => String(v ?? "").trim();
const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};

const STATUS_LABEL: Record<string, string> = {
  GS_GS: "Goods Stock - Goods Stock",
  GS_BAD: "Goods Stock - Bad Stock",
  BAD_GS: "Bad Stock - Goods Stock",
  GS_REJ: "Goods Stock - Reject",
  BAD_REJ: "Bad Stock - Reject",
  GS_QI: "Goods Stock - QI",
  QI_GS: "QI - Goods Stock",
  QI_BAD: "QI - Bad Stock",
  BAD_QI: "Bad Stock - QI",
};

const css = `
.mutasi-detail-page { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; }
.md-card { background: #FFFFFF; border: 1px solid #e7ebf3; border-radius: 12px; box-shadow: none; }
.md-head { padding: 12px; }
.md-back-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; margin-bottom: 10px; }
.md-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.25); transform: translateY(-1px); }
.md-detail-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 9px; }
.md-section-title { font-size: 13px; font-weight: 900; color: var(--text-main); margin: 0; letter-spacing: -0.15px; }
.md-detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 7px; }
.md-text-row { border: 1px solid #edf0f6; background: #fbfcff; border-radius: 9px; padding: 8px 10px; min-height: 51px; display: flex; flex-direction: column; justify-content: center; }
.md-text-wide { grid-column: span 2; }
.md-text-label { font-size: 9.5px; color: #8b8fa3; font-weight: 850; margin-bottom: 4px; line-height: 1.1; }
.md-text-value { font-size: 11.5px; color: #111827; font-weight: 900; line-height: 1.25; word-break: break-word; }
.md-toolbar { padding: 8px; display: flex; gap: 7px; align-items: center; }
.md-search-wrap { position: relative; flex: 1; min-width: 200px; }
.md-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px 0 12px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; box-sizing: border-box; }
.md-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.md-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); border: 0; background: transparent; cursor: pointer; }
.md-item-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.md-item-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 9px; }
.md-item-card { padding: 11px; border: 1px solid rgba(25,25,112,0.18); border-radius: 11px; background: #fbfcff; }
.detail-product { font-size: 13px; font-weight: 900; color: var(--text-main); margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #e2e7f0; line-height: 1.3; }
.detail-info-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 6px; gap: 8px; }
.detail-info-row:last-child { margin-bottom: 0; }
.detail-info-label { color: #6b7280; font-weight: 750; flex-shrink: 0; }
.detail-info-val { color: #111827; font-weight: 850; text-align: right; word-break: break-word; }
.badge-status { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; color: #4b5563; white-space: nowrap; }
.ba-lama { color: #9ca3af; font-weight: 750; margin-right: 4px; }
.ba-arrow { color: #9ca3af; font-weight: 750; margin-right: 4px; }
.ba-baru { color: #191970; font-weight: 900; }
.md-empty { padding: 13px; color: var(--text-soft); font-size: 11px; font-weight: 850; }
.status-badge { padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 900; white-space: nowrap; }
@media (max-width: 1100px) { .md-detail-grid, .md-item-list { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 768px) {
  .md-detail-grid, .md-item-list { grid-template-columns: 1fr; }
  .md-text-wide { grid-column: span 1; }
}
`;

export default function MutasiDetailPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const user = searchParams.get("user") || "";
  const lok = searchParams.get("lok") || "";
  const from = searchParams.get("from") || "";
  const [items, setItems] = useState<MutasiRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!session || !tanggal || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.append("tanggal", tanggal);
        if (multi) {
          if (lok) sp.append("id_pengguna_lokasi", lok);
          else {
            const l = lokasiParam(session);
            if (l) sp.set("id_pengguna_lokasi_multi", l.split("=")[1] || "");
          }
        } else {
          sp.append("id_pengguna_lokasi", String(session.user.id_pengguna_lokasi || ""));
        }
        const r = await apiGet<MutasiRow[]>(`/mutasi?${sp.toString()}`);
        if (cancelled) return;
        const rows = r.data || [];
        const filtered = rows
          .filter((row) => {
            if (dateOnly(row.created_at) !== tanggal) return false;
            const nama = norm(row.nama_pengguna) || "Tanpa Nama";
            return nama === user;
          })
          .sort((a, b) => angka(b.id_mutasi) - angka(a.id_mutasi));
        setItems(filtered);
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, tanggal, user, lok, multi]);

  if (!session || !loaded) return null;

  const backHref = from === "user"
    ? `/mutasi/user/${encodeURIComponent(tanggal)}${lok ? `?lok=${encodeURIComponent(lok)}` : ""}`
    : "/mutasi";

  const kw = q.trim().toLowerCase();
  const shown = kw === "" ? items : items.filter((row) => {
    const hay = `${norm(row.nama_produk)} ${norm(row.jenis_mutasi)} ${norm(row.lokasi_sumber)} ${norm(row.lokasi_tujuan)} ${norm(row.catatan)} ${norm(row.best_before)} ${norm(row.batch_baru)} ${norm(row.batch_lama)}`.toLowerCase();
    return hay.includes(kw);
  });

  const totalQty = items.reduce((s, it) => s + angka(it.jumlah), 0);
  const jenisCount: Record<string, number> = {};
  items.forEach((it) => {
    const j = norm(it.jenis_mutasi).toUpperCase();
    if (j) jenisCount[j] = (jenisCount[j] || 0) + 1;
  });
  let jenisDominan = "-";
  let bestN = 0;
  Object.entries(jenisCount).forEach(([j, n]) => {
    if (n > bestN) { bestN = n; jenisDominan = j; }
  });

  return (
    <div className="mutasi-detail-page">
      <style>{css}</style>
      <div className="md-card md-head">
        <Link className="md-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>

        <div className="md-detail-top">
          <h3 className="md-section-title">Detail Mutasi</h3>
        </div>

        <div className="md-detail-grid">
          <div className="md-text-row">
            <div className="md-text-label">Tanggal Mutasi</div>
            <div className="md-text-value">{tanggal || "-"}</div>
          </div>
          <div className="md-text-row">
            <div className="md-text-label">Dibuat Oleh</div>
            <div className="md-text-value">{user || "-"}</div>
          </div>
          <div className="md-text-row">
            <div className="md-text-label">Total Item</div>
            <div className="md-text-value">{items.length}</div>
          </div>
          <div className="md-text-row">
            <div className="md-text-label">Total Qty</div>
            <div className="md-text-value">{totalQty}</div>
          </div>
          <div className="md-text-row">
            <div className="md-text-label">Jenis Dominan</div>
            <div className="md-text-value">{jenisDominan}</div>
          </div>
          <div className="md-text-row md-text-wide">
            <div className="md-text-label">Lokasi</div>
            <div className="md-text-value">{lok || norm(items[0]?.id_pengguna_lokasi) || "-"}</div>
          </div>
        </div>
      </div>

      <div className="md-card">
        <div className="md-toolbar">
          <div className="md-search-wrap">
            <input type="text" className="md-search-input" value={q}
              placeholder="Cari produk, lokasi, jenis, catatan..." autoComplete="off"
              onChange={(e) => setQ(e.target.value)} />
            {q.trim() !== "" && (
              <button type="button" className="md-search-clear" aria-label="Bersihkan pencarian"
                onClick={() => setQ("")}>
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="md-item-title-row">
        <h3 className="md-section-title" style={{ margin: 0 }}>Item</h3>
      </div>

      {shown.length === 0 ? (
        <div className="md-card md-empty">
          {items.length === 0 ? "Riwayat tidak ditemukan." : "Tidak ada item yang cocok dengan pencarian."}
        </div>
      ) : (
        <div className="md-item-list">
          {shown.map((item) => {
            const jumlahLama = item.jumlah_lama ?? null;
            const bbLama = norm(item.best_before_lama);
            const bbBaru = norm(item.best_before);
            const plantLama = norm(item.plant_lama);
            const plantBaru = norm(item.plant_baru);
            const batchLama = norm(item.batch_lama);
            const batchBaru = norm(item.batch_baru);
            const jumlahBerubah = jumlahLama !== null && angka(jumlahLama) !== angka(item.jumlah);
            const bbBerubah = bbLama !== "" && bbBaru !== "" && bbLama !== bbBaru;
            const plantBerubah = plantLama !== "" && plantBaru !== "" && plantLama !== plantBaru;
            const batchBerubah = batchLama !== "" && batchBaru !== "" && batchLama !== batchBaru;
            const adaPlant = plantLama !== "" || plantBaru !== "";
            const adaBatch = batchLama !== "" || batchBaru !== "";
            return (
              <div key={item.id_mutasi} className="md-item-card">
                <div className="detail-product">{norm(item.nama_produk) || "Produk Tidak Diketahui"}</div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Jumlah</span>
                  <span className="detail-info-val">
                    {jumlahBerubah && <span className="ba-lama">{angka(jumlahLama)}</span>}
                    {jumlahBerubah && <span className="ba-arrow">→</span>}
                    {angka(item.jumlah)} {norm(item.satuan) || "BOX"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Status</span>
                  <span className="detail-info-val"><span className="badge-status">{STATUS_LABEL[item.jenis_mutasi] || norm(item.jenis_mutasi)}</span></span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Dari Lokasi</span>
                  <span className="detail-info-val">{norm(item.lokasi_sumber) || "-"}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Ke Lokasi</span>
                  <span className="detail-info-val">{norm(item.lokasi_tujuan) || "-"}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Best Before</span>
                  <span className="detail-info-val">
                    {bbBerubah ? (
                      <>
                        <span className="ba-lama">{bbLama}</span>
                        <span className="ba-arrow">→</span>
                        <span className="ba-baru">{bbBaru}</span>
                      </>
                    ) : (
                      bbBaru || "-"
                    )}
                  </span>
                </div>
                {adaPlant && (
                  <div className="detail-info-row">
                    <span className="detail-info-label">Plant</span>
                    <span className="detail-info-val">
                      {plantBerubah ? (
                        <>
                          <span className="ba-lama">{plantLama}</span>
                          <span className="ba-arrow">→</span>
                          <span className="ba-baru">{plantBaru}</span>
                        </>
                      ) : (
                        plantBaru || plantLama
                      )}
                    </span>
                  </div>
                )}
                {adaBatch && (
                  <div className="detail-info-row">
                    <span className="detail-info-label">Batch</span>
                    <span className="detail-info-val">
                      {batchBerubah ? (
                        <>
                          <span className="ba-lama">{batchLama}</span>
                          <span className="ba-arrow">→</span>
                          <span className="ba-baru">{batchBaru}</span>
                        </>
                      ) : (
                        batchBaru || batchLama
                      )}
                    </span>
                  </div>
                )}
                <div className="detail-info-row">
                  <span className="detail-info-label">Waktu Mutasi</span>
                  <span className="detail-info-val">{String(item.created_at || "").slice(11, 16)}</span>
                </div>
                {norm(item.catatan) !== "" && (
                  <div className="detail-info-row" style={{ alignItems: "flex-start" }}>
                    <span className="detail-info-label">Catatan</span>
                    <span className="detail-info-val" style={{ textAlign: "left" }}>{norm(item.catatan)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
