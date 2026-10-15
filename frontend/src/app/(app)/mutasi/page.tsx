"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import Pagination, { paginate, totalPagesOf } from "@/components/Pagination";

type MutasiRow = {
  id_mutasi: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  id_pengguna: number;
  nama_pengguna: string;
  nama_produk: string;
  jumlah: number;
  satuan: string;
  jenis_mutasi: string;
  lokasi_sumber: string;
  lokasi_tujuan: string;
  catatan: string;
  created_at: string;
};

type TransaksiRow = {
  key: string;
  tanggal: string;
  user: string;
  jumlah_item: number;
  total_qty: number;
  jenis_dominan: string;
  lokasi_id: string;
  lokasi_nama: string;
};

const PAGE_SIZE_LOCAL = 10;
const FILTER_KEY = "sailendra_mutasi_filter_v1";

const JENIS_OPTIONS = [
  { v: "GS_GS", label: "GS - GS", dot: "#1D4ED8" },
  { v: "GS_BAD", label: "GS - Bad", dot: "#D97706" },
  { v: "BAD_GS", label: "Bad - GS", dot: "#059669" },
  { v: "GS_REJ", label: "GS - Reject", dot: "#DC2626" },
  { v: "BAD_REJ", label: "Bad - Reject", dot: "#991B1B" },
  { v: "GS_QI", label: "GS - QI", dot: "#7C3AED" },
  { v: "QI_GS", label: "QI - GS", dot: "#0D9488" },
  { v: "QI_BAD", label: "QI - Bad", dot: "#DB2777" },
  { v: "BAD_QI", label: "Bad - QI", dot: "#92400E" },
] as const;

type SavedFilter = { q: string; jenis: string[]; dari: string; sampai: string };

const loadSaved = (): SavedFilter => {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (!raw) return { q: "", jenis: [], dari: "", sampai: "" };
    const p = JSON.parse(raw) as Partial<SavedFilter>;
    const validJenis: string[] = JENIS_OPTIONS.map((o) => o.v);
    return {
      q: typeof p.q === "string" ? p.q : "",
      jenis: Array.isArray(p.jenis) ? p.jenis.filter((t) => validJenis.includes(t)) : [],
      dari: typeof p.dari === "string" ? p.dari.slice(0, 10) : "",
      sampai: typeof p.sampai === "string" ? p.sampai.slice(0, 10) : "",
    };
  } catch {
    return { q: "", jenis: [], dari: "", sampai: "" };
  }
};

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);
const jenisNorm = (v: unknown) => String(v ?? "").trim().toUpperCase();

const jenisDot = (j: string): string => {
  const f = JENIS_OPTIONS.find((o) => o.v === j);
  return f ? f.dot : "#64748B";
};

type SortKey = "tanggal" | "pembuat" | "lokasi" | "item" | "qty" | "jenis";
type SortDir = "asc" | "desc";

const css = `
.mutasi-page { display: flex; flex-direction: column; gap: 7px; }
.mutasi-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.mutasi-toolbar { padding: 8px; display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.mutasi-search-wrap { position: relative; flex: 1; min-width: 200px; }
.mutasi-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px 0 12px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; box-sizing: border-box; }
.mutasi-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.mutasi-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); text-decoration: none; border: 0; background: transparent; cursor: pointer; }
.mutasi-reset-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: transparent; border: 1px dashed #cbd5e1; color: var(--text-soft); font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.mutasi-reset-btn:hover { color: #DC2626; border-color: #DC2626; }
.mutasi-filter-panel { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.mutasi-date-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.mutasi-date-field { display: flex; flex-direction: column; gap: 4px; }
.mutasi-date-field label { font-size: 10px; font-weight: 850; color: var(--text-soft); }
.mutasi-date-field input { height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.mutasi-date-field input:focus { background: #FFFFFF; border-color: var(--primary); }
.mutasi-active-hint { font-size: 10px; font-weight: 750; color: var(--text-soft); }
.mutasi-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.mutasi-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.mutasi-filter-title { font-size: 11px; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.4px; }
.mutasi-tipe-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.mutasi-tipe-check { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-main); border: 1px solid #e2e7f0; background: #fbfcff; border-radius: 999px; padding: 5px 11px; cursor: pointer; user-select: none; }
.mutasi-tipe-check input { accent-color: var(--primary); }
.mutasi-tipe-check.is-on { background: var(--primary-soft); border-color: rgba(25,25,112,0.3); }
.mutasi-tipe-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
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
.mutasi-badge .mutasi-tipe-dot { width: 6px; height: 6px; }
`;

