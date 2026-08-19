"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { isMultiRole, SUPERADMIN_ROLES, SUPERVISOR_ROLES, useSession } from "@/lib/auth";
import LineEditModal, { type BbItem, type EditLine } from "@/components/LineEditModal";
import UploadModal from "@/components/UploadModal";

type LokasiRow = { id_lokasi: number; nama_lokasi?: string; kategori?: string };
type BlockRow = { id_block: number; kode_block: string };
type LokProfile = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };

type Deep = {
  id_deep: number;
  deep: number;
  kapasitas: number;
  terpakai: number;
  status: string;
  best_before?: string | null;
  batch?: string | null;
  batch_produk?: string | null;
  id_produk?: number;
  id_stok?: number;
  id_stok_header?: number;
};
type Level = { id_level: number; level: number; deep: Deep[] };
type Line = {
  id_line: number;
  nomor_line: number;
  total_kapasitas: number;
  total_terpakai: number;
  nama_produk?: string;
  id_produk?: number;
  level: Level[];
};
type LayoutBlock = {
  id_block: number;
  kode_block: string;
  total_kapasitas: number;
  total_terpakai: number;
  line: Line[];
};

const css = `
.warehouse-page { display: flex; flex-direction: column; gap: 7px; }

.warehouse-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.warehouse-tabs-card { padding: 7px; }

.warehouse-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; width: 100%; }
.warehouse-tab {
  text-decoration: none; border-radius: 8px; padding: 7px 12px;
  background: #f3f5fb; color: var(--text-soft); font-size: 11px; font-weight: 850;
  text-align: center; transition: .18s ease; border: 0; cursor: pointer;
}
.warehouse-tab.active, .warehouse-tab:hover {
  background: var(--primary); color: #FFFFFF;
  box-shadow: 0 6px 14px rgba(25, 25, 112, 0.13); transform: translateY(-1px);
}

.warehouse-control-card { padding: 8px; }

.status-legend { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 7px; justify-content: space-between; }
.legend-pill {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border-radius: 999px; padding: 5px 10px; font-size: 10px; font-weight: 800;
  border: 1px solid transparent; white-space: nowrap; flex: 1; min-width: 105px;
}
.legend-dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }

.legend-release { color: #2E7D32; background: rgba(46, 125, 50, 0.12); border-color: rgba(46, 125, 50, 0.40); }
.legend-release .legend-dot { background: #2E7D32; }
.legend-hold { color: #F9A825; background: rgba(249, 168, 37, 0.12); border-color: rgba(249, 168, 37, 0.40); }
.legend-hold .legend-dot { background: #F9A825; }
.legend-blank { color: #BDBDBD; background: rgba(189, 189, 189, 0.12); border-color: rgba(189, 189, 189, 0.40); }
.legend-blank .legend-dot { background: #BDBDBD; }
.legend-full { color: #D32F2F; background: rgba(211, 47, 47, 0.12); border-color: rgba(211, 47, 47, 0.40); }
.legend-full .legend-dot { background: #D32F2F; }
.legend-empty-gallon { color: #7E57C2; background: rgba(126, 87, 194, 0.12); border-color: rgba(126, 87, 194, 0.40); }
.legend-empty-gallon .legend-dot { background: #7E57C2; }
.legend-reject { color: #C62828; background: rgba(211, 47, 47, 0.12); border-color: rgba(211, 47, 47, 0.40); }
.legend-reject .legend-dot { background: #C62828; }
.legend-badstok { color: #424242; background: rgba(97, 97, 97, 0.12); border-color: rgba(97, 97, 97, 0.40); }
.legend-badstok .legend-dot { background: #424242; }
.legend-qi { color: #F9A825; background: rgba(255, 214, 0, 0.12); border-color: rgba(255, 214, 0, 0.40); }
.legend-qi .legend-dot { background: #FFD600; }

.warehouse-search-wrap { position: relative; margin-bottom: 7px; }
.warehouse-search-icon {
  position: absolute; top: 50%; left: 11px; transform: translateY(-50%);
  color: var(--text-soft); font-size: 13px;
}
.warehouse-search-input {
  width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0;
  background: #fbfcff; padding: 0 10px 0 31px; font-size: 11px; font-weight: 700;
  color: var(--text-main); outline: none;
}
.warehouse-search-input::placeholder { color: #8a93a3; font-weight: 650; }
.warehouse-search-input:focus {
  background: #FFFFFF; border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07);
}

.block-list { display: flex; flex-wrap: wrap; gap: 5px; }
.block-btn {
  text-decoration: none; border: 1px solid #e2e7f0; background: #fbfcff;
  color: var(--text-main); border-radius: 8px; padding: 5px 10px;
  font-size: 11px; font-weight: 850; transition: .18s ease; cursor: pointer;
}
.block-btn.active, .block-btn:hover {
  background: var(--primary); color: #FFFFFF; border-color: var(--primary);
  box-shadow: 0 6px 14px rgba(25, 25, 112, 0.13); transform: translateY(-1px);
}

.warehouse-upload-btn {
  border: 0; border-radius: 8px; height: 31px; padding: 0 12px; background: var(--primary);
  color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center;
  gap: 6px; cursor: pointer; white-space: nowrap;
}
.warehouse-upload-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }

.warehouse-lines { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.warehouse-line-card { padding: 8px; }
.line-header { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 7px; }
.line-title { font-size: 12px; font-weight: 900; color: var(--text-main); margin: 0 0 2px 0; letter-spacing: -0.2px; }
.line-product {
  font-size: 10px; font-weight: 800; color: var(--text-main); margin-bottom: 1px; line-height: 1.25;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
}
.line-total { font-size: 10px; font-weight: 700; color: var(--text-soft); }
.line-total strong { color: var(--text-main); font-weight: 900; }

.line-edit-btn {
  width: 25px; height: 25px; border: 0; outline: 0; border-radius: 8px;
  background: var(--primary-soft); color: var(--primary); font-size: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer;
  transition: background .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
}
.line-edit-btn:hover {
  background: var(--primary); color: #FFFFFF; transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(25, 25, 112, 0.13);
}

.deep-grid { display: flex; flex-direction: column; gap: 4px; }
.deep-row { display: grid; grid-template-columns: 21px minmax(0, 1fr); gap: 5px; align-items: center; }
.level-label { font-size: 11px; font-weight: 900; color: var(--text-main); }

.deep-scroll-shell { display: grid; grid-template-columns: 23px minmax(0, 1fr) 23px; gap: 5px; align-items: center; min-width: 0; }
.deep-scroll-shell.no-scroll { grid-template-columns: minmax(0, 1fr); }
.deep-scroll-viewport {
  width: 100%; max-width: none; overflow-x: auto; overflow-y: hidden;
  scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth;
}
.deep-scroll-viewport::-webkit-scrollbar { display: none; }
.deep-scroll-list { display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - (6px * 6)) / 7); gap: 6px; width: 100%; }

.deep-scroll-btn {
  width: 23px; height: 29px; border: 1px solid #e2e7f0; border-radius: 7px;
  background: #fbfcff; color: var(--primary); font-size: 12px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: background .18s ease, color .18s ease, border-color .18s ease, transform .18s ease;
}
.deep-scroll-btn:hover { background: var(--primary); color: #FFFFFF; border-color: var(--primary); transform: translateY(-1px); }

.deep-scroll-shell.no-scroll .deep-scroll-list {
  display: grid; grid-template-columns: repeat(7, calc((100% - (6px * 6)) / 7));
  grid-auto-flow: unset; grid-auto-columns: unset; width: 100%; justify-content: start;
}
.deep-scroll-shell.no-scroll .deep-cell { width: 100%; min-width: 0; }

.deep-cell {
  width: 100%; min-width: 46px; height: 27px; border-radius: 7px; border: 1px solid #dcdfe6;
  background: #f6f7f9; color: #b5bac2; display: flex; align-items: center; justify-content: center;
  text-align: center; cursor: pointer; flex-shrink: 0; position: relative; overflow: hidden;
  transition: transform .16s ease, box-shadow .16s ease;
}
.deep-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; border-radius: 7px; z-index: 1; pointer-events: none; }
.deep-content { position: relative; z-index: 2; }
.deep-cell:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(15, 23, 42, 0.07); }
.deep-main-text { font-size: 10px; font-weight: 900; line-height: 1.1; }
.deep-sub-text { display: none; }

.deep-cell.release { background: #F7F8FA; border-color: rgba(46, 125, 50, 0.45); color: #2E7D32; }
.deep-cell.release .deep-fill { background: rgba(46, 125, 50, 0.22); }
.deep-cell.hold { background: #F7F8FA; border-color: rgba(249, 168, 37, 0.45); color: #F9A825; }
.deep-cell.hold .deep-fill { background: rgba(249, 168, 37, 0.22); }
.deep-cell.full { background: #F7F8FA; border-color: rgba(211, 47, 47, 0.45); color: #D32F2F; }
.deep-cell.full .deep-fill { background: rgba(211, 47, 47, 0.22); }
.deep-cell.empty-gallon { background: #F7F8FA; border-color: rgba(126, 87, 194, 0.45); color: #7E57C2; }
.deep-cell.empty-gallon .deep-fill { background: rgba(126, 87, 194, 0.22); }
.deep-cell.blank { background: #F7F8FA; border-color: rgba(189, 189, 189, 0.45); color: #BDBDBD; }
.deep-cell.blank .deep-fill { background: rgba(189, 189, 189, 0.22); }
.deep-cell.reject { background: #F7F8FA; border-color: rgba(211, 47, 47, 0.55); color: #C62828; }
.deep-cell.reject .deep-fill { background: rgba(211, 47, 47, 0.25); }
.deep-cell.badstok { background: #F7F8FA; border-color: rgba(97, 97, 97, 0.50); color: #424242; }
.deep-cell.badstok .deep-fill { background: rgba(97, 97, 97, 0.22); }
.deep-cell.qi { background: #FFFDCC; border-color: rgba(255, 214, 0, 0.70); color: #F9A825; }
.deep-cell.qi .deep-fill { background: rgba(255, 214, 0, 0.28); }

.layout-empty-card { padding: 12px; color: var(--text-soft); font-size: 12px; font-weight: 700; }

.pick-card { padding: 12px 14px; }
.pick-card form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pick-card label { font-size: 11px; font-weight: 850; color: var(--text-main); }
.pick-card select {
  height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid #e2e7f0;
  background: #fbfcff; font-size: 11px; font-weight: 750; color: var(--text-main);
  outline: none; cursor: pointer;
}

.deep-detail-overlay {
  position: fixed; inset: 0; z-index: 1080; display: flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px);
}
.deep-detail-modal { width: min(430px, calc(100% - 30px)); background: #fff; border-radius: 16px; box-shadow: 0 25px 60px rgba(15, 23, 42, 0.18); overflow: hidden; }
.deep-detail-body { padding: 20px 24px; }
.deep-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid #e9edf5; padding-bottom: 16px; }
.deep-detail-close {
  width: 36px; height: 36px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main);
  font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 10px;
  cursor: pointer; transition: .15s ease; flex-shrink: 0;
}
.deep-detail-close:hover { background: #f0f2f5; border-color: #cbd5e1; }

.deep-detail-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
.deep-detail-icon.release { background: rgba(46, 125, 50, 0.12); color: #2E7D32; }
.deep-detail-icon.hold { background: rgba(249, 168, 37, 0.12); color: #F9A825; }
.deep-detail-icon.blank { background: rgba(189, 189, 189, 0.12); color: #BDBDBD; }
.deep-detail-icon.full { background: rgba(211, 47, 47, 0.12); color: #D32F2F; }
.deep-detail-icon.empty-gallon { background: rgba(126, 87, 194, 0.12); color: #7E57C2; }
.deep-detail-icon.reject { background: rgba(211, 47, 47, 0.12); color: #C62828; }
.deep-detail-icon.badstok { background: rgba(97, 97, 97, 0.12); color: #424242; }
.deep-detail-icon.qi { background: rgba(255, 214, 0, 0.18); color: #F9A825; }

.deep-detail-badge { border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 800; border: 1px solid transparent; }
.deep-detail-badge.release { color: #2E7D32; background: rgba(46, 125, 50, 0.12); border-color: rgba(46, 125, 50, 0.40); }
.deep-detail-badge.hold { color: #F9A825; background: rgba(249, 168, 37, 0.12); border-color: rgba(249, 168, 37, 0.40); }
.deep-detail-badge.blank { color: #BDBDBD; background: rgba(189, 189, 189, 0.12); border-color: rgba(189, 189, 189, 0.40); }
.deep-detail-badge.full { color: #D32F2F; background: rgba(211, 47, 47, 0.12); border-color: rgba(211, 47, 47, 0.40); }
.deep-detail-badge.empty-gallon { color: #7E57C2; background: rgba(126, 87, 194, 0.12); border-color: rgba(126, 87, 194, 0.40); }
.deep-detail-badge.reject { color: #C62828; background: rgba(211, 47, 47, 0.12); border-color: rgba(211, 47, 47, 0.40); }
.deep-detail-badge.badstok { color: #424242; background: rgba(97, 97, 97, 0.12); border-color: rgba(97, 97, 97, 0.40); }
.deep-detail-badge.qi { color: #F9A825; background: rgba(255, 214, 0, 0.18); border-color: rgba(255, 214, 0, 0.45); }

.modal-loading {
  position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
  background-color: rgba(0,0,0,0.6);
}
.modal-loading-inner {
  background: #fff; border-radius: 12px; padding: 35px 40px; text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 360px;
}
.spinner-loader {
  width: 48px; height: 48px; border: 4px solid #e2e7f0; border-top-color: var(--primary);
  border-radius: 50%; margin: 0 auto 16px; animation: spinLoader 0.8s linear infinite;
}
@keyframes spinLoader { to { transform: rotate(360deg); } }

@media (max-width: 1500px) { .warehouse-lines { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 1200px) { .warehouse-lines { grid-template-columns: 1fr; } }
@media (max-width: 768px) {
  .block-btn { flex: 1; text-align: center; }
  .warehouse-control-card, .warehouse-line-card { padding: 10px; }
  .deep-row { grid-template-columns: 25px minmax(0, 1fr); gap: 5px; }
  .deep-cell { width: 48px; min-width: 48px; height: 30px; }
  .deep-scroll-btn { width: 23px; height: 29px; }
}
`;

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};

