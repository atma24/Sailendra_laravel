"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession, type Session } from "@/lib/auth";

type HistRow = {
  tanggal_opname: string;
  created_at: string;
  jenis_opname: string;
  jumlah_produk: number;
  jumlah_selisih: number;
};
type DetailRow = {
  id_opname: number;
  id_produk: number;
  nama_produk: string;
  lokasi_block: string;
  best_before: string;
  satuan: string;
  stok_fisik: number;
  stok_sistem: number;
  selisih: number;
  alasan: string;
  stok_sebelumnya: number | null;
  dirubah_oleh: string | null;
};
type CatalogRow = {
  id_produk: number;
  nama_produk: string;
  satuan: string;
  lokasi_block: string;
  best_before: string;
  stok_sistem: number;
};
type ProdukRow = { id_produk: number; nama_produk: string };
type ManualRow = {
  id_produk: number | "";
  nama_produk: string;
  lokasi_block: string;
  best_before: string;
  stok_fisik: number | "";
};

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const nf = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const fmtPlus = (n: number) => (n >= 0 ? "+" : "") + nf(n);
const opKey = (x: { id_produk?: number; lokasi_block?: string; best_before?: string }) =>
  `${x.id_produk}|${x.lokasi_block}|${x.best_before}`;
const opx = (x: { id_produk?: number; lokasi_block?: string; best_before?: string }) => opKey(x);
const blockOf = (loc: string) => {
  const l = norm(loc);
  if (l === "" || l === "-") return "Lainnya";
  return l.replace(/\s*-\s*\d+\s*$/, "");
};
const clsSelisih = (n: number) => (n < 0 ? "so-min" : n > 0 ? "so-pls" : "so-nol");

type Group = { name: string; rows: DetailRow[] };
const groupRows = (rows: DetailRow[]) => {
  const map: Record<string, DetailRow[]> = {};
  rows.forEach((r) => {
    const b = blockOf(r.lokasi_block);
    (map[b] = map[b] || []).push(r);
  });
  return Object.entries(map).map<Group>(([name, g]) => ({ name, rows: g }));
};

