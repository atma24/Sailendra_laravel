"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { setSession, isMultiRole, type AkunLokasi } from "@/lib/auth";
import AuthShell, { AUTH_FORM_CSS } from "@/components/AuthShell";

type LoginData = AkunLokasi & {
  token: string;
  perlu_pilih_lokasi?: boolean;
  akun_lokasi?: AkunLokasi[];
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<LoginData>("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const d = res.data;
      setSession({
        user: {
          id_pengguna: d.id_pengguna,
          id_pengguna_lokasi: d.id_pengguna_lokasi,
          username: d.username,
          role: d.role,
          status: d.status,
          created_at: d.created_at,
          nama_pengguna_lokasi: d.nama_pengguna_lokasi,
        },
        token: d.token,
        session_token: d.session_token,
        lokasi: isMultiRole(d.role) ? [] : d.id_pengguna_lokasi ? [d.id_pengguna_lokasi] : [],
      });
      router.replace(isMultiRole(d.role) ? "/pilih-lokasi" : "/dashboard");
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Gagal masuk, coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Login" error={error}>
      <style>{AUTH_FORM_CSS}</style>
      <form onSubmit={onSubmit}>
        <div className="auth-field">
          <label>Username</label>
          <div className="auth-input-wrap">
            <i className="bi bi-person auth-input-icon"></i>
            <input
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              maxLength={25}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="auth-field">
          <label>Password</label>
          <div className="auth-input-wrap">
            <i className="bi bi-lock auth-input-icon"></i>
            <input
              className="auth-input-password"
              type={show ? "text" : "password"}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={25}
              required
            />
            <button type="button" className="auth-toggle" onClick={() => setShow((s) => !s)}>
              <i className={show ? "bi bi-eye-slash" : "bi bi-eye"}></i>
            </button>
          </div>
        </div>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </AuthShell>
  );
}