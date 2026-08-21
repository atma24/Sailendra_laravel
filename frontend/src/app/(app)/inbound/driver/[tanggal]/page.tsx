"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";

type BmRow = {
  id_barang_masuk: number;
  nama_produk: string;
  jumlah: number;
  tanggal_masuk: string;
  nama_driver: string;
  no_mobil: string;
  no_dn: string;
  shipment_id: string; // --- TAMBAHAN BARU ---
  status: string;      // --- TAMBAHAN BARU ---
};

type ShipmentItem = {
  nama_driver: string;
  shipment_id: string;
  total_item: number;
  total_qty: number;
  no_mobil: string;
  no_dn: string;
  status: string;
  _semua_selesai: boolean;
};

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};

const STATUS_OPTIONS = [
  { v: "", label: "Semua" },
  { v: "Draft", label: "Draft" },
  { v: "Pending", label: "Pending" },
  { v: "Selesai", label: "Selesai" },
];

const statusStyle = (s: string): { bg: string; color: string } => {
  const st = (s || "").toLowerCase();
  if (st === "pending") return { bg: "#fef3c7", color: "#92400e" };
  if (st === "selesai") return { bg: "#d1fae5", color: "#065f46" };
  return { bg: "#e5e7eb", color: "#4b5563" };
};

const css = `
.inbound-page { display: flex; flex-direction: column; gap: 7px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.inbound-back-row { display: flex; align-items: center; justify-content: space-between; gap: 7px; padding: 8px; }
.inbound-back-btn { height: 30px; border-radius: 8px; padding: 0 9px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; }
.inbound-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.22); transform: translateY(-1px); }
.inbound-date-chip { border-radius: 999px; background: var(--primary-soft); color: var(--primary); padding: 5px 9px; font-size: 10px; font-weight: 900; white-space: nowrap; }
.inbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.inbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.inbound-driver-grid { display: flex; flex-direction: column; gap: 7px; }
.inbound-driver-card { padding: 8px; text-decoration: none; color: inherit; display: block; }
.inbound-driver-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.driver-top { display: flex; gap: 7px; align-items: center; }
.driver-name { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; line-height: 1.2; }
.driver-sub { font-size: 10px; font-weight: 750; color: var(--text-soft); line-height: 1.3; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.inbound-toolbar { padding: 8px; position: relative; }
.inbound-status-filter { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 8px 8px; }
.inbound-status-chip { border-radius: 999px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); text-decoration: none; padding: 4px 9px; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; }
.inbound-status-chip.is-active { background: var(--primary); border-color: var(--primary); color: #FFFFFF; }
.inbound-status-chip .chip-count { font-size: 9px; font-weight: 900; background: rgba(0,0,0,0.06); border-radius: 999px; padding: 1px 6px; }
.inbound-status-chip.is-active .chip-count { background: rgba(255,255,255,0.22); }
.status-badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
`;

