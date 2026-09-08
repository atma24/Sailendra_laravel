"use client";

import { useEffect, useState } from "react";
import { api, apiGet, apiPost } from "@/lib/api";
import { aktifLokasiId, isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import { useToast } from "@/components/ToastProvider";

type SettingRow = {
  id_produk: number;
  nama_produk: string;
  satuan: string;
  tanpa_batch?: number | boolean;
  id_pengaturan: number | null;
  ikut_fefo: boolean;
  urutan_blok: string[];
  is_default: boolean;
};

type Lokasi = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };

const sekel = (v: unknown) => String(v ?? "");
const KAT_LABEL: Record<string, string> = {
  MOBIL: "Mobil",
  RECEH: "Receh",
  TRANSIT: "Transit",
  REGULER: "Reguler",
};
const KAT_DESC: Record<string, string> = {
  MOBIL: "Blok staging mobil",
  RECEH: "Blok receh",
  TRANSIT: "Blok transit",
  REGULER: "Semua blok lain (termasuk di GALLON / SPS / XWH)",
};

const css = `
.ppeng-page { display: flex; flex-direction: column; gap: 12px; }
.ppeng-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 12px; }
.ppeng-toolbar { padding: 12px 14px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.ppeng-search { flex: 1; min-width: 200px; height: 36px; border-radius: 9px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 12px; font-size: 12px; font-weight: 600; color: var(--text-main); outline: none; }
.ppeng-search:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.ppeng-select { height: 36px; border-radius: 9px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 12px; font-weight: 700; color: var(--text-main); outline: none; }
.ppeng-note { padding: 10px 14px; font-size: 11px; font-weight: 600; color: var(--text-soft); line-height: 1.5; }
.ppeng-table-card { overflow-x: auto; }
.ppeng-table { width: 100%; border-collapse: collapse; min-width: 980px; }
.ppeng-table thead th { background: #F8FAFC; color: #475569; font-size: 11px; font-weight: 800; padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: left; white-space: nowrap; }
.ppeng-table tbody td { font-size: 12px; font-weight: 600; color: #1E293B; padding: 10px 12px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
.ppeng-table tbody tr:hover { background: #F8FAFC; }
.ppeng-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; }
.ppeng-badge-default { background: #F1F5F9; color: #64748B; }
.ppeng-badge-custom { background: #EEF2FF; color: var(--primary); }
.ppeng-rank-list { display: flex; flex-direction: column; gap: 6px; min-width: 250px; }
.ppeng-rank-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; background: #F8FAFC; border: 1px solid #E2E8F0; }
.ppeng-rank-item.is-over { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(25,25,112,0.12); background: #EEF2FF; }
.ppeng-rank-item.is-dragging { opacity: 0.5; }
.ppeng-grip { color: #94A3B8; font-size: 14px; cursor: grab; padding: 2px; flex-shrink: 0; }
.ppeng-grip:active { cursor: grabbing; }
.ppeng-ranknum { width: 22px; height: 22px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 11px; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ppeng-ranktext { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.ppeng-ranktext strong { font-size: 12px; color: #0F172A; }
.ppeng-ranktext small { font-size: 10px; color: #94A3B8; font-weight: 600; }
.ppeng-rankbtns { display: flex; gap: 4px; flex-shrink: 0; }
.ppeng-move { border: 1px solid #e2e7f0; background: #fff; border-radius: 7px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: #475569; cursor: pointer; }
.ppeng-move:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.ppeng-move:disabled { opacity: 0.3; cursor: not-allowed; }
.ppeng-preview { margin-top: 6px; font-size: 10px; font-weight: 600; color: var(--text-soft); line-height: 1.5; }
.ppeng-preview strong { color: var(--primary); }
.ppeng-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
.ppeng-switch input { opacity: 0; width: 0; height: 0; }
.ppeng-slider { position: absolute; inset: 0; border-radius: 999px; background: #CBD5E1; transition: .18s; cursor: pointer; }
.ppeng-slider:before { content: ""; position: absolute; width: 14px; height: 14px; left: 3px; top: 3px; border-radius: 50%; background: #fff; transition: .18s; }
.ppeng-switch input:checked + .ppeng-slider { background: var(--primary); }
.ppeng-switch input:checked + .ppeng-slider:before { transform: translateX(16px); }
.ppeng-btn { border: 0; border-radius: 8px; min-height: 30px; padding: 0 12px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.ppeng-btn-save { background: var(--primary); color: #fff; }
.ppeng-btn-save:hover:not(:disabled) { filter: brightness(1.1); }
.ppeng-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.ppeng-actions { display: flex; gap: 6px; }
.ppeng-badge-dirty { background: #FEF3C7; color: #92400E; }
.ppeng-savebar { position: sticky; bottom: 12px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 10px 25px rgba(15,23,42,0.12); }
.ppeng-saveinfo { font-size: 12px; font-weight: 800; color: var(--text-main); }
.ppeng-saveinfo small { display: block; font-size: 10px; font-weight: 600; color: var(--text-soft); margin-top: 2px; }
.ppeng-btn-big { min-height: 40px; padding: 0 22px; font-size: 13px; }
.ppeng-empty { padding: 28px; text-align: center; color: var(--text-soft); font-size: 12px; font-weight: 700; }
`;

