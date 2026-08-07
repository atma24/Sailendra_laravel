"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useSession } from "@/lib/auth";

type TraceDetail = {
  id_traceability: number;
  so_number: string;
  no_dn: string;
  nama_customer: string;
  id_customer: string;
  sales_group: string;
  id_route: string;
  nama_driver: string;
  driver_gudang: string;
  status_barang_keluar: string;
  id_barang_keluar: number;
  nama_produk: string;
  jumlah: number;
  batch_number: string;
  best_before: string;
  nama_plant: string;
  lokasi_block: string;
  gin_no: string;
  aktual_kirim_gudang: string;
  tanggal_pengiriman: string;
  status_delivery: string;
};

const norm = (v: unknown) => String(v ?? "").trim();
const stripPlant = (name: unknown) => norm(name).replace(/^9000\s+ID\s+/i, "");

const css = `
.trace-dtl-page { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; }
.trace-dtl-card { background: #FFFFFF; border: 1px solid #e7ebf3; border-radius: 12px; box-shadow: none; }
.trace-dtl-head { padding: 12px; }
.trace-dtl-back-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: #fbfcff; border: 1px solid #e2e7f0; color: #172033; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; margin-bottom: 10px; }
.trace-dtl-back-btn:hover { color: #191970; border-color: rgba(25,25,112,0.25); transform: translateY(-1px); }
.trace-dtl-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 9px; flex-wrap: wrap; }
.trace-dtl-section-title { font-size: 13px; font-weight: 900; color: #172033; margin: 0; letter-spacing: -0.15px; }
.trace-dtl-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 7px; }
.trace-dtl-text-row { border: 1px solid #edf0f6; background: #fbfcff; border-radius: 9px; padding: 8px 10px; min-height: 51px; display: flex; flex-direction: column; justify-content: center; }
.trace-dtl-text-label { font-size: 9.5px; color: #8b8fa3; font-weight: 850; margin-bottom: 4px; line-height: 1.1; }
.trace-dtl-text-value { font-size: 11.5px; color: #111827; font-weight: 900; line-height: 1.25; word-break: break-word; }
.trace-dtl-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 850; }
.trace-dtl-badge-delivered { background: #d1fae5; color: #059669; }
.trace-dtl-badge-transit { background: #fef3c7; color: #d97706; }
.trace-dtl-badge-pending { background: #f3f4f6; color: #6b7280; }
.trace-dtl-badge-failed { background: #fee2e2; color: #dc2626; }
.trace-dtl-badge-other { background: #eef0ff; color: #191970; }
.trace-dtl-timeline { padding: 12px; }
.trace-dtl-timeline-item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f4fa; }
.trace-dtl-timeline-item:last-child { border-bottom: none; }
.trace-dtl-timeline-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.trace-dtl-timeline-icon-done { background: #d1fae5; color: #059669; }
.trace-dtl-timeline-icon-current { background: #eef0ff; color: #191970; }
.trace-dtl-timeline-icon-pending { background: #f3f4f6; color: #9ca3af; }
.trace-dtl-timeline-content { flex: 1; }
.trace-dtl-timeline-title { font-size: 12px; font-weight: 900; color: #111827; margin-bottom: 2px; }
.trace-dtl-timeline-desc { font-size: 10.5px; color: #6b7280; font-weight: 700; }
.trace-dtl-action-btn { min-height: 35px; border-radius: 9px; padding: 0 18px; font-size: 12px; font-weight: 900; display: inline-flex; align-items: center; gap: 7px; text-decoration: none; white-space: nowrap; }
.trace-dtl-section-tag { font-size: 10px; font-weight: 850; color: #8a93a3; margin-bottom: 8px; }
@media (max-width: 768px) {
  .trace-dtl-grid { grid-template-columns: 1fr; }
  .trace-dtl-text-row { min-height: auto; padding: 8px 9px; }
}
`;

const delBadge = (s: string): string => {
  if (s.toLowerCase() === "delivered") return "trace-dtl-badge-delivered";
  if (s.toLowerCase() === "in transit") return "trace-dtl-badge-transit";
  if (s.toLowerCase() === "failed") return "trace-dtl-badge-failed";
  return s ? "trace-dtl-badge-other" : "";
};