export default function MutasiPage() {
  const session = useSession();
  const router = useRouter();
  const multi = !!session && isMultiRole(session.user.role);

  const [savedOnce] = useState<SavedFilter>(() =>
    typeof window === "undefined" ? { q: "", jenis: [], dari: "", sampai: "" } : loadSaved()
  );
  const [rows, setRows] = useState<MutasiRow[]>([]);
  const [search, setSearch] = useState(savedOnce.q);
  const [keyword, setKeyword] = useState(savedOnce.q);
  const [jenis, setJenis] = useState<string[]>(savedOnce.jenis);
  const [dari, setDari] = useState(savedOnce.dari);
  const [sampai, setSampai] = useState(savedOnce.sampai);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("tanggal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({ q: keyword, jenis, dari, sampai }));
    } catch { /* abaikan */ }
  }, [keyword, jenis, dari, sampai]);

  useEffect(() => {
    const t = setTimeout(() => setKeyword(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  const jenisKey = useMemo(() => [...jenis].sort().join(","), [jenis]);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination on filter/data change
    setPage(1);
  }, [keyword, jenisKey, dari, sampai, rows]);

  const toggleJenis = (v: string) => {
    setJenis((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));
  };

  const resetFilter = () => {
    setSearch("");
    setKeyword("");
    setJenis([]);
    setDari("");
    setSampai("");
    setPage(1);
    try { sessionStorage.removeItem(FILTER_KEY); } catch { /* abaikan */ }
  };

  if (!session || !loaded) return null;

  const canAdd = !!session && session.user.role !== "Support";
  const filterActive = jenis.length > 0 || dari !== "" || sampai !== "" || keyword.trim() !== "";
  const q = keyword.trim().toLowerCase();

  // Filter client-side (API mutasi belum dukung cari/tipe/range), lalu grup per tanggal+user.
  const mapTrans: Record<string, TransaksiRow> = {};
  const jenisCount: Record<string, Record<string, number>> = {};
  rows.forEach((row) => {
    const t = dateOnly(row.created_at);
    if (!t || t.startsWith("0000")) return;
    if (dari !== "" && t < dari) return;
    if (sampai !== "" && t > sampai) return;
    const jn = jenisNorm(row.jenis_mutasi);
    if (jenis.length > 0 && !jenis.includes(jn)) return;
    const user = norm(row.nama_pengguna) || "Tanpa Nama";
    const lokId = String(row.id_pengguna_lokasi || "");
    const lokNama = norm(row.nama_pengguna_lokasi) || lokId;
    if (q !== "") {
      const hay = `${t} ${user} ${norm(row.nama_produk)} ${jn} ${lokId} ${lokNama} ${norm(row.lokasi_sumber)} ${norm(row.lokasi_tujuan)} ${norm(row.catatan)}`.toLowerCase();
      if (!hay.includes(q)) return;
    }
    const key = `${t}::${user}::${lokId}`;
    if (!mapTrans[key]) {
      mapTrans[key] = {
        key,
        tanggal: t,
        user,
        jumlah_item: 0,
        total_qty: 0,
        jenis_dominan: "",
        lokasi_id: lokId,
        lokasi_nama: lokNama,
      };
      jenisCount[key] = {};
    }
    mapTrans[key].jumlah_item++;
    mapTrans[key].total_qty += angka(row.jumlah);
    if (jn) jenisCount[key][jn] = (jenisCount[key][jn] || 0) + 1;
  });
  Object.entries(jenisCount).forEach(([key, counts]) => {
    let best = "";
    let bestN = -1;
    Object.entries(counts).forEach(([c, n]) => {
      if (n > bestN) { best = c; bestN = n; }
    });
    if (mapTrans[key]) mapTrans[key].jenis_dominan = best;
  });

  const list = Object.values(mapTrans);
  const sorted = [...list].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "tanggal": return dir * a.tanggal.localeCompare(b.tanggal);
      case "pembuat": return dir * a.user.localeCompare(b.user, "id");
      case "lokasi": return dir * `${a.lokasi_id} ${a.lokasi_nama}`.localeCompare(`${b.lokasi_id} ${b.lokasi_nama}`, "id");
      case "item": return dir * (a.jumlah_item - b.jumlah_item);
      case "qty": return dir * (a.total_qty - b.total_qty);
      case "jenis": return dir * a.jenis_dominan.localeCompare(b.jenis_dominan, "id");
      default: return 0;
    }
  });

  const totalPages = totalPagesOf(sorted.length, PAGE_SIZE_LOCAL);
  const paged = paginate(sorted, page, PAGE_SIZE_LOCAL);

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
    { key: "tanggal", label: "Tanggal" },
    { key: "pembuat", label: "Pembuat" },
    ...(multi ? [{ key: "lokasi" as SortKey, label: "Lokasi" }] : []),
    { key: "item", label: "Jumlah Item" },
    { key: "qty", label: "Total Qty" },
    { key: "jenis", label: "Jenis" },
  ];

  return (
    <div className="mutasi-page">
      <style>{css}</style>

      <div className="mutasi-card">
        <div className="mutasi-toolbar">
          <div className="mutasi-search-wrap">
            <input type="text" className="mutasi-search-input" value={search}
              placeholder="Cari tanggal, pembuat, produk, jenis, lokasi, catatan..." autoComplete="off"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setKeyword(search.trim()); }} />
            {search.trim() !== "" && (
              <button type="button" className="mutasi-search-clear" aria-label="Bersihkan pencarian"
                onClick={() => { setSearch(""); setKeyword(""); }}>
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>

          {filterActive && (
            <button type="button" className="mutasi-reset-btn" onClick={resetFilter}>
              <i className="bi bi-arrow-counterclockwise"></i>
              Reset
            </button>
          )}

          {canAdd && (
            <Link className="mutasi-add-btn" href="/mutasi/form">
              <i className="bi bi-plus-lg"></i>
              Tambah Mutasi
            </Link>
          )}
        </div>

        <div className="mutasi-filter-panel">
          <div>
            <div className="mutasi-filter-title" style={{ marginBottom: 6 }}>Jenis Mutasi</div>
            <div className="mutasi-tipe-grid">
              {JENIS_OPTIONS.map((o) => {
                const on = jenis.includes(o.v);
                return (
                  <label key={o.v} className={`mutasi-tipe-check ${on ? "is-on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleJenis(o.v)} />
                    <span className="mutasi-tipe-dot" style={{ background: o.dot }}></span>
                    {o.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mutasi-filter-title" style={{ marginBottom: 6 }}>Range Tanggal</div>
            <div className="mutasi-date-row">
              <div className="mutasi-date-field">
                <label>Dari</label>
                <input type="date" value={dari} max={sampai || undefined} onChange={(e) => setDari(e.target.value)} />
              </div>
              <div className="mutasi-date-field">
                <label>Sampai</label>
                <input type="date" value={sampai} min={dari || undefined} onChange={(e) => setSampai(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="mutasi-active-hint">
            Filter tersimpan otomatis — tetap aktif saat membuka detail, ter-reset saat pindah halaman lain atau tekan Reset.
          </div>
        </div>
      </div>

      <div className="mutasi-card">
        {paged.length === 0 ? (
          <div className="mutasi-empty">
            {filterActive ? "Tidak ada data yang cocok dengan filter/pencarian." : "Tidak ada riwayat mutasi."}
          </div>
        ) : (
          <div className="mutasi-table-wrap">
            <table className="mutasi-table">
              <thead>
                <tr>
                  {columns.map((c) => {
                    const active = sortKey === c.key;
                    return (
                      <th key={c.key} className={`sortable ${active ? "is-sorted" : ""}`}
                        onClick={() => onSort(c.key)}
                        title={`Urutkan ${c.label}`}>
                        {c.label}
                        <i className={`bi ${active ? (sortDir === "asc" ? "bi-caret-up-fill" : "bi-caret-down-fill") : "bi-arrow-down-up"} sort-ico`}></i>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paged.map((item) => {
                  const qp = new URLSearchParams();
                  qp.set("user", item.user);
                  if (multi && item.lokasi_id) qp.set("lok", item.lokasi_id);
                  qp.set("from", "list");
                  return (
                    <tr key={item.key}
                      onClick={() => { router.push(`/mutasi/detail/${encodeURIComponent(item.tanggal)}?${qp.toString()}`); }}>
                      <td>{item.tanggal}</td>
                      <td>{item.user}</td>
                      {multi && <td><span className="mutasi-badge">{item.lokasi_id}{item.lokasi_nama ? ` - ${item.lokasi_nama}` : ""}</span></td>}
                      <td>{item.jumlah_item}</td>
                      <td>{item.total_qty}</td>
                      <td>
                        {item.jenis_dominan ? (
                          <span className="mutasi-badge">
                            <span className="mutasi-tipe-dot" style={{ background: jenisDot(item.jenis_dominan) }}></span>
                            {item.jenis_dominan}
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={sorted.length} pageSize={PAGE_SIZE_LOCAL} onChange={setPage} />
    </div>
  );
}
