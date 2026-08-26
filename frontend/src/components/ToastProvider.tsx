"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
};

export type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
};

type ToastContextType = {
  toast: (message: string, type?: ToastType, title?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const css = `
.sailendra-toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 380px;
  width: calc(100vw - 40px);
  pointer-events: none;
}

.sailendra-toast-card {
  pointer-events: auto;
  background: #FFFFFF;
  border-radius: 14px;
  padding: 14px 16px;
  border: 1px solid #E2E8F0;
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  animation: toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

@keyframes toastSlideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.sailendra-toast-card.success { border-left: 4px solid #10B981; }
.sailendra-toast-card.error { border-left: 4px solid #EF4444; }
.sailendra-toast-card.warning { border-left: 4px solid #F59E0B; }
.sailendra-toast-card.info { border-left: 4px solid var(--primary-navy, #191970); }

.sailendra-toast-badge {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}

.sailendra-toast-card.success .sailendra-toast-badge { background: #ECFDF5; color: #10B981; }
.sailendra-toast-card.error .sailendra-toast-badge { background: #FEF2F2; color: #EF4444; }
.sailendra-toast-card.warning .sailendra-toast-badge { background: #FFFBEB; color: #F59E0B; }
.sailendra-toast-card.info .sailendra-toast-badge { background: #EEF2FF; color: var(--primary-navy, #191970); }

.sailendra-toast-body {
  flex: 1;
  min-width: 0;
}

.sailendra-toast-heading {
  font-size: 13px;
  font-weight: 800;
  color: #0F172A;
  margin-bottom: 2px;
  letter-spacing: -0.1px;
}

.sailendra-toast-text {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  line-height: 1.4;
  word-break: break-word;
}

.sailendra-toast-close-btn {
  border: 0;
  background: transparent;
  color: #94A3B8;
  padding: 2px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.sailendra-toast-close-btn:hover {
  color: #0F172A;
  background: #F1F5F9;
}

/* Confirm Dialog Styles */
.sailendra-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: dialogFadeIn 0.2s ease;
}

@keyframes dialogFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sailendra-dialog-card {
  background: #FFFFFF;
  border-radius: 18px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
  overflow: hidden;
  animation: dialogScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dialogScaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.sailendra-dialog-header {
  padding: 20px 22px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.sailendra-dialog-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.sailendra-dialog-icon-box.danger { background: #FEF2F2; color: #EF4444; border: 1px solid #FCA5A5; }
.sailendra-dialog-icon-box.warning { background: #FFFBEB; color: #F59E0B; border: 1px solid #FCD34D; }
.sailendra-dialog-icon-box.primary { background: #EEF2FF; color: var(--primary-navy, #191970); border: 1px solid #C7D2FE; }

.sailendra-dialog-title {
  font-size: 16px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -0.2px;
}

.sailendra-dialog-body {
  padding: 0 22px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  line-height: 1.5;
}

.sailendra-dialog-footer {
  padding: 14px 22px;
  background: #F8FAFC;
  border-top: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.sailendra-dialog-cancel {
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid #CBD5E1;
  background: #FFFFFF;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sailendra-dialog-cancel:hover {
  background: #F1F5F9;
  color: #0F172A;
}

.sailendra-dialog-action {
  height: 38px;
  padding: 0 20px;
  border-radius: 10px;
  border: 0;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  color: #FFFFFF;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.sailendra-dialog-action.danger {
  background: #EF4444;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
}
.sailendra-dialog-action.danger:hover {
  background: #DC2626;
}

.sailendra-dialog-action.warning {
  background: #F59E0B;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);
}
.sailendra-dialog-action.warning:hover {
  background: #D97706;
}

.sailendra-dialog-action.primary {
  background: var(--primary-navy, #191970);
  box-shadow: 0 2px 6px rgba(25, 25, 112, 0.25);
}
.sailendra-dialog-action.primary:hover {
  background: #121254;
}
`;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const toast = useCallback((message: string, type: ToastType = "success", title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const defaultTitle =
      type === "success" ? "Berhasil" : type === "error" ? "Gagal" : type === "warning" ? "Peringatan" : "Informasi";

    setToasts((prev) => [...prev, { id, type, title: title || defaultTitle, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Flash toast persistency across page reloads & client-side navigations (router.push)
  useEffect(() => {
    const checkFlashToast = () => {
      try {
        const stored = sessionStorage.getItem("sailendra_flash_toast");
        if (stored) {
          sessionStorage.removeItem("sailendra_flash_toast");
          const parsed = JSON.parse(stored);
          if (parsed.message) {
            toast(parsed.message, parsed.type || "success", parsed.title);
          }
        }
      } catch {
        /* ignore */
      }
    };

    checkFlashToast();
  }, [pathname, toast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      <style>{css}</style>
      {children}

      {/* Toast Stacking Container */}
      <div className="sailendra-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`sailendra-toast-card ${t.type}`}>
            <div className="sailendra-toast-badge">
              <i
                className={`bi ${
                  t.type === "success"
                    ? "bi-check-lg"
                    : t.type === "error"
                    ? "bi-exclamation-triangle-fill"
                    : t.type === "warning"
                    ? "bi-exclamation-circle-fill"
                    : "bi-info-circle-fill"
                }`}
              ></i>
            </div>
            <div className="sailendra-toast-body">
              <div className="sailendra-toast-heading">{t.title}</div>
              <div className="sailendra-toast-text">{t.message}</div>
            </div>
            <button
              type="button"
              className="sailendra-toast-close-btn"
              onClick={() => removeToast(t.id)}
              aria-label="Tutup"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        ))}
      </div>

      {/* Modern Confirm Modal */}
      {confirmState && (
        <div className="sailendra-dialog-backdrop">
          <div className="sailendra-dialog-card">
            <div className="sailendra-dialog-header">
              <div className={`sailendra-dialog-icon-box ${confirmState.options.variant || "danger"}`}>
                <i
                  className={`bi ${
                    confirmState.options.variant === "warning"
                      ? "bi-exclamation-triangle"
                      : confirmState.options.variant === "primary"
                      ? "bi-question-circle"
                      : "bi-trash3"
                  }`}
                ></i>
              </div>
              <div className="sailendra-dialog-title">{confirmState.options.title}</div>
            </div>
            <div className="sailendra-dialog-body">{confirmState.options.message}</div>
            <div className="sailendra-dialog-footer">
              <button
                type="button"
                className="sailendra-dialog-cancel"
                onClick={() => handleConfirmClose(false)}
              >
                {confirmState.options.cancelText || "Batal"}
              </button>
              <button
                type="button"
                className={`sailendra-dialog-action ${confirmState.options.variant || "danger"}`}
                onClick={() => handleConfirmClose(true)}
              >
                {confirmState.options.confirmText || "Ya, Lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus digunakan didalam ToastProvider");
  return ctx;
}