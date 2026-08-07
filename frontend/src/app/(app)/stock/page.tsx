"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession, type Session } from "@/lib/auth";

type ListRow = {
  id_produk: number;
  nama_produk: string;
  kategori_lokasi: string;
  satuan: string;
  total_qty: number;
  best_before_terdekat: string;
};
type KapRow = {
  id_produk: number;
  nama_produk: string;
  kategori_lokasi: string;
  satuan: string;
  total_kapasitas: number;
};
type DetailRow = {
  lokasi_block: string;
  qty_sisa: number;
  best_before: string;
  satuan: string;
};
type Produk = {
  id_produk: number;
  nama_produk: string;
  kategori_lokasi: string;
  satuan: string;
  qty: number;
  kapasitas: number;
  persen: number;
};

const CAT_ORDER = ["GALLON", "SPS", "XWH", "LAINNYA"];

const SPECIALS: [string, string][] = [
  ["receh", "Stock Receh"],
  ["bad", "Bad Stock"],
  ["reject", "Stock Reject"],
  ["festive", "Stock Festive"],
  ["transit", "Stock Transit"],
  ["hold", "Stock Hold"],
];

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => new Intl.NumberFormat("id-ID").format(angka(v));
const persen = (q: number, k: number) => (k > 0 ? Math.min(100, Math.round((q / k) * 100)) : 0);

const css = `
.stock-page { display: flex; flex-direction: column; gap: 7px; padding-bottom: 12px; }
.stock-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; }
.stock-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 0; flex-wrap: wrap; gap: 8px; }

.stock-search-wrap { position: relative; }
.stock-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 750; color: #172033; outline: none; }
.stock-search-input::placeholder { color: #8a93a3; font-weight: 650; }
.stock-search-input:focus { background: #FFFFFF; border-color: #191970; box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }

.stock-summary-grid { display: flex; flex-direction: column; gap: 7px; }
.stock-summary-card { background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 11px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.stock-summary-card.wide { grid-column: auto; }
.stock-summary-top { display: flex; align-items: center; justify-content: space-between; gap: 7px; }
.stock-summary-title { font-size: 12px; font-weight: 900; color: #172033; letter-spacing: -0.15px; }
.stock-percent-pill { min-width: 32px; min-height: 23px; border-radius: 999px; background: #eef2ff; color: #191970; display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; font-size: 10px; font-weight: 900; }
.stock-progress { width: 100%; height: 5px; border-radius: 999px; background: #e8ecf4; overflow: hidden; }
.stock-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #191970, #77a7ff); width: 0%; }
.stock-summary-bottom { font-size: 11px; font-weight: 850; line-height: 1.2; }

.stock-special-list { display: flex; flex-direction: column; gap: 7px; }
.stock-special-link { min-height: 31px; border-radius: 9px; background: #FFFFFF; border: 1px solid #e2e7f0; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 7px; font-size: 11px; font-weight: 850; cursor: pointer; transition: color .18s, border-color .18s, box-shadow .18s; }
.stock-special-link:hover { border-color: rgba(25,25,112,.18); box-shadow: 0 6px 14px rgba(15,23,42,0.08); }

.stock-category-section { display: flex; flex-direction: column; gap: 7px; }
.stock-category-title { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 950; letter-spacing: -0.2px; margin-top: 2px; }
.stock-category-title::after { content: ""; height: 1px; background: #dfe3ec; flex: 1; }

.stock-product-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
.stock-product-card { background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 11px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; transition: transform .18s, box-shadow .18s, border-color .18s; }
.stock-product-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 6px 14px rgba(25,23,42,0.07); }
.stock-product-name { font-size: 11px; font-weight: 850; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stock-product-meta { display: flex; align-items: center; justify-content: space-between; gap: 7px; font-size: 10px; font-weight: 800; }
.stock-product-muted { color: #8a93a3; font-weight: 750; white-space: nowrap; }

.stock-empty { padding: 12px; text-align: center; color: #8a93a3; font-size: 11px; font-weight: 750; }

.stock-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 9999; align-items: center; justify-content: center; padding: 24px; backdrop-filter: blur(2px); }
.stock-modal-overlay.active { display: flex; }
.stock-modal { background: #FFFFFF; border-radius: 16px; width: 100%; max-width: 95%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(15,23,42,0.18); overflow: hidden; }
.stock-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e9edf5; flex-shrink: 0; }
.stock-modal-title { font-size: 14px; font-weight: 950; color: #191970; letter-spacing: -0.2px; }
.stock-modal-subtitle { font-size: 11px; font-weight: 700; color: #8a93a3; margin-top: 2px; }
.stock-modal-close { width: 36px; height: 36px; border: 1px solid #e2e7f0; border-radius: 10px; background: #fbfcff; font-size: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.stock-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.stock-detail-loading { font-size: 11px; font-weight: 800; color: #8a93a3; text-align: center; padding: 20px 0; }
@media (max-width: 992px) { .stock-product-grid { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .stock-modal-overlay { padding: 12px; } .stock-modal { max-height: 90vh; border-radius: 12px; } }
`;

