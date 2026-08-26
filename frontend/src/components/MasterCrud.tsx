"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export type MasterField = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  min?: number;
  maxLength?: number;
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
  searchPlaceholder: string;
  emptyLabel: string;
  endpoint: string;
  idField: string;
  displayName: (row: Record<string, unknown>) => string;
  columns: MasterColumn[];
  fields: MasterField[];
};

const css = `
.master-list-page { display: flex; flex-direction: column; gap: 16px; }
.master-list-card { background: #FFFFFF; border: 1px solid var(--border-light, #E2E8F0); border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.02); }
.master-list-toolbar { padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.master-search-wrap { position: relative; flex: 1; max-width: 420px; min-width: 220px; }
.master-search-icon { position: absolute; top: 50%; left: 14px; transform: translateY(-50%); color: #94A3B8; font-size: 14px; }
.master-search-input {
  width: 100%; height: 38px; border-radius: 10px; border: 1px solid #E2E8F0; background: #F8FAFC;
  padding: 0 36px 0 38px; font-size: 13px; font-weight: 700; color: #0F172A; outline: none; transition: all 0.2s ease;
}
.master-search-input::placeholder { color: #94A3B8; font-weight: 600; }
.master-search-input:focus { background: #FFFFFF; border-color: var(--primary-navy, #191970); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.08); }
.master-clear-link { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); text-decoration: none; color: #94A3B8; font-size: 12px; cursor: pointer; border: 0; background: none; }
.master-clear-link:hover { color: #DC2626; }
.master-add-btn {
  height: 38px; border: 0; outline: 0; border-radius: 10px; padding: 0 16px; background: var(--primary-navy, #191970);
  color: #FFFFFF; font-size: 13px; font-weight: 800; display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none; white-space: nowrap; transition: all .2s ease; cursor: pointer; box-shadow: 0 2px 6px rgba(25, 25, 112, 0.2);
}
.master-add-btn:hover { background: #121254; transform: translateY(-1px); box-shadow: 0 6px 14px rgba(25, 25, 112, 0.3); }
.master-table-card { overflow: hidden; border-radius: 16px; border: 1px solid #E2E8F0; background: #FFFFFF; }
.master-table { width: 100%; border-collapse: collapse; margin: 0; }
.master-table thead th { background: #F8FAFC; color: #475569; font-size: 12px; font-weight: 800; padding: 12px 16px; border-bottom: 1px solid #E2E8F0; text-align: left; white-space: nowrap; }
.master-table tbody td { color: #1E293B; font-size: 13px; font-weight: 600; padding: 12px 16px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
.master-table tbody tr { transition: background 0.15s ease; }
.master-table tbody tr:hover { background: #F8FAFC; }
.master-id-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 24px; padding: 0 10px; border-radius: 999px; background: #EEF2FF; color: var(--primary-navy, #191970); font-size: 11px; font-weight: 800; }
.master-name-text { max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.master-action-wrap { display: flex; justify-content: flex-end; gap: 6px; }
.master-icon-btn { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #EEF2FF; color: var(--primary-navy, #191970); display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-size: 13px; cursor: pointer; transition: all .18s ease; }
.master-icon-btn.danger { background: #FEF2F2; color: #DC2626; }
.master-icon-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1); }
.master-icon-btn.danger:hover { background: #DC2626; color: #FFFFFF; }

.master-empty { text-align: center; padding: 48px 20px; color: #64748B; font-size: 13px; font-weight: 600; }
.master-empty-icon { font-size: 40px; color: #94A3B8; margin-bottom: 10px; }

/* Pagination Modern */
.master-pagination-wrap { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid #E2E8F0; background: #FFFFFF; flex-wrap: wrap; gap: 10px; }
.pagination-info { font-size: 12px; font-weight: 600; color: #64748B; }
.pagination-controls { display: flex; align-items: center; gap: 4px; }
.page-btn { min-width: 32px; height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
.page-btn:hover:not(:disabled) { border-color: var(--primary-navy, #191970); color: var(--primary-navy, #191970); background: #EEF2FF; }
.page-btn.active { background: var(--primary-navy, #191970); color: #FFFFFF; border-color: var(--primary-navy, #191970); font-weight: 800; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.mc-overlay { position: fixed; inset: 0; z-index: 1050; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
.mc-modal { background: #FFFFFF; border-radius: 18px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); overflow: hidden; animation: mcModalIn 0.2s ease; }
@keyframes mcModalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.mc-modal-header { padding: 16px 20px; border-bottom: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: space-between; }
.mc-modal-title { margin: 0; font-size: 16px; font-weight: 800; color: #0F172A; }
.mc-modal-close { border: 0; background: transparent; color: #94A3B8; font-size: 16px; cursor: pointer; padding: 4px; border-radius: 6px; }
.mc-modal-close:hover { color: #0F172A; background: #F1F5F9; }
.mc-modal-body { padding: 20px; max-height: 75vh; overflow-y: auto; }
.mc-form-label { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; display: block; }
.mc-form-control { width: 100%; height: 38px; border-radius: 10px; border: 1px solid #CBD5E1; padding: 0 12px; font-size: 13px; font-weight: 600; color: #0F172A; outline: none; transition: all 0.2s ease; }
.mc-form-control:focus { border-color: var(--primary-navy, #191970); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.08); }
.mc-modal-footer { padding: 14px 20px; border-top: 1px solid #E2E8F0; background: #F8FAFC; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.mc-cancel-btn { padding: 8px 16px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-size: 13px; font-weight: 700; cursor: pointer; }
.mc-cancel-btn:hover { background: #F1F5F9; }
.mc-save-btn { padding: 8px 20px; border-radius: 10px; border: 0; background: var(--primary-navy, #191970); color: #FFFFFF; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 6px rgba(25, 25, 112, 0.2); }
.mc-save-btn:hover:not(:disabled) { background: #121254; }
.mc-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.mc-confirm-overlay { position: fixed; inset: 0; z-index: 1060; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: dialogFadeIn 0.2s ease; }
@keyframes dialogFadeIn { from { opacity: 0; } to { opacity: 1; } }

.mc-confirm-box { background: #FFFFFF; border-radius: 18px; width: 100%; max-width: 420px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25); overflow: hidden; animation: dialogScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes dialogScaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.mc-confirm-header { padding: 18px 22px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 0; }
.mc-confirm-title { display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 800; color: #0F172A; letter-spacing: -0.2px; }
.mc-confirm-icon-box { width: 40px; height: 40px; border-radius: 12px; background: #FEF2F2; color: #EF4444; border: 1px solid #FCA5A5; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.mc-confirm-close { border: 0; background: transparent; color: #94A3B8; font-size: 18px; cursor: pointer; border-radius: 6px; padding: 4px; }
.mc-confirm-close:hover { color: #0F172A; background: #F1F5F9; }
.mc-confirm-body { padding: 0 22px 20px; font-size: 13px; font-weight: 600; color: #475569; line-height: 1.5; }
.mc-confirm-footer { padding: 14px 22px; border-top: 1px solid #E2E8F0; background: #F8FAFC; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.mc-confirm-btn { height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; border: 0; transition: all 0.15s ease; }
.mc-confirm-btn-cancel { background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; }
.mc-confirm-btn-cancel:hover { background: #F1F5F9; color: #0F172A; }
.mc-confirm-btn-ok { background: #EF4444; color: #FFFFFF; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25); }
.mc-confirm-btn-ok:hover { background: #DC2626; }

.sailendra-toast-wrap { position: fixed; top: 20px; right: 20px; z-index: 1100; display: flex; flex-direction: column; gap: 8px; width: 340px; pointer-events: none; }
.sailendra-toast { pointer-events: auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid var(--primary-navy, #191970); border-radius: 12px; padding: 12px 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); display: flex; align-items: flex-start; gap: 10px; animation: toastIn 0.2s ease; }
@keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.sailendra-toast-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
.sailendra-toast-content { min-width: 0; flex: 1; }
.sailendra-toast-title { font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 2px; }
.sailendra-toast-message { font-size: 12px; font-weight: 600; color: #64748B; }
.sailendra-toast-close { border: 0; background: transparent; color: #94A3B8; font-size: 14px; cursor: pointer; padding: 0; }
.sailendra-toast.success { border-left-color: #10B981; }
.sailendra-toast.success .sailendra-toast-icon { background: #ECFDF5; color: #10B981; }
.sailendra-toast.error { border-left-color: #DC2626; }
.sailendra-toast.error .sailendra-toast-icon { background: #FEF2F2; color: #DC2626; }
.sailendra-toast.warning { border-left-color: #F59E0B; }
.sailendra-toast.warning .sailendra-toast-icon { background: #FFFBEB; color: #F59E0B; }

@media (max-width: 640px) {
  .master-list-toolbar { flex-direction: column; align-items: stretch; }
  .master-search-wrap { max-width: 100%; }
  .master-add-btn { justify-content: center; width: 100%; }
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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const toastSeq = useRef(0);

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const notify = useCallback((type: string, title: string, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((arr) => [...arr, { id, type, title, msg }]);
    setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 3000);
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
    config.fields.forEach((f) => { init[f.key] = f.type === "select" ? (f.options?.[0] || "") : ""; });
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
      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: "Berhasil dihapus.", type: "success" }));
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
            <div className="master-empty">
              <div className="master-empty-icon"><i className="bi bi-inbox-fill"></i></div>
              <div>{config.emptyLabel}</div>
            </div>
          ) : (
            <>
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
                  {paginatedRows.map((row, i) => (
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

              {totalPages > 1 && (
                <div className="master-pagination-wrap">
                  <div className="pagination-info">
                    Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, rows.length)} dari {rows.length} data
                  </div>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="page-btn"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`page-btn ${page === p ? "active" : ""}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="page-btn"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
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
                      maxLength={f.maxLength}
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
              <div className="mc-confirm-title">
                <div className="mc-confirm-icon-box">
                  <i className="bi bi-trash3"></i>
                </div>
                <span>{confirm.title}</span>
              </div>
              <button type="button" className="mc-confirm-close" onClick={() => setConfirm(null)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="mc-confirm-body">{confirm.msg}</div>
            <div className="mc-confirm-footer">
              <button type="button" className="mc-confirm-btn mc-confirm-btn-cancel" onClick={() => setConfirm(null)}>
                Batal
              </button>
              <button type="button" className="mc-confirm-btn mc-confirm-btn-ok" onClick={doDelete}>
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sailendra-toast-wrap" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`sailendra-toast ${t.type}`}>
            <div className="sailendra-toast-icon"><i className={`bi ${t.type === "success" ? "bi-check-circle-fill" : t.type === "warning" ? "bi-exclamation-triangle-fill" : "bi-x-circle-fill"}`}></i></div>
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