export default function InboundDriverPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const lok = searchParams.get("lok") || "";
  const [rows, setRows] = useState<BmRow[]>([]);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  useEffect(() => {
    if (!session || !tanggal) return;
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
        const r = await apiGet<BmRow[]>(`/barang-masuk?${sp.toString()}`);
        if (!cancelled) setRows(r.data || []);
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, tanggal, lok, multi]);

  if (!session || !loaded) return null;

  const kw = q.trim().toLowerCase();
  // Satu kartu per (driver + shipment_id), mirip GIN di outbound
  const shipMap: Record<string, ShipmentItem> = {};
  rows.forEach((row) => {
    const nama = (row.nama_driver || "").trim() || "Tanpa nama driver";
    const ship = (row.shipment_id || "").trim() || "Tanpa Shipment";
    if (kw !== "" && !nama.toLowerCase().includes(kw)) return;
    const key = `${nama}::${ship}`;
    if (!shipMap[key]) {
      shipMap[key] = { nama_driver: nama, shipment_id: ship, total_item: 0, total_qty: 0, no_mobil: row.no_mobil || "", no_dn: row.no_dn || "", status: row.status || "", _semua_selesai: true };
    }
    shipMap[key].total_item++;
    shipMap[key].total_qty += angka(row.jumlah);
    if (!shipMap[key].no_mobil && row.no_mobil) shipMap[key].no_mobil = row.no_mobil;
    if (!shipMap[key].no_dn && row.no_dn) shipMap[key].no_dn = row.no_dn;
    const st = (row.status || "").toLowerCase();
    if (st !== "selesai") shipMap[key]._semua_selesai = false;
  });

  Object.values(shipMap).forEach((d) => {
    if (d._semua_selesai) d.status = "Selesai";
    else if (!d.status) d.status = "Draft";
    delete (d as Record<string, unknown>)._semua_selesai;
  });

  const statusCounts = { Draft: 0, Pending: 0, Selesai: 0 };
  Object.values(shipMap).forEach((d) => {
    if (statusCounts[d.status as keyof typeof statusCounts] !== undefined) statusCounts[d.status as keyof typeof statusCounts]++;
    else statusCounts.Draft++;
  });
  const totalShipAll = Object.keys(shipMap).length;

  let shipmentList = Object.values(shipMap).sort((a, b) => a.nama_driver.localeCompare(b.nama_driver, "id") || a.shipment_id.localeCompare(b.shipment_id, "id"));
  if (statusFilter !== "") shipmentList = shipmentList.filter((d) => d.status.toLowerCase() === statusFilter.toLowerCase());

  const buildUrl = (sv: string) => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (lok) p.set("lok", lok);
    if (sv) p.set("status", sv);
    const qs = p.toString();
    return `/inbound/driver/${encodeURIComponent(tanggal)}${qs ? `?${qs}` : ""}`;
  };

  const backHref = `/inbound${lok ? `?lok=${encodeURIComponent(lok)}` : ""}`;

  return (
    <div className="inbound-page">
      <style>{css}</style>
      <div className="inbound-card inbound-back-row">
        <Link className="inbound-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali ke tanggal</span>
        </Link>
        <div className="inbound-date-chip">{tanggal}</div>
      </div>

      <div className="inbound-card">
        <div className="inbound-toolbar">
          <input type="text" className="inbound-search-input" value={q}
            placeholder="Cari nama driver" autoComplete="off" onChange={(e) => setQ(e.target.value)} />
          {q.trim() !== "" && (
            <a href="#" style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-soft)", textDecoration: "none" }}
              onClick={(e) => { e.preventDefault(); setQ(""); }}>
              <i className="bi bi-x-lg"></i>
            </a>
          )}
        </div>
        <div className="inbound-status-filter">
          {STATUS_OPTIONS.map((o) => {
            const count = o.v === "" ? totalShipAll : (statusCounts[o.v as keyof typeof statusCounts] || 0);
            const active = (statusFilter === o.v);
            return (
              <Link key={o.v || "_"} className={`inbound-status-chip ${active ? "is-active" : ""}`} href={buildUrl(o.v)}>
                <span>{o.label}</span>
                <span className="chip-count">{count}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {shipmentList.length === 0 ? (
        <div className="inbound-card inbound-empty">Driver tidak ditemukan pada tanggal ini.</div>
      ) : (
        <div className="inbound-driver-grid">
          {shipmentList.map((d) => {
            const ss = statusStyle(d.status);
            return (
            <Link key={`${d.nama_driver}::${d.shipment_id}`} className="inbound-card inbound-driver-card"
              href={`/inbound/detail/${encodeURIComponent(tanggal)}?driver=${encodeURIComponent(d.nama_driver)}&shipment=${encodeURIComponent(d.shipment_id)}${lok ? `&lok=${encodeURIComponent(lok)}` : ""}`}>
              <div className="driver-top">
                <i className="bi bi-truck" style={{ color: "var(--primary)", fontSize: 16 }}></i>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="driver-name">{d.nama_driver}</div>
                  <div className="driver-sub">
                    Shipment: <strong>{d.shipment_id}</strong>
                  </div>
                  <div className="driver-sub">
                    {d.total_item} item · {d.total_qty} qty{d.no_mobil ? ` · ${d.no_mobil}` : ""}
                  </div>
                </div>
                <span className="status-badge" style={ss}>{d.status}</span>
                <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}