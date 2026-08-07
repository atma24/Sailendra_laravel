"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";

type BmRow = {
  id_barang_masuk: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  nama_produk: string;
  jumlah: number;
  tanggal_masuk: string;
  nama_driver: string;
};

type TanggalItem = { tanggal: string; total_item: number; total_qty: number };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);

const css = `
.inbound-page { display: flex; flex-direction: column; gap: 7px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.inbound-toolbar { padding: 8px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; align-items: center; }
.inbound-search-wrap { position: relative; }
.inbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.inbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.inbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.inbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.inbound-grid { display: flex; flex-direction: column; gap: 7px; }
.inbound-date-card { padding: 8px; text-decoration: none; color: inherit; display: block; }
.inbound-date-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.inbound-card-top { display: flex; align-items: center; gap: 8px; }
.inbound-date-title { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.inbound-meta { font-size: 10px; font-weight: 750; color: var(--text-soft); margin-top: 3px; }
`;

export default function InboundTanggalPage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const [rows, setRows] = useState<BmRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams(lokasiParam(session));
        if (keyword.trim()) q.append("cari", keyword.trim());
        const r = await apiGet<BmRow[]>(`/barang-masuk?${q.toString()}`);
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

  const push = (map: Record<string, TanggalItem>, tgl: string, row: BmRow) => {
    if (!map[tgl]) map[tgl] = { tanggal: tgl, total_item: 0, total_qty: 0 };
    map[tgl].total_item++;
    map[tgl].total_qty += angka(row.jumlah);
  };

  rows.forEach((row) => {
    const t = dateOnly(row.tanggal_masuk);
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
  const canAdd = session && !["Support", "Forklift"].includes(session.user.role);

  const renderTanggal = (list: TanggalItem[], lokasiName?: string) =>
    list.length === 0 ? (
      <div className="inbound-card inbound-empty">
        {lokasiName ? "Tidak ada data inbound untuk lokasi ini." : "Tidak ada data tanggal inbound."}
      </div>
    ) : (
      <div className="inbound-grid">
        {list.map((item) => (
          <Link key={item.tanggal} className="inbound-card inbound-date-card"
            href={`/inbound/driver/${encodeURIComponent(item.tanggal)}`}>
            <div className="inbound-card-top">
              <i className="bi bi-calendar3" style={{ color: "var(--primary)", fontSize: 16 }}></i>
              <div>
                <div className="inbound-date-title">{item.tanggal}</div>
                <div className="inbound-meta">{item.total_item} item · {item.total_qty} qty</div>
              </div>
              <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
            </div>
          </Link>
        ))}
      </div>
    );

  return (
    <div className="inbound-page">
      <style>{css}</style>
      <div className="inbound-card">
        <div className="inbound-toolbar">
          <div className="inbound-search-wrap">
            <input type="text" className="inbound-search-input" value={search}
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
            <Link className="inbound-add-btn" href="/inbound/form">
              <i className="bi bi-plus-lg"></i>
              Tambah Inbound
            </Link>
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
    </div>
  );
}