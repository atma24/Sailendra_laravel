"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export type MasterField = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  min?: number;
};

export type MasterColumn = {
  key: string;
  label: string;
  width?: number;
  render: (row: Record<string, unknown>) => React.ReactNode;
};

export type MasterCrudConfig = {
  addLabel: string;
  entityLabel: string;
  endpoint: string;
  idField: string;
  searchPlaceholder: string;
  emptyLabel: string;
  displayName: (row: Record<string, unknown>) => string;
  columns: MasterColumn[];
  fields: MasterField[];
};

const css = `
.master-list-page { display: flex; flex-direction: column; gap: 7px; }
.master-list-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.master-list-toolbar { padding: 8px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; align-items: center; }
.master-search-wrap { position: relative; }
.master-search-icon { position: absolute; top: 50%; left: 11px; transform: translateY(-50%); color: var(--text-soft); font-size: 13px; }
.master-search-input {
  width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff;
  padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none;
}
.master-search-input::placeholder { color: #8a93a3; font-weight: 650; }
.master-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.master-clear-link { position: absolute; top: 50%; right: 10px; transform: translateY(-50%); text-decoration: none; color: var(--text-soft); font-size: 11px; cursor: pointer; border: 0; background: none; }
.master-clear-link:hover { color: var(--primary); }
.master-add-btn {
  height: 31px; border: 0; outline: 0; border-radius: 8px; padding: 0 11px; background: var(--primary);
  color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px;
  text-decoration: none; white-space: nowrap; transition: transform .18s ease, box-shadow .18s ease; cursor: pointer;
}
.master-add-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25, 25, 112, 0.15); }
.master-table-card { overflow: hidden; }
.master-table { width: 100%; border-collapse: collapse; margin: 0; }
.master-table thead th { background: #fbfcff; color: var(--text-soft); font-size: 10px; font-weight: 850; padding: 8px 9px; border-bottom: 1px solid #e9edf5; white-space: nowrap; }
.master-table tbody td { color: var(--text-main); font-size: 11px; font-weight: 700; padding: 8px 9px; border-bottom: 1px solid #f0f2f6; vertical-align: middle; }
.master-table tbody tr:hover { background: #fbfcff; }
.master-id-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 22px; padding: 0 8px; border-radius: 999px; background: var(--primary-soft); color: var(--primary); font-size: 10px; font-weight: 900; }
.master-name-text { max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.master-action-wrap { display: flex; justify-content: flex-end; gap: 5px; }
.master-icon-btn { width: 25px; height: 25px; border: 0; border-radius: 8px; background: var(--primary-soft); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-size: 12px; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; }
.master-icon-btn.danger { background: #fff0f0; color: #ef4444; }
.master-icon-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(15, 23, 42, 0.10); }
.master-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }

.mc-overlay { position: fixed; inset: 0; z-index: 999990; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); padding: 18px; }
.mc-modal { background: #FFFFFF; border-radius: 16px; box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18); overflow: hidden; width: min(440px, 100%); }
.mc-modal-header { border-bottom: 1px solid #edf0f6; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
.mc-modal-title { margin: 0; color: var(--text-main); font-size: 16px; font-weight: 900; }
.mc-modal-close { border: 0; background: transparent; color: var(--text-soft); font-size: 16px; cursor: pointer; }
.mc-modal-body { padding: 16px; }
.mc-form-label { color: var(--text-soft); font-size: 11px; font-weight: 850; margin-bottom: 5px; display: block; }
.mc-form-control { width: 100%; height: 38px; border: 1px solid #e2e7f0; border-radius: 10px; background: #fbfcff; color: var(--text-main); font-size: 12px; font-weight: 750; padding: 0 12px; outline: none; }
.mc-form-control:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.mc-form-control[readonly] { background: #f6f7f9; color: #6b7280; }
.mc-modal-footer { border-top: 1px solid #edf0f6; padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; }
.mc-cancel-btn, .mc-save-btn { border: 0; border-radius: 10px; font-size: 12px; font-weight: 850; padding: 8px 15px; cursor: pointer; }
.mc-cancel-btn { background: #f3f4f6; color: var(--text-soft); }
.mc-save-btn { background: var(--primary); color: #FFFFFF; min-width: 92px; }
.mc-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.mc-confirm-overlay { position: fixed; inset: 0; z-index: 999998; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; padding: 18px; }
.mc-confirm-box { width: min(360px, 100%); background: #FFFFFF; border-radius: 16px; box-shadow: 0 18px 42px rgba(15, 23, 42, 0.22); overflow: hidden; }
.mc-confirm-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #edf0f6; }
.mc-confirm-title { display: flex; align-items: center; gap: 8px; color: var(--text-main); font-size: 14px; font-weight: 900; }
.mc-confirm-title i { color: #f59e0b; }
.mc-confirm-close { width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: #64748b; cursor: pointer; }
.mc-confirm-close:hover { background: #f1f5f9; color: #475569; }
.mc-confirm-body { padding: 16px; color: var(--text-soft); font-size: 12px; font-weight: 750; line-height: 1.45; }
.mc-confirm-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 0 16px 16px; }
.mc-confirm-btn { padding: 9px 16px; border-radius: 10px; font-size: 12px; font-weight: 850; border: none; cursor: pointer; transition: background 0.15s; }
.mc-confirm-btn-cancel { background: #f1f5f9; color: #475569; }
.mc-confirm-btn-cancel:hover { background: #e2e8f0; }
.mc-confirm-btn-ok { background: var(--primary); color: #FFFFFF; }
.mc-confirm-btn-ok:hover { filter: brightness(0.92); }

.sailendra-toast-wrap { position: fixed; top: 18px; right: 18px; z-index: 999999; display: flex; flex-direction: column; gap: 10px; width: min(360px, calc(100vw - 32px)); pointer-events: none; }
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

@media (max-width: 768px) {
  .master-list-toolbar { grid-template-columns: 1fr; }
  .master-table-card { overflow-x: auto; }
  .master-search-input, .master-add-btn { height: 34px; font-size: 12px; }
  .sailendra-toast-wrap { top: 12px; right: 12px; left: 12px; width: auto; }
}
`;

