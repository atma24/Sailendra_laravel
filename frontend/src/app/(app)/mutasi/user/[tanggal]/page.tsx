"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import Pagination, { paginate, totalPagesOf } from "@/components/Pagination";

type MutasiRow = {
  id_mutasi: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  nama_pengguna: string;
  nama_produk: string;
  jumlah: number;
  jenis_mutasi: string;
  lokasi_sumber: string;
  lokasi_tujuan: string;
  catatan: string;
  created_at: string;
};

type UserItem = {
  key: string;
  nama_pengguna: string;
  total_item: number;
  total_qty: number;
  jenis_dominan: string;
  lokasi_id: string;
  lokasi_nama: string;
};

const PAGE_SIZE_LOCAL = 10;

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);
const jenisNorm = (v: unknown) => String(v ?? "").trim().toUpperCase();

const jenisDot = (j: string): string => {
  const map: Record<string, string> = {
    GS_GS: "#1D4ED8",
    GS_BAD: "#D97706",
    BAD_GS: "#059669",
    GS_REJ: "#DC2626",
    BAD_REJ: "#991B1B",
    GS_QI: "#7C3AED",
    QI_GS: "#0D9488",
    QI_BAD: "#DB2777",
    BAD_QI: "#92400E",
  };
  return map[j] || "#64748B";
};

type SortKey = "pembuat" | "item" | "qty" | "jenis";
type SortDir = "asc" | "desc";

const css = `
.mutasi-page { display: flex; flex-direction: column; gap: 7px; }
.mutasi-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.mutasi-back-row { display: flex; align-items: center; justify-content: space-between; gap: 7px; padding: 8px; }
.mutasi-back-btn { height: 30px; border-radius: 8px; padding: 0 9px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; }
.mutasi-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.22); transform: translateY(-1px); }
.mutasi-date-chip { border-radius: 999px; background: var(--primary-soft); color: var(--primary); padding: 5px 9px; font-size: 10px; font-weight: 900; white-space: nowrap; }
.mutasi-toolbar { padding: 8px; display: flex; gap: 7px; align-items: center; }
.mutasi-search-wrap { position: relative; flex: 1; min-width: 200px; }
.mutasi-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px 0 12px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; box-sizing: border-box; }
.mutasi-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.mutasi-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); border: 0; background: transparent; cursor: pointer; }
.mutasi-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.mutasi-table-wrap { overflow-x: auto; }
.mutasi-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.mutasi-table th { text-align: left; font-weight: 900; color: var(--text-main); background: #f7f9fd; border-bottom: 1px solid #e9edf5; padding: 8px 10px; white-space: nowrap; }
.mutasi-table th.sortable { cursor: pointer; user-select: none; }
.mutasi-table th.sortable:hover { background: #eef2fb; }
.mutasi-table th .sort-ico { margin-left: 5px; font-size: 9px; color: var(--text-soft); }
.mutasi-table th.is-sorted .sort-ico { color: var(--primary); }
.mutasi-table td { padding: 8px 10px; border-bottom: 1px solid #f1f4fa; color: var(--text-main); font-weight: 700; white-space: nowrap; }
.mutasi-table tbody tr:hover { background: #f9fbff; }
.mutasi-table tbody tr { cursor: pointer; }
.mutasi-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 850; border-radius: 999px; padding: 2px 8px; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; white-space: nowrap; }
.mutasi-badge .mutasi-tipe-dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
`;

