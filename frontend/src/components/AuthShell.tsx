"use client";

export default function AuthShell({
  title,
  onBack,
  error,
  children,
}: {
  title: string;
  onBack?: () => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-body">
      <style>{AUTH_CSS}</style>
      <div className="auth-shell">
        {onBack && (
          <button type="button" className="auth-back-btn" onClick={onBack}>
            <i className="bi bi-chevron-left"></i>
          </button>
        )}
        <div className="auth-image-side"></div>
        <div className="auth-form-side">
          <div className="auth-form-wrap">
            <h1 className="auth-title">{title}</h1>
            {error && <div className="auth-alert">{error}</div>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const AUTH_CSS = `
.auth-body {
  min-height: 100vh;
  background: var(--page-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-shell {
  position: relative;
  width: 100%;
  max-width: 980px;
  min-height: 600px;
  background: #FFFFFF;
  border-radius: 16px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
  border: none;
}

.auth-image-side {
  min-height: 600px;
  background-color: #FFFFFF;
  background-image: url('/logologin.jpg');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: 82% auto;
}

.auth-back-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--page-bg);
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border: 1px solid var(--line);
  z-index: 10;
  transition: .2s ease;
}

.auth-back-btn:hover {
  color: var(--primary);
  background: #FFFFFF;
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(25, 25, 112, 0.1);
}

.auth-form-side {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 52px;
  background: #FFFFFF;
}

.auth-form-wrap {
  width: 100%;
  max-width: 380px;
}

.auth-title {
  margin: 0 0 24px;
  color: var(--primary);
  font-size: 28px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.5px;
}

.auth-alert {
  background: rgba(239, 43, 45, 0.10);
  color: #991b1b;
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 18px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid rgba(239, 43, 45, 0.2);
}

@media (max-width: 900px) {
  .auth-shell { grid-template-columns: 1fr; max-width: 440px; min-height: auto; }
  .auth-image-side { display: none; }
  .auth-form-side { padding: 40px 30px; }
  .auth-title { text-align: left; }
}

@media (max-width: 480px) {
  .auth-body { padding: 0; background: #FFFFFF; }
  .auth-shell { border-radius: 0; border: none; box-shadow: none; min-height: 100vh; }
  .auth-form-side { height: 100vh; padding: 24px; }
  .auth-form-wrap { margin-top: -10vh; }
  .auth-back-btn { top: 24px; left: 24px; background: transparent; border: none; box-shadow: none; width: auto; height: auto; font-size: 24px; padding: 0; }
  .auth-back-btn:hover { background: transparent; box-shadow: none; color: var(--primary); }
}
`;

const AUTH_FORM_CSS = `
.auth-field {
  margin-bottom: 18px;
}

.auth-field label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 700;
}

.auth-input-wrap {
  position: relative;
}

.auth-input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-soft);
  font-size: 18px;
  pointer-events: none;
}

.auth-input-wrap input {
  width: 100%;
  height: 48px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 16px 0 42px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  outline: none;
  background: #fbfcff;
  transition: border-color .2s ease, box-shadow .2s ease;
  font-family: inherit;
}

.auth-input-wrap input:focus {
  border-color: var(--primary);
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.08);
}

.auth-input-wrap input.auth-input-password {
  padding-right: 44px;
}

.auth-input-wrap .auth-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: var(--text-soft);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

.auth-btn {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 8px;
  background: var(--primary);
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 8px;
  transition: .2s ease;
  font-family: inherit;
}

.auth-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(25, 25, 112, 0.20);
}
`;

export { AUTH_CSS, AUTH_FORM_CSS };