export default function TraceabilityDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const id = Number(params.id || 0);
  const [row, setRow] = useState<TraceDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session || id <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiGet<TraceDetail>(`/traceability/show?id_traceability=${id}`);
        if (!cancelled) setRow(r.data || null);
      } catch {
        setRow(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, id]);

  if (!session || !loaded) return null;

  if (!row) {
    return (
      <div className="trace-dtl-page">
        <style>{css}</style>
        <div className="trace-dtl-card trace-dtl-head" style={{ padding: 30, textAlign: "center", color: "#8a93a3", fontSize: 12, fontWeight: 700 }}>
          Data traceability tidak ditemukan.
        </div>
      </div>
    );
  }

  const st = (row.status_barang_keluar || "").toLowerCase();
  const gudangDone = st === "selesai" || st === "confirmed";
  const tglKirim = norm(row.tanggal_pengiriman);
  const linkOutbound = row.id_barang_keluar > 0 && norm(row.driver_gudang) && norm(row.aktual_kirim_gudang)
    ? `/outbound/detail/${encodeURIComponent(norm(row.aktual_kirim_gudang).slice(0, 10))}?driver=${encodeURIComponent(norm(row.driver_gudang))}`
    : "";
  const statusDel = norm(row.status_delivery);

  return (
    <div className="trace-dtl-page">
      <style>{css}</style>

      <div className="trace-dtl-card trace-dtl-head">
        <Link className="trace-dtl-back-btn" href="/traceability">
          <i className="bi bi-arrow-left"></i>
          <span>Kembali ke daftar</span>
        </Link>

        <div className="trace-dtl-top">
          <h3 className="trace-dtl-section-title">Detail Traceability: {norm(row.so_number) || "-"}</h3>
          {linkOutbound && (
            <Link href={linkOutbound} className="trace-dtl-action-btn" style={{ background: "#191970", color: "#fff" }}>
              <i className="bi bi-box-arrow-up-right"></i>
              <span>Lihat Detail Outbound</span>
            </Link>
          )}
        </div>
      </div>

      <div className="trace-dtl-card trace-dtl-head">
        <div className="trace-dtl-section-tag">INFORMASI UMUM</div>
        <div className="trace-dtl-grid">
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">SO Number</div>
            <div className="trace-dtl-text-value">{norm(row.so_number) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">DN No</div>
            <div className="trace-dtl-text-value">{norm(row.no_dn) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Customer</div>
            <div className="trace-dtl-text-value">{norm(row.nama_customer) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">ID Customer</div>
            <div className="trace-dtl-text-value">{norm(row.id_customer) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Sales Group</div>
            <div className="trace-dtl-text-value">{norm(row.sales_group) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Route</div>
            <div className="trace-dtl-text-value">{norm(row.id_route) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Driver</div>
            <div className="trace-dtl-text-value">{norm(row.nama_driver) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Driver Gudang</div>
            <div className="trace-dtl-text-value">{norm(row.driver_gudang) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Status Gudang</div>
            <div className="trace-dtl-text-value">
              {st !== "" ? (
                <span className={`trace-dtl-badge ${gudangDone ? "trace-dtl-badge-delivered" : "trace-dtl-badge-other"}`}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </span>
              ) : (
                <span style={{ color: "#9ca3af" }}>-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="trace-dtl-card trace-dtl-head">
        <div className="trace-dtl-section-tag">DETAIL PRODUK</div>
        <div className="trace-dtl-grid">
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Nama Produk</div>
            <div className="trace-dtl-text-value">{norm(row.nama_produk) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Jumlah</div>
            <div className="trace-dtl-text-value">{norm(row.jumlah) || "0"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Batch Number</div>
            <div className="trace-dtl-text-value">{norm(row.batch_number) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Best Before</div>
            <div className="trace-dtl-text-value">{norm(row.best_before) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Plant</div>
            <div className="trace-dtl-text-value">{stripPlant(row.nama_plant) || "-"}</div>
          </div>
          <div className="trace-dtl-text-row">
            <div className="trace-dtl-text-label">Lokasi Pengambilan</div>
            <div className="trace-dtl-text-value">{norm(row.lokasi_block) || "-"}</div>
          </div>
        </div>
      </div>

      <div className="trace-dtl-card">
        <div className="trace-dtl-timeline">
          <div className="trace-dtl-section-tag">TIMELINE TRACKING</div>

          <div className="trace-dtl-timeline-item">
            <div className={`trace-dtl-timeline-icon ${gudangDone ? "trace-dtl-timeline-icon-done" : "trace-dtl-timeline-icon-current"}`}>
              <i className={`bi ${gudangDone ? "bi-check-lg" : "bi-arrow-right"}`}></i>
            </div>
            <div className="trace-dtl-timeline-content">
              <div className="trace-dtl-timeline-title">Keluar Gudang</div>
              <div className="trace-dtl-timeline-desc">
                {norm(row.aktual_kirim_gudang) ? (
                  <> {norm(row.aktual_kirim_gudang)} &mdash; Status: {st ? st.charAt(0).toUpperCase() + st.slice(1) : "-"} </>
                ) : "Belum ada data keluar gudang"}
              </div>
            </div>
          </div>

          <div className="trace-dtl-timeline-item">
            <div className={`trace-dtl-timeline-icon ${tglKirim ? "trace-dtl-timeline-icon-done" : "trace-dtl-timeline-icon-pending"}`}>
              <i className={`bi ${tglKirim ? "bi-check-lg" : "bi-clock"}`}></i>
            </div>
            <div className="trace-dtl-timeline-content">
              <div className="trace-dtl-timeline-title">Pengiriman</div>
              <div className="trace-dtl-timeline-desc">
                {tglKirim ? <>Tanggal kirim: {tglKirim}</> : "Belum dijadwalkan"}
              </div>
            </div>
          </div>

          <div className="trace-dtl-timeline-item">
            <div className={`trace-dtl-timeline-icon ${
              statusDel.toLowerCase() === "delivered" ? "trace-dtl-timeline-icon-done"
              : statusDel.toLowerCase() === "in transit" ? "trace-dtl-timeline-icon-current"
              : "trace-dtl-timeline-icon-pending"}`}>
              <i className={`bi ${
                statusDel.toLowerCase() === "delivered" ? "bi-truck"
                : statusDel.toLowerCase() === "in transit" ? "bi-arrow-right-circle"
                : statusDel.toLowerCase() === "failed" ? "bi-exclamation-circle"
                : "bi-clock"}`}></i>
            </div>
            <div className="trace-dtl-timeline-content">
              <div className="trace-dtl-timeline-title">Status Delivery</div>
              <div className="trace-dtl-timeline-desc">
                {statusDel ? <span className={`trace-dtl-badge ${delBadge(statusDel)}`}>{statusDel}</span> : <span style={{ color: "#9ca3af" }}>Belum diupdate</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}