export default function StockPage() {
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const [list, setList] = useState<ListRow[]>([]);
  const [kaps, setKaps] = useState<Map<number, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ id: number; nama: string } | null>(null);
  const [detail, setDetail] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const paramsOf = useCallback(() => {
    if (!session) return "";
    const sp = new URLSearchParams();
    if (multi) {
      const l = lokasiParam(session as Session);
      sp.set("id_pengguna_lokasi_multi", l.split("=")[1] || "");
    } else {
      sp.append("id_pengguna_lokasi", String(session.user.id_pengguna_lokasi || ""));
    }
    return sp.toString();
  }, [session, multi]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const b = paramsOf();
        const [lr, kr] = await Promise.all([
          apiGet<ListRow[]>(`/stok?zona=normal&${b}`),
          apiGet<KapRow[]>(`/stok?mode=kapasitas_produk&${b}`),
        ]);
        if (cancelled) return;
        setList(lr.data || []);
        setKaps(new Map((kr.data || []).map((r) => [r.id_produk, angka(r.total_kapasitas)])));
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, paramsOf]);

  const openModal = (id: number, nama: string) => {
    if (!session) return;
    setModal({ id, nama });
    setDetail([]);
    setDetailLoading(true);
    apiGet<DetailRow[]>(`/stok?id_produk=${id}&zona=normal&${paramsOf()}`)
      .then((r) => setDetail(r.data || []))
      .catch(() => setDetail([]))
      .finally(() => setDetailLoading(false));
  };

  const products: Produk[] = list.map((r) => {
    const kap = kaps.get(r.id_produk) || 0;
    const qty = angka(r.total_qty);
    return { id_produk: r.id_produk, nama_produk: norm(r.nama_produk), kategori_lokasi: norm(r.kategori_lokasi), satuan: norm(r.satuan), qty, kapasitas: kap, persen: persen(qty, kap) };
  });

  const ql = q.trim().toLowerCase();
  const filtered = products.filter((p) =>
    ql === "" || p.nama_produk.toLowerCase().includes(ql) || p.kategori_lokasi.toLowerCase().includes(ql)
  );
  const byCat: Record<string, Produk[]> = {};
  filtered.forEach((p) => { (byCat[p.kategori_lokasi] = byCat[p.kategori_lokasi] || []).push(p); });
  const cats = Object.keys(byCat).sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a === "LAINNYA" ? a : a);
    const ib = CAT_ORDER.indexOf(b === "LAINNYA" ? b : b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });

  const sumQty = (p: Produk[]) => p.reduce((s, x) => s + x.qty, 0);
  const sumKap = (p: Produk[]) => p.reduce((s, x) => s + x.kapasitas, 0);
  const tQ = sumQty(filtered); const tK = sumKap(filtered);
  const gab = { qty: tQ, kap: tK, persen: persen(tQ, tK) };

  const groupTotal = (c: string) => {
    const p = byCat[c]; const qty = sumQty(p); const kap = sumKap(p);
    return { qty, kap, persen: persen(qty, kap) };
  };

  const sections = detail.reduce<{ parent: string; blocks: Record<string, { total: number; rows: { bb: string; qty: number }[] }> }[]>((acc, d) => {
    const loc = norm(d.lokasi_block) || "-";
    const prefix = loc === "-" ? "Lainnya" : "Block " + loc.split("-")[0];
    let sec = acc.find((s) => s.parent === prefix);
    if (!sec) { sec = { parent: prefix, blocks: {} }; acc.push(sec); }
    const b = sec.blocks[loc] = sec.blocks[loc] || { total: 0, rows: [] };
    const bb = norm(d.best_before) || "-";
    const qty = angka(d.qty_sisa);
    b.total += qty;
    const ex = b.rows.find((r) => r.bb === bb);
    if (ex) ex.qty += qty; else b.rows.push({ bb, qty });
    return acc;
  }, []);

  const grandTotal = detail.reduce((s, d) => s + angka(d.qty_sisa), 0);

  if (!session || !loaded) return null;

  return (
    <div className="stock-page">
      <style>{css}</style>

      <div className="stock-card" style={{ padding: 8 }}>
        <div className="stock-search-wrap">
          <i className="bi bi-search" style={{ position: "absolute", top: "50%", left: 11, transform: "translateY(-50%)", color: "#8a93a3", fontSize: 13 }}></i>
          <input type="text" className="stock-search-input" placeholder="Cari produk" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="stock-summary-grid">
        <div className="stock-summary-card wide">
          <div className="stock-summary-top"><div className="stock-summary-title">Gabungan</div><div className="stock-percent-pill">{gab.persen}%</div></div>
          <div className="stock-progress"><div className="stock-progress-fill" style={{ width: gab.persen + "%" }}></div></div>
          <div className="stock-summary-bottom">Stok: {num(gab.qty)} / {num(gab.kap)}</div>
        </div>
        {cats.map((c) => {
          const s = groupTotal(c);
          return (
            <div key={c} className={"stock-summary-card" + (s.persen >= 60 ? " wide" : "")}>
              <div className="stock-summary-top"><div className="stock-summary-title">{c}</div><div className="stock-percent-pill">{s.persen}%</div></div>
              <div className="stock-progress"><div className="stock-progress-fill" style={{ width: s.persen + "%" }}></div></div>
              <div className="stock-summary-bottom">Stok: {num(s.qty)} / {num(s.kap)}</div>
            </div>
          );
        })}
      </div>

      <div className="stock-card stock-special-list">
        {SPECIALS.map(([z, label]) => (
          <a key={z} className="stock-special-link" href={"/stock"} onClick={(e) => { e.preventDefault(); }}>
            <span>{label}</span><i className="bi bi-chevron-right"></i>
          </a>
        ))}
      </div>

      {cats.length === 0 ? (
        <div className="stock-card stock-empty">Data stock belum tersedia.</div>
      ) : (
        cats.map((c) => (
          <div key={c} className="stock-card stock-category-section" style={{ padding: 10 }}>
            <div className="stock-category-title">{c}</div>
            <div className="stock-product-grid">
              {byCat[c].map((p) => (
                <div key={p.id_produk} className="stock-product-card" onClick={() => openModal(p.id_produk, p.nama_produk)}>
                  <div className="stock-product-name" title={p.nama_produk}>{p.nama_produk}</div>
                  <div className="stock-progress"><div className="stock-progress-fill" style={{ width: p.persen + "%" }}></div></div>
                  <div className="stock-product-meta">
                    <span>Stok: {num(p.qty)} {p.satuan}</span>
                    <span className="stock-product-muted">{num(p.qty)} / {num(p.kapasitas)} &nbsp; {p.persen}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className={`stock-modal-overlay${modal ? " active" : ""}`}>
        <div className="stock-modal">
          <div className="stock-modal-header">
            <div>
              <div className="stock-modal-title">{modal?.nama || ""}</div>
              <div className="stock-modal-subtitle">ID Produk: {modal?.id}</div>
            </div>
            <button type="button" className="stock-modal-close" onClick={() => setModal(null)}><i className="bi bi-x-lg"></i></button>
          </div>
          <div className="stock-modal-body">
            {detailLoading ? (
              <div className="stock-detail-loading"><i className="bi bi-arrow-clockwise"></i> Memuat rincian stock...</div>
            ) : detail.length === 0 ? (
              <div className="stock-detail-loading">Tidak ada stok untuk produk ini.</div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ background: "#eef2ff", color: "#191970", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 900, display: "inline-block" }}>Sisa Total: {num(grandTotal)}</div>
                </div>
                {sections.map((sec) => (
                  <div key={sec.parent} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 4, height: 16, background: "#191970", borderRadius: 4 }}></div>{sec.parent}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14 }}>
                      {Object.entries(sec.blocks).map(([loc, blk]) => (
                        <div key={loc} style={{ border: "1px solid #e2e7f0", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
                          <div style={{ background: "#fbfcff", padding: "10px 14px", borderBottom: "1px solid #e9edf5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 900, fontSize: 13, color: "#191970" }}><i className="bi bi-geo-alt" style={{ marginRight: 4, fontSize: 11 }}></i>{loc}</span>
                            <span style={{ fontSize: 11, fontWeight: 850, background: "#e8ecf4", padding: "4px 8px", borderRadius: 6 }}>Total: {num(blk.total)}</span>
                          </div>
                          <div style={{ padding: "8px 14px" }}>
                            {blk.rows.map((r, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px dashed #f0f2f5", fontSize: 11 }}>
                                <span style={{ color: "#8a93a3", fontWeight: 700 }}>{r.bb}</span>
                                <span style={{ fontWeight: 850 }}>{num(r.qty)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}