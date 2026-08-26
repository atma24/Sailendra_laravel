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
  position: fixed; inset: 0; z-index: 1050; background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  backdrop-filter: blur(4px); animation: umFadeIn 0.2s ease;
}
@keyframes umFadeIn { from { opacity: 0; } to { opacity: 1; } }

.upload-modal-card {
  background: #FFFFFF; border-radius: 18px; width: 100%; max-width: 480px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  overflow: hidden; display: flex; flex-direction: column; animation: umScaleIn 0.2s ease;
}
@keyframes umScaleIn { from { transform: scale(0.96); } to { transform: scale(1); } }

.upload-modal-header {
  padding: 18px 22px; border-bottom: 1px solid #E2E8F0;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.upload-modal-title {
  margin: 0; font-size: 16px; font-weight: 800; color: #0F172A; letter-spacing: -0.2px;
}
.upload-modal-close {
  border: 0; background: transparent; color: #94A3B8; font-size: 18px; line-height: 1;
  padding: 4px; cursor: pointer; border-radius: 6px; transition: all 0.15s ease;
}
.upload-modal-close:hover { color: #0F172A; background: #F1F5F9; }

.upload-modal-body {
  padding: 22px; display: flex; flex-direction: column; gap: 16px;
}

.upload-note-box {
  background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 12px; padding: 12px 14px;
  font-size: 12px; font-weight: 600; color: var(--primary-navy, #191970); line-height: 1.4;
  display: flex; align-items: flex-start; gap: 8px;
}

.upload-file-input-wrap {
  width: 100%; border: 1px solid #CBD5E1; border-radius: 10px; padding: 6px; background: #F8FAFC;
  display: flex; align-items: center; gap: 10px; transition: border-color 0.2s ease;
}
.upload-file-input-wrap:focus-within {
  border-color: var(--primary-navy, #191970); background: #FFFFFF;
}

.upload-file-btn-fake {
  height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF;
  color: #334155; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
  display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease;
}
.upload-file-btn-fake:hover {
  background: #F1F5F9; border-color: #94A3B8; color: #0F172A;
}

.upload-file-name {
  font-size: 12px; font-weight: 600; color: #64748B; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; flex: 1;
}

.upload-modal-footer {
  padding: 14px 22px; border-top: 1px solid #E2E8F0; background: #F8FAFC;
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
}

.upload-cancel-btn {
  height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid #CBD5E1;
  background: #FFFFFF; color: #475569; font-size: 13px; font-weight: 700; cursor: pointer;
  transition: all 0.15s ease;
}
.upload-cancel-btn:hover { background: #F1F5F9; }

.upload-submit-btn {
  height: 38px; padding: 0 20px; border-radius: 10px; border: 0;
  background: var(--primary-navy, #191970); color: #FFFFFF; font-size: 13px; font-weight: 800;
  cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  box-shadow: 0 2px 6px rgba(25, 25, 112, 0.2); transition: all 0.15s ease;
}
.upload-submit-btn:hover:not(:disabled) {
  background: #121254; transform: translateY(-1px);
}
.upload-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.upload-loading-overlay {
  position: absolute; inset: 0; background: rgba(255, 255, 255, 0.92);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; z-index: 10; border-radius: 18px; backdrop-filter: blur(2px);
  animation: umFadeIn 0.2s ease;
}
.upload-spinner-outer {
  position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;
}
.upload-spinner-ring {
  position: absolute; inset: 0; border-radius: 50%;
  border: 4px solid #E2E8F0; border-top-color: var(--primary-navy, #191970);
  animation: umSpin 0.8s linear infinite;
}
@keyframes umSpin { to { transform: rotate(360deg); } }
.upload-spinner-icon {
  font-size: 22px; color: var(--primary-navy, #191970); animation: umPulse 1.2s ease-in-out infinite;
}
@keyframes umPulse { 0%, 100% { transform: scale(0.9); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; } }

.upload-loading-title {
  font-size: 15px; font-weight: 800; color: #0F172A; margin: 0;
}
.upload-loading-sub {
  font-size: 12px; font-weight: 600; color: #64748B; margin: 0;
}
.upload-progress-bar {
  width: 180px; height: 5px; background: #E2E8F0; border-radius: 99px; overflow: hidden; position: relative;
}
.upload-progress-fill {
  position: absolute; top: 0; bottom: 0; left: -100%; width: 100%;
  background: linear-gradient(90deg, transparent, var(--primary-navy, #191970), transparent);
  animation: umProgress 1.5s ease-in-out infinite;
}
@keyframes umProgress { 0% { left: -100%; } 100% { left: 100%; } }
`;

export default function UploadModal({
  open,
  title,
  note,
  onClose,
  onDownload,
  onSubmit,
  submitLabel = "Upload Sekarang",
  busy = false,
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file || busy) return;
    await onSubmit(file);
    setFile(null);
  };

  return (
    <>
      <style>{css}</style>
      <div className="upload-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
        <div className="upload-modal-card" style={{ position: "relative" }}>
          {busy && (
            <div className="upload-loading-overlay">
              <div className="upload-spinner-outer">
                <div className="upload-spinner-ring"></div>
                <i className="bi bi-cloud-arrow-up-fill upload-spinner-icon"></i>
              </div>
              <div style={{ textAlign: "center" }}>
                <p className="upload-loading-title">Mengunggah & Memproses Data...</p>
                <p className="upload-loading-sub">Mohon tunggu sejenak, sistem sedang mengolah file.</p>
              </div>
              <div className="upload-progress-bar">
                <div className="upload-progress-fill"></div>
              </div>
            </div>
          )}
          <div className="upload-modal-header">
            <h5 className="upload-modal-title">{title}</h5>
            <button
              type="button"
              className="upload-modal-close"
              onClick={onClose}
              disabled={busy}
              aria-label="Tutup"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div className="upload-modal-body">
            {note && (
              <div className="upload-note-box">
                <i className="bi bi-info-circle-fill" style={{ fontSize: 14 }}></i>
                <span>{note}</span>
              </div>
            )}

            <div className="upload-file-input-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="upload-file-btn-fake"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </button>
              <span className="upload-file-name">
                {file ? file.name : "No file chosen"}
              </span>
            </div>

            {onDownload && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={onDownload}
                  style={{
                    border: 0, background: "none", color: "var(--primary-navy, #191970)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex",
                    alignItems: "center", gap: 6
                  }}
                >
                  <i className="bi bi-download"></i> Download Template Format
                </button>
              </div>
            )}
          </div>

          <div className="upload-modal-footer">
            <button
              type="button"
              className="upload-cancel-btn"
              onClick={onClose}
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="button"
              className="upload-submit-btn"
              onClick={handleSubmit}
              disabled={busy || !file}
            >
              {busy ? (
                <>
                  <i className="bi bi-arrow-repeat spin"></i>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-upload"></i>
                  <span>{submitLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}