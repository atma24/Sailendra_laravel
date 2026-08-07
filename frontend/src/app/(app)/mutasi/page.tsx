"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";

type MutasiRow = {
  id_mutasi: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  id_pengguna: number;
  nama_pengguna: string;
  nama_produk: string;
  jumlah: number;
  created_at: string;
};

type TanggalItem = { tanggal: string; total_item: number; total_user: number; users: Record<string, boolean> };

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
.inbound-icon-box { width: 29px; height: 29px; border-radius: 9px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 13px; }
.inbound-date-title { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; }
.inbound-meta { font-size: 10px; font-weight: 750; color: var(--text-soft); margin-top: 3px; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
`;

export default function MutasiTanggalPage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const [rows, setRows] = useState<MutasiRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams(lokasiParam(session));
        const r = await apiGet<MutasiRow[]>(`/mutasi?${q.toString()}`);
        if (!cancelled) setRows(r.data || []);
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  if (!session || !loaded) return null;

  const q = keyword.trim().toLowerCase();
  const singleMap: Record<string, TanggalItem> = {};
  const lokasiMap: Record<string, { nama: string; tanggal_map: Record<string, TanggalItem> }> = {};

  rows.forEach((row) => {
    const t = dateOnly(row.created_at);
    if (!t || t.startsWith("0000")) return;
    if (q !== "" && !t.includes(q)) return;
    const user = (row.nama_pengguna || "").trim() || "Tanpa Nama";

    const push = (map: Record<string, TanggalItem>) => {
      if (!map[t]) map[t] = { tanggal: t, total_item: 0, total_user: 0, users: {} };
      map[t].total_item++;
      map[t].users[user] = true;
    };

    if (multi) {
      const lok = String(row.id_pengguna_lokasi || "");
      if (!lokasiMap[lok]) lokasiMap[lok] = { nama: row.nama_pengguna_lokasi || lok, tanggal_map: {} };
      push(lokasiMap[lok].tanggal_map);
    } else {
      push(singleMap);
    }
  });

  const finish = (list: TanggalItem[]) =>
    list.map((x) => ({ ...x, total_user: Object.keys(x.users || {}).length }));

  const singleList = finish(Object.values(singleMap)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const canAdd = !!session && session.user.role !== "Support";

  const renderTanggal = (list: TanggalItem[], lokasiName?: string) =>
    list.length === 0 ? (
      <div className="inbound-card inbound-empty">
        {lokasiName ? "Tidak ada riwayat mutasi untuk lokasi ini." : "Tidak ada riwayat mutasi."}
      </div>
    ) : (
      <div className="inbound-grid">
        {list.map((item) => (
          <Link key={item.tanggal} className="inbound-card inbound-date-card"
            href={`/mutasi/user/${encodeURIComponent(item.tanggal)}`}>
            <div className="inbound-card-top">
              <div className="inbound-icon-box"><i className="bi bi-calendar3"></i></div>
              <div>
                <div className="inbound-date-title">{item.tanggal}</div>
                <div className="inbound-meta">{item.total_item} mutasi · {item.total_user} pembuat</div>
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
            <Link className="inbound-add-btn" href="/mutasi/form">
              <i className="bi bi-plus-lg"></i>
              Tambah Mutasi
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
            {renderTanggal(finish(Object.values(g.tanggal_map)).sort((a, b) => b.tanggal.localeCompare(a.tanggal)), g.nama)}
          </div>
        ))
      ) : (
        renderTanggal(singleList)
      )}
    </div>
  );
}