"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import type { Session } from "@/lib/auth";

export type BbItem = {
  id_stok: number;
  best_before: string;
  jumlah: number;
  qty_primary: number;
  min_qty_allowed: number;
};

export type EditLine = {
  idLine: number;
  idProduk: number;
  lineLabel: string;
  product: string;
  total: number;
  bbItems: BbItem[];
};

type LokasiRow = { id_lokasi: number; nama_lokasi?: string; kategori?: string };
type BlockRow = { id_block: number; kode_block: string; id_lokasi?: number };
type PlantRow = { id_plant: string; nama_plant?: string };
type TransferLine = {
  id_line: number;
  id_block: number;
  kode_block: string;
  nomor_line: number;
};

type BbRow = BbItem & { date: string; plant: string; qty: string; alasan: string };

type Toast = { id: number; type: string; title: string; msg: string };

export type LineEditModalProps = {
  edit: EditLine;
  session: Session;
  lokasiList: LokasiRow[];
  blockList: BlockRow[];
  onClose: () => void;
  onChanged: () => void;
};

const css = `
.lg-modal-overlay {
  position: fixed; inset: 0; z-index: 1080; display: flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); padding: 0 15px;
}
.lg-modal {
  width: 100%; max-width: 430px; background: #FFFFFF; border-radius: 16px;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.18); overflow: hidden;
}
.lg-modal-body { padding: 20px 24px; max-height: 86vh; overflow-y: auto; }
.lg-topbar { width: 38px; height: 4px; border-radius: 999px; background: #cfd3dc; margin: 0 auto 12px; display: block; }
.lg-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
.lg-title { font-size: 15px; font-weight: 900; color: var(--text-main); margin: 0; letter-spacing: -0.25px; }
.lg-subtitle { font-size: 11px; font-weight: 750; color: var(--text-soft); margin-top: 3px; text-transform: uppercase; }
.lg-close {
  width: 36px; height: 36px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main);
  font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 10px;
  cursor: pointer; transition: .15s ease; flex-shrink: 0;
}
.lg-close:hover { background: #f0f2f5; border-color: #cbd5e1; }

.lg-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #f3f5fb; border-radius: 999px; padding: 3px; margin: 0 0 12px; border: 1px solid #e2e7f0; }
.lg-tab-btn { border: 0; border-radius: 999px; padding: 8px 8px; font-size: 12px; font-weight: 900; background: transparent; color: var(--text-main); transition: .18s ease; cursor: pointer; }
.lg-tab-btn.active { background: var(--primary); color: #FFFFFF; box-shadow: 0 6px 14px rgba(25, 25, 112, 0.14); }

.lg-info { padding: 8px 10px; margin-bottom: 10px; color: var(--text-soft); background: #fbfcff; border: 1px solid #e2e7f0; border-radius: 10px; font-size: 11px; font-weight: 800; line-height: 1.4; }

.lg-section-title { font-size: 13px; font-weight: 900; color: var(--text-main); margin-bottom: 9px; }
.lg-total-text { font-size: 12px; font-weight: 750; color: var(--text-soft); margin-bottom: 10px; }
.lg-total-text span { color: var(--text-main); font-weight: 900; }

.lg-field { margin-bottom: 10px; }
.lg-label { display: block; font-size: 11px; font-weight: 900; color: var(--text-main); margin-bottom: 5px; }
.lg-input, .lg-select, .lg-textarea {
  width: 100%; border: 1px solid #dedede; border-radius: 10px; padding: 8px 10px;
  font-size: 12px; font-weight: 650; color: var(--text-main); outline: none; background: #fbfcff;
}
.lg-select, .lg-input { min-height: 36px; }
.lg-date-input { cursor: pointer; }
.lg-date-input::-webkit-calendar-picker-indicator { cursor: pointer; }
.lg-select { padding-right: 34px; }
.lg-input:focus, .lg-select:focus, .lg-textarea:focus { border-color: var(--primary); background: #FFFFFF; box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.lg-input[readonly] { background: #f6f7f9; color: #6b7280; }

.lg-divider { height: 1px; background: #dedede; margin: 14px 0 12px; }
.lg-actions { display: flex; justify-content: flex-end; align-items: center; gap: 9px; }
.lg-cancel-btn { border: 0; background: transparent; color: #6b6380; font-size: 12px; font-weight: 850; padding: 8px 10px; border-radius: 10px; cursor: pointer; }
.lg-cancel-btn:hover { background: #f3f4f6; }
.lg-save-btn { border: 0; background: var(--primary); color: #FFFFFF; font-size: 12px; font-weight: 900; padding: 8px 18px; border-radius: 11px; min-width: 92px; cursor: pointer; }
.lg-save-btn:hover { filter: brightness(1.05); }
.lg-save-btn:disabled, .lg-transfer-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.lg-bb-row { border: 1px solid #e7eaf2; background: #fbfcff; border-radius: 11px; padding: 9px; margin-bottom: 8px; }
.lg-row-title { font-size: 11px; font-weight: 900; color: var(--primary); margin-bottom: 8px; }
.lg-two-col { display: grid; grid-template-columns: 1fr 120px; gap: 8px; }
.lg-origin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lg-transfer-btn { width: 100%; border: 0; background: var(--primary); color: #FFFFFF; min-height: 36px; border-radius: 10px; font-size: 12px; font-weight: 900; cursor: pointer; }
.lg-transfer-btn:hover { filter: brightness(1.05); }

.lg-picker-wrap { position: relative; }
.lg-picker-button {
  width: 100%; min-height: 36px; border-radius: 10px; border: 1px solid #dedede; background: #fbfcff;
  padding: 0 10px; font-size: 12px; font-weight: 650; color: var(--text-main); outline: none;
  display: flex; align-items: center; justify-content: space-between; gap: 7px; cursor: pointer; transition: .18s ease;
}
.lg-picker-button.active { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.lg-picker-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lg-picker-panel {
  display: none; position: absolute; left: 0; right: 0; top: calc(100% + 5px); z-index: 80;
  background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 10px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12); padding: 7px;
}
.lg-picker-panel.show { display: block; }
.lg-picker-search {
  width: 100%; height: 36px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff;
  padding: 0 10px; font-size: 11px; font-weight: 700; outline: none; margin-bottom: 6px;
}
.lg-picker-search:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.lg-option-list { max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.lg-option {
  border: 0; outline: 0; width: 100%; text-align: left; background: #FFFFFF; color: var(--text-main);
  border-radius: 8px; padding: 6px 8px; font-size: 11px; font-weight: 800; cursor: pointer;
  transition: background .18s ease, color .18s ease;
}
.lg-option:hover, .lg-option.selected { background: var(--primary-soft); color: var(--primary); }
.lg-empty-result { padding: 7px; color: var(--text-soft); font-size: 10px; font-weight: 800; }

.lg-busy { opacity: 0.6; pointer-events: none; }

.sailendra-toast-wrap {
  position: fixed; top: 18px; right: 18px; z-index: 3000;
  display: flex; flex-direction: column; gap: 10px;
  width: min(360px, calc(100vw - 32px)); pointer-events: none;
}
.sailendra-toast {
  pointer-events: auto; background: #FFFFFF; border: 1px solid #e5e7eb;
  border-left: 5px solid var(--primary); border-radius: 14px;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16); padding: 12px 13px;
  display: flex; align-items: flex-start; gap: 10px;
  animation: sailendraToastIn .22s ease-out;
}
.sailendra-toast-icon {
  width: 28px; height: 28px; border-radius: 999px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px;
}
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
@keyframes sailendraToastIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 768px) {
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}

@media (max-width: 768px) {
  .lg-modal-body { padding: 14px !important; max-height: 88vh; }
  .lg-two-col, .lg-origin-grid { grid-template-columns: 1fr; }
}
`;

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};

