"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { isMultiRole, useSession } from "@/lib/auth";

type LokasiRow = { id_lokasi: number; nama_lokasi?: string; kategori?: string };
type LokProfile = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };
type ProdukRow = { id_produk: number; nama_produk: string };

const css = `
.layout-form-page { display: flex; flex-direction: column; gap: 7px; padding: 0 0 12px 0; }
#layoutGudangForm { display: flex; flex-direction: column; gap: 8px; }

.layout-form-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; padding: 10px 12px; margin-bottom: 0; }
.layout-alert { border-radius: 11px; padding: 8px 10px; font-size: 11px; font-weight: 800; }
.layout-alert.success { background: #edf8f0; color: #2f8f46; border: 1px solid #bfe8c9; }
.layout-alert.error { background: #fff0f0; color: #d33b3e; border: 1px solid #efc0c1; }

.form-section-title { font-size: 13px; font-weight: 900; color: var(--primary); margin-bottom: 8px; letter-spacing: -0.25px; }
.form-label-custom { font-size: 10px; font-weight: 800; color: var(--text-main); margin-bottom: 4px; display: block; }

.form-control-custom, .form-select-custom {
  width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0;
  background-color: #fbfcff; padding: 0 31px 0 10px; font-size: 11px;
  font-weight: 700; color: var(--text-main); outline: none;
}
.form-select-custom { appearance: none; -webkit-appearance: none; -moz-appearance: none; background-image: none; }
.select-custom-wrap { position: relative; }
.select-custom-wrap .form-select-custom { padding-right: 34px; }
.select-custom-wrap .select-custom-icon {
  position: absolute; top: 50%; right: 12px; transform: translateY(-50%);
  font-size: 11px; color: var(--text-main); pointer-events: none;
}
.form-control-custom::placeholder { color: #8a93a3; font-weight: 650; }
.form-control-custom:focus, .form-select-custom:focus {
  background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07);
}
.helper-text { font-size: 10px; font-weight: 650; color: var(--text-soft); margin-top: 4px; line-height: 1.3; }

.line-preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.line-config-card { border: 1px solid #e9edf5; border-radius: 10px; background: #fcfdff; padding: 8px; }
.line-config-title { font-size: 11px; font-weight: 900; color: var(--text-main); margin-bottom: 7px; }
.level-config-box { border: 1px solid #e9edf5; border-radius: 10px; padding: 7px; margin-top: 6px; background: #FFFFFF; }
.level-config-title { font-size: 11px; font-weight: 900; color: var(--primary); margin-bottom: 6px; }

.layout-submit-wrap { padding-top: 0; }
.submit-layout-btn {
  width: 100%; border: 0; outline: 0; border-radius: 9px; background: var(--primary); color: #FFFFFF;
  min-height: 33px; padding: 7px 11px; font-size: 11px; font-weight: 900;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: transform .18s ease, box-shadow .18s ease; cursor: pointer;
}
.submit-layout-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25, 25, 112, 0.15); }
.submit-layout-btn:disabled { background: #b9beca; cursor: not-allowed; transform: none; box-shadow: none; opacity: 0.75; }

.line-error-text { display: none; margin-top: 6px; font-size: 10px; font-weight: 800; color: #d33b3e; }
.line-error-text.show { display: block; }
.form-empty-info { border: 1px dashed #dfe5ef; background: #fcfdff; color: var(--text-soft); font-weight: 700; border-radius: 9px; padding: 8px 9px; font-size: 10px; }

.product-picker-wrap { position: relative; }
.product-picker-button {
  width: 100%; min-height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff;
  padding: 0 10px; font-size: 11px; font-weight: 800; color: var(--text-main); outline: none;
  display: flex; align-items: center; justify-content: space-between; gap: 7px; cursor: pointer;
}
.product-picker-button.active { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.product-picker-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.product-picker-panel {
  display: none; position: absolute; left: 0; right: 0; top: calc(100% + 5px); z-index: 80;
  background: #FFFFFF; border: 1px solid #e2e7f0; border-radius: 10px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12); padding: 7px;
}
.product-picker-panel.show { display: block; }
.product-search-input {
  width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff;
  padding: 0 10px; font-size: 11px; font-weight: 700; outline: none; margin-bottom: 6px;
}
.product-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.product-option-list { max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.product-option {
  border: 0; outline: 0; width: 100%; text-align: left; background: #FFFFFF; color: var(--text-main);
  border-radius: 8px; padding: 6px 8px; font-size: 10px; font-weight: 750;
  display: flex; align-items: flex-start; cursor: pointer;
}
.product-option:hover, .product-option.selected { background: var(--primary-soft); color: var(--primary); }
.product-option-label { flex: 1; min-width: 0; color: inherit; font-weight: 800; line-height: 1.3; }
.product-empty-result { padding: 8px; color: var(--text-soft); font-size: 11px; font-weight: 800; text-align: center; }

.pick-card { padding: 12px 14px; }
.pick-card form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pick-card label { font-size: 11px; font-weight: 850; color: var(--text-main); }
.pick-card select {
  height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid #e2e7f0;
  background: #fbfcff; font-size: 11px; font-weight: 750; color: var(--text-main);
  outline: none; cursor: pointer;
}

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

@media (max-width: 992px) { .line-preview-grid { grid-template-columns: 1fr; } }
@media (max-width: 576px) {
  .layout-form-card { padding: 12px; border-radius: 12px; }
  .form-section-title { font-size: 15px; }
  .form-control-custom, .form-select-custom, .product-picker-button, .product-search-input { height: 34px; min-height: 34px; font-size: 12px; }
}
`;

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};