const statusClass = (status: unknown, terpakai: unknown, kapasitas: unknown) => {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "gallon") return "empty-gallon";
  if (s === "release" || s === "hold" || s === "full" || s === "reject" || s === "badstok" || s === "qi") return s;
  const t = angka(terpakai);
  if (t <= 0) return "blank";
  if (angka(kapasitas) > 0 && t >= angka(kapasitas)) return "full";
  return "blank";
};

const statusLabel = (status: unknown) => {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "release") return "Release";
  if (s === "hold") return "Hold";
  if (s === "full") return "Full";
  if (s === "gallon") return "Gallon Kosong";
  if (s === "reject") return "Reject";
  if (s === "badstok") return "Bad Stock";
  if (s === "qi") return "QI";
  if (s === "" || s === "blank") return "-";
  return "Blank";
};

const sortLevelsDesc = (levels: Level[]) =>
  [...levels].sort((a, b) => angka(b.level) - angka(a.level));

const sortDeepsLikeApp = (deeps: Deep[]) => {
  const hasHold = deeps.some((d) => String(d.status ?? "").trim().toLowerCase() === "hold");
  const w = (status: unknown) => {
    const s = String(status ?? "").trim().toLowerCase();
    return { hold: 0, release: 1, full: 2, reject: 3, qi: 4, badstok: 5 }[s] ?? 6;
  };
  return [...deeps].sort((a, b) => {
    if (hasHold) {
      const wa = w(a.status);
      const wb = w(b.status);
      if (wa !== wb) return wa - wb;
    }
    return angka(a.deep) - angka(b.deep);
  });
};