export default function MutasiUserPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const lok = searchParams.get("lok") || "";
  const [rows, setRows] = useState<MutasiRow[]>([]);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("pembuat");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const t = setTimeout(() => setKeyword(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

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

  const kw = useMemo(() => keyword.toLowerCase(), [keyword]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination on filter/data change
    setPage(1);
  }, [keyword, rows]);

  if (!session || !loaded) return null;

  const userMap: Record<string, UserItem> = {};
  const jenisCount: Record<string, Record<string, number>> = {};
  rows.forEach((row) => {
    if (dateOnly(row.created_at) !== tanggal) return;
    const user = norm(row.nama_pengguna) || "Tanpa Nama";
    const lokId = String(row.id_pengguna_lokasi || "");
    const lokNama = norm((row as { nama_pengguna_lokasi?: unknown }).nama_pengguna_lokasi) || lokId;
    const jn = jenisNorm(row.jenis_mutasi);
    if (kw !== "") {
      const hay = `${user} ${norm(row.nama_produk)} ${jn} ${norm(row.lokasi_sumber)} ${norm(row.lokasi_tujuan)} ${norm(row.catatan)}`.toLowerCase();
      if (!hay.includes(kw)) return;
    }
    const key = `${user}::${lokId}`;
    if (!userMap[key]) {
      userMap[key] = { key, nama_pengguna: user, total_item: 0, total_qty: 0, jenis_dominan: "", lokasi_id: lokId, lokasi_nama: lokNama };
      jenisCount[key] = {};
    }
    userMap[key].total_item++;
    userMap[key].total_qty += angka(row.jumlah);
    if (jn) jenisCount[key][jn] = (jenisCount[key][jn] || 0) + 1;
  });
  Object.entries(jenisCount).forEach(([key, counts]) => {
    let best = "";
    let bestN = -1;
    Object.entries(counts).forEach(([c, n]) => {
      if (n > bestN) { best = c; bestN = n; }
    });
    if (userMap[key]) userMap[key].jenis_dominan = best;
  });

  const userList = Object.values(userMap).sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "pembuat": return dir * a.nama_pengguna.localeCompare(b.nama_pengguna, "id");
      case "item": return dir * (a.total_item - b.total_item);
      case "qty": return dir * (a.total_qty - b.total_qty);
      case "jenis": return dir * a.jenis_dominan.localeCompare(b.jenis_dominan, "id");
      default: return 0;
    }
  });

  const totalPages = totalPagesOf(userList.length, PAGE_SIZE_LOCAL);
  const paged = paginate(userList, page, PAGE_SIZE_LOCAL);

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
    setPage(1);
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "pembuat", label: "Pembuat" },
    { key: "item", label: "Jumlah Item" },
    { key: "qty", label: "Total Qty" },
    { key: "jenis", label: "Jenis" },
  ];

  const backHref = "/mutasi";

  const goDetail = (u: UserItem) => {
    const qp = new URLSearchParams();
    qp.set("user", u.nama_pengguna);
    const lokParam = multi ? (lok || u.lokasi_id) : "";
    if (lokParam) qp.set("lok", lokParam);
    qp.set("from", "user");
    router.push(`/mutasi/detail/${encodeURIComponent(tanggal)}?${qp.toString()}`);
  };

  return (
    <div className="mutasi-page">
      <style>{css}</style>
      <div className="mutasi-card mutasi-back-row">
        <Link className="mutasi-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>
        <div className="mutasi-date-chip">{tanggal}</div>
      </div>

      <div className="mutasi-card">
        <div className="mutasi-toolbar">
          <div className="mutasi-search-wrap">
            <input type="text" className="mutasi-search-input" value={search}
              placeholder="Cari pembuat, produk, jenis, lokasi, catatan..." autoComplete="off"
              onChange={(e) => setSearch(e.target.value)} />
            {search.trim() !== "" && (
              <button type="button" className="mutasi-search-clear" aria-label="Bersihkan pencarian"
                onClick={() => { setSearch(""); setKeyword(""); }}>
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mutasi-card">
        {paged.length === 0 ? (
          <div className="mutasi-empty">Pembuat mutasi tidak ditemukan.</div>
        ) : (
          <div className="mutasi-table-wrap">
            <table className="mutasi-table">
              <thead>
                <tr>
                  {columns.map((c) => {
                    const active = sortKey === c.key;
                    return (
                      <th key={c.key} className={`sortable ${active ? "is-sorted" : ""}`}
                        onClick={() => onSort(c.key)} title={`Urutkan ${c.label}`}>
                        {c.label}
                        <i className={`bi ${active ? (sortDir === "asc" ? "bi-caret-up-fill" : "bi-caret-down-fill") : "bi-arrow-down-up"} sort-ico`}></i>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.key} onClick={() => goDetail(u)}>
                    <td>{u.nama_pengguna}</td>
                    <td>{u.total_item}</td>
                    <td>{u.total_qty}</td>
                    <td>
                      {u.jenis_dominan ? (
                        <span className="mutasi-badge">
                          <span className="mutasi-tipe-dot" style={{ background: jenisDot(u.jenis_dominan) }}></span>
                          {u.jenis_dominan}
                        </span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={userList.length} pageSize={PAGE_SIZE_LOCAL} onChange={setPage} />
    </div>
  );
}
