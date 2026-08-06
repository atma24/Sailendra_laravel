"use client";

import { useEffect, useRef, useState } from "react";
import { api, apiGet, apiPost } from "@/lib/api";
import { isMultiRole, useSession } from "@/lib/auth";

type LokasiRow = { id_lokasi: number; nama_lokasi?: string; kategori?: string };
type BlockRow = { id_block: number; kode_block: string; id_lokasi?: number };
type LokProfile = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };
type ProdukRow = { id_produk: number; nama_produk: string };

type Deep = {
  id_deep: number;
  deep: number;
  kapasitas: number;
  terpakai: number;
};
type Level = { id_level: number; level: number; deep: Deep[] };
type Line = {
  id_line: number;
  id_produk?: number;
  nomor_line: number;
  nama_produk?: string;
  level: Level[];
};
type LayoutBlock = { id_block: number; kode_block: string; line: Line[] };

type EditLine = {
  idLokasi: number;
  idBlock: number;
  idLine: number;
  kodeBlock: string;
  nomorLine: number;
  idProduk: number;
  produk: string;
  levels: Level[];
};

type Toast = { id: number; type: string; title: string; msg: string };

const css = `
.history-layout-page { display: flex; flex-direction: column; gap: 7px; }
.history-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.history-tabs-card { padding: 7px; }
.history-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; width: 100%; }
.history-tab {
  text-decoration: none; border-radius: 8px; padding: 7px 12px; background: #f3f5fb;
  color: var(--text-soft); font-size: 11px; font-weight: 850; text-align: center;
  transition: .18s ease; border: 0; cursor: pointer;
}
.history-tab.active, .history-tab:hover { background: var(--primary); color: #FFFFFF; box-shadow: 0 6px 14px rgba(25, 25, 112, 0.13); transform: translateY(-1px); }
.history-control-card { padding: 8px; }
.history-search-wrap { position: relative; margin-bottom: 7px; }
.history-search-icon { position: absolute; top: 50%; left: 11px; transform: translateY(-50%); color: var(--text-soft); font-size: 13px; }
.history-search-input {
  width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff;
  padding: 0 10px 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none;
}
.history-search-input::placeholder { color: #8a93a3; font-weight: 650; }
.history-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.history-block-list { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 7px; }
.history-block-btn {
  text-decoration: none; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main);
  border-radius: 8px; padding: 5px 10px; font-size: 11px; font-weight: 850; transition: .18s ease; cursor: pointer;
}
.history-block-btn.active, .history-block-btn:hover { background: var(--primary); color: #FFFFFF; border-color: var(--primary); box-shadow: 0 6px 14px rgba(25, 25, 112, 0.13); transform: translateY(-1px); }
.history-action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.history-action-btn { border: 0; outline: 0; min-height: 31px; border-radius: 8px; font-size: 11px; font-weight: 850; display: flex; align-items: center; justify-content: center; gap: 6px; transition: .18s ease; cursor: pointer; }
.history-action-btn.primary { background: var(--primary); color: #FFFFFF; }
.history-action-btn.danger { background: #ef4444; color: #FFFFFF; }
.history-action-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(15, 23, 42, 0.11); }

.history-lines { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.history-line-card { padding: 8px; }
.history-line-header { display: flex; justify-content: space-between; gap: 7px; margin-bottom: 7px; }
.history-line-title { font-size: 12px; font-weight: 900; color: var(--text-main); margin: 0 0 2px 0; letter-spacing: -0.2px; }
.history-line-product { font-size: 10px; font-weight: 800; color: var(--text-main); margin-bottom: 1px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.history-line-total { font-size: 10px; font-weight: 700; color: var(--text-soft); }
.history-line-total strong { color: var(--text-main); font-weight: 900; }
.history-line-actions { display: flex; gap: 5px; flex-shrink: 0; }
.history-icon-btn { width: 25px; height: 25px; border: 0; outline: 0; border-radius: 8px; background: var(--primary-soft); color: var(--primary); font-size: 12px; display: flex; align-items: center; justify-content: center; transition: .18s ease; cursor: pointer; }
.history-icon-btn.danger { background: #fff0f0; color: #ef4444; }
.history-icon-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(15, 23, 42, 0.10); }

.history-deep-grid { display: flex; flex-direction: column; gap: 4px; }
.history-deep-row { display: grid; grid-template-columns: 21px minmax(0, 1fr); gap: 5px; align-items: center; }
.history-level-label { font-size: 11px; font-weight: 900; color: var(--text-main); }
.history-deep-scroll-shell { display: grid; grid-template-columns: 23px minmax(0, 1fr) 23px; gap: 5px; align-items: center; min-width: 0; }
.history-deep-scroll-shell.no-scroll { grid-template-columns: minmax(0, 1fr); }
.history-deep-viewport { width: 100%; max-width: none; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth; }
.history-deep-viewport::-webkit-scrollbar { display: none; }
.history-deep-list { display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - (6px * 6)) / 7); gap: 6px; width: 100%; }
.history-deep-scroll-btn {
  width: 23px; height: 29px; border: 1px solid #e2e7f0; border-radius: 7px; background: #fbfcff;
  color: var(--primary); font-size: 12px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background .18s ease, color .18s ease, border-color .18s ease, transform .18s ease;
}
.history-deep-scroll-btn:hover { background: var(--primary); color: #FFFFFF; border-color: var(--primary); transform: translateY(-1px); }
.history-deep-scroll-shell.no-scroll .history-deep-list { display: grid; grid-template-columns: repeat(7, calc((100% - (6px * 6)) / 7)); grid-auto-flow: unset; grid-auto-columns: unset; width: 100%; justify-content: start; }
.history-deep-scroll-shell.no-scroll .history-deep-cell { width: 100%; min-width: 0; }
.history-deep-cell {
  width: 100%; min-width: 46px; height: 27px; border-radius: 7px; border: 1px solid #dcdfe6; background: #f6f7f9;
  color: var(--text-main); display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; font-weight: 900;
}

.history-empty-card { padding: 10px; color: var(--text-soft); font-size: 11px; font-weight: 700; }
.pick-card { padding: 12px 14px; }
.pick-card form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pick-card label { font-size: 11px; font-weight: 850; color: var(--text-main); }
.pick-card select { height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; font-size: 11px; font-weight: 750; color: var(--text-main); outline: none; cursor: pointer; }

/* modal generic */
.hg-overlay { position: fixed; inset: 0; z-index: 1080; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); padding: 0 15px; }
.hg-modal { width: 100%; background: #FFFFFF; border-radius: 12px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15); overflow: hidden; }
.hg-modal-body { padding: 16px 20px; max-height: 86vh; overflow-y: auto; }
.hg-handle { width: 38px; height: 4px; border-radius: 999px; background: #cfd3dc; margin: 0 auto 12px; }
.hg-title { font-size: 16px; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.2px; }
.hg-subtitle { font-size: 12px; font-weight: 500; color: var(--text-soft); margin-top: 3px; text-transform: uppercase; }
.hg-label { display: block; font-size: 12px; font-weight: 600; color: var(--text-main); margin-bottom: 6px; }
.hg-input, .hg-select { width: 100%; min-height: 36px; border: 1px solid #dedede; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; color: var(--text-main); outline: none; background: #fbfcff; }
.hg-select { padding-right: 34px; }
.hg-input:focus, .hg-select:focus { border-color: var(--primary); background: #FFFFFF; box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.hg-main-btn { width: 100%; min-height: 38px; border: 0; border-radius: 8px; background: var(--primary); color: #FFFFFF; font-size: 13px; font-weight: 600; margin-top: 8px; cursor: pointer; }
.hg-main-btn:hover { filter: brightness(1.05); }
.hg-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #f3f5fb; border-radius: 10px; padding: 4px; margin: 14px 0; border: 1px solid #e2e7f0; }
.hg-tab-btn { border: 0; border-radius: 6px; padding: 8px; font-size: 13px; font-weight: 600; background: transparent; color: var(--text-main); transition: .18s ease; cursor: pointer; }
.hg-tab-btn.active { background: var(--primary); color: #FFFFFF; box-shadow: 0 4px 10px rgba(25, 25, 112, 0.12); }
.hg-section-title { font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 10px; }
.hg-level-row { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; align-items: center; margin-bottom: 10px; }
.hg-level-label { font-size: 13px; font-weight: 700; color: var(--text-main); }
.hg-deep-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; -ms-overflow-style: none; }
.hg-deep-scroll::-webkit-scrollbar { display: none; }
.hg-deep-input { width: 52px; height: 38px; flex: 0 0 auto; border: 1px solid #dedede; border-radius: 8px; background: #fbfcff; text-align: center; font-size: 13px; font-weight: 600; color: var(--text-main); outline: none; }
.hg-deep-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); background: #FFFFFF; }
.hg-info-box { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #f4f6ff; border: 1px solid #d7dcff; color: var(--primary); font-size: 12px; font-weight: 500; line-height: 1.4; }
.hg-level-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 10px; background: #FFFFFF; }
.hg-level-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 6px; }
.hg-level-title { font-size: 13px; font-weight: 700; color: var(--text-main); }
.hg-danger-btn { border: 0; border-radius: 6px; background: #f44336; color: #FFFFFF; font-size: 12px; font-weight: 600; padding: 5px 10px; cursor: pointer; }
.hg-small-text { font-size: 11px; font-weight: 500; color: var(--text-soft); margin-bottom: 8px; }
.hg-deep-cell-display { width: 52px; height: 38px; flex: 0 0 auto; border: 1px solid #dedede; border-radius: 8px; background: #fbfcff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: var(--text-main); }
.hg-mini-actions { display: flex; gap: 8px; margin-top: 8px; }
.hg-round-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--primary); background: #FFFFFF; color: var(--primary); font-size: 16px; font-weight: 700; line-height: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.hg-divider { height: 1px; background: #dedede; margin: 16px 0; }
.hg-actions { display: flex; justify-content: flex-end; gap: 8px; }
.hg-close-btn { border: 0; background: var(--primary); color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.hg-custom-select { position: relative; width: 100%; }
.hg-select-trigger { display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: #FFFFFF; }
.hg-select-dropdown { position: absolute; top: calc(100% + 5px); left: 0; right: 0; background: #FFFFFF; border: 1px solid #dedede; border-radius: 8px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15); z-index: 1055; display: none; flex-direction: column; }
.hg-select-dropdown.show { display: flex; }
.hg-select-search { padding: 8px; border-bottom: 1px solid #e2e7f0; }
.hg-select-search input { width: 100%; min-height: 34px; padding: 6px 12px; border: 1px solid #dedede; border-radius: 6px; font-size: 12px; outline: none; }
.hg-select-search input:focus { border-color: var(--primary); }
.hg-select-options { max-height: 200px; overflow-y: auto; padding: 5px 0; }
.hg-select-option { padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-main); cursor: pointer; }
.hg-select-option:hover { background: #f3f5fb; color: var(--primary); }
.hg-select-option.hidden { display: none; }

.sailendra-toast-wrap { position: fixed; top: 18px; right: 18px; z-index: 3000; display: flex; flex-direction: column; gap: 10px; width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.sailendra-toast { pointer-events: auto; background: #FFFFFF; border: 1px solid #e5e7eb; border-left: 5px solid var(--primary); border-radius: 14px; box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16); padding: 12px 13px; display: flex; align-items: flex-start; gap: 10px; animation: sailendraToastIn .22s ease-out; }
.sailendra-toast-icon { width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
.sailendra-toast-content { min-width: 0; flex: 1; }
.sailendra-toast-title { font-size: 12px; font-weight: 900; color: var(--text-main); line-height: 1.25; margin-bottom: 2px; }
.sailendra-toast-message { font-size: 11px; font-weight: 700; color: var(--text-soft); line-height: 1.35; }
.sailendra-toast-close { border: 0; background: transparent; color: #9ca3af; font-size: 14px; line-height: 1; padding: 2px; cursor: pointer; }
.sailendra-toast.success { border-left-color: #2E7D32; }
.sailendra-toast.success .sailendra-toast-icon { background: rgba(46, 125, 50, 0.12); color: #2E7D32; }
.sailendra-toast.warning { border-left-color: #F9A825; }
.sailendra-toast.warning .sailendra-toast-icon { background: rgba(249, 168, 37, 0.14); color: #B7791F; }
.sailendra-toast.error { border-left-color: #D32F2F; }
.sailendra-toast.error .sailendra-toast-icon { background: rgba(211, 47, 47, 0.12); color: #D32F2F; }
.sailendra-toast.info { border-left-color: var(--primary); }
.sailendra-toast.info .sailendra-toast-icon { background: var(--primary-soft); color: var(--primary); }
@keyframes sailendraToastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

.modal-loading { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.6); }
.spinner-loader { width: 48px; height: 48px; border: 4px solid #e2e7f0; border-top-color: var(--primary); border-radius: 50%; margin: 0 auto 16px; animation: spinLoader 0.8s linear infinite; }
@keyframes spinLoader { to { transform: rotate(360deg); } }

@media (max-width: 1200px) { .history-lines { grid-template-columns: 1fr; } }
@media (max-width: 768px) {
  .history-action-grid { grid-template-columns: 1fr; }
  .history-block-btn { flex: 1; text-align: center; }
  .history-deep-cell { min-width: 48px; height: 30px; }
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}
`;

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();

