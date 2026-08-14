"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";

type MutasiRow = {
  id_mutasi: number;
  id_pengguna_lokasi: string;
  nama_pengguna: string;
  nama_produk: string;
  jumlah: number;
  satuan: string;
  jenis_mutasi: string;
  lokasi_sumber: string;
  lokasi_tujuan: string;
  best_before: string;
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
  GS_QA: "Goods Stock - QA",
  QA_GS: "QA - Goods Stock",
  QA_BAD: "QA - Bad Stock",
  BAD_QA: "Bad Stock - QA",
};

const css = `
.inbound-page { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e7ebf3; border-radius: 12px; box-shadow: none; padding: 12px; }
.detail-back-btn { min-height: 30px; border-radius: 8px; padding: 0 10px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; margin-bottom: 15px; }
.detail-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.25); transform: translateY(-1px); }
.detail-title { font-size: 14px; font-weight: 900; color: var(--text-main); margin-bottom: 14px; letter-spacing: -0.2px; }
.header-info { background: #f8fafc; border: 1px solid #e2e7f0; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.header-row:last-child { margin-bottom: 0; }
.header-label { font-size: 11px; font-weight: 750; color: #6b7280; }
.header-val { font-size: 12px; font-weight: 900; color: var(--primary); }
.detail-item-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.detail-item-card { border: 1px solid #e2e7f0; border-radius: 10px; background: #FFFFFF; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.detail-product { font-size: 13px; font-weight: 900; color: var(--text-main); margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #e2e7f0; line-height: 1.3; }
.detail-info-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 6px; }
.detail-info-row:last-child { margin-bottom: 0; }
.detail-info-label { color: #6b7280; font-weight: 750; }
.detail-info-val { color: #111827; font-weight: 850; text-align: right; }
.badge-status { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; color: #4b5563; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; text-align: center; }
@media (max-width: 768px) { .detail-item-list { grid-template-columns: 1fr; } }
`;

export default function MutasiDetailPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const user = searchParams.get("user") || "";
  const lok = searchParams.get("lok") || "";
  const [items, setItems] = useState<MutasiRow[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  const backHref = `/mutasi/user/${encodeURIComponent(tanggal)}${lok ? `?lok=${encodeURIComponent(lok)}` : ""}`;

  return (
    <div className="inbound-page">
      <style>{css}</style>
      <div className="inbound-card">
        <Link className="detail-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>

        <div className="detail-title">Detail Riwayat Mutasi</div>

        <div className="header-info">
          <div className="header-row">
            <span className="header-label">Dibuat Oleh</span>
            <span className="header-val"><i className="bi bi-person-fill" style={{ marginRight: 3 }}></i> {user}</span>
          </div>
          <div className="header-row">
            <span className="header-label">Tanggal Mutasi</span>
            <span className="header-val"><i className="bi bi-calendar-event-fill" style={{ marginRight: 3 }}></i> {tanggal}</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="inbound-empty">Riwayat tidak ditemukan.</div>
        ) : (
          <div className="detail-item-list">
            {items.map((item) => (
              <div key={item.id_mutasi} className="detail-item-card">
                <div className="detail-product">{norm(item.nama_produk) || "Produk Tidak Diketahui"}</div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Jumlah</span>
                  <span className="detail-info-val">{angka(item.jumlah)} {norm(item.satuan) || "BOX"}</span>
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
                  <span className="detail-info-val">{norm(item.best_before) || "-"}</span>
                </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}