type Toast = { id: number; type: string; title: string; msg: string };
type Confirm = { title: string; msg: string; id: string };

const s = (v: unknown) => String(v ?? "").trim();

export default function MasterCrud({ config }: { config: MasterCrudConfig }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [mode, setMode] = useState<"tambah" | "edit" | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const notify = useCallback((type: string, title: string, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, type, title, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 9000 : type === "warning" ? 7000 : 6000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<Record<string, unknown>[]>(`${config.endpoint}?q=${encodeURIComponent(search)}`)
      .then((r) => { if (!cancelled) setRows(r.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [config.endpoint, search, refresh]);

  const openCreate = () => {
    setMode("tambah");
    const init: Record<string, string> = {};
    config.fields.forEach((f) => { init[f.key] = f.type === "select" ? f.options?.[0] || "" : ""; });
    setValues(init);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setMode("edit");
    const init: Record<string, string> = {};
    config.fields.forEach((f) => { init[f.key] = s(row[f.key]); });
    setValues(init);
  };

  const save = async () => {
    for (const f of config.fields) {
      if (f.type === "select") continue;
      if (s(values[f.key]) === "") { notify("warning", "Data belum lengkap", `Isi ${f.label}.`); return; }
      if (f.type === "number" && parseInt(s(values[f.key]), 10) <= 0) { notify("warning", "Data belum lengkap", `${f.label} harus lebih dari 0.`); return; }
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      config.fields.forEach((f) => { body[f.key] = f.type === "number" ? parseInt(s(values[f.key]), 10) : s(values[f.key]); });
      if (mode === "edit") {
        await api(`${config.endpoint}/${encodeURIComponent(s(values[config.idField]))}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api(config.endpoint, { method: "POST", body: JSON.stringify(body) });
      }
      notify("success", "Berhasil", "Berhasil disimpan.");
      setMode(null);
      setRefresh((v) => v + 1);
    } catch (e) {
      notify("error", "Gagal", (e as Error).message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    setConfirm(null);
    try {
      await api(`${config.endpoint}/${encodeURIComponent(confirm.id)}`, { method: "DELETE", body: JSON.stringify({}) });
      notify("success", "Berhasil", "Berhasil dihapus.");
      setRefresh((v) => v + 1);
    } catch (e) {
      notify("error", "Gagal", (e as Error).message || "Gagal menghapus.");
    }
  };

  return (
    <>
      <style>{css}</style>

      <div className="master-list-page">
        <div className="master-list-card">
          <div className="master-list-toolbar">
            <div className="master-search-wrap">
              <i className="bi bi-search master-search-icon"></i>
              <input
                type="text"
                className="master-search-input"
                placeholder={config.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
              {search !== "" && (
                <button type="button" className="master-clear-link" onClick={() => setSearch("")}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>

            <button type="button" className="master-add-btn" onClick={openCreate}>
              <i className="bi bi-plus-lg"></i>
              <span>{config.addLabel}</span>
            </button>
          </div>
        </div>

        <div className="master-list-card master-table-card">
          {!rows.length ? (
            <div className="master-empty">{config.emptyLabel}</div>
          ) : (
            <table className="master-table">
              <thead>
                <tr>
                  {config.columns.map((c) => (
                    <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
                  ))}
                  <th style={{ width: 120, textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {config.columns.map((c) => (
                      <td key={c.key}>{c.render(row)}</td>
                    ))}
                    <td>
                      <div className="master-action-wrap">
                        <button type="button" className="master-icon-btn" title={`Edit ${config.entityLabel}`} onClick={() => openEdit(row)}>
                          <i className="bi bi-pencil-fill"></i>
                        </button>
                        <button type="button" className="master-icon-btn danger" title={`Hapus ${config.entityLabel}`}
                          onClick={() => setConfirm({
                            title: `Hapus ${config.entityLabel}`,
                            id: s(row[config.idField]),
                            msg: `Yakin ingin menghapus "${config.displayName(row)}"?`,
                          })}>
                          <i className="bi bi-trash3-fill"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {mode && (
        <div className="mc-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) setMode(null); }}>
          <div className="mc-modal">
            <div className="mc-modal-header">
              <h5 className="mc-modal-title">{mode === "edit" ? `Edit ${config.entityLabel}` : config.addLabel}</h5>
              <button type="button" className="mc-modal-close" onClick={() => !saving && setMode(null)} aria-label="Close"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="mc-modal-body">
              {config.fields.map((f) => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label className="mc-form-label" htmlFor={f.key}>{f.label}</label>
                  {f.type === "select" ? (
                    <select className="mc-form-control" id={f.key} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                      {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      className="mc-form-control"
                      id={f.key}
                      min={f.min}
                      readOnly={mode === "edit" && f.key === config.idField}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mc-modal-footer">
              <button type="button" className="mc-cancel-btn" onClick={() => setMode(null)}>Batal</button>
              <button type="button" className="mc-save-btn" disabled={saving} onClick={save}>{saving ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="mc-confirm-overlay">
          <div className="mc-confirm-box">
            <div className="mc-confirm-header">
              <div className="mc-confirm-title"><i className="bi bi-exclamation-triangle-fill"></i><span>{confirm.title}</span></div>
              <button type="button" className="mc-confirm-close" onClick={() => setConfirm(null)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="mc-confirm-body">{confirm.msg}</div>
            <div className="mc-confirm-footer">
              <button type="button" className="mc-confirm-btn mc-confirm-btn-cancel" onClick={() => setConfirm(null)}>Batal</button>
              <button type="button" className="mc-confirm-btn mc-confirm-btn-ok" onClick={doDelete}>Ya, Hapus</button>
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
    </>
  );
}