const norm = (v: unknown) => String(v ?? "").toString().trim();

const getLokasiLabel = (item: LokasiRow) =>
  norm(item.kategori || item.nama_lokasi || "-").toUpperCase();

const getLineLabel = (item: TransferLine) => {
  const block = norm(item.kode_block || "");
  const line = norm(item.nomor_line || "");
  if (block !== "" && line !== "") return `Block ${block} - Line ${line}`;
  return "-";
};

const parseLineLabel = (label: string) => {
  const text = norm(label);
  const m = text.match(/Block\s+(.+?)\s*-\s*Line\s+([0-9]+)/i);
  if (m) {
    return { block: `Block ${norm(m[1]).replace("-", "").trim()}`, line: `Line ${norm(m[2])}` };
  }
  return { block: "Block", line: "Line" };
};

export default function LineEditModal({
  edit,
  session,
  lokasiList,
  blockList,
  onClose,
  onChanged,
}: LineEditModalProps) {
  const [tab, setTab] = useState<"bb" | "transfer">("bb");
  const [plantOptions, setPlantOptions] = useState<PlantRow[]>([]);
  const [plantMap, setPlantMap] = useState<Record<string, string>>({});
  const [bbRows, setBbRows] = useState<BbRow[]>(() =>
    edit.bbItems.map((b) => ({
      ...b,
      date: norm(b.best_before),
      plant: "",
      qty: String(b.jumlah),
      alasan: "",
    }))
  );
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [lokasiTujuan, setLokasiTujuan] = useState("");
  const [blockTujuan, setBlockTujuan] = useState("");
  const [lineTujuan, setLineTujuan] = useState("");
  const [qtyTransfer, setQtyTransfer] = useState("");
  const [selectedBb, setSelectedBb] = useState<BbItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [transferLines, setTransferLines] = useState<TransferLine[]>([]);

  const idLokasiTujuan = angka(lokasiTujuan);
  const idBlockTujuan = angka(blockTujuan);

  const notify = useCallback((type: string, title: string, msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, title, msg }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, type === "error" ? 9000 : type === "warning" ? 7000 : 6000);
  }, []);

  useEffect(() => {
    apiGet<PlantRow[]>("/plant")
      .then((r) => setPlantOptions(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiGet<{ id_stok: number; id_plant: string }[]>(
      `/layout-gudang/ambil-plant-line?id_pengguna_lokasi=${encodeURIComponent(
        String(session.user.id_pengguna_lokasi || "")
      )}&id_line=${edit.idLine}`
    )
      .then((r) => {
        const map: Record<string, string> = {};
        (r.data || []).forEach((i) => {
          map[String(i.id_stok)] = i.id_plant;
        });
        setPlantMap(map);
      })
      .catch(() => {});
  }, [edit.idLine, session.user.id_pengguna_lokasi]);

  useEffect(() => {
    const list: TransferLine[] = [];
    Promise.all(
      blockList.map((b) =>
        apiGet<{ id_line: number; nomor_line: number }[]>(
          `/line?id_pengguna_lokasi=${encodeURIComponent(
            String(session.user.id_pengguna_lokasi || "")
          )}&id_block=${b.id_block}`
        )
          .then((r) => {
            (r.data || []).forEach((l) => {
              list.push({ id_line: l.id_line, id_block: b.id_block, kode_block: b.kode_block, nomor_line: l.nomor_line });
            });
          })
          .catch(() => {})
      )
    ).then(() => setTransferLines(list));
  }, [blockList, session.user.id_pengguna_lokasi]);

  const origin = parseLineLabel(edit.lineLabel);

  const blockTujuanOptions = blockList.filter(
    (b) => angka(b.id_lokasi ?? 0) === 0 || angka(b.id_lokasi ?? 0) === idLokasiTujuan
  );

  const lineTujuanOptions = transferLines.filter(
    (l) => l.id_block === idBlockTujuan && l.id_line !== edit.idLine
  );

  const submitBb = async () => {
    if (edit.idLine <= 0 || bbRows.length === 0) {
      notify("warning", "Data belum lengkap", "Data stok belum tersedia.");
      return;
    }

    const requests: Record<string, string | number>[] = [];
    const plantRequests: Record<string, string | number>[] = [];
    let adaUbahBb = false;
    let adaUbahQty = false;
    let adaUbahAlasan = false;
    let adaUbahPlant = false;

    for (let index = 0; index < bbRows.length; index++) {
      const row = bbRows[index];
      const idStok = angka(row.id_stok);
      const bbAwal = norm(row.best_before);
      const qtyAwal = angka(row.jumlah);
      const qtyPrimary = angka(row.qty_primary);
      const minQtyAllowed = angka(row.min_qty_allowed);

      const bbBaru = norm(row.date);
      const qtyBaruText = norm(row.qty);
      const qtyBaru = angka(qtyBaruText);
      const catatanAlasan = norm(row.alasan);

      const bbBerubah = bbBaru !== "" && bbBaru !== bbAwal;
      const qtyBerubah = qtyBaruText !== "" && qtyBaru !== qtyAwal;
      const alasanBerubah = catatanAlasan !== "";

      if (idStok <= 0) {
        notify("error", "Data stok tidak valid", `ID stok pada BB ${index + 1} tidak valid.`);
        return;
      }

      if ((bbBerubah || qtyBerubah) && !catatanAlasan) {
        notify("warning", "Alasan wajib", `Isi alasan perubahan pada BB ${index + 1}.`);
        return;
      }

      if (!bbBerubah && !qtyBerubah && !alasanBerubah) {
        const plantAwal = norm(plantMap[String(idStok)]);
        const plantBaru = norm(row.plant);
        if (plantBaru !== "" && plantBaru !== plantAwal) {
          plantRequests.push({
            id_stok: idStok,
            id_produk: edit.idProduk,
            best_before: bbBaru !== "" ? bbBaru : bbAwal,
            id_plant: plantBaru,
            catatan_perubahan: catatanAlasan || `Plant ${plantAwal} -> ${plantBaru}`,
          });
          adaUbahPlant = true;
        }
        continue;
      }

      if (qtyBerubah && qtyBaru <= 0) {
        notify("warning", "Jumlah tidak valid", `Jumlah baru pada BB ${index + 1} harus lebih dari 0.`);
        return;
      }

      if (qtyBerubah && qtyBaru < minQtyAllowed) {
        notify(
          "warning",
          "Jumlah tidak valid",
          `Jumlah baru untuk BB ${bbAwal} minimal ${minQtyAllowed} karena ada stok inbound lain dengan tanggal yang sama.`
        );
        return;
      }

      if (bbBerubah) adaUbahBb = true;
      if (qtyBerubah) adaUbahQty = true;
      if (alasanBerubah) adaUbahAlasan = true;

      let qtyKirim = qtyBaru;
      if (qtyBerubah) {
        qtyKirim = Math.max(0, qtyBaru - (qtyAwal - qtyPrimary));
      }

      requests.push({
        id_line: edit.idLine,
        id_stok: idStok,
        qty_baru: qtyBerubah ? qtyKirim : "",
        best_before_baru: bbBerubah ? bbBaru : "",
        catatan_perubahan: catatanAlasan,
      });

      const plantAwal = norm(plantMap[String(idStok)]);
      const plantBaru = norm(row.plant);
      if (plantBaru !== "" && plantBaru !== plantAwal) {
        plantRequests.push({
          id_stok: idStok,
          id_produk: edit.idProduk,
          best_before: bbBaru !== "" ? bbBaru : bbAwal,
          id_plant: plantBaru,
          catatan_perubahan: catatanAlasan || `Plant ${plantAwal} -> ${plantBaru}`,
        });
        adaUbahPlant = true;
      }
    }

    if (requests.length === 0 && plantRequests.length === 0) {
      notify("warning", "Tidak ada perubahan", "Tidak ada perubahan yang disimpan.");
      return;
    }

    const base = {
      id_pengguna_lokasi: String(session.user.id_pengguna_lokasi || ""),
      nama_pengguna: norm(session.user.username),
    };

    setBusy(true);
    try {
      for (const d of requests) {
        await apiPost("/layout-gudang/ubah-bb-jumlah-line", { ...base, ...d });
      }
      for (const d of plantRequests) {
        await apiPost("/layout-gudang/ubah-plant-line", { ...base, ...d });
      }

      let pesan = "Perubahan stok berhasil disimpan.";
      if (adaUbahBb && adaUbahQty && adaUbahPlant) pesan = "Best before, jumlah, dan plant berhasil diperbarui.";
      else if (adaUbahBb && adaUbahQty) pesan = "Best before dan jumlah stok berhasil diperbarui.";
      else if (adaUbahBb && adaUbahPlant) pesan = "Best before dan plant berhasil diperbarui.";
      else if (adaUbahQty && adaUbahPlant) pesan = "Jumlah stok dan plant berhasil diperbarui.";
      else if (adaUbahBb) pesan = "Best before berhasil diperbarui.";
      else if (adaUbahQty) pesan = "Jumlah stok berhasil diperbarui.";
      else if (adaUbahPlant) pesan = "Plant berhasil diperbarui.";
      else if (adaUbahAlasan) pesan = "Catatan perubahan berhasil disimpan.";

      notify("success", "Berhasil disimpan", pesan);
      setBusy(false);
      onChanged();
    } catch (e) {
      setBusy(false);
      notify("error", "Gagal menyimpan", (e as Error).message || "Gagal menyimpan perubahan.");
    }
  };

  const submitTransfer = async () => {
    const idStok = angka(selectedBb?.id_stok || 0);
    const bestBefore = norm(selectedBb?.best_before || "");
    const qty = angka(qtyTransfer);

    if (edit.idLine <= 0 || idStok <= 0 || !bestBefore) {
      notify("warning", "Best before belum sesuai", "Best before yang dipilih tidak ditemukan di stok line ini.");
      return;
    }

    if (idLokasiTujuan <= 0) {
      notify("warning", "Lokasi tidak valid", "Pilih lokasi tujuan.");
      return;
    }

    if (idBlockTujuan <= 0) {
      notify("warning", "Block tidak valid", "Pilih block tujuan.");
      return;
    }

    if (angka(lineTujuan) <= 0) {
      notify("warning", "Line tidak valid", "Pilih line tujuan.");
      return;
    }

    if (edit.idLine === angka(lineTujuan)) {
      notify("warning", "Line tidak valid", "Line asal dan line tujuan tidak boleh sama.");
      return;
    }

    if (qty <= 0) {
      notify("warning", "Jumlah tidak valid", "Jumlah transfer wajib lebih dari 0.");
      return;
    }

    setBusy(true);
    try {
      await apiPost("/layout-gudang/transfer-stok-line", {
        id_pengguna_lokasi: String(session.user.id_pengguna_lokasi || ""),
        id_pengguna: angka(session.user.id_pengguna),
        id_line_asal: edit.idLine,
        id_line_tujuan: angka(lineTujuan),
        id_stok: idStok,
        qty: qty,
        best_before: bestBefore,
      });
      notify("success", "Transfer berhasil", "Stok berhasil ditransfer.");
      setBusy(false);
      onChanged();
    } catch (e) {
      setBusy(false);
      notify("error", "Transfer gagal", (e as Error).message || "Gagal transfer stok.");
    }
  };

  const filterBb = bbRows.filter(
    (b) => b.best_before.toLowerCase().indexOf(pickerSearch.trim().toLowerCase()) !== -1
  );

  const closeOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !busy) onClose();
  };

  return (
    <>
      <style>{css}</style>
      <div className="lg-modal-overlay" onClick={closeOverlay}>
        <div className="lg-modal">
          <div className={`lg-modal-body ${busy ? "lg-busy" : ""}`}>
            <span className="lg-topbar"></span>

            <div className="lg-header">
              <div>
                <h3 className="lg-title">Edit {edit.lineLabel}</h3>
                <div className="lg-subtitle">{edit.product}</div>
              </div>
              <button type="button" className="lg-close" onClick={onClose} aria-label="Close">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="lg-tabs">
              <button
                type="button"
                className={`lg-tab-btn ${tab === "bb" ? "active" : ""}`}
                onClick={() => setTab("bb")}
              >
                BB
              </button>
              <button
                type="button"
                className={`lg-tab-btn ${tab === "transfer" ? "active" : ""}`}
                onClick={() => setTab("transfer")}
              >
                Transfer Stok
              </button>
            </div>

            {bbRows.length === 0 && (
              <div className="lg-info">
                Line ini belum memiliki stok, jadi BB dan transfer stok belum bisa dilakukan.
              </div>
            )}

            {tab === "bb" && (
              <div>
                <div className="lg-section-title">Best before di line ini</div>

                {bbRows.length === 0 ? (
                  <div className="lg-info">Stok BB belum tersedia.</div>
                ) : (
                  bbRows.map((row, index) => {
                    const idStok = angka(row.id_stok);
                    return (
                      <div className="lg-bb-row" key={idStok} data-row={idStok}>
                        <div className="lg-row-title">BB {index + 1}</div>

                        <div className="lg-two-col">
                          <div>
                            <label className="lg-label">Best before</label>
                            <input
                              type="date"
                              className="lg-input lg-date-input bb-row-date"
                              value={row.date}
                              onChange={(e) => setBbRows((rs) => rs.map((r) => (r.id_stok === idStok ? { ...r, date: e.target.value } : r)))}
                            />
                          </div>
                          <div>
                            <label className="lg-label">Jumlah</label>
                            <input
                              type="number"
                              min="0"
                              className="lg-input bb-row-qty"
                              value={row.qty}
                              onChange={(e) => setBbRows((rs) => rs.map((r) => (r.id_stok === idStok ? { ...r, qty: e.target.value } : r)))}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <label className="lg-label">Plant</label>
                          <select
                            className="lg-input lg-select bb-row-plant"
                            style={{ height: 34, fontSize: 11 }}
                            value={row.plant || norm(plantMap[String(idStok)])}
                            onChange={(e) => setBbRows((rs) => rs.map((r) => (r.id_stok === idStok ? { ...r, plant: e.target.value } : r)))}
                          >
                            <option value="">-- Plant --</option>
                            {plantOptions.map((p) => (
                              <option key={p.id_plant} value={p.id_plant}>
                                {p.id_plant} - {p.nama_plant || ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <label className="lg-label">Alasan Perubahan</label>
                          <textarea
                            className="lg-input lg-textarea bb-row-alasan"
                            rows={2}
                            placeholder="Tulis alasan perubahan"
                            value={row.alasan}
                            onChange={(e) => setBbRows((rs) => rs.map((r) => (r.id_stok === idStok ? { ...r, alasan: e.target.value } : r)))}
                          ></textarea>
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="lg-divider"></div>

                <div className="lg-actions">
                  <button type="button" className="lg-cancel-btn" onClick={onClose}>
                    Tutup
                  </button>
                  <button type="button" className="lg-save-btn" onClick={submitBb}>
                    Simpan
                  </button>
                </div>
              </div>
            )}

            {tab === "transfer" && (
              <div>
                <div className="lg-total-text">
                  Total stok di line ini: <span>{edit.total}</span>
                </div>

                <div className="lg-field">
                  <label className="lg-label">Jumlah yang dipindah</label>
                  <input
                    type="number"
                    className="lg-input"
                    min="1"
                    value={qtyTransfer}
                    onChange={(e) => setQtyTransfer(e.target.value)}
                  />
                </div>

                <div className="lg-field">
                  <label className="lg-label">Pilih best before yang dipindah</label>
                  <div className="lg-picker-wrap">
                    <button
                      type="button"
                      className={`lg-picker-button ${pickerOpen ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPickerOpen((v) => !v);
                      }}
                    >
                      <span className="lg-picker-text">{selectedBb ? selectedBb.best_before : "Pilih BB"}</span>
                      <i className="bi bi-chevron-down"></i>
                    </button>

                    {pickerOpen && (
                      <div className="lg-picker-panel show" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="lg-picker-search"
                          placeholder="Cari BB"
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          autoComplete="off"
                        />
                        <div className="lg-option-list">
                          {filterBb.length === 0 && <div className="lg-empty-result">Tidak ada BB tersedia</div>}
                          {filterBb.map((b) => (
                            <button
                              key={b.id_stok}
                              type="button"
                              className={`lg-option ${selectedBb?.id_stok === b.id_stok ? "selected" : ""}`}
                              onClick={() => {
                                setSelectedBb(b);
                                setQtyTransfer((prev) => (angka(prev) <= 0 ? String(b.jumlah) : prev));
                                setPickerOpen(false);
                              }}
                            >
                              {b.best_before}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg-field">
                  <label className="lg-label">Dari</label>
                  <div className="lg-origin-grid">
                    <input type="text" className="lg-input" value={origin.block} readOnly />
                    <input type="text" className="lg-input" value={origin.line} readOnly />
                  </div>
                </div>

                <div className="lg-field">
                  <label className="lg-label">Ke</label>
                  <select
                    className="lg-select"
                    style={{ marginBottom: 8 }}
                    value={lokasiTujuan}
                    onChange={(e) => {
                      setLokasiTujuan(e.target.value);
                      setBlockTujuan("");
                      setLineTujuan("");
                    }}
                  >
                    <option value="">Lokasi tujuan</option>
                    {lokasiList.map((l) => (
                      <option key={l.id_lokasi} value={l.id_lokasi}>
                        {getLokasiLabel(l)}
                      </option>
                    ))}
                  </select>

                  <div className="lg-origin-grid">
                    <select
                      className="lg-select"
                      value={blockTujuan}
                      disabled={idLokasiTujuan <= 0}
                      onChange={(e) => {
                        setBlockTujuan(e.target.value);
                        setLineTujuan("");
                      }}
                    >
                      <option value="">Block tujuan</option>
                      {blockTujuanOptions.map((b) => (
                        <option key={b.id_block} value={b.id_block}>
                          Block {norm(b.kode_block).toUpperCase()}
                        </option>
                      ))}
                    </select>

                    <select
                      className="lg-select"
                      value={lineTujuan}
                      disabled={idBlockTujuan <= 0}
                      onChange={(e) => setLineTujuan(e.target.value)}
                    >
                      <option value="">Line tujuan</option>
                      {lineTujuanOptions.map((l) => (
                        <option key={l.id_line} value={l.id_line}>
                          {getLineLabel(l)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="button" className="lg-transfer-btn" onClick={submitTransfer}>
                  Transfer stok
                </button>

                <div className="lg-divider"></div>

                <div className="lg-actions">
                  <button type="button" className="lg-cancel-btn" onClick={onClose}>
                    Tutup
                  </button>
                  <button type="button" className="lg-save-btn" onClick={submitTransfer}>
                    Simpan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sailendra-toast-wrap" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`sailendra-toast ${t.type}`}>
            <div className="sailendra-toast-icon">
              <i className={`bi ${t.type === "success" ? "bi-check-circle-fill" : t.type === "warning" ? "bi-exclamation-triangle-fill" : t.type === "error" ? "bi-x-circle-fill" : "bi-info-circle-fill"}`}></i>
            </div>
            <div className="sailendra-toast-content">
              <div className="sailendra-toast-title">{t.title}</div>
              <div className="sailendra-toast-message">{t.msg}</div>
            </div>
            <button
              type="button"
              className="sailendra-toast-close"
              aria-label="Tutup"
              onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