const css = `
.so-page { display: flex; flex-direction: column; gap: 7px; padding-bottom: 12px; }
.so-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.so-section { padding: 10px; }
.so-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 0; flex-wrap: wrap; gap: 8px; }
.so-title { font-size: 13px; font-weight: 900; color: #172033; margin: 0; }
.so-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px; }
.so-search-wrap { position: relative; max-width: 300px; width: 100%; }
.so-search-wrap i { position: absolute; top: 50%; left: 11px; transform: translateY(-50%); color: #8a93a3; font-size: 13px; }
.so-search { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: #172033; outline: none; }
.so-search:focus { background: #fff; border-color: #191970; box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.so-btn { height: 31px; border-radius: 8px; padding: 0 14px; border: none; font-size: 11px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; transition: transform .18s, box-shadow .18s; font-family: inherit; }
.so-btn-primary { background: #191970; color: #fff; }
.so-btn-primary:hover { color: #fff; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.so-btn-secondary { background: #f0f2f5; color: #172033; }
.so-btn-secondary:hover { background: #e5e8ee; }
.so-btn:disabled { opacity: .5; cursor: not-allowed; }
.so-table-wrap { overflow-x: auto; }
.so-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.so-table th { padding: 7px 8px; text-align: left; font-weight: 850; color: #8a93a3; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; border-bottom: 1px solid #e9edf5; white-space: nowrap; }
.so-table td { padding: 6px 8px; border-bottom: 1px solid #f4f6fb; vertical-align: middle; }
.so-table tbody tr:hover { background: #f9fafb; }
.so-empty { padding: 24px; text-align: center; color: #8a93a3; font-size: 11px; font-weight: 750; }
.badge-ok { background-color: #dcfce7; color: #166534; padding: 3px 9px; border-radius: 4px; font-size: 10px; font-weight: 800; display: inline-block; }
.badge-err { background-color: #fee2e2; color: #991b1b; padding: 3px 9px; border-radius: 4px; font-size: 10px; font-weight: 800; display: inline-block; }
.btn-action { background: #fff; color: #191970; border: 1px solid #d1d5db; padding: 5px 13px; border-radius: 4px; font-size: 10px; font-weight: 800; cursor: pointer; transition: all .18s; font-family: inherit; }
.btn-action:hover { background: #f3f4f6; border-color: #9ca3af; }
.so-form-label { font-size: 10px; font-weight: 900; color: #8a93a3; text-transform: uppercase; margin-bottom: 4px; }
.so-form-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; color: #172033; outline: none; font-family: inherit; }
.so-form-input:focus { background: #fff; border-color: #191970; box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.btn-duplicate { background: #eef3ff; color: #191970; border: none; padding: 5px 8px; border-radius: 6px; cursor: pointer; }
.btn-remove { background: #fff0f0; color: #dc2626; border: none; padding: 5px 8px; border-radius: 6px; cursor: pointer; }
.so-err { background: #fff0f0; color: #dc3545; font-size: 11px; font-weight: 700; border-radius: 8px; padding: 8px 10px; }
.so-warn { background: #fff8e1; color: #856404; font-size: 11px; font-weight: 700; border-radius: 8px; padding: 8px 10px; }
.so-info { background: #e8f4fd; color: #0c5460; font-size: 11px; font-weight: 700; border-radius: 8px; padding: 8px 10px; }
.so-min { color: #dc3545; font-weight: 800; }
.so-pls { color: #28a745; font-weight: 800; }
.so-nol { color: #8a93a3; }
.so-input { width: 100%; border: 1px solid #e2e7f0; border-radius: 4px; padding: 4px 6px; font-size: 11px; background: #fbfcff; color: #172033; outline: none; }
.so-input:focus { border-color: #191970; background: #fff; }
.btn-aksi { background: #191970; color: #fff; border: none; padding: 4px 9px; border-radius: 4px; font-size: 10px; font-weight: 800; cursor: pointer; font-family: inherit; }
`;