const sortLevelsDesc = (levels: Level[]) => [...levels].sort((a, b) => angka(b.level) - angka(a.level));
const sortDeepsAsc = (deeps: Deep[]) => [...deeps].sort((a, b) => angka(a.deep) - angka(b.deep));

export default function HistoryLayoutGudangPage() {
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
  const [produkList, setProdukList] = useState<ProdukRow[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [editLine, setEditLine] = useState<EditLine | null>(null);
  const [salModal, setSalModal] = useState(false);
  const [addLevelModal, setAddLevelModal] = useState(false);
  const [addLineModal, setAddLineModal] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; onOk: () => void }>(null);
  const [kodeBlockType, setKodeBlockType] = useState("reguler");
  const [kodeBlockBaru, setKodeBlockBaru] = useState("");
  const [editTab, setEditTab] = useState<"kapasitas" | "level">("kapasitas");
  const [addLevelNo, setAddLevelNo] = useState("");
  const [addLevelDeep, setAddLevelDeep] = useState("");
  const [addLevelCap, setAddLevelCap] = useState("");
  const toastSeq = useRef(0);

  const notify = (type: string, title: string, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, type, title, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : type === "warning" ? 7000 : 6000);
  };

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
    return () => { cancelled = true; };
  }, [session, isMulti]);

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
    apiGet<ProdukRow[]>("/produk")
      .then((r) => {
        if (cancelled) return;
        setProdukList((r.data || []).sort((a, b) => angka(a.id_produk) - angka(b.id_produk)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const penggunaLokasiFinal = isMulti
    ? penggunaLokasi
    : String(session?.user.id_pengguna_lokasi || "");

  useEffect(() => {
    if (!penggunaLokasiFinal || !idLokasi) return;
    let cancelled = false;
    const params = new URLSearchParams({ id_pengguna_lokasi: penggunaLokasiFinal, id_lokasi: String(idLokasi) });
    apiGet<BlockRow[]>(`/block?${params.toString()}`)
      .then((r) => {
        if (cancelled) return;
        const rows = r.data || [];
        setBlockList(rows);
        setIdBlock((prev) => (rows.some((b) => b.id_block === prev) ? prev : rows[0]?.id_block || 0));
      })
      .catch(() => {});
    return () => { cancelled = true; };
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
      });
    return () => { cancelled = true; };
  }, [penggunaLokasiFinal, idLokasi, idBlock, refresh]);

  if (!session) return null;

  const labelLokasi = (r: LokasiRow) => String(r.kategori || r.nama_lokasi || "").trim().toUpperCase();

  const selectedBlock = layoutBlocks[0] || null;
  const kodeBlockAktif = (selectedBlock?.kode_block || "").toUpperCase();
  const lines = (selectedBlock?.line || []).slice().sort((a, b) => angka(a.nomor_line) - angka(b.nomor_line));

  const searchQ = search.trim().toUpperCase();
  const visibleLines = lines.filter((l) => {
    const key = `${kodeBlockAktif}-${angka(l.nomor_line)} ${kodeBlockAktif} ${angka(l.nomor_line)}`.toUpperCase();
    return searchQ === "" || key.indexOf(searchQ) !== -1;
  });

  const maxNomorLine = lines.reduce((m, l) => Math.max(m, angka(l.nomor_line)), 0);
  const nextNomorLine = maxNomorLine > 0 ? maxNomorLine + 1 : 1;

  const templateLevels = (() => {
    const tpl = lines.find((l) => angka(l.nomor_line) === maxNomorLine);
    if (!tpl) return [];
    const out: { level: number; jumlah_deep: number; kapasitas: number }[] = [];
    sortLevelsDesc(tpl.level || []).forEach((lv) => {
      const deeps = sortDeepsAsc(lv.deep || []);
      const jumlah = deeps.length;
      const kap = deeps.length ? angka(deeps[0].kapasitas) : 0;
      if (angka(lv.level) > 0 && jumlah > 0 && kap > 0) {
        out.push({ level: angka(lv.level), jumlah_deep: jumlah, kapasitas: kap });
      }
    });
    return out;
  })();

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
  };

  const reload = () => {
    setEditLine(null);
    setSalModal(false);
    setAddLevelModal(false);
    setAddLineModal(false);
    setConfirm(null);
    setRefresh((v) => v + 1);
  };

  const cekMasihAdaStok = (levels: Level[]) => {
    return (levels || []).some((lv) => (lv.deep || []).some((d) => angka(d.terpakai) > 0));
  };

  const hapusLine = (idLine: number, nomorLine: number) => {
    if (idLine <= 0) { notify("error", "Gagal", "ID line tidak valid."); return; }
    setConfirm({
      title: "Hapus Line",
      message: `Hapus Line <strong>${nomorLine}</strong>?<br><span style="font-size:11px;color:var(--text-soft);font-weight:600;">Line hanya bisa dihapus jika stoknya kosong.</span>`,
      onOk: async () => {
        try {
          await api(`/line/${idLine}`, { method: "DELETE", body: JSON.stringify({ id_line: idLine, id_pengguna_lokasi: penggunaLokasiFinal, role: session.user.role }) });
          notify("success", "Berhasil", "Selesai");
          reload();
        } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menghapus line."); }
      },
    });
  };

  const hapusBlock = () => {
    if (idBlock <= 0) { notify("error", "Gagal", "ID block tidak valid."); return; }
    setConfirm({
      title: "Hapus Block",
      message: `Hapus Block <strong>${kodeBlockAktif}</strong>?<br><span style="font-size:11px;color:var(--text-soft);font-weight:600;">Block hanya bisa dihapus jika sudah tidak memiliki line.</span>`,
      onOk: async () => {
        try {
          await api(`/block/${idBlock}`, { method: "DELETE", body: JSON.stringify({ id_block: idBlock, id_pengguna_lokasi: penggunaLokasiFinal, role: session.user.role }) });
          notify("success", "Berhasil", "Selesai");
          setIdBlock(0);
          setLayoutBlocks([]);
          setRefresh((v) => v + 1);
        } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menghapus block."); }
      },
    });
  };

  const tambahLine = async () => {
    if (idBlock <= 0) { notify("error", "Gagal", "ID block tidak valid."); return; }
    if (nextNomorLine <= 0) { notify("error", "Gagal", "Nomor line baru tidak valid."); return; }
    if (!templateLevels.length) { notify("warning", "Perhatian", "Belum ada line sebelumnya untuk dijadikan contoh."); return; }
    setAddLineModal(true);
  };

  const eksekusiTambahLine = async () => {
    setBusy(true);
    try {
      const resLine = await apiPost<{ line_dibuat?: { id_line: number }[] }>("/line", {
        role: session.user.role,
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_block: idBlock,
        nomor_line: nextNomorLine,
      });
      let idLineBaru = resLine.data?.line_dibuat?.[0]?.id_line || 0;
      if (idLineBaru <= 0) {
        const lst = await apiGet<{ id_line: number; nomor_line: number }[]>(
          `/line?id_pengguna_lokasi=${encodeURIComponent(penggunaLokasiFinal)}&id_block=${idBlock}`
        );
        const f = (lst.data || []).find((l) => angka(l.nomor_line) === nextNomorLine);
        idLineBaru = f?.id_line || 0;
      }
      if (idLineBaru <= 0) { notify("error", "Gagal", "ID line baru tidak ditemukan."); return; }

      for (const tpl of templateLevels) {
        if (angka(tpl.level) <= 0 || angka(tpl.jumlah_deep) <= 0 || angka(tpl.kapasitas) <= 0) continue;
        const resLevel = await apiPost<{ id_level: number }>("/level", {
          role: session.user.role,
          id_pengguna_lokasi: penggunaLokasiFinal,
          id_line: idLineBaru,
          level: tpl.level,
        });
        let idLevel = resLevel.data?.id_level || 0;
        if (idLevel <= 0) {
          const lst = await apiGet<{ id_level: number; level: number }[]>(
            `/level?id_pengguna_lokasi=${encodeURIComponent(penggunaLokasiFinal)}&id_line=${idLineBaru}`
          );
          const f = (lst.data || []).find((l) => angka(l.level) === angka(tpl.level));
          idLevel = f?.id_level || 0;
        }
        if (idLevel <= 0) { notify("error", "Gagal", `ID Level L${tpl.level} tidak ditemukan.`); return; }
        await apiPost("/deep", {
          role: session.user.role,
          id_pengguna_lokasi: penggunaLokasiFinal,
          id_level: idLevel,
          jumlah_deep: tpl.jumlah_deep,
          kapasitas: tpl.kapasitas,
        });
      }
      notify("success", "Berhasil", "Line baru berhasil dibuat.");
      reload();
    } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal membuat line baru."); }
    finally { setBusy(false); }
  };

  const simpanProdukDanKapasitas = async () => {
    if (!editLine) return;
    if (cekMasihAdaStok(editLine.levels)) { notify("warning", "Perhatian", "Line masih ada stok, kosongkan stok dulu sebelum mengubah line."); return; }

    const inputs = document.querySelectorAll<HTMLInputElement>(".hg-deep-input[data-id-deep]");
    const items: { id_deep: number; kapasitas: number }[] = [];
    inputs.forEach((input) => {
      const idDeep = angka(input.getAttribute("data-id-deep"));
      const kap = angka(input.value);
      if (idDeep > 0 && kap > 0) items.push({ id_deep: idDeep, kapasitas: kap });
    });
    if (!items.length) { notify("warning", "Perhatian", "Data kapasitas deep belum tersedia."); return; }

    setBusy(true);
    try {
      if (angka(editLine.idProduk) <= 0) { notify("warning", "Perhatian", "Data produk belum lengkap. Silakan pilih produk terlebih dahulu."); return; }
      await apiPost("/layout-gudang/prioritas-lokasi-produk", {
        role: session.user.role,
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_produk: editLine.idProduk,
        id_lokasi: editLine.idLokasi,
        id_block: editLine.idBlock,
        id_line: editLine.idLine,
      });
      for (const item of items) {
        await api(`/deep/${item.id_deep}`, {
          method: "PATCH",
          body: JSON.stringify({
            role: session.user.role,
            id_pengguna_lokasi: penggunaLokasiFinal,
            id_deep: item.id_deep,
            kapasitas: item.kapasitas,
          }),
        });
      }
      notify("success", "Berhasil", "Produk & Kapasitas berhasil disimpan.");
      reload();
    } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menyimpan."); }
    finally { setBusy(false); }
  };

  const hapusLevel = (idLevel: number, levelNo: number) => {
    if (!editLine) return;
    if (cekMasihAdaStok(editLine.levels)) { notify("warning", "Perhatian", "Line masih ada stok, kosongkan stok dulu sebelum mengubah line."); return; }
    if (idLevel <= 0) { notify("error", "Gagal", "ID level tidak valid."); return; }
    setConfirm({
      title: "Hapus Level",
      message: `Apakah Anda yakin ingin menghapus Level <strong>L${levelNo}</strong>?`,
      onOk: async () => {
        try {
          await api(`/level/${idLevel}`, { method: "DELETE", body: JSON.stringify({ id_level: idLevel, id_pengguna_lokasi: penggunaLokasiFinal, role: session.user.role }) });
          notify("success", "Berhasil", "Selesai");
          reload();
        } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menghapus level."); }
      },
    });
  };

  const hapusDeepTerakhir = (idDeep: number) => {
    if (!editLine) return;
    if (cekMasihAdaStok(editLine.levels)) { notify("warning", "Perhatian", "Line masih ada stok, kosongkan stok dulu sebelum mengubah line."); return; }
    if (idDeep <= 0) { notify("warning", "Perhatian", "Deep belum tersedia untuk dihapus."); return; }
    setConfirm({
      title: "Hapus Deep",
      message: "Apakah Anda yakin ingin menghapus deep terakhir pada level ini?",
      onOk: async () => {
        try {
          await api(`/deep/${idDeep}`, { method: "DELETE", body: JSON.stringify({ id_deep: idDeep, id_pengguna_lokasi: penggunaLokasiFinal, role: session.user.role }) });
          notify("success", "Berhasil", "Selesai");
          reload();
        } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menghapus deep."); }
      },
    });
  };

  const tambahDeep = async (idLevel: number, kapasitas: number) => {
    if (!editLine) return;
    if (cekMasihAdaStok(editLine.levels)) { notify("warning", "Perhatian", "Line masih ada stok, kosongkan stok dulu sebelum mengubah line."); return; }
    if (idLevel <= 0) { notify("error", "Gagal", "ID level tidak valid."); return; }
    if (kapasitas <= 0) { notify("warning", "Perhatian", "Kapasitas deep belum valid."); return; }
    setBusy(true);
    try {
      await apiPost("/deep", {
        role: session.user.role,
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_level: idLevel,
        jumlah_deep: 1,
        kapasitas: kapasitas,
      });
      notify("success", "Berhasil", "Selesai");
      reload();
    } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menambah deep."); }
    finally { setBusy(false); }
  };

  const salinBlock = async () => {
    const kode = norm(kodeBlockBaru) || (kodeBlockType !== "reguler" ? kodeBlockType : "");
    if (idBlock <= 0) { notify("error", "Gagal", "ID block sumber tidak valid."); return; }
    if (kode === "") { notify("warning", "Perhatian", "Kode block baru wajib diisi."); return; }
    setBusy(true);
    try {
      await apiPost("/layout-gudang/salin-block", {
        role: session.user.role,
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_block_sumber: idBlock,
        kode_block_baru: kode,
      });
      notify("success", "Berhasil", "Block berhasil disalin.");
      reload();
    } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menyalin block."); }
    finally { setBusy(false); }
  };

  const eksekusiTambahLevel = async () => {
    if (!editLine) return;
    const level = angka(addLevelNo);
    const jumlahDeep = angka(addLevelDeep);
    const kapasitas = angka(addLevelCap);
    if (level <= 0 || jumlahDeep <= 0 || kapasitas <= 0) {
      notify("warning", "Perhatian", "Input angka level, jumlah deep, atau kapasitas tidak valid (harus lebih dari 0).");
      return;
    }
    if (cekMasihAdaStok(editLine.levels)) { notify("warning", "Perhatian", "Line masih ada stok, kosongkan stok dulu sebelum mengubah line."); return; }
    setBusy(true);
    try {
      const resLevel = await apiPost<{ id_level: number }>("/level", {
        role: session?.user.role || "",
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_line: editLine.idLine,
        level: level,
      });
      const idLevel = resLevel.data?.id_level || 0;
      if (idLevel <= 0) { notify("error", "Gagal", "ID level tidak ditemukan."); return; }
      await apiPost("/deep", {
        role: session?.user.role || "",
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_level: idLevel,
        jumlah_deep: jumlahDeep,
        kapasitas: kapasitas,
      });
      notify("success", "Berhasil", "Level berhasil ditambahkan.");
      reload();
    } catch (e) { notify("error", "Gagal", (e as Error).message || "Gagal menambah level."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <style>{css}</style>

      {isMulti && !!semuaLokasi.length && (
        <div className="history-card pick-card">
          <form onSubmit={(e) => e.preventDefault()}>
            <label>Pilih Lokasi/Depo:</label>
            <select value={penggunaLokasi} onChange={(e) => { setPenggunaLokasi(e.target.value); setIdBlock(0); setLayoutBlocks([]); }}>
              {semuaLokasi.map((l) => (
                <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                  {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                </option>
              ))}
            </select>
          </form>
        </div>
      )}

      <div className="history-layout-page">
        <div className="history-card history-tabs-card">
          {!lokasiList.length ? (
            <div className="history-empty-card">Data lokasi belum tersedia.</div>
          ) : (
            <div className="history-tabs">
              {lokasiList.map((lokasi) => (
                <button key={lokasi.id_lokasi} type="button"
                  className={`history-tab ${angka(lokasi.id_lokasi) === idLokasi ? "active" : ""}`}
                  onClick={() => gantiLokasi(angka(lokasi.id_lokasi))}
                >
                  {labelLokasi(lokasi)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="history-card history-control-card">
          <div className="history-search-wrap">
            <i className="bi bi-search history-search-icon"></i>
            <input type="text" className="history-search-input" placeholder="Cari line contoh: A-1" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
          </div>

          {!blockList.length ? (
            <div className="history-empty-card">Data block belum tersedia untuk lokasi ini.</div>
          ) : (
            <>
              <div className="history-block-list">
                {blockList.map((block) => (
                  <button key={block.id_block} type="button"
                    className={`history-block-btn ${angka(block.id_block) === idBlock ? "active" : ""}`}
                    onClick={() => gantiBlock(angka(block.id_block))}
                  >
                    Block {String(block.kode_block).toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="history-action-grid">
                <button type="button" className="history-action-btn primary" onClick={() => { setKodeBlockType("reguler"); setKodeBlockBaru(""); setSalModal(true); }}>
                  <i className="bi bi-copy"></i>
                  <span>Salin block ini</span>
                </button>
                <button type="button" className="history-action-btn danger" onClick={hapusBlock}>
                  <i className="bi bi-trash3"></i>
                  <span>Hapus block {kodeBlockAktif}</span>
                </button>
                <button type="button" className="history-action-btn primary" onClick={tambahLine}>
                  <i className="bi bi-plus-lg"></i>
                  <span>Tambah line di block ini</span>
                </button>
              </div>
            </>
          )}
        </div>

        {layoutError !== "" && <div className="history-card history-empty-card">{layoutError}</div>}
        {layoutError === "" && !visibleLines.length && (
          <div className="history-card history-empty-card">Layout pada block ini belum memiliki line, level, atau deep.</div>
        )}

        {layoutError === "" && !!visibleLines.length && (
          <div className="history-lines">
            {visibleLines.map((line) => {
              const lvSorted = sortLevelsDesc(line.level || []);
              const totalKap = (line.level || []).reduce((sum, lv) => sum + (lv.deep || []).reduce((s2, d) => s2 + angka(d.kapasitas), 0), 0);
              return (
                <div key={line.id_line} className="history-card history-line-card">
                  <div className="history-line-header">
                    <div>
                      <h2 className="history-line-title">Block {kodeBlockAktif} Line {angka(line.nomor_line)}</h2>
                      {!!norm(line.nama_produk) && <div className="history-line-product">{norm(line.nama_produk)}</div>}
                      <div className="history-line-total">Kapasitas total: <strong>{totalKap}</strong></div>
                    </div>
                    <div className="history-line-actions">
                      <button type="button" className="history-icon-btn" title="Edit kapasitas, level, dan deep"
                        onClick={() => setEditLine({
                          idLokasi, idBlock, idLine: angka(line.id_line), kodeBlock: kodeBlockAktif,
                          nomorLine: angka(line.nomor_line), idProduk: angka(line.id_produk),
                          produk: norm(line.nama_produk) || "-", levels: line.level || [],
                        })}>
                        <i className="bi bi-pencil-fill"></i>
                      </button>
                      <button type="button" className="history-icon-btn danger" title="Hapus line" onClick={() => hapusLine(angka(line.id_line), angka(line.nomor_line))}>
                        <i className="bi bi-trash3-fill"></i>
                      </button>
                    </div>
                  </div>

                  <div className="history-deep-grid">
                    {lvSorted.map((level) => {
                      const deeps = sortDeepsAsc(level.deep || []);
                      const bisaScroll = deeps.length > 7;
                      return (
                        <div className="history-deep-row" key={level.id_level}>
                          <div className="history-level-label">L{angka(level.level)}</div>
                          <div className={`history-deep-scroll-shell ${bisaScroll ? "" : "no-scroll"}`}>
                            {bisaScroll && (
                              <button type="button" className="history-deep-scroll-btn" title="Geser kiri"
                                onClick={(e) => { const el = (e.currentTarget as HTMLButtonElement).parentElement!.querySelector(".history-deep-viewport") as HTMLElement | null; el?.scrollBy({ left: -(el.clientWidth || 300), behavior: "smooth" }); }}>
                                <i className="bi bi-chevron-left"></i>
                              </button>
                            )}
                            <div className="history-deep-viewport">
                              <div className="history-deep-list">
                                {deeps.map((d) => (
                                  <div key={d.id_deep} className="history-deep-cell">{angka(d.kapasitas) > 0 ? angka(d.kapasitas) : "-"}</div>
                                ))}
                              </div>
                            </div>
                            {bisaScroll && (
                              <button type="button" className="history-deep-scroll-btn" title="Geser kanan"
                                onClick={(e) => { const el = (e.currentTarget as HTMLButtonElement).parentElement!.querySelector(".history-deep-viewport") as HTMLElement | null; el?.scrollBy({ left: el.clientWidth || 300, behavior: "smooth" }); }}>
                                <i className="bi bi-chevron-right"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editLine && (
        <div className="hg-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setEditLine(null); }}>
          <div className="hg-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="hg-modal-body">
              <div className="hg-handle"></div>
              <h3 className="hg-title">Block {editLine.kodeBlock} - Line {editLine.nomorLine}</h3>
              <div className="hg-subtitle">{editLine.produk}</div>

              <div style={{ marginTop: 16 }}>
                <label className="hg-label">Produk yang dipakai di line ini</label>
                <EditProdukSelect produkList={produkList} value={editLine.idProduk} onChange={(id) => setEditLine({ ...editLine, idProduk: id })} />
              </div>

              <div className="hg-tabs">
                <button type="button" className={`hg-tab-btn ${editTab === "kapasitas" ? "active" : ""}`} onClick={() => setEditTab("kapasitas")}>Kapasitas Deep</button>
                <button type="button" className={`hg-tab-btn ${editTab === "level" ? "active" : ""}`} onClick={() => setEditTab("level")}>Level &amp; Deep</button>
              </div>

              {editTab === "kapasitas" && (
                <div>
                  <div className="hg-section-title">Kapasitas deep di line ini</div>
                  <KapasitasRows levels={editLine.levels} />
                  <button type="button" className="hg-main-btn" onClick={simpanProdukDanKapasitas}>Simpan</button>
                </div>
              )}

              {editTab === "level" && (
                <div>
                  <div className="hg-info-box mb-3">Atur jumlah level dan deep di line ini otomatis akan mengubah kapasitas gudang.</div>
                  <button type="button" className="hg-main-btn" onClick={() => { const lv = sortLevelsDesc(editLine.levels); const max = lv.reduce((m, x) => Math.max(m, angka(x.level)), 0); const top = lv.find((x) => angka(x.level) === max); setAddLevelNo(String(max + 1)); setAddLevelDeep(String(top && top.deep.length ? top.deep.length : 4)); setAddLevelCap(String(top && top.deep.length ? angka(top.deep[0].kapasitas) : 40)); setAddLevelModal(true); }}>+ Tambah level</button>
                  <div style={{ marginTop: 12 }}>
                    {!sortLevelsDesc(editLine.levels).length ? (
                      <div className="history-empty-card">Belum ada level / deep di line ini.</div>
                    ) : (
                      sortLevelsDesc(editLine.levels).map((level) => {
                        const deeps = sortDeepsAsc(level.deep || []);
                        const deepCount = deeps.length;
                        const capPerDeep = deepCount ? angka(deeps[0].kapasitas) : 0;
                        const lastDeep = deeps.length ? deeps[deeps.length - 1] : null;
                        return (
                          <div className="hg-level-card" key={level.id_level}>
                            <div className="hg-level-head">
                              <div className="hg-level-title">Level L{angka(level.level)}</div>
                              <button type="button" className="hg-danger-btn" onClick={() => hapusLevel(angka(level.id_level), angka(level.level))}>Hapus Level</button>
                            </div>
                            <div className="hg-small-text">Deep: {deepCount} - Kapasitas/deep: {capPerDeep} - Kapasitas level: {deepCount * capPerDeep}</div>
                            <div className="hg-deep-scroll">
                              {deeps.map((d) => (
                                <div key={d.id_deep} className="hg-deep-cell-display">{angka(d.kapasitas)}</div>
                              ))}
                            </div>
                            <div className="hg-mini-actions">
                              <button type="button" className="hg-round-btn" onClick={() => hapusDeepTerakhir(lastDeep ? angka(lastDeep.id_deep) : 0)}>&minus;</button>
                              <button type="button" className="hg-round-btn" onClick={() => tambahDeep(angka(level.id_level), capPerDeep)}>+</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="hg-divider"></div>
              <div className="hg-actions">
                <button type="button" className="hg-close-btn" onClick={() => setEditLine(null)}>Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {salModal && (
        <div className="hg-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSalModal(false); }}>
          <div className="hg-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="hg-modal-body">
              <div className="hg-handle"></div>
              <h3 className="hg-title">Salin Block</h3>
              <div className="hg-subtitle">Block Sumber: Block {kodeBlockAktif}</div>
              <div style={{ marginTop: 16 }}>
                <label className="hg-label">Tipe Block</label>
                <select className="hg-input" style={{ textTransform: "uppercase" }} value={kodeBlockType}
                  onChange={(e) => { setKodeBlockType(e.target.value); if (e.target.value !== "reguler") setKodeBlockBaru(e.target.value); }}>
                  <option value="reguler">Reguler (isi kode sendiri)</option>
                  <option value="MOBIL">MOBIL</option>
                  <option value="RECEH">RECEH</option>
                  <option value="TRANSIT">TRANSIT</option>
                  <option value="BADSTOCK">BADSTOCK</option>
                  <option value="REJECT">REJECT</option>
                </select>
                <label className="hg-label" style={{ marginTop: 12 }}>Masukkan Kode Block Baru</label>
                <input type="text" className="hg-input" placeholder="Contoh: E" value={kodeBlockBaru} readOnly={kodeBlockType !== "reguler"} autoComplete="off"
                  onChange={(e) => setKodeBlockBaru(e.target.value)} style={{ textTransform: "uppercase" }} />
                <button type="button" className="hg-main-btn" onClick={salinBlock}>Simpan &amp; Duplikasi Layout</button>
              </div>
              <div className="hg-divider"></div>
              <div className="hg-actions">
                <button type="button" className="hg-close-btn" onClick={() => setSalModal(false)}>Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addLineModal && (
        <div className="hg-overlay">
          <div className="hg-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="hg-modal-body">
              <div style={{ display: "flex", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e2e7f0" }}>
                <i className="bi bi-info-circle-fill me-2" style={{ color: "#191970", fontSize: 18 }}></i>
                <h3 className="hg-title m-0">Konfirmasi Tambah</h3>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-main)", marginBottom: 24, lineHeight: 1.5 }}>
                Tambah Line <strong>{nextNomorLine}</strong> di Block <strong>{kodeBlockAktif}</strong> dengan layout yang sama seperti line sebelumnya?
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="hg-close-btn" style={{ background: "#ffffff", color: "var(--text-main)", border: "1px solid #e2e7f0" }} onClick={() => setAddLineModal(false)}>Batal</button>
                <button type="button" className="hg-main-btn" style={{ width: "auto", padding: "8px 16px", marginTop: 0 }} onClick={eksekusiTambahLine}>Ya, Lanjutkan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addLevelModal && (
        <div className="hg-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAddLevelModal(false); }}>
          <div className="hg-modal" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="hg-modal-body">
              <div className="hg-handle"></div>
              <h3 className="hg-title" style={{ marginBottom: 8 }}>Tambah Level</h3>
              <div>
                <label className="hg-label">Level</label>
                <input type="number" className="hg-input mb-3" placeholder="Contoh: 6" min={1} value={addLevelNo} onChange={(e) => setAddLevelNo(e.target.value)} />
                <label className="hg-label">Jumlah deep / level</label>
                <input type="number" className="hg-input mb-3" placeholder="Contoh: 3" min={1} value={addLevelDeep} onChange={(e) => setAddLevelDeep(e.target.value)} />
                <label className="hg-label">Kapasitas / deep</label>
                <input type="number" className="hg-input mb-4" placeholder="Contoh: 65" min={1} value={addLevelCap} onChange={(e) => setAddLevelCap(e.target.value)} />
                <button type="button" className="hg-main-btn mb-3" onClick={eksekusiTambahLevel}>Simpan</button>
              </div>
              <div className="hg-divider" style={{ marginTop: 0 }}></div>
              <div className="hg-actions" style={{ justifyContent: "center" }}>
                <button type="button" className="hg-close-btn" style={{ background: "transparent", color: "var(--text-soft)" }} onClick={() => setAddLevelModal(false)}>Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="hg-overlay">
          <div className="hg-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="hg-modal-body">
              <div style={{ display: "flex", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e2e7f0" }}>
                <i className="bi bi-exclamation-octagon-fill me-2" style={{ color: "#ef4444", fontSize: 18 }}></i>
                <h3 className="hg-title m-0">{confirm.title}</h3>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-main)", marginBottom: 24, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: confirm.message }}></p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="hg-close-btn" style={{ background: "#ffffff", color: "var(--text-main)", border: "1px solid #e2e7f0" }} onClick={() => setConfirm(null)}>Batal</button>
                <button type="button" className="hg-main-btn" style={{ width: "auto", padding: "8px 16px", marginTop: 0, background: "#ef4444" }}
                  onClick={() => { setConfirm(null); confirm.onOk(); }}>Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sailendra-toast-wrap" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`sailendra-toast ${t.type}`}>
            <div className="sailendra-toast-icon"><i className={`bi ${t.type === "success" ? "bi-check-circle-fill" : t.type === "warning" ? "bi-exclamation-triangle-fill" : t.type === "error" ? "bi-x-circle-fill" : "bi-info-circle-fill"}`}></i></div>
            <div className="sailendra-toast-content">
              <div className="sailendra-toast-title">{t.title}</div>
              <div className="sailendra-toast-message">{t.msg}</div>
            </div>
            <button type="button" className="sailendra-toast-close" aria-label="Tutup" onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}><i className="bi bi-x-lg"></i></button>
          </div>
        ))}
      </div>

      {busy && (
        <div className="modal-loading">
          <div style={{ background: "#fff", borderRadius: 12, padding: "35px 40px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div className="spinner-loader"></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>Mohon tunggu...</div>
          </div>
        </div>
      )}
    </>
  );
}

function EditProdukSelect({ produkList, value, onChange }: { produkList: ProdukRow[]; value: number; onChange: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const selected = produkList.find((p) => angka(p.id_produk) === angka(value));
  const filtered = produkList.filter((p) => {
    const k = `${p.id_produk} ${p.nama_produk}`.toLowerCase();
    return k.indexOf(q.toLowerCase()) !== -1;
  });

  return (
    <div className="hg-custom-select" ref={wrapRef}>
      <div className="hg-input hg-select-trigger" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <span>{selected ? `${selected.id_produk} - ${selected.nama_produk}` : "Pilih produk"}</span>
        <i className="bi bi-chevron-down" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
      </div>
      <div className={`hg-select-dropdown ${open ? "show" : ""}`}>
        <div className="hg-select-search"><input type="text" placeholder="Cari ID atau nama produk..." value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
        <div className="hg-select-options">
          <div className="hg-select-option" onClick={() => { onChange(0); setOpen(false); }}>Pilih produk</div>
          {filtered.map((p) => (
            <div key={p.id_produk} className="hg-select-option" onClick={() => { onChange(angka(p.id_produk)); setOpen(false); }}>
              {p.id_produk} - {p.nama_produk}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KapasitasRows({ levels }: { levels: Level[] }) {
  const lvSorted = sortLevelsDesc(levels || []);
  return (
    <>
      {!lvSorted.length ? (
        <div className="history-empty-card">Belum ada level / deep di line ini.</div>
      ) : (
        lvSorted.map((level) => {
          const deeps = sortDeepsAsc(level.deep || []);
          return (
            <div className="hg-level-row" key={level.id_level}>
              <div className="hg-level-label">L{angka(level.level)}</div>
              <div className="hg-deep-scroll">
                {deeps.map((d, idx) => (
                  <input
                    key={d.id_deep}
                    type="number"
                    min="1"
                    className="hg-deep-input"
                    data-id-deep={d.id_deep}
                    data-level={level.level}
                    data-index={idx}
                    defaultValue={angka(d.kapasitas)}
                    onInput={(e) => {
                      if (idx !== 0) return;
                      const value = (e.currentTarget as HTMLInputElement).value;
                      const wrap = (e.currentTarget as HTMLInputElement).parentElement!;
                      wrap.querySelectorAll<HTMLInputElement>(".hg-deep-input").forEach((other, oi) => { if (oi > 0) other.value = value; });
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
