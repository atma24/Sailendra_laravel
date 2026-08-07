"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { useSession } from "@/lib/auth";

type Produk = { id_produk: number; nama_produk: string; satuan: string; isi_per_pcs: number };
type Lokasi = { id_lokasi: number; nama_lokasi: string; kategori: string };
type Block = { id_block: number; id_lokasi: number; kode_block: string };
type Line = { id_line: number; id_block: number; nomor_line: number };
type LineFull = Line & { id_lokasi: number; kode_block: string; label_line: string };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => String(v ?? "").trim();
const PRODUK_TANPA_BATCH = [10516938, 10516939];

const STATUS_OPTIONS: Record<string, string> = {
  GS_GS: "Goods Stock - Goods Stock",
  GS_BAD: "Goods Stock - Bad Stock",
  BAD_GS: "Bad Stock - Goods Stock",
  GS_REJ: "Goods Stock - Reject",
  BAD_REJ: "Bad Stock - Reject",
};

const css = `
.mutasi-page { display: flex; flex-direction: column; gap: 7px; padding-bottom: 12px; }
.mutasi-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; padding: 10px 12px; }
.mutasi-alert { border-radius: 9px; padding: 7px 9px; font-size: 10px; font-weight: 800; }
.mutasi-alert-danger { background: #fff0f0; color: #dc2626; border: 1px solid #fecaca; }
.mutasi-alert-success { background: #ecfdf3; color: #15803d; border: 1px solid #bbf7d0; }
.mutasi-stack { display: flex; flex-direction: column; gap: 7px; }
.mutasi-section-title { font-size: 12px; font-weight: 950; color: var(--primary); margin-bottom: 8px; letter-spacing: -0.2px; }
.mutasi-label { display: block; font-size: 10px; font-weight: 850; color: var(--text-main); margin-bottom: 4px; }
.mutasi-input, .mutasi-select, .mutasi-textarea { width: 100%; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); font-size: 11px; font-weight: 750; outline: none; box-sizing: border-box; }
.mutasi-input, .mutasi-select { height: 31px; padding: 0 26px 0 10px; }
.mutasi-select { -webkit-appearance: none; -moz-appearance: none; appearance: none; cursor: pointer; }
.mutasi-textarea { min-height: 68px; padding: 8px 10px; resize: vertical; }
.mutasi-input:focus, .mutasi-select:focus, .mutasi-picker-search:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.mutasi-input[readonly] { background: #fbfcff; color: var(--text-main); cursor: pointer; }
.mutasi-select-wrap { position: relative; }
.mutasi-select-icon { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); font-size: 11px; color: var(--text-main); pointer-events: none; }
.mutasi-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.mutasi-picker-wrap { position: relative; }
.mutasi-picker-button { width: 100%; min-height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 800; color: var(--text-main); outline: none; display: flex; align-items: center; justify-content: space-between; gap: 7px; cursor: pointer; }
.mutasi-picker-button:disabled { background: #f1f3f7; color: #777; pointer-events: none; }
.mutasi-picker-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mutasi-picker-panel { display: none; position: absolute; left: 0; right: 0; top: calc(100% + 5px); z-index: 80; background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 10px; box-shadow: 0 10px 24px rgba(15,23,42,0.12); padding: 7px; }
.mutasi-picker-panel.show { display: block; z-index: 95; }
.mutasi-picker-search { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 10px; font-size: 11px; font-weight: 700; outline: none; margin-bottom: 6px; box-sizing: border-box; }
.mutasi-option-list { max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.mutasi-option { border: 0; outline: 0; width: 100%; text-align: left; background: #FFFFFF; color: var(--text-main); border-radius: 8px; padding: 6px 8px; font-size: 10px; font-weight: 800; cursor: pointer; }
.mutasi-option:hover, .mutasi-option.selected { background: var(--primary-soft); color: var(--primary); }
.mutasi-empty-result { padding: 7px; color: var(--text-soft); font-size: 10px; font-weight: 800; text-align: center; }
.mutasi-summary { border: 1px solid var(--primary); border-radius: 11px; padding: 8px; background: #FFFFFF; }
.mutasi-summary-title { color: var(--primary); font-size: 11px; font-weight: 950; margin-bottom: 7px; }
.mutasi-summary-row { display: grid; grid-template-columns: 68px minmax(0,1fr); gap: 7px; padding: 2px 0; font-size: 11px; }
.mutasi-summary-key { color: var(--primary); font-weight: 900; }
.mutasi-summary-value { color: var(--text-main); font-weight: 750; word-break: break-word; }
.mutasi-submit-btn { width: 100%; border: 0; outline: 0; border-radius: 9px; background: var(--primary); color: #FFFFFF; min-height: 33px; padding: 7px 11px; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.mutasi-submit-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.mutasi-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.mutasi-back-btn { height: 30px; border-radius: 8px; padding: 0 9px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; }
.mutasi-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.22); transform: translateY(-1px); }
.sailendra-toast-wrap { position: fixed; top: 18px; right: 18px; z-index: 3000; display: flex; flex-direction: column; gap: 10px; width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.sailendra-toast { pointer-events: auto; background: #FFFFFF; border: 1px solid #e5e7eb; border-left: 5px solid var(--primary); border-radius: 14px; box-shadow: 0 16px 34px rgba(15,23,42,0.16); padding: 12px 13px; display: flex; align-items: flex-start; gap: 10px; }
.sailendra-toast-icon { width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
.sailendra-toast-content { min-width: 0; flex: 1; }
.sailendra-toast-title { font-size: 12px; font-weight: 900; color: var(--text-main); margin-bottom: 2px; }
.sailendra-toast-message { font-size: 11px; font-weight: 700; color: var(--text-soft); line-height: 1.35; }
.sailendra-toast-close { border: 0; background: transparent; color: #9ca3af; font-size: 14px; line-height: 1; padding: 2px; cursor: pointer; }
.sailendra-toast.success { border-left-color: #2E7D32; }
.sailendra-toast.success .sailendra-toast-icon { background: rgba(46,125,50,0.12); color: #2E7D32; }
.sailendra-toast.error { border-left-color: #D32F2F; }
.sailendra-toast.error .sailendra-toast-icon { background: rgba(211,47,47,0.12); color: #D32F2F; }
@media (max-width: 768px) {
  .mutasi-row-2 { grid-template-columns: 1fr; }
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}
`;