export default function StockOpnamePage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const isChecker = !!session && session.user.role === "Checker";
  const isEditable = !!session && !isChecker && (session.user.role === "SuperAdmin" || session.user.role === "Supervisor");

  const [view, setView] = useState<"history" | "form" | "preview" | "detail">("history");
  const [jenis, setJenis] = useState<"Manual" | "Akurasi">("Akurasi");
  const [hist, setHist] = useState<HistRow[]>([]);
  const [qManual, setQManual] = useState("");
  const [qAkurasi, setQAkurasi] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [produkList, setProdukList] = useState<ProdukRow[]>([]);
  const [akurasiFisik, setAkurasiFisik] = useState<Record<string, number>>({});
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [detail, setDetail] = useState<DetailRow[]>([]);
  const [detailMeta, setDetailMeta] = useState({ tanggal: "", waktu: "" });
  const [editVals, setEditVals] = useState<Record<string, { fisik: string; alasan: string }>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const paramsOf = useCallback(() => {
    const sp = new URLSearchParams();
    if (multi) {
      const l = lokasiParam(session as Session);
      sp.set("id_pengguna_lokasi_multi", l.split("=")[1] || "");
    } else {
      sp.append("id_pengguna_lokasi", String(session?.user.id_pengguna_lokasi || ""));
    }
    return sp;
  }, [session, multi]);

  const reload = useCallback(() => {
    if (!session) return;
    apiGet<HistRow[]>(`/stok-opname?mode=history&${paramsOf().toString()}`)
      .then((r) => setHist(r.data || []))
      .catch(() => setHist([]));
  }, [session, paramsOf]);

  useEffect(() => { reload(); }, [reload]);

  const histManual = hist.filter((h) => (h.jenis_opname || "Akurasi") === "Manual");
  const histAkurasi = hist.filter((h) => (h.jenis_opname || "Akurasi") !== "Manual");
  const fManual = histManual.filter((h) =>
    qManual === "" || (h.tanggal_opname || "").toLowerCase().includes(qManual.toLowerCase()) || (h.tanggal_opname || "").toLowerCase().includes(qManual.toLowerCase())
  );
  const fAkurasi = histAkurasi.filter((h) =>
    qAkurasi === "" || (h.tanggal_opname || "").toLowerCase().includes(qAkurasi.toLowerCase())
  );

  const openForm = (jenis: "Manual" | "Akurasi") => {
    setErr(""); setMsg(""); setJenis(jenis); setView("form"); setCatalog([]); setManualRows([]); setAkurasiFisik({});
    if (jenis === "Manual") {
      setLoading(true);
      apiGet<ProdukRow[]>(`/produk?limit=2000`)
        .then((r) => setProdukList(r.data || []))
        .catch((e) => setErr(e.message || "Gagal memuat produk."))
        .finally(() => setLoading(false));
      apiGet<CatalogRow[]>(`/stok-opname?mode=stok_catalog&${paramsOf().toString()}`)
        .then((r) => {
          const rows = r.data || [];
          if (rows.length) {
            const seen = new Set<number>();
            const uniq: ManualRow[] = [];
            rows.forEach((x) => {
              if (seen.has(x.id_produk)) return;
              seen.add(x.id_produk);
              uniq.push({
                id_produk: x.id_produk,
                nama_produk: x.nama_produk,
                lokasi_block: "",
                best_before: "",
                stok_fisik: "",
              });
            });
            setManualRows(uniq);
          } else {
            setManualRows([{ id_produk: "", nama_produk: "", lokasi_block: "", best_before: "", stok_fisik: "" }]);
          }
        })
        .catch(() => setManualRows([{ id_produk: "", nama_produk: "", lokasi_block: "", best_before: "", stok_fisik: "" }]));
    } else {
      setLoading(true);
      apiGet<CatalogRow[]>(`/stok-opname?mode=stok_catalog&${paramsOf().toString()}`)
        .then((r) => {
          const rows = r.data || [];
          setCatalog(rows);
          const f: Record<string, number> = {};
          rows.forEach((x) => { f[opKey(x)] = angka(x.stok_sistem); });
          setAkurasiFisik(f);
        })
        .catch((e) => setErr(e.message || "Gagal memuat stok sistem."))
        .finally(() => setLoading(false));
    }
  };

  const addManualRow = () => {
    if (manualRows.length && manualRows[manualRows.length - 1].id_produk === "") return;
    setManualRows([...manualRows, { id_produk: "", nama_produk: "", lokasi_block: "", best_before: "", stok_fisik: 0 }]);
  };
  const updManual = (i: number, patch: Partial<ManualRow>) => {
    const next = manualRows.slice();
    next[i] = { ...next[i], ...patch };
    if (patch.id_produk !== undefined && patch.id_produk !== "") {
      const p = produkList.find((x) => x.id_produk === patch.id_produk);
      next[i].nama_produk = p?.nama_produk || "";
    }
    setManualRows(next);
  };
  const dupManual = (i: number) => {
    const next = manualRows.slice();
    next.splice(i + 1, 0, { ...manualRows[i] });
    setManualRows(next);
  };
  const rmManual = (i: number) => {
    const next = manualRows.slice();
    next.splice(i, 1);
    if (next.length === 0) next.push({ id_produk: "", nama_produk: "", lokasi_block: "", best_before: "", stok_fisik: 0 });
    setManualRows(next);
  };

  const preview = () => {
    if (!session) return;
    let items: Record<string, unknown>[];
    if (jenis === "Manual") {
      items = manualRows.filter((r) => angka(r.id_produk) > 0).map((r) => ({
        id_produk: r.id_produk, nama_produk: r.nama_produk,
        lokasi_block: r.lokasi_block, best_before: r.best_before, stok_fisik: r.stok_fisik, alasan: "",
      }));
      if (!items.length) { setErr("Tidak ada baris produk valid."); return; }
    } else {
      items = catalog.map((x) => ({
        id_produk: x.id_produk, nama_produk: x.nama_produk,
        lokasi_block: x.lokasi_block, best_before: x.best_before,
        stok_fisik: akurasiFisik[opx(x)] ?? 0, alasan: "",
      }));
    }
    setLoading(true); setErr(""); setMsg("");
    const body: Record<string, unknown> = Object.fromEntries(paramsOf());
    body.id_pengguna = session.user.id_pengguna;
    body.tanggal_opname = tanggal;
    body.jenis_opname = jenis;
    body.items = items;
    apiPost<{ items: DetailRow[]; errors: string[] }>(`/stok-opname?mode=preview`, body)
      .then((r) => {
        const rows = r.data?.items || [];
        setDetail(rows);
        setDetailMeta({ tanggal, waktu: "" });
        setErr(r.data?.errors?.length ? r.data.errors.join(" ") : "");
        setMsg(rows.length ? (r.data.errors?.length ? "Sebagian item dipreview." : "Preview berhasil. Cek selisih lalu simpan.") : "");
        setView("preview");
      })
      .catch((e) => setErr(e.message || "Gagal preview."))
      .finally(() => setLoading(false));
  };

  const simpan = () => {
    if (!session) return;
    const items = detail.map((x) => ({
      id_produk: x.id_produk, nama_produk: x.nama_produk, lokasi_block: x.lokasi_block,
      best_before: x.best_before, satuan: x.satuan, stok_fisik: x.stok_fisik, alasan: x.alasan ?? "",
    }));
    setLoading(true); setErr(""); setMsg("");
    const body: Record<string, unknown> = Object.fromEntries(paramsOf());
    body.id_pengguna = session.user.id_pengguna;
    body.tanggal_opname = tanggal;
    body.jenis_opname = jenis;
    body.items = items;
    apiPost<{ tanggal_opname: string; created_at: string; jumlah_item: number }>(`/stok-opname?mode=save`, body)
      .then((r) => {
        setMsg(`Stock opname ${r.data.tanggal_opname} tersimpan (${r.data.jumlah_item} item).`);
        setView("detail");
        setDetailMeta({ tanggal: r.data.tanggal_opname, waktu: r.data.created_at });
        return apiGet<DetailRow[]>(`/stok-opname?mode=detail&${paramsOf().toString()}&created_at=${encodeURIComponent(r.data.created_at)}`)
          .then((dr) => setDetail(dr.data || []));
      })
      .then(() => setView("detail"))
      .catch((e) => setErr(e.message || "Gagal menyimpan."))
      .finally(() => setLoading(false));
  };

  const openDetail = (row: HistRow) => {
    if (!session) return;
    setLoading(true); setErr("");
    apiGet<DetailRow[]>(`/stok-opname?mode=detail&${paramsOf().toString()}&created_at=${encodeURIComponent(row.created_at)}`)
      .then((r) => {
        const rows = r.data || [];
        setDetail(rows);
        setDetailMeta({ tanggal: row.tanggal_opname, waktu: row.created_at });
        const ev: Record<string, { fisik: string; alasan: string }> = {};
        rows.forEach((d) => { ev[d.id_opname] = { fisik: String(d.stok_fisik), alasan: d.alasan ?? "" }; });
        setEditVals(ev);
        setView("detail");
      })
      .catch((e) => setErr(e.message || "Gagal memuat detail."))
      .finally(() => setLoading(false));
  };

  const editItem = (d: DetailRow) => {
    if (!session || !canEdit) return;
    const ev = editVals[d.id_opname];
    const v = angka(ev?.fisik);
    const al = norm(ev?.alasan);
    if (v !== d.stok_fisik && al === "") { setErr("Catatan wajib diisi jika Stok Fisik diubah."); return; }
    setErr("");
    const body: Record<string, unknown> = Object.fromEntries(paramsOf());
    body.id_opname = d.id_opname; body.stok_fisik = v; body.alasan = al; body.dirubah_oleh = session.user.username;
    apiPost<{ ok?: boolean }>(`/stok-opname?mode=edit_item&${paramsOf().toString()}`, body)
      .then(() => {
        setMsg("Data berhasil disimpan.");
        const row = detail.slice();
        const i = row.findIndex((x) => x.id_opname === d.id_opname);
        if (i >= 0) row[i] = { ...row[i], stok_fisik: v, selisih: v - row[i].stok_sistem, alasan: al, stok_sebelumnya: d.stok_fisik, dirubah_oleh: session.user.username };
        setDetail(row);
      })
      .catch((e) => setErr(e.message || "Gagal update."));
  };

  if (!session) return null;

  const canEdit = isEditable;

  const downloadForm = async () => {
    if (!session) return;
    try {
      const raw = localStorage.getItem("sailendra_session");
      const token = (raw && JSON.parse(raw)?.token) || "";
      const sp = paramsOf();
      sp.set("tanggal_opname", tanggal);
      const res = await fetch(`/api/laporan/stok-opname/print-ready?${sp.toString()}`, {
        headers: { Accept: "application/pdf", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setErr("Gagal memuat PDF."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setErr("Gagal memuat PDF.");
    }
  };

  return (
    <div className="so-page">
      <style>{css}</style>

      {view === "history" && (
        <>
          <div className="so-card">
            <div className="so-head"><h2 className="so-title">Riwayat Stock Opname</h2></div>
            <div className="so-toolbar">
              <div className="so-search-wrap">
                <i className="bi bi-search"></i>
                <input type="text" className="so-search" placeholder="Cari tanggal atau status..." value={qManual} onChange={(e) => setQManual(e.target.value)} />
              </div>
              <button type="button" className="so-btn so-btn-primary" onClick={() => openForm("Manual")}>
                <i className="bi bi-plus-lg"></i> Tambah Opname
              </button>
            </div>
            {fManual.length === 0 ? (
              <div className="so-empty">Data tidak ditemukan.</div>
            ) : (
              <div className="so-table-wrap">
                <table className="so-table">
                  <thead><tr><th style={{width:50}}>No</th><th>Tanggal Opname</th><th style={{textAlign:"center"}}>Waktu Simpan</th><th>Total Item</th><th>Status</th><th style={{textAlign:"right"}}>Aksi</th></tr></thead>
                  <tbody>
                    {fManual.map((h, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><strong style={{color:"#111827"}}>{h.tanggal_opname}</strong></td>
                        <td style={{textAlign:"center"}}>{String(h.created_at).slice(11, 16)}</td>
                        <td>{h.jumlah_produk} Produk</td>
                        <td><span className={h.jumlah_selisih > 0 ? "badge-err" : "badge-ok"}>{h.jumlah_selisih > 0 ? h.jumlah_selisih + " Selish" : "Semua"}</span></td>
                        <td style={{textAlign:"right"}}><button type="button" className="btn-action" onClick={() => openDetail(h)}>Detail</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="so-card">
            <div className="so-head"><h2 className="so-title">Riwayat Akurasi Stok</h2></div>
            <div className="so-toolbar">
              <div className="so-search-wrap">
                <i className="bi bi-search"></i>
                <input type="text" className="so-search" placeholder="Cari tanggal atau status..." value={qAkurasi} onChange={(e) => setQAkurasi(e.target.value)} />
              </div>
              <button type="button" className="so-btn so-btn-primary" onClick={() => openForm("Akurasi")}>
                <i className="bi bi-shield-check"></i> Tambah Akurasi
              </button>
            </div>
            {fAkurasi.length === 0 ? (
              <div className="so-empty">Data tidak ditemukan.</div>
            ) : (
              <div className="so-table-wrap">
                <table className="so-table">
                  <thead><tr><th style={{width:50}}>No</th><th>Tanggal Opname</th><th style={{textAlign:"center"}}>Waktu Simpan</th><th>Total Item</th><th>Status</th><th style={{textAlign:"right"}}>Aksi</th></tr></thead>
                  <tbody>
                    {fAkurasi.map((h, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><strong style={{color:"#111827"}}>{h.tanggal_opname}</strong></td>
                        <td style={{textAlign:"center"}}>{String(h.created_at).slice(11, 16)}</td>
                        <td>{h.jumlah_produk} Produk</td>
                        <td><span className={h.jumlah_selisih > 0 ? "badge-err" : "badge-ok"}>{h.jumlah_selisih > 0 ? h.jumlah_selisih + " Selish" : "Sesuai"}</span></td>
                        <td style={{textAlign:"right"}}><button type="button" className="btn-action" onClick={() => openDetail(h)}>Detail</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {view === "form" && (
        <div className="so-card so-section">
          {err && <div className="so-err" style={{marginBottom:10}}>{err}</div>}
          <div style={{ marginBottom: 12 }}>
            <div className="so-form-label">Tanggal Opname</div>
            <input type="date" className="so-form-input" style={{ width: 160 }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <input type="hidden" value={jenis} />

          {jenis === "Manual" ? (
            <>
              {manualRows.length === 0 ? (
                <div className="so-info">Tidak ada data stok untuk lokasi ini. Tambahkan baris manual di bawah.</div>
              ) : (
                <div className="so-table-wrap">
                  <table className="so-table">
                    <thead><tr><th style={{minWidth:180}}>Produk</th><th style={{minWidth:120}}>Lokasi</th><th style={{minWidth:120}}>Best Before</th><th style={{width:100}}>Stok Fisik</th><th style={{width:90}}></th></tr></thead>
                    <tbody>
                      {manualRows.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <select className="so-form-input" value={r.id_produk} onChange={(e) => updManual(i, { id_produk: Number(e.target.value) || "" })}>
                              <option value="">-- Pilih Produk --</option>
                              {produkList.map((p) => <option key={p.id_produk} value={p.id_produk}>{p.nama_produk}</option>)}
                            </select>
                          </td>
                          <td><input type="text" className="so-input so-printblank" placeholder="Misal: A-1" value={r.lokasi_block} onChange={(e) => updManual(i, { lokasi_block: e.target.value })} /></td>
                          <td><input type="text" className="so-input so-printblank" placeholder="Misal: 2026-12-31" value={r.best_before} onChange={(e) => updManual(i, { best_before: e.target.value })} /></td>
                          <td><input type="number" className="so-input so-printblank" min="0" value={r.stok_fisik} onChange={(e) => updManual(i, { stok_fisik: Number(e.target.value) || 0 })} /></td>
                          <td style={{whiteSpace:"nowrap"}}>
                            <button type="button" className="btn-duplicate" title="Duplikat Baris" onClick={() => dupManual(i)}><i className="bi bi-files"></i></button>
                            <button type="button" className="btn-remove" onClick={() => rmManual(i)}><i className="bi bi-trash"></i></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {manualRows.length > 0 && manualRows[manualRows.length - 1].id_produk !== "" && (
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="so-btn so-btn-secondary" onClick={addManualRow}><i className="bi bi-plus-lg"></i> Tambah Baris</button>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 15 }}>
                <button type="button" className="so-btn so-btn-secondary" onClick={downloadForm}>
                  <i className="bi bi-printer"></i> Cetak / PDF
                </button>
                <button type="button" className="so-btn so-btn-secondary" onClick={() => setView("history")}>Batal</button>
                <button type="button" className="so-btn so-btn-primary" disabled={loading} onClick={preview}><i className="bi bi-eye"></i> Preview Opname</button>
              </div>
            </>
          ) : (
            <>
              {catalog.length === 0 ? (
                <div className="so-info">Tidak ada data stok untuk lokasi ini. Pastikan sudah ada stok yang masuk.</div>
              ) : (
                <div className="so-table-wrap" style={{ marginBottom: 12 }}>
                  <table className="so-table">
                    <thead><tr><th style={{minWidth:160}}>Produk</th><th style={{minWidth:90}}>Lokasi</th><th style={{minWidth:90}}>Best Before</th><th style={{width:100}}>Stok Fisik</th></tr></thead>
                    <tbody>
                      {catalog.map((x, i) => {
                        const k = opx(x);
                        return (
                          <tr key={i}>
                            <td>{x.nama_produk}</td>
                            <td>{x.lokasi_block}</td>
                            <td>{x.best_before}</td>
                            <td>
                              <input type="hidden" />
                              <input type="number" className="so-input" min="0" style={{width:100}} placeholder="0"
                                value={akurasiFisik[k] ?? 0}
                                onChange={(e) => setAkurasiFisik({ ...akurasiFisik, [k]: Number(e.target.value) || 0 })} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {catalog.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button type="button" className="so-btn so-btn-secondary" onClick={() => setView("history")}>Batal</button>
                  <button type="button" className="so-btn so-btn-primary" disabled={loading} onClick={preview}><i className="bi bi-eye"></i> Preview</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === "preview" && (
        <div className="so-card">
          <div className="so-section">
            {(err || msg) && <div style={{ marginBottom: 10 }}>{err ? <div className="so-err">{err}</div> : msg ? <div className="so-warn">{msg}</div> : null}</div>}
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Preview Stock Opname: {detailMeta.tanggal}</div>
            {detail.length === 0 ? (
              <div className="so-empty">Tidak ada data valid untuk ditampilkan.</div>
            ) : (
              <PreviewTable rows={detail} />
            )}
            {detail.length > 0 && (
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" className="so-btn so-btn-secondary" onClick={() => setView("form")}>Kembali</button>
                <button type="button" className="so-btn so-btn-primary" disabled={loading} onClick={simpan}><i className="bi bi-check-lg"></i> Simpan Opname</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "detail" && (
        <div className="so-card">
          <div className="so-section">
            {err && <div className="so-err" style={{ marginBottom: 10 }}>{err}</div>}
            {msg && <div className="so-info" style={{ marginBottom: 10 }}>{msg}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900 }}>
                Detail Stock Opname: {detailMeta.tanggal}
                <span style={{ fontSize: 10, fontWeight: 750, color: "#8a93a3" }}> ({detail.length} item)</span>
              </div>
              <button type="button" className="so-btn so-btn-secondary" onClick={() => setView("history")}><i className="bi bi-arrow-left"></i> Kembali ke Riwayat</button>
            </div>
            {detail.length === 0 ? (
              <div className="so-empty">Detail kosong.</div>
            ) : (
              <DetailTable rows={detail} editable={canEdit} vals={editVals} setVals={setEditVals} onSave={editItem} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewTable({ rows }: { rows: DetailRow[] }) {
  const groups = groupRows(rows).map((g) => ({
    ...g,
    s: g.rows.reduce((a, r) => a + r.stok_sistem, 0),
    f: g.rows.reduce((a, r) => a + r.stok_fisik, 0),
    se: g.rows.reduce((a, r) => a + r.selisih, 0),
  }));
  const gs = groups.reduce((a, g) => a + g.s, 0);
  const gf = groups.reduce((a, g) => a + g.f, 0);
  const gse = groups.reduce((a, g) => a + g.se, 0);
  return (
    <div className="so-table-wrap">
      <table className="so-table">
        <thead><tr><th>Produk</th><th>Lokasi</th><th>Best Before</th><th>Stok Online</th><th>Stok Fisik</th><th>Selisih</th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <>
              {g.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.nama_produk}</td><td>{r.lokasi_block}</td><td>{r.best_before}</td>
                  <td>{nf(r.stok_sistem)}</td><td>{nf(r.stok_fisik)}</td>
                  <td className={clsSelisih(r.selisih)}>{fmtPlus(r.selisih)}</td>
                </tr>
              ))}
              <tr className="so-block" style={{ background: "#eef2ff", fontWeight: 900 }}>
                <td colSpan={3} style={{ color: "#191970" }}>TOTAL BLOCK {g.name}</td>
                <td>{nf(g.s)}</td><td>{nf(g.f)}</td><td className={clsSelisih(g.se)}>{fmtPlus(g.se)}</td>
              </tr>
            </>
          ))}
          <tr style={{ background: "#f8f9fa", fontWeight: 900, fontSize: 12 }}>
            <td colSpan={3}>TOTAL KESELURUHAN</td><td>{nf(gs)}</td><td>{nf(gf)}</td><td className={clsSelisih(gse)}>{fmtPlus(gse)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DetailTable({ rows, editable, vals, setVals, onSave }: {
  rows: DetailRow[];
  editable: boolean;
  vals: Record<string, { fisik: string; alasan: string }>;
  setVals: (v: Record<string, { fisik: string; alasan: string }>) => void;
  onSave: (d: DetailRow) => void;
}) {
  const groups = groupRows(rows).map((g) => ({
    ...g,
    s: g.rows.reduce((a, r) => a + r.stok_sistem, 0),
    f: g.rows.reduce((a, r) => a + r.stok_fisik, 0),
    se: g.rows.reduce((a, r) => a + r.selisih, 0),
  }));
  const gs = groups.reduce((a, g) => a + g.s, 0);
  const gf = groups.reduce((a, g) => a + g.f, 0);
  const gse = groups.reduce((a, g) => a + g.se, 0);
  return (
    <div className="so-table-wrap">
      <table className="so-table">
        <thead>
          <tr>
            <th>Produk</th><th>Lokasi</th><th>Batch / BB</th><th>Stok Online</th>
            <th>{editable ? "Stok Fisik (Edit)" : "Stok Fisik"}</th><th>Selisih</th>
            <th>{editable ? "Catatan Wajib" : "Catatan"}</th><th>Stok Sebelumnya</th><th>Diubah Oleh</th>
            {editable && <th>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <>
              {g.rows.map((d) => {
                const ev = vals[d.id_opname] ?? { fisik: String(d.stok_fisik), alasan: d.alasan ?? "" };
                return (
                  <tr key={d.id_opname}>
                    <td>{d.nama_produk}</td><td>{d.lokasi_block}</td><td>{d.best_before}</td>
                    <td>{nf(d.stok_sistem)}</td>
                    <td style={{ width: 70 }}>
                      {editable ? (
                        <input type="number" className="so-input" value={ev.fisik}
                          onChange={(e) => setVals({ ...vals, [d.id_opname]: { ...ev, fisik: e.target.value } })} />
                      ) : (
                        <span style={{ fontWeight: 700 }}>{nf(d.stok_fisik)}</span>
                      )}
                    </td>
                    <td className={clsSelisih(d.selisih)}>{fmtPlus(d.selisih)}</td>
                    <td style={{ width: 140 }}>
                      {editable ? (
                        <input type="text" className="so-input" value={ev.alasan} placeholder="Isi catatan..."
                          onChange={(e) => setVals({ ...vals, [d.id_opname]: { ...ev, alasan: e.target.value } })} />
                      ) : (
                        <span style={{ color: "#8a93a3" }}>{norm(d.alasan) || "-"}</span>
                      )}
                    </td>
                    <td>{d.stok_sebelumnya !== null ? nf(d.stok_sebelumnya) : "-"}</td>
                    <td><div style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>{norm(d.dirubah_oleh) || "-"}</div></td>
                    {editable && <td><button type="button" className="btn-aksi" onClick={() => onSave(d)}><i className="bi bi-save"></i></button></td>}
                  </tr>
                );
              })}
              <tr className="so-block" style={{ background: "#eef0ff", fontWeight: 900 }}>
                <td colSpan={3} style={{ color: "#191970" }}>TOTAL BLOCK {g.name}</td>
                <td>{nf(g.s)}</td><td>{nf(g.f)}</td><td className={clsSelisih(g.se)}>{fmtPlus(g.se)}</td>
                <td colSpan={editable ? 4 : 3}></td>
              </tr>
            </>
          ))}
          <tr style={{ background: "#f8f9fa", fontWeight: 900, fontSize: 12 }}>
            <td colSpan={3}>TOTAL KESELURUHAN</td><td>{nf(gs)}</td><td>{nf(gf)}</td>
            <td className={clsSelisih(gse)}>{fmtPlus(gse)}</td><td colSpan={editable ? 4 : 3}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}