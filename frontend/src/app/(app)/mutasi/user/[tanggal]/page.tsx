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
  created_at: string;
};

type UserItem = { nama_pengguna: string; total_item: number; total_qty: number };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);

const css = `
.inbound-page { display: flex; flex-direction: column; gap: 7px; }
.inbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.inbound-back-row { display: flex; align-items: center; justify-content: space-between; gap: 7px; padding: 8px; }
.inbound-back-btn { height: 30px; border-radius: 8px; padding: 0 9px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; }
.inbound-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.22); transform: translateY(-1px); }
.inbound-date-chip { border-radius: 999px; background: var(--primary-soft); color: var(--primary); padding: 5px 9px; font-size: 10px; font-weight: 900; white-space: nowrap; }
.inbound-toolbar { padding: 8px; position: relative; }
.inbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.inbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.inbound-driver-grid { display: flex; flex-direction: column; gap: 7px; }
.inbound-driver-card { padding: 8px; text-decoration: none; color: inherit; display: block; }
.inbound-driver-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.driver-top { display: flex; gap: 7px; align-items: center; }
.driver-icon { width: 29px; height: 29px; border-radius: 9px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 13px; }
.driver-name { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; line-height: 1.2; }
.driver-sub { font-size: 10px; font-weight: 750; color: var(--text-soft); line-height: 1.3; }
.inbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
`;

export default function MutasiUserPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const lok = searchParams.get("lok") || "";
  const [rows, setRows] = useState<MutasiRow[]>([]);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

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
        const r = await apiGet<MutasiRow[]>(`/mutasi?${sp.toString()}`);
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
  const userMap: Record<string, UserItem> = {};
  rows.forEach((row) => {
    if (dateOnly(row.created_at) !== tanggal) return;
    const user = (row.nama_pengguna || "").trim() || "Tanpa Nama";
    if (kw !== "" && !user.toLowerCase().includes(kw)) return;
    if (!userMap[user]) userMap[user] = { nama_pengguna: user, total_item: 0, total_qty: 0 };
    userMap[user].total_item++;
    userMap[user].total_qty += angka(row.jumlah);
  });

  const userList = Object.values(userMap).sort((a, b) => a.nama_pengguna.localeCompare(b.nama_pengguna, "id"));
  const backHref = `/mutasi${lok ? `?lok=${encodeURIComponent(lok)}` : ""}`;

  return (
    <div className="inbound-page">
      <style>{css}</style>
      <div className="inbound-card inbound-back-row">
        <Link className="inbound-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>
        <div className="inbound-date-chip">{tanggal}</div>
      </div>

      <div className="inbound-card">
        <div className="inbound-toolbar">
          <input type="text" className="inbound-search-input" value={q}
            placeholder="Cari pembuat mutasi" autoComplete="off" onChange={(e) => setQ(e.target.value)} />
          {q.trim() !== "" && (
            <a href="#" style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-soft)", textDecoration: "none" }}
              onClick={(e) => { e.preventDefault(); setQ(""); }}>
              <i className="bi bi-x-lg"></i>
            </a>
          )}
        </div>
      </div>

      {userList.length === 0 ? (
        <div className="inbound-card inbound-empty">Pembuat mutasi tidak ditemukan.</div>
      ) : (
        <div className="inbound-driver-grid">
          {userList.map((u) => (
            <Link key={u.nama_pengguna} className="inbound-card inbound-driver-card"
              href={`/mutasi/detail/${encodeURIComponent(tanggal)}?user=${encodeURIComponent(u.nama_pengguna)}${lok ? `&lok=${encodeURIComponent(lok)}` : ""}`}>
              <div className="driver-top">
                <div className="driver-icon"><i className="bi bi-person-circle"></i></div>
                <div>
                  <div className="driver-name">{u.nama_pengguna}</div>
                  <div className="driver-sub">{u.total_item} mutasi · {u.total_qty} qty</div>
                </div>
                <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}