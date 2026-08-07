"use client";

import { useRef, useState } from "react";

type UploadModalProps = {
  open: boolean;
  title: string;
  note?: string;
  onClose: () => void;
  onDownload?: () => void;
  onSubmit: (file: File) => Promise<void>;
  submitLabel?: string;
  busy?: boolean;
};

const css = `
.upload-modal-overlay {
  position: fixed; inset: 0; z-index: 1050; background: rgba(15,23,42,0.45);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  backdrop-filter: blur(2px);
}
.upload-modal-content {
  background: #fff; width: 100%; max-width: 420px; border-radius: 16px;
  box-shadow: 0 25px 50px rgba(15,23,42,0.2); overflow: hidden;
  animation: modalFadeIn 0.2s ease-out;
}
@keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.upload-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 20px 14px;
}
.upload-modal-header h3 { margin: 0; font-size: 16px; font-weight: 900; color: #172033; letter-spacing: -0.3px; }
.upload-modal-header button {
  background: transparent; border: none; font-size: 18px; color: #8a93a3; cursor: pointer; transition: color 0.2s;
}
.upload-modal-header button:hover { color: #d33b3e; }
.upload-modal-body { padding: 0 20px 20px; }
.upload-modal-body label {
  display: block; font-size: 11px; font-weight: 800; color: #6b7280; margin-bottom: 8px;
}
.file-drop-area {
  border: 1px solid #e2e7f0; border-radius: 8px; padding: 6px 8px; background: #fff;
  transition: border-color 0.2s;
}
.file-drop-area:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.07); }
.file-drop-area input[type="file"] {
  font-size: 11px; color: #172033; width: 100%; cursor: pointer; font-weight: 600;
}
.file-drop-area input[type="file"]::file-selector-button {
  background: #f6f7f9; color: #172033; border: 1px solid #e2e7f0; border-radius: 6px;
  padding: 6px 12px; font-weight: 800; cursor: pointer; margin-right: 12px; transition: background 0.2s;
}
.file-drop-area input[type="file"]::file-selector-button:hover { background: #eef0ff; color: var(--primary); border-color: var(--primary); }
.upload-modal-note { font-size: 10px; font-weight: 700; color: #8a93a3; margin-top: 8px; }
.upload-modal-extra { margin-bottom: 14px; font-size: 11px; font-weight: 700; color: #172033; }
.upload-modal-footer { padding: 16px 20px; display: flex; justify-content: flex-end; gap: 10px; }
.upload-modal-msg {
  margin: 0 20px; padding: 8px 10px; border-radius: 9px; font-size: 11px; font-weight: 800;
}
.upload-modal-msg.ok { background: #ecfdf5; border: 1px solid #bbf7d0; color: #166534; }
.upload-modal-msg.err { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; }
.btn-batal {
  background: #fff; border: 1px solid #e2e7f0; border-radius: 8px; padding: 0 16px;
  height: 36px; font-size: 12px; font-weight: 800; color: #6b7280; cursor: pointer; transition: background 0.2s;
}
.btn-batal:hover { background: #f3f4f6; color: #172033; }
.btn-batal:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-upload-sekarang {
  background: #191970; border: none; border-radius: 8px; padding: 0 20px;
  height: 36px; font-size: 12px; font-weight: 800; color: #fff; cursor: pointer;
  display: flex; align-items: center; gap: 8px; transition: filter 0.2s, transform 0.2s;
}
.btn-upload-sekarang:hover { filter: brightness(1.1); transform: translateY(-1px); }
.btn-upload-sekarang:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.download-template-link {
  display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800;
  color: var(--primary); margin-top: 12px; text-decoration: none; cursor: pointer;
}
.download-template-link:hover { text-decoration: underline; }
`;

export default function UploadModal({
  open,
  title,
  note,
  onClose,
  onDownload,
  onSubmit,
  submitLabel = "Upload Sekarang",
  busy,
}: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) return null;

  const submit = async () => {
    if (!file) {
      setMsg({ ok: false, text: "Pilih file terlebih dahulu." });
      return;
    }
    setMsg(null);
    try {
      await onSubmit(file);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || "Gagal memproses file." });
    }
  };

  const _busy = busy || false;

  return (
    <>
      <style>{css}</style>
      <div className="upload-modal-overlay" onClick={() => _busy ? undefined : onClose()}>
        <div className="upload-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="upload-modal-header">
            <h3>{title}</h3>
            <button onClick={() => (busy ? undefined : onClose())} disabled={busy}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div className="upload-modal-body">
            <label>Pilih File (Format .XLSX / .CSV)</label>
            <div className="file-drop-area">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                ref={fileRef}
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setMsg(null);
                }}
              />
            </div>
            {note && <div className="upload-modal-note">{note}</div>}
            {onDownload && (
              <a
                href="#"
                className="download-template-link"
                onClick={(e) => {
                  e.preventDefault();
                  onDownload();
                }}
              >
                <i className="bi bi-download"></i> Download Template Excel
              </a>
            )}
          </div>

          {msg && <div className={`upload-modal-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

          <div className="upload-modal-footer">
            <button className="btn-batal" onClick={onClose} disabled={busy}>
              Batal
            </button>
            <button className="btn-upload-sekarang" onClick={submit} disabled={busy || !file}>
              <i className="bi bi-upload"></i>
              <span>{busy ? "Memproses..." : submitLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}