const buildBbItems = (line: Line): BbItem[] => {
  const map: Record<string, BbItem> = {};
  (line.level || []).forEach((level) => {
    (level.deep || []).forEach((d) => {
      const jumlah = angka(d.terpakai);
      const idStok = angka(d.id_stok ?? d.id_stok_header);
      const bb = String(
        d.best_before ?? (d as { min_bb_prod?: string }).min_bb_prod ?? (d as { min_bb_deep?: string }).min_bb_deep ?? ""
      )
        .trim();
      if (jumlah <= 0 || idStok <= 0 || bb === "") return;
      if (!map[bb]) {
        map[bb] = { id_stok: idStok, best_before: bb, jumlah: 0, qty_primary: 0, min_qty_allowed: 0 };
      }
      map[bb].jumlah += jumlah;
      if (map[bb].id_stok === idStok) {
        map[bb].qty_primary += jumlah;
      } else {
        map[bb].min_qty_allowed += jumlah;
      }
    });
  });
  return Object.values(map);
};

export default function LayoutGudangPage() {
  const session = useSession();
  const isMulti = !!session && isMultiRole(session.user.role);

  const [semuaLokasi, setSemuaLokasi] = useState<LokProfile[]>([]);
  const [penggunaLokasi, setPenggunaLokasi] = useState("");
  const [lokasiList, setLokasiList] = useState<LokasiRow[]>([]);
  const [idLokasi, setIdLokasi] = useState(0);
  const [blockList, setBlockList] = useState<BlockRow[]>([]);
  const [idBlock, setIdBlock] = useState(0);
  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>([]);
  const [layoutError, setLayoutError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<null | {
    line: string;
    status: string;
    statusClass: string;
    batch: string;
  }>(null);
  const [edit, setEdit] = useState<EditLine | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!session || !isMulti) return;
    let cancelled = false;
    apiGet<LokProfile[]>("/pengguna-lokasi")
      .then((r) => {
        if (cancelled) return;
        const all = r.data || [];
        const ids = Array.isArray(session.lokasi) ? session.lokasi.map(String) : null;
        const list = ids ? all.filter((x) => ids.includes(String(x.id_pengguna_lokasi))) : all;
        setSemuaLokasi(list);
        setPenggunaLokasi((prev) => prev || (list[0]?.id_pengguna_lokasi ?? ""));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, isMulti]);

  const penggunaLokasiFinal = isMulti
    ? penggunaLokasi
    : String(session?.user.id_pengguna_lokasi || "");

  const downloadTemplate = async () => {
    try {
      const res = await fetch("/api/barang-masuk/download-template", {
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template-stok-gudang.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* silent */
    }
  };

  const importStock = async (file: File) => {
    const lok = isMulti ? penggunaLokasi : String(session?.user.id_pengguna_lokasi || "");
    if (!lok) {
      throw new Error("Pilih lokasi terlebih dahulu.");
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("id_pengguna_lokasi", lok);
    fd.append("id_pengguna", String(session?.user.id_pengguna || ""));
    setImporting(true);
    try {
      const res = await fetch("/api/barang-masuk/import-stock", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.token || ""}` },
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) {
        throw new Error(body?.message || "Gagal mengimpor stock.");
      }
      setShowUpload(false);
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiGet<LokasiRow[]>("/lokasi")
      .then((r) => {
        if (cancelled) return;
        const rows = (r.data || []).sort((a, b) => angka(a.id_lokasi) - angka(b.id_lokasi));
        setLokasiList(rows);
        if (rows.length) setIdLokasi((prev) => prev || rows[0].id_lokasi);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!penggunaLokasiFinal || !idLokasi) return;
    let cancelled = false;
    const params = new URLSearchParams({
      id_pengguna_lokasi: penggunaLokasiFinal,
      id_lokasi: String(idLokasi),
    });
    apiGet<BlockRow[]>(`/block?${params.toString()}`)
      .then((r) => {
        if (cancelled) return;
        const rows = r.data || [];
        setBlockList(rows);
        setIdBlock((prev) => (rows.some((b) => b.id_block === prev) ? prev : rows[0]?.id_block || 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [penggunaLokasiFinal, idLokasi]);

  useEffect(() => {
    if (!penggunaLokasiFinal || !idLokasi || !idBlock) return;
    let cancelled = false;
    const params = new URLSearchParams({
      id_pengguna_lokasi: penggunaLokasiFinal,
      id_lokasi: String(idLokasi),
      id_block: String(idBlock),
    });
    apiGet<LayoutBlock[]>(`/layout-gudang/ambil-layout?${params.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setLayoutBlocks(r.data || []);
        setLayoutError("");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setLayoutBlocks([]);
        setLayoutError(e.message || "Gagal memuat layout gudang.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [penggunaLokasiFinal, idLokasi, idBlock, refresh]);

  if (!session) return null;

  const labelLokasi = (r: LokasiRow) =>
    String(r.kategori || r.nama_lokasi || "").trim().toUpperCase();

  const selectedBlock = layoutBlocks[0] || null;
  const kodeBlockAktif = (selectedBlock?.kode_block || "").toUpperCase();
  const lines = (selectedBlock?.line || [])
    .slice()
    .sort((a, b) => angka(a.nomor_line) - angka(b.nomor_line));

  const searchQ = search.trim().toUpperCase();
  const visibleLines = lines.filter((l) => {
    const key = `${kodeBlockAktif}-${angka(l.nomor_line)} ${kodeBlockAktif} ${angka(l.nomor_line)}`.toUpperCase();
    return searchQ === "" || key.indexOf(searchQ) !== -1;
  });

  const gantiLokasi = (id: number) => {
    if (id === idLokasi) return;
    setIdLokasi(id);
    setIdBlock(0);
    setBlockList([]);
    setLayoutBlocks([]);
    setLayoutError("");
  };

  const gantiBlock = (id: number) => {
    if (id === idBlock) return;
    setIdBlock(id);
    setLayoutBlocks([]);
    setLayoutError("");
    setBusy(true);
  };

  const openDetail = (d: Deep, line: Line) => {
    const batchRaw = String(d.batch ?? d.batch_produk ?? "");
    const batch =
      batchRaw.trim() === "" || batchRaw.trim().toLowerCase() === "null"
        ? String(d.best_before ?? "").trim()
        : batchRaw.trim();
    setDetail({
      line: `Block ${kodeBlockAktif} Line ${angka(line.nomor_line)}`,
      status: statusLabel(d.status),
      statusClass: statusClass(d.status, d.terpakai, d.kapasitas),
      batch: batch !== "" ? batch : "Batch belum tersedia",
    });
  };

  const renderEmpty = (msg: string) => (
    <div className="warehouse-card layout-empty-card">{msg}</div>
  );

  return (
    <>
      <style>{css}</style>

      <div className="warehouse-page">
        {isMulti && !semuaLokasi.length && renderEmpty("Data lokasi belum tersedia.")}
        {isMulti && !!semuaLokasi.length && (
          <div className="warehouse-card pick-card">
            <form onSubmit={(e) => e.preventDefault()}>
              <label>Pilih Lokasi/Depo:</label>
              <select
                value={penggunaLokasi}
                onChange={(e) => {
                  setPenggunaLokasi(e.target.value);
                  setIdBlock(0);
                  setBlockList([]);
                  setLayoutBlocks([]);
                  setLayoutError("");
                }}
              >
                {semuaLokasi.map((l) => (
                  <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                    {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                  </option>
                ))}
              </select>
            </form>
          </div>
        )}

        {SUPERADMIN_ROLES.includes(session?.user.role || "") && (
          <div className="warehouse-card" style={{ padding: "8px", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="warehouse-upload-btn" style={{ border: "none", cursor: "pointer" }}
              onClick={() => setShowUpload(true)}>
              <i className="bi bi-file-earmark-excel"></i>
              Upload Stock
            </button>
          </div>
        )}

        <div className="warehouse-card warehouse-tabs-card">
          {!lokasiList.length ? (
            renderEmpty("Data lokasi belum tersedia.")
          ) : (
            <div className="warehouse-tabs">
              {lokasiList.map((lokasi) => (
                <button
                  key={lokasi.id_lokasi}
                  type="button"
                  className={`warehouse-tab ${angka(lokasi.id_lokasi) === idLokasi ? "active" : ""}`}
                  onClick={() => gantiLokasi(angka(lokasi.id_lokasi))}
                >
                  {labelLokasi(lokasi)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="warehouse-card warehouse-control-card">
          <div className="status-legend">
            <div className="legend-pill legend-release"><span className="legend-dot"></span><span>Release</span></div>
            <div className="legend-pill legend-hold"><span className="legend-dot"></span><span>Hold</span></div>
            <div className="legend-pill legend-blank"><span className="legend-dot"></span><span>Blank</span></div>
            <div className="legend-pill legend-full"><span className="legend-dot"></span><span>Full</span></div>
            <div className="legend-pill legend-empty-gallon"><span className="legend-dot"></span><span>Gallon Kosong</span></div>
            <div className="legend-pill legend-reject"><span className="legend-dot"></span><span>Reject</span></div>
            <div className="legend-pill legend-badstok"><span className="legend-dot"></span><span>Bad Stock</span></div>
            <div className="legend-pill legend-qi"><span className="legend-dot"></span><span>QI</span></div>
          </div>

          <div className="warehouse-search-wrap">
            <i className="bi bi-search warehouse-search-icon"></i>
            <input
              type="text"
              className="warehouse-search-input"
              placeholder="Cari line contoh: A-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          {!blockList.length ? (
            renderEmpty("Data block belum tersedia untuk lokasi ini.")
          ) : (
            <div className="block-list">
              {blockList.map((block) => (
                <button
                  key={block.id_block}
                  type="button"
                  className={`block-btn ${angka(block.id_block) === idBlock ? "active" : ""}`}
                  onClick={() => gantiBlock(angka(block.id_block))}
                >
                  Block {String(block.kode_block).toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {layoutError !== "" && renderEmpty(layoutError)}
        {layoutError === "" && !visibleLines.length && (
          renderEmpty(
            !selectedBlock
              ? "Layout pada block ini belum memiliki line, level, atau deep."
              : "Tidak ada line yang cocok dengan pencarian."
          )
        )}

        {layoutError === "" && !!visibleLines.length && (
          <div className="warehouse-lines">
            {visibleLines.map((line) => (
              <div key={line.id_line} className="warehouse-card warehouse-line-card">
                <div className="line-header">
                  <div>
                    <h2 className="line-title">
                      Block {kodeBlockAktif} Line {angka(line.nomor_line)}
                    </h2>
                    {!!String(line.nama_produk || "").trim() && (
                      <div className="line-product">{String(line.nama_produk).trim()}</div>
                    )}
                    <div className="line-total">
                      Total: <strong>{angka(line.total_terpakai)}</strong> /{" "}
                      <strong>{angka(line.total_kapasitas)}</strong>
                    </div>
                  </div>

                  {SUPERVISOR_ROLES.includes(session.user.role) && (
                    <button
                      type="button"
                      className="line-edit-btn"
                      title="Ubah BB dan Transfer Stok"
                      onClick={() =>
                        setEdit({
                          idLine: angka(line.id_line),
                          idProduk: angka(line.id_produk),
                          lineLabel: `Block ${kodeBlockAktif} - Line ${angka(line.nomor_line)}`,
                          product: String(line.nama_produk || "").trim() || "-",
                          total: angka(line.total_terpakai),
                          bbItems: buildBbItems(line),
                        })
                      }
                    >
                      <i className="bi bi-pencil-fill"></i>
                    </button>
                  )}
                </div>

                <div className="deep-grid">
                  {sortLevelsDesc(line.level || []).map((level) => {
                    const deeps = sortDeepsLikeApp(level.deep || []);
                    const bisaScroll = deeps.length > 7;
                    return (
                      <div className="deep-row" key={level.id_level}>
                        <div className="level-label">L{angka(level.level)}</div>

                        <div className={`deep-scroll-shell ${bisaScroll ? "" : "no-scroll"}`}>
                          {bisaScroll && (
                            <button
                              type="button"
                              className="deep-scroll-btn"
                              title="Geser kiri"
                              onClick={(e) => {
                                const el = (e.currentTarget as HTMLButtonElement).parentElement!.querySelector(
                                  ".deep-scroll-viewport"
                                ) as HTMLElement | null;
                                el?.scrollBy({ left: -(el.clientWidth || 300), behavior: "smooth" });
                              }}
                            >
                              <i className="bi bi-chevron-left"></i>
                            </button>
                          )}

                          <div className="deep-scroll-viewport">
                            <div className="deep-scroll-list">
                              {deeps.map((d) => {
                                const kap = angka(d.kapasitas);
                                const terpakai = angka(d.terpakai);
                                const cls = statusClass(d.status, terpakai, kap);
                                const persen = kap > 0 && terpakai > 0 ? Math.min(100, Math.max(0, (terpakai / kap) * 100)) : 0;
                                return (
                                  <div
                                    key={d.id_deep}
                                    className={`deep-cell ${cls}`}
                                    title={`${statusLabel(d.status)} | ${terpakai}/${kap}`}
                                    onClick={() => openDetail(d, line)}
                                  >
                                    <div className="deep-fill" style={{ width: `${persen}%` }}></div>
                                    <div className="deep-content">
                                      <div className="deep-main-text">
                                        {terpakai}/{kap}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {bisaScroll && (
                            <button
                              type="button"
                              className="deep-scroll-btn"
                              title="Geser kanan"
                              onClick={(e) => {
                                const el = (e.currentTarget as HTMLButtonElement).parentElement!.querySelector(
                                  ".deep-scroll-viewport"
                                ) as HTMLElement | null;
                                el?.scrollBy({ left: el.clientWidth || 300, behavior: "smooth" });
                              }}
                            >
                              <i className="bi bi-chevron-right"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {busy && (
        <div className="modal-loading">
          <div className="modal-loading-inner">
            <div className="spinner-loader"></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>Mohon Tunggu</div>
          </div>
        </div>
      )}

      {detail && (
        <div className="deep-detail-overlay" onClick={() => setDetail(null)}>
          <div className="deep-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="deep-detail-body">
              <div className="deep-detail-header">
                <div>
                  <h3 className="m-0 fw-bold" style={{ fontSize: 15, color: "var(--primary)", letterSpacing: "-0.2px" }}>
                    Detail Batch
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>{detail.line}</div>
                </div>
                <button type="button" className="deep-detail-close" onClick={() => setDetail(null)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div className={`deep-detail-icon ${detail.statusClass}`}>
                  <i className="bi bi-calendar-event-fill"></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>{detail.batch}</div>
                </div>
                <div className={`deep-detail-badge ${detail.statusClass}`}>{detail.status}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <LineEditModal
          edit={edit}
          session={session}
          lokasiList={lokasiList}
          blockList={blockList}
          onClose={() => setEdit(null)}
          onChanged={() => {
            setEdit(null);
            setDetail(null);
            setRefresh((v) => v + 1);
          }}
        />
      )}

      <UploadModal
        open={showUpload}
        title="Upload Stock ke Layout"
        note="Kolom: nama_produk, jenis_produk, kuantiti, lokasi_block, lokasi_line, batch, best_before. Stock otomatis masuk ke line layout sesuai lokasi_block-lokasi_line."
        onClose={() => setShowUpload(false)}
        onDownload={downloadTemplate}
        onSubmit={importStock}
        busy={importing}
      />
    </>
  );
}