export default function PengaturanProdukPage() {
  const session = useSession();
  const { toast } = useToast();
  const multi = !!session && isMultiRole(session.user.role);
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [lokAktif, setLokAktif] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [asal, setAsal] = useState<SettingRow[]>([]);
  const [drag, setDrag] = useState<{ prod: number; from: number } | null>(null);
  const [over, setOver] = useState<{ prod: number; idx: number } | null>(null);

  const lok = lokAktif || (session ? aktifLokasiId(session) : "");

  const fetchRows = async (lokId: string) => {
    const sp = new URLSearchParams();
    sp.append("id_pengguna_lokasi", lokId);
    const r = await apiGet<SettingRow[]>(`/pengaturan-produk?${sp.toString()}`);
    const data = r.data || [];
    setRows(data);
    setAsal(JSON.parse(JSON.stringify(data)));
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        if (multi) {
          try {
            const r = await apiGet<Lokasi[]>("/pengguna-lokasi");
            if (!cancelled) setLokasiList(r.data || []);
          } catch { /* ignore */ }
        }
        const lokId = lokAktif || aktifLokasiId(session);
        if (lokId) await fetchRows(lokId);
      } catch (e) {
        toast((e as Error).message || "Gagal memuat pengaturan.", "error");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, lokAktif]);

  if (!session || !loaded) return null;

  const patchRow = (id: number, patch: Partial<SettingRow>) =>
    setRows((arr) => arr.map((r) => (r.id_produk === id ? { ...r, ...patch } : r)));

  const isBatchOff = (v: unknown) => v === true || v === 1 || v === "1";
  const normBatch = (v: unknown) => (isBatchOff(v) ? 1 : 0);
  const kunci = (r: SettingRow) =>
    JSON.stringify([normBatch(r.tanpa_batch), !!r.ikut_fefo, r.urutan_blok]);

  const petaAsal = new Map(asal.map((a) => [a.id_produk, kunci(a)]));
  const barisBerubah = rows.filter((r) => petaAsal.get(r.id_produk) !== kunci(r));
  const kotor = new Map(barisBerubah.map((r) => [r.id_produk, true]));

  const q = search.trim().toLowerCase();
  const tampil = q === ""
    ? rows
    : rows.filter((r) =>
        `${r.id_produk} ${r.nama_produk || ""}`.toLowerCase().includes(q)
      );

  const pindah = (row: SettingRow, from: number, to: number) => {
    if (to < 0 || to >= row.urutan_blok.length || from === to) return;
    const arr = [...row.urutan_blok];
    const [x] = arr.splice(from, 1);
    arr.splice(to, 0, x);
    patchRow(row.id_produk, { urutan_blok: arr });
  };

  const geser = (row: SettingRow, idx: number, dir: -1 | 1) => pindah(row, idx, idx + dir);

  const simpanSemua = async () => {
    if (!lok) { toast("Lokasi belum dipilih.", "error"); return; }
    if (barisBerubah.length === 0) return;
    setMenyimpan(true);
    let ok = 0;
    const gagal: string[] = [];
    for (const row of barisBerubah) {
      try {
        const a = asal.find((x) => x.id_produk === row.id_produk);
        if (!a || normBatch(a.tanpa_batch) !== normBatch(row.tanpa_batch)) {
          try {
            await api(`/produk/${row.id_produk}`, {
              method: "PUT",
              body: JSON.stringify({ tanpa_batch: normBatch(row.tanpa_batch) }),
            });
          } catch (e) {
            if ((e as Error).message !== "Tidak ada perubahan") throw e;
          }
        }
        if (!a || !!a.ikut_fefo !== !!row.ikut_fefo
          || JSON.stringify(a.urutan_blok) !== JSON.stringify(row.urutan_blok)) {
          await apiPost("/pengaturan-produk", {
            id_pengguna_lokasi: lok,
            id_produk: row.id_produk,
            ikut_fefo: row.ikut_fefo,
            urutan_blok: row.urutan_blok,
          });
        }
        ok++;
      } catch (e) {
        gagal.push(`${row.nama_produk}: ${(e as Error).message}`);
      }
    }
    if (gagal.length === 0) {
      toast(`${ok} produk berhasil disimpan.`, "success");
    } else {
      toast(`${ok} tersimpan, ${gagal.length} gagal: ${gagal.slice(0, 3).join("; ")}`, "error");
    }
    try {
      await fetchRows(lok);
    } catch { /* abaikan, data lokal tetap */ }
    setMenyimpan(false);
  };

  return (
    <div className="ppeng-page">
      <style>{css}</style>
      <div className="ppeng-card">
        <div className="ppeng-toolbar">
          <input
            type="text" className="ppeng-search" value={search}
            placeholder="Cari ID / nama produk" autoComplete="off"
            onChange={(e) => setSearch(e.target.value)}
          />
          {multi && (
            <select className="ppeng-select" value={lokAktif} onChange={(e) => setLokAktif(e.target.value)}>
              <option value="">Lokasi saya</option>
              {lokasiList.map((l) => (
                <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                  {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="ppeng-note">
          Atur sesukamu untuk lokasi <strong>{lok || "-"}</strong> — Tanpa Batch, FEFO, dan urutan blok (no. 1 diambil paling dulu).
          Lalu tekan <strong>Simpan Semua</strong> di bawah halaman untuk menyimpan sekaligus.
          Produk tanpa pengaturan memakai default: Mobil → Receh → Transit → Reguler + FEFO aktif.
        </div>
      </div>

      <div className="ppeng-card ppeng-table-card">
        {tampil.length === 0 ? (
          <div className="ppeng-empty">Data produk tidak ditemukan.</div>
        ) : (
          <table className="ppeng-table">
            <thead>
              <tr>
                    <th>Produk</th>
                    <th>Tanpa Batch</th>
                    <th>Ikut FEFO</th>
                    <th>Urutan Pengambilan Blok</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((row) => (
                <tr key={row.id_produk}>
                  <td>
                    <div style={{ fontWeight: 800 }}>{sekel(row.nama_produk)}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>
                      {row.id_produk} · {sekel(row.satuan)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label className="ppeng-switch" title={isBatchOff(row.tanpa_batch) ? "Tanpa batch" : "Pakai batch normal"}>
                        <input
                          type="checkbox" checked={isBatchOff(row.tanpa_batch)}
                          disabled={menyimpan}
                          onChange={(e) => patchRow(row.id_produk, { tanpa_batch: e.target.checked ? 1 : 0 })}
                        />
                        <span className="ppeng-slider"></span>
                      </label>
                      <div style={{ lineHeight: 1.3 }}>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{isBatchOff(row.tanpa_batch) ? "Ya" : "Tidak"}</div>
                        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>
                          {isBatchOff(row.tanpa_batch) ? "BB otomatis 9999" : "BB wajib diisi"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label className="ppeng-switch" title={row.ikut_fefo ? "Ikut FEFO" : "Tidak ikut FEFO"}>
                        <input
                          type="checkbox" checked={!!row.ikut_fefo}
                          disabled={menyimpan}
                          onChange={(e) => patchRow(row.id_produk, { ikut_fefo: e.target.checked })}
                        />
                        <span className="ppeng-slider"></span>
                      </label>
                      <div style={{ lineHeight: 1.3 }}>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{row.ikut_fefo ? "Ya" : "Tidak"}</div>
                        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>
                          {row.ikut_fefo ? "Expired terdekat diambil dulu" : "Expired diabaikan"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#64748B", marginBottom: 6 }}>
                      <i className="bi bi-grip-vertical" style={{ marginRight: 4 }}></i>
                      Tahan &amp; geser, atau pakai panah — no. 1 diambil paling dulu
                    </div>
                    <div className="ppeng-rank-list">
                      {row.urutan_blok.map((kat, i) => (
                        <div
                          key={kat}
                          className={`ppeng-rank-item${over?.prod === row.id_produk && over?.idx === i ? " is-over" : ""}${drag?.prod === row.id_produk && drag?.from === i ? " is-dragging" : ""}`}
                          draggable={!menyimpan}
                          onDragStart={(e) => { setDrag({ prod: row.id_produk, from: i }); e.dataTransfer.effectAllowed = "move"; }}
                          onDragOver={(e) => { e.preventDefault(); setOver({ prod: row.id_produk, idx: i }); }}
                          onDragLeave={() => setOver(null)}
                          onDrop={(e) => { e.preventDefault(); if (drag && drag.prod === row.id_produk) pindah(row, drag.from, i); setDrag(null); setOver(null); }}
                          onDragEnd={() => { setDrag(null); setOver(null); }}
                        >
                          <span className="ppeng-grip" title="Tahan & geser untuk menyusun ulang">
                            <i className="bi bi-grip-vertical"></i>
                          </span>
                          <span className="ppeng-ranknum">{i + 1}</span>
                          <span className="ppeng-ranktext">
                            <strong>{KAT_LABEL[kat] || kat}</strong>
                            <small>{KAT_DESC[kat] || ""}</small>
                          </span>
                          <span className="ppeng-rankbtns">
                            <button type="button" className="ppeng-move" disabled={i === 0 || menyimpan}
                              onClick={() => geser(row, i, -1)} title="Naikkan prioritas">
                              <i className="bi bi-arrow-up"></i>
                            </button>
                            <button type="button" className="ppeng-move" disabled={i === row.urutan_blok.length - 1 || menyimpan}
                              onClick={() => geser(row, i, 1)} title="Turunkan prioritas">
                              <i className="bi bi-arrow-down"></i>
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="ppeng-preview">
                      Diambil dulu dari blok <strong>{row.urutan_blok.map((k) => KAT_LABEL[k] || k).join(" → ")}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      {row.is_default
                        ? <span className="ppeng-badge ppeng-badge-default">Default</span>
                        : <span className="ppeng-badge ppeng-badge-custom">Custom</span>}
                      {kotor.get(row.id_produk) && (
                        <span className="ppeng-badge ppeng-badge-dirty">● Belum disimpan</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="ppeng-card ppeng-savebar">
        <div className="ppeng-saveinfo">
          {barisBerubah.length === 0
            ? "Tidak ada perubahan."
            : `${barisBerubah.length} produk berubah, belum disimpan.`}
          <small>Perubahan baru berlaku setelah disimpan.</small>
        </div>
        <button type="button" className="ppeng-btn ppeng-btn-save ppeng-btn-big"
          disabled={barisBerubah.length === 0 || menyimpan} onClick={simpanSemua}>
          <i className="bi bi-check-lg"></i>
          {menyimpan ? "Menyimpan..." : "Simpan Semua"}
        </button>
      </div>
    </div>
  );
}