const SPECIAL_TYPES = ["MOBIL", "RECEH", "TRANSIT", "BADSTOCK", "REJECT"];

type LevelCfg = { jumlah: string; kapasitas: string };
type LineCfg = {
  line: number;
  levelDari: string;
  levelSampai: string;
  levels: Record<number, LevelCfg>;
};

export default function FormLayoutGudangPage() {
  const session = useSession();
  const isMulti = !!session && isMultiRole(session.user.role);

  const [semuaLokasi, setSemuaLokasi] = useState<LokProfile[]>([]);
  const [penggunaLokasi, setPenggunaLokasi] = useState("");
  const [lokasiList, setLokasiList] = useState<LokasiRow[]>([]);
  const [produkList, setProdukList] = useState<ProdukRow[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedProduk, setSelectedProduk] = useState<{ id: number; label: string } | null>(null);

  const [idLokasi, setIdLokasi] = useState("");
  const [kodeBlockType, setKodeBlockType] = useState("reguler");
  const [kodeBlock, setKodeBlock] = useState("");

  const [lineDari, setLineDari] = useState("");
  const [lineSampai, setLineSampai] = useState("");
  const [lineBentrok, setLineBentrok] = useState(false);
  const [lineError, setLineError] = useState("");
  const [configs, setConfigs] = useState<Record<number, LineCfg>>({});

  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const cekTimer = useRef<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    apiGet<LokasiRow[]>("/lokasi")
      .then((r) => {
        if (cancelled) return;
        setLokasiList((r.data || []).sort((a, b) => angka(a.id_lokasi) - angka(b.id_lokasi)));
      })
      .catch(() => {});
    apiGet<ProdukRow[]>("/produk")
      .then((r) => {
        if (cancelled) return;
        setProdukList((r.data || []).sort((a, b) => angka(a.id_produk) - angka(b.id_produk)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const cekLineTerpakai = () => {
    if (cekTimer.current) window.clearTimeout(cekTimer.current);
    cekTimer.current = window.setTimeout(() => {
      const lok = angka(idLokasi);
      const block = kodeBlock.trim();
      const dari = angka(lineDari);
      const sampai = angka(lineSampai);
      if (!lok || !block || dari <= 0 || sampai <= 0 || sampai < dari) {
        setLineBentrok(false);
        setLineError("");
        return;
      }
      const params = new URLSearchParams({
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_lokasi: String(lok),
        kode_block: block,
        line_dari: String(dari),
        line_sampai: String(sampai),
      });
      apiGet<{ bentrok: boolean; message?: string }>(`/layout-gudang/cek-line-layout?${params.toString()}`)
        .then((r) => {
          const d = r.data as { bentrok: boolean; message?: string } | undefined;
          const bentrok = !!d?.bentrok;
          setLineBentrok(bentrok);
          setLineError(bentrok ? d?.message || "Line sudah terpakai, Silakan pakai line lain." : "");
        })
        .catch(() => {
          setLineBentrok(false);
          setLineError("");
        });
    }, 300);
  };

  const penggunaLokasiFinal = isMulti
    ? penggunaLokasi
    : String(session?.user.id_pengguna_lokasi || "");

  const syncKodeBlockType = (type: string) => {
    if (type === "reguler") {
      if (SPECIAL_TYPES.includes(kodeBlock.toUpperCase()) || kodeBlock.toUpperCase() === "REGULER") {
        setKodeBlock("");
      }
    } else {
      setKodeBlock(type);
    }
  };

  const lineNumbers: number[] = (() => {
    const dari = angka(lineDari);
    const sampai = angka(lineSampai);
    if (dari <= 0 || sampai <= 0 || sampai < dari) return [];
    const out: number[] = [];
    for (let i = dari; i <= sampai; i++) out.push(i);
    return out;
  })();

  const levelNumbersFor = (line: number): number[] => {
    const cfg = configs[line];
    if (!cfg) return [];
    const dari = angka(cfg.levelDari);
    const sampai = angka(cfg.levelSampai);
    if (dari <= 0 || sampai <= 0 || sampai < dari) return [];
    const out: number[] = [];
    for (let i = dari; i <= sampai; i++) out.push(i);
    return out;
  };

  const setLevelRange = (line: number, field: "levelDari" | "levelSampai", value: string) => {
    setConfigs((prev) => {
      const cur = prev[line] || { line, levelDari: "", levelSampai: "", levels: {} };
      return { ...prev, [line]: { ...cur, [field]: value } };
    });
  };

  const setLevelField = (line: number, level: number, field: keyof LevelCfg, value: string) => {
    setConfigs((prev) => {
      const cur = prev[line] || { line, levelDari: "", levelSampai: "", levels: {} };
      const lv = cur.levels[level] || { jumlah: "", kapasitas: "" };
      return { ...prev, [line]: { ...cur, levels: { ...cur.levels, [level]: { ...lv, [field]: value } } } };
    });
  };

  const buildLayoutConfig = () => {
    const result: { line: number; levels: { level: number; jumlah_deep: number; kapasitas: number }[] }[] = [];
    lineNumbers.forEach((line) => {
      const cfg = configs[line];
      const lvNumbers = levelNumbersFor(line);
      if (!cfg || lvNumbers.length === 0) return;
      const levels = lvNumbers.map((level) => {
        const lv = cfg.levels[level] || { jumlah: "", kapasitas: "" };
        return { level, jumlah_deep: angka(lv.jumlah), kapasitas: angka(lv.kapasitas) };
      });
      result.push({ line, levels });
    });
    return result;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineBentrok) return;

    if (!selectedProduk) {
      setAlert({ type: "error", msg: "Pilih produk terlebih dahulu." });
      setPickerOpen(true);
      return;
    }

    const config = buildLayoutConfig();
    if (!config.length) {
      setAlert({ type: "error", msg: "Isi line, level, jumlah deep, dan kapasitas terlebih dahulu." });
      return;
    }

    for (const c of config) {
      if (!c.levels.length) {
        setAlert({ type: "error", msg: `Line ${c.line}: isi level terlebih dahulu.` });
        return;
      }
      for (const lv of c.levels) {
        if (lv.jumlah_deep <= 0 || lv.kapasitas <= 0) {
          setAlert({ type: "error", msg: `Line ${c.line} Level ${lv.level}: jumlah deep dan kapasitas wajib lebih dari 0.` });
          return;
        }
      }
    }

    setBusy(true);
    try {
      await apiPost("/layout-gudang/simpan-layout", {
        role: session?.user.role || "",
        id_pengguna_lokasi: penggunaLokasiFinal,
        id_lokasi: angka(idLokasi),
        id_produk: selectedProduk.id,
        kode_block: kodeBlock.toUpperCase(),
        layout_config: config,
      });
      setAlert({ type: "success", msg: "Layout gudang berhasil disimpan." });
      setConfigs({});
      setSelectedProduk(null);
      setKodeBlock("");
      setKodeBlockType("reguler");
      setLineDari("");
      setLineSampai("");
    } catch (err) {
      setAlert({ type: "error", msg: (err as Error).message || "Gagal menyimpan layout." });
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const labelLokasi = (r: LokasiRow) =>
    String(r.kategori || r.nama_lokasi || "").trim().toUpperCase();

  const filteredProduk = produkList.filter((p) => {
    const q = pickerSearch.trim().toUpperCase();
    if (!q) return true;
    return `${p.id_produk} - ${p.nama_produk}`.toUpperCase().indexOf(q) !== -1;
  });

  return (
    <>
      <style>{css}</style>

      {isMulti && !!semuaLokasi.length && (
        <div className="layout-form-card pick-card">
          <form onSubmit={(e) => e.preventDefault()}>
            <label>Pilih Lokasi/Depo:</label>
            <select
              value={penggunaLokasi}
              onChange={(e) => setPenggunaLokasi(e.target.value)}
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

      <div className="layout-form-page">
        {alert && (
          <div className={`layout-alert ${alert.type}`}>{alert.msg}</div>
        )}

        <form onSubmit={submit} id="layoutGudangForm">
          <div className="layout-form-card">
            <div className="form-section-title">1. Produk</div>

            <div className="mb-3">
              <label className="form-label-custom">Produk</label>

              <div className="product-picker-wrap" ref={pickerRef}>
                <button
                  type="button"
                  className={`product-picker-button ${pickerOpen ? "active" : ""}`}
                  onClick={() => setPickerOpen((v) => !v)}
                >
                  <span className="product-picker-text">{selectedProduk ? selectedProduk.label : "Pilih produk"}</span>
                  <i className="bi bi-chevron-down"></i>
                </button>

                {pickerOpen && (
                  <div className="product-picker-panel show">
                    <input
                      type="text"
                      className="product-search-input"
                      placeholder="Cari ID atau nama produk"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      autoComplete="off"
                    />
                    <div className="product-option-list">
                      {filteredProduk.length === 0 && <div className="product-empty-result">Produk tidak ditemukan</div>}
                      {filteredProduk.map((p) => (
                        <button
                          key={p.id_produk}
                          type="button"
                          className={`product-option ${selectedProduk?.id === angka(p.id_produk) ? "selected" : ""}`}
                          onClick={() => {
                            setSelectedProduk({ id: angka(p.id_produk), label: `${p.id_produk} - ${p.nama_produk}` });
                            setPickerOpen(false);
                          }}
                        >
                          <span className="product-option-label">{p.id_produk} - {p.nama_produk}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="helper-text">Satu kali simpan hanya untuk satu produk.</div>
            </div>
          </div>

          <div className="layout-form-card">
            <div className="form-section-title">2. Lokasi &amp; Block</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div>
                <label className="form-label-custom">Lokasi</label>
                <div className="select-custom-wrap">
                  <select
                    className="form-select-custom"
                    value={idLokasi}
                    onChange={(e) => {
                      setIdLokasi(e.target.value);
                      cekLineTerpakai();
                    }}
                  >
                    <option value="">Pilih lokasi</option>
                    {lokasiList.map((l) => (
                      <option key={l.id_lokasi} value={l.id_lokasi}>
                        {labelLokasi(l)}
                      </option>
                    ))}
                  </select>
                  <i className="bi bi-chevron-down select-custom-icon"></i>
                </div>
              </div>

              <div>
                <label className="form-label-custom">Tipe Block</label>
                <div className="select-custom-wrap">
                  <select
                    className="form-select-custom"
                    value={kodeBlockType}
                    onChange={(e) => {
                      setKodeBlockType(e.target.value);
                      syncKodeBlockType(e.target.value);
                      cekLineTerpakai();
                    }}
                  >
                    <option value="reguler">Reguler (isi kode sendiri)</option>
                    {SPECIAL_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <i className="bi bi-chevron-down select-custom-icon"></i>
                </div>
                <div className="helper-text">
                  Pilih &quot;Reguler&quot; untuk blok biasa (contoh A, B, AA, B2) atau pilih tipe khusus dari daftar.
                </div>
              </div>

              <div>
                <label className="form-label-custom">Kode Block</label>
                <input
                  type="text"
                  className="form-control-custom"
                  placeholder="Contoh A, B, AA, B2"
                  value={kodeBlock}
                  readOnly={kodeBlockType !== "reguler"}
                  onChange={(e) => {
                    setKodeBlock(e.target.value);
                    cekLineTerpakai();
                  }}
                />
                {kodeBlockType !== "reguler" && (
                  <div className="helper-text">Kode block otomatis = {kodeBlockType}</div>
                )}
              </div>
            </div>
          </div>

          <div className="layout-form-card">
            <div className="form-section-title">3. Line</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div>
                <label className="form-label-custom">Dari Line</label>
                <input
                  type="number"
                  className="form-control-custom"
                  min="1"
                  placeholder="Contoh 1"
                  value={lineDari}
                  onChange={(e) => {
                    setLineDari(e.target.value);
                    cekLineTerpakai();
                  }}
                />
              </div>
              <div>
                <label className="form-label-custom">Sampai Line</label>
                <input
                  type="number"
                  className="form-control-custom"
                  min="1"
                  placeholder="Contoh 4"
                  value={lineSampai}
                  onChange={(e) => {
                    setLineSampai(e.target.value);
                    cekLineTerpakai();
                  }}
                />
              </div>
            </div>

            <div className="helper-text">
              Contoh: dari 1 sampai 4 berarti sistem membuat Line 1, Line 2, Line 3, dan Line 4.
            </div>
            <div className={`line-error-text ${lineBentrok ? "show" : ""}`}>{lineError}</div>
          </div>

          <div className="layout-form-card">
            <div className="form-section-title">4. Level dan Deep</div>

            <div>
              {lineNumbers.length === 0 ? (
                <div className="form-empty-info">
                  Isi range line terlebih dahulu, lalu form level dan deep akan muncul otomatis.
                </div>
              ) : (
                <div className="line-preview-grid">
                  {lineNumbers.map((line) => {
                    const cfg = configs[line];
                    const lvNumbers = levelNumbersFor(line);
                    return (
                      <div className="line-config-card" key={line} data-line-card={line}>
                        <div className="line-config-title">Line {line}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label-custom">Dari Level</label>
                            <input
                              type="number"
                              min="1"
                              className="form-control-custom"
                              placeholder="Contoh 1"
                              value={cfg?.levelDari ?? ""}
                              onChange={(e) => setLevelRange(line, "levelDari", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="form-label-custom">Sampai Level</label>
                            <input
                              type="number"
                              min="1"
                              className="form-control-custom"
                              placeholder="Contoh 4"
                              value={cfg?.levelSampai ?? ""}
                              onChange={(e) => setLevelRange(line, "levelSampai", e.target.value)}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          {lvNumbers.length === 0 ? (
                            <div className="helper-text">Isi level terlebih dahulu.</div>
                          ) : (
                            lvNumbers.map((level) => (
                              <div className="level-config-box" key={level} data-level-box={level}>
                                <div className="level-config-title">Level {level}</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                  <div>
                                    <label className="form-label-custom">Jumlah Deep</label>
                                    <input
                                      type="number"
                                      min="1"
                                      className="form-control-custom"
                                      placeholder="Contoh 4"
                                      value={cfg?.levels[level]?.jumlah ?? ""}
                                      onChange={(e) => setLevelField(line, level, "jumlah", e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="form-label-custom">Kapasitas per Deep</label>
                                    <input
                                      type="number"
                                      min="1"
                                      className="form-control-custom"
                                      placeholder="Contoh 40"
                                      value={cfg?.levels[level]?.kapasitas ?? ""}
                                      onChange={(e) => setLevelField(line, level, "kapasitas", e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="layout-submit-wrap">
            <button type="submit" className="submit-layout-btn" disabled={busy || lineBentrok}>
              <i className="bi bi-save2"></i>
              <span>Simpan Layout Gudang</span>
            </button>
          </div>
        </form>
      </div>

      {busy && (
        <div className="modal-loading">
          <div className="modal-loading-inner">
            <div className="spinner-loader"></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
              Mohon tunggu, jangan tutup halaman ini.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