export default function MutasiFormPage() {
  const session = useSession();
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [blockList, setBlockList] = useState<Block[]>([]);
  const [lineList, setLineList] = useState<LineFull[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  const toastSeq = useRef(0);

  const [jenis, setJenis] = useState("");
  const [idProduk, setIdProduk] = useState(0);
  const [produkLabel, setProdukLabel] = useState("Pilih produk");
  const [satuan, setSatuan] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [bestBefore, setBestBefore] = useState("");
  const [bbList, setBbList] = useState<string[]>([]);
  const [bbOpen, setBbOpen] = useState(false);
  const [bbSearch, setBbSearch] = useState("");

  const [dariLokasi, setDariLokasi] = useState(0);
  const [dariBlock, setDariBlock] = useState(0);
  const [dariLine, setDariLine] = useState(0);
  const [keLokasi, setKeLokasi] = useState(0);
  const [keBlock, setKeBlock] = useState(0);
  const [keLine, setKeLine] = useState(0);
  const [dariLabel, setDariLabel] = useState("");
  const [keLabel, setKeLabel] = useState("");
  const [catatan, setCatatan] = useState("");

  const notify = (type: string, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, type, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : 6000);
  };
  const closeToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const idPenggunaLokasi = () => String(session?.user.id_pengguna_lokasi || "");

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const lp = String(session.user.id_pengguna_lokasi || "");
        const [pr, lr] = await Promise.all([
          apiGet<Produk[]>("/produk?limit=200"),
          apiGet<Lokasi[]>(`/lokasi?q=&id_pengguna_lokasi=${lp}`),
        ]);
        if (cancelled) return;
        setProdukList((pr.data || []).sort((a, b) => angka(a.id_produk) - angka(b.id_produk)));
        setLokasiList((lr.data || []).sort((a, b) => angka(a.id_lokasi) - angka(b.id_lokasi)));
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const lp = idPenggunaLokasi();
      if (!lp) return;
      try {
        const r = await apiGet<Block[]>("/block?id_pengguna_lokasi=" + lp);
        if (cancelled) return;
        const blocks = r.data || [];
        setBlockList(blocks);
        const lines: LineFull[] = [];
        await Promise.all(
          blocks.map((b) =>
            apiGet<Line[]>(`/line?id_pengguna_lokasi=${lp}&id_block=${b.id_block}`)
              .then((lr) => {
                (lr.data || []).forEach((ln) => {
                  lines.push({
                    ...ln,
                    id_lokasi: b.id_lokasi,
                    kode_block: b.kode_block,
                    label_line: `${b.kode_block}-${ln.nomor_line}`,
                  });
                });
              })
              .catch(() => {})
          )
        );
        if (cancelled) return;
        setLineList(lines);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session || !loaded) return null;

  const pickProduk = (p: Produk) => {
    setIdProduk(p.id_produk);
    setProdukLabel(`${p.id_produk} - ${p.nama_produk}`);
    let s = (p.satuan || "").toUpperCase();
    if (!s && p.nama_produk.toUpperCase().includes("GALLON")) s = "GALLON";
    if (!s) s = "BOX";
    setSatuan(s);

    if (PRODUK_TANPA_BATCH.includes(p.id_produk)) {
      setBestBefore("9999-12-31");
    } else {
      setBestBefore("");
    }
    setBbList([]);
    setBbOpen(false);
  };

  const fetchBB = async (idLine: number, idProdukVal: number) => {
    if (!idLine || !idProdukVal) return;
    try {
      const r = await apiGet<{ bb_list?: string[] }>(`/mutasi/bb-line?id_pengguna_lokasi=${idPenggunaLokasi()}&id_line=${idLine}&id_produk=${idProdukVal}`);
      setBbList(r.data?.bb_list || []);
      setBbOpen(true);
    } catch {
      setBbList([]);
      setBbOpen(true);
    }
  };

  const onDariLineChange = (idLine: number) => {
    setDariLine(idLine);
    setBestBefore("");
    setBbList([]);
    setBbOpen(false);
    const ln = lineList.find((l) => l.id_line === idLine);
    setDariLabel(ln?.label_line || "");
    if (idLine && idProduk) {
      fetchBB(idLine, idProduk);
    }
  };

  const resetSumber = () => {
    setDariBlock(0);
    setDariLine(0);
    setDariLabel("");
    setBestBefore("");
    setBbList([]);
    setBbOpen(false);
  };

  const blocksFor = (idLokasi: number) => blockList.filter((b) => b.id_lokasi === idLokasi);
  const linesFor = (idBlock: number) => lineList.filter((l) => l.id_block === idBlock);
  const lokasiLabel = (idLokasi: number) => {
    const l = lokasiList.find((x) => x.id_lokasi === idLokasi);
    if (!l) return "";
    return (l.kategori || l.nama_lokasi || "").trim().toUpperCase();
  };

  const validate = () => {
    if (!idProduk) { notify("error", "Pilih produk terlebih dahulu."); return false; }
    if (!satuan) { notify("error", "Satuan produk belum terbaca. Pilih ulang produk."); return false; }
    if (!dariLabel || !dariLine) { notify("error", "Pilih lokasi sumber terlebih dahulu."); return false; }
    if (!bestBefore) { notify("error", "Pilih tanggal best before terlebih dahulu."); return false; }
    if (!keLabel || !keLine) { notify("error", "Pilih lokasi tujuan terlebih dahulu."); return false; }
    if (String(dariLine) === String(keLine)) { notify("error", "Lokasi sumber dan lokasi tujuan tidak boleh sama."); return false; }
    if (norm(catatan) === "") { notify("error", "Catatan wajib diisi."); return false; }
    const isGallonSps = (a: number, b: number) =>
      (lokasiLabel(a).includes("GALLON") && lokasiLabel(b).includes("SPS")) ||
      (lokasiLabel(a).includes("SPS") && lokasiLabel(b).includes("GALLON"));
    if (isGallonSps(dariLokasi, keLokasi)) { notify("error", "GALLON dan SPS tidak bisa saling transfer mutasi."); return false; }
    return true;
  };

  const simpan = async (showPreview = false) => {
    if (!validate()) return;
    const payload = {
      mode: showPreview ? "preview" : "",
      id_pengguna_lokasi: idPenggunaLokasi(),
      id_pengguna: session!.user.id_pengguna,
      id_produk: idProduk,
      jumlah: angka(jumlah),
      satuan,
      jenis_mutasi: jenis,
      best_before: bestBefore,
      lokasi_sumber: dariLabel,
      lokasi_tujuan: keLabel,
      id_line_sumber: dariLine,
      id_line_tujuan: keLine,
      catatan,
    };
    setBusy(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      if (showPreview) {
        const r = await apiPost<{ alokasi_tujuan?: { id_deep: number; jumlah: number }[] }>("/mutasi/proses", payload);
        notify("success", `Preview OK. ${(r.data?.alokasi_tujuan || []).length} slot tujuan siap.`);
        return;
      }
      await apiPost("/mutasi/proses", payload);
      setSuccessMsg("Mutasi stok berhasil disimpan.");
      notify("success", "Mutasi stok berhasil disimpan.");
      window.setTimeout(() => window.location.href = "/mutasi", 1200);
    } catch (e) {
      setErrorMsg((e as Error).message);
      notify("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const bbOptions = bbList.filter((bb) =>
    bbSearch.trim() === "" || bb.toLocaleLowerCase().includes(bbSearch.trim().toLowerCase()));

  const summaryDari = `${dariLabel || "-"}`;
  const summaryKe = `${keLabel || "-"}`;

  return (
    <div className="mutasi-page">
      <style>{css}</style>
      <div className="sailendra-toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`sailendra-toast ${t.type === "success" ? "success" : "error"}`}>
            <div className="sailendra-toast-icon"><i className={`bi ${t.type === "success" ? "bi-check-lg" : "bi-exclamation-lg"}`}></i></div>
            <div className="sailendra-toast-content">
              <div className="sailendra-toast-title">{t.type === "success" ? "Berhasil" : "Gagal"}</div>
              <div className="sailendra-toast-message">{t.msg}</div>
            </div>
            <button type="button" className="sailendra-toast-close" onClick={() => closeToast(t.id)}><i className="bi bi-x-lg"></i></button>
          </div>
        ))}
      </div>

      <div className="mutasi-card" style={{ marginBottom: 8, padding: 8 }}>
        <Link className="mutasi-back-btn" href="/mutasi">
          <i className="bi bi-arrow-left"></i>
          <span>Kembali ke Riwayat Mutasi</span>
        </Link>
      </div>

      {errorMsg !== "" && <div className="mutasi-alert mutasi-alert-danger">{errorMsg}</div>}
      {successMsg !== "" && <div className="mutasi-alert mutasi-alert-success">{successMsg}</div>}

      <div className="mutasi-card">
        <div className="mutasi-stack">
          <div className="mutasi-select-wrap">
            <select className="mutasi-select" value={jenis} onChange={(e) => setJenis(e.target.value)}>
              <option value="">Pilih status mutasi</option>
              {Object.entries(STATUS_OPTIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <i className="bi bi-chevron-down mutasi-select-icon"></i>
          </div>

          <ProdukPicker produkList={produkList} value={produkLabel} onChange={pickProduk} />

          <input type="number" min={1} className="mutasi-input" placeholder="Jumlah yang mau dipindah"
            value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
        </div>
      </div>

      <div className="mutasi-card">
        <div className="mutasi-section-title">Dari</div>
        <div className="mutasi-stack">
          <div className="mutasi-select-wrap">
            <select className="mutasi-select" value={dariLokasi} onChange={(e) => { setDariLokasi(angka(e.target.value)); resetSumber(); }}>
              <option value="0">Lokasi</option>
              {lokasiList.map((l) => <option key={l.id_lokasi} value={l.id_lokasi}>{lokasiLabel(l.id_lokasi)}</option>)}
            </select>
            <i className="bi bi-chevron-down mutasi-select-icon"></i>
          </div>
          <div className="mutasi-row-2">
            <div className="mutasi-select-wrap">
              <select className="mutasi-select" value={dariBlock} disabled={!dariLokasi}
                onChange={(e) => { setDariBlock(angka(e.target.value)); setDariLine(0); setDariLabel(""); setBestBefore(""); setBbList([]); setBbOpen(false); }}>
                <option value="0">Block</option>
                {blocksFor(dariLokasi).map((b) => <option key={b.id_block} value={b.id_block}>{b.kode_block}</option>)}
              </select>
              <i className="bi bi-chevron-down mutasi-select-icon"></i>
            </div>
            <div className="mutasi-select-wrap">
              <select className="mutasi-select" value={dariLine} disabled={!dariBlock} onChange={(e) => onDariLineChange(angka(e.target.value))}>
                <option value="0">Line</option>
                {linesFor(dariBlock).map((l) => <option key={l.id_line} value={l.id_line}>Line {l.nomor_line}</option>)}
              </select>
              <i className="bi bi-chevron-down mutasi-select-icon"></i>
            </div>
          </div>

          <div>
            <label className="mutasi-label">Best Before</label>
            <BBPicker bestBefore={bestBefore} open={bbOpen} onToggle={() => setBbOpen((o) => !o)}
              search={bbSearch} setSearch={setBbSearch} options={bbOptions}
              onSelect={(bb) => { setBestBefore(bb); setBbOpen(false); }}
              disabled={bestBefore === "9999-12-31"} />
          </div>
        </div>
      </div>

      <div className="mutasi-card">
        <div className="mutasi-section-title">Ke</div>
        <div className="mutasi-stack">
          <div className="mutasi-select-wrap">
            <select className="mutasi-select" value={keLokasi} onChange={(e) => { setKeLokasi(angka(e.target.value)); setKeBlock(0); setKeLine(0); setKeLabel(""); }}>
              <option value="0">Lokasi</option>
              {lokasiList.map((l) => <option key={l.id_lokasi} value={l.id_lokasi}>{lokasiLabel(l.id_lokasi)}</option>)}
            </select>
            <i className="bi bi-chevron-down mutasi-select-icon"></i>
          </div>
          <div className="mutasi-row-2">
            <div className="mutasi-select-wrap">
              <select className="mutasi-select" value={keBlock} disabled={!keLokasi}
                onChange={(e) => { setKeBlock(angka(e.target.value)); setKeLine(0); setKeLabel(""); }}>
                <option value="0">Block</option>
                {blocksFor(keLokasi).map((b) => <option key={b.id_block} value={b.id_block}>{b.kode_block}</option>)}
              </select>
              <i className="bi bi-chevron-down mutasi-select-icon"></i>
            </div>
            <div className="mutasi-select-wrap">
              <select className="mutasi-select" value={keLine} disabled={!keBlock}
                onChange={(e) => {
                  const idLine = angka(e.target.value);
                  setKeLine(idLine);
                  const ln = lineList.find((l) => l.id_line === idLine);
                  setKeLabel(ln?.label_line || "");
                }}>
                <option value="0">Line</option>
                {linesFor(keBlock).map((l) => <option key={l.id_line} value={l.id_line}>Line {l.nomor_line}</option>)}
              </select>
              <i className="bi bi-chevron-down mutasi-select-icon"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="mutasi-card">
        <div className="mutasi-summary">
          <div className="mutasi-summary-title">Ringkasan Mutasi</div>
          <div className="mutasi-summary-row"><div className="mutasi-summary-key">BB</div><div className="mutasi-summary-value">{bestBefore || "-"}</div></div>
          <div className="mutasi-summary-row"><div className="mutasi-summary-key">Dari</div><div className="mutasi-summary-value">{summaryDari}</div></div>
          <div className="mutasi-summary-row"><div className="mutasi-summary-key">Ke</div><div className="mutasi-summary-value">{summaryKe}</div></div>
          <div className="mutasi-summary-row"><div className="mutasi-summary-key">Jumlah</div><div className="mutasi-summary-value">{angka(jumlah) > 0 ? `${angka(jumlah)} ${satuan}` : "-"}</div></div>
        </div>
      </div>

      <div className="mutasi-card">
        <div className="mutasi-section-title">Catatan</div>
        <textarea className="mutasi-textarea" placeholder="Tulis catatan mutasi" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        <button type="button" className="mutasi-submit-btn" style={{ flex: 1 }} disabled={busy} onClick={() => simpan(false)}>
          <i className="bi bi-save2"></i>
          <span>{busy ? "Menyimpan..." : "Simpan Mutasi"}</span>
        </button>
      </div>
    </div>
  );
}

function ProdukPicker({ produkList, value, onChange }: {
  produkList: Produk[]; value: string; onChange: (p: Produk) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = produkList.filter((p) => {
    const label = `${p.id_produk} - ${p.nama_produk}`.toUpperCase();
    return q.trim() === "" || label.includes(q.trim().toUpperCase());
  });
  return (
    <div className="mutasi-picker-wrap">
      <button type="button" className="mutasi-picker-button" onClick={() => setOpen((o) => !o)}>
        <span className="mutasi-picker-text">{norm(value) || "Pilih produk"}</span>
        <i className="bi bi-search"></i>
      </button>
      {open && (
        <div className="mutasi-picker-panel show">
          <input type="text" className="mutasi-picker-search" placeholder="Cari ID atau nama produk" value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="mutasi-option-list">
            {filtered.map((p) => (
              <button key={p.id_produk} type="button" className="mutasi-option"
                onClick={() => { onChange(p); setOpen(false); setQ(""); }}>
                <span>{p.id_produk} - {p.nama_produk}</span>
              </button>
            ))}
            {!filtered.length && <div className="mutasi-empty-result">Produk tidak ditemukan</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BBPicker({ bestBefore, open, onToggle, search, setSearch, options, onSelect, disabled }: {
  bestBefore: string; open: boolean; onToggle: () => void; search: string; setSearch: (s: string) => void;
  options: string[]; onSelect: (bb: string) => void; disabled: boolean;
}) {
  return (
    <div className="mutasi-picker-wrap">
      <button type="button" className="mutasi-picker-button" disabled={disabled} onClick={onToggle}>
        <span className="mutasi-picker-text">{norm(bestBefore) || "Pilih BB"}</span>
        <i className="bi bi-chevron-down"></i>
      </button>
      {open && !disabled && (
        <div className="mutasi-picker-panel show">
          <input type="text" className="mutasi-picker-search" placeholder="Cari BB" value={search}
            onChange={(e) => setSearch(e.target.value)} autoFocus />
          <div className="mutasi-option-list">
            {options.length === 0 && <div className="mutasi-empty-result">Tidak ada BB tersedia</div>}
            {options.map((bb) => (
              <button key={bb} type="button" className={`mutasi-option ${bestBefore === bb ? "selected" : ""}`} onClick={() => onSelect(bb)}>
                {bb}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}