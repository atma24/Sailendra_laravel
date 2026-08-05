"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { isMultiRole, setSession } from "@/lib/auth";

type LoginRes = {
  id_pengguna: number;
  id_pengguna_lokasi: number | null;
  username: string;
  role: string;
  status: string;
  created_at: string;
  nama_pengguna_lokasi: string | null;
  perlu_pilih_lokasi: boolean;
  akun_lokasi: any[];
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiPost<{ data: LoginRes }>("/login", {
        username,
        password,
      });
      const user = res.data;
      setSession({
        user: { ...user, role: user.role, id_pengguna_lokasi: user.id_pengguna_lokasi },
        lokasi: isMultiRole(user.role) ? undefined as any : (user.id_pengguna_lokasi ? [user.id_pengguna_lokasi] : []),
      });
      if (isMultiRole(user.role)) {
        router.replace("/pilih-lokasi");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb] p-6">
      <div className="grid w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08)] md:grid-cols-[0.9fr_1.1fr]">
        <div
          className="hidden min-h-[600px] bg-white bg-center bg-no-repeat md:block"
          style={{
            backgroundImage: "url(/logo-login.jpg)",
            backgroundSize: "82% auto",
          }}
        />
        <div className="flex items-center justify-center p-[52px]">
          <div className="w-full max-w-[380px]">
            <h1 className="mb-6 text-[28px] font-extrabold tracking-tight text-[#191970]">
              Login
            </h1>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-[13px] font-bold text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <div className="mb-4">
                <label className="mb-2 block text-[13px] font-bold">Username</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-lg text-[#6b7280]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.5 0-8 1.9-8 5v1h16v-1c0-3.1-4.5-5-8-5Z"/></svg>
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    className="h-12 w-full rounded-lg border border-[#e2e8f0] bg-[#fbfcff] pl-[42px] pr-4 text-sm font-semibold outline-none transition focus:border-[#191970] focus:bg-white focus:ring-[3px] focus:ring-[rgba(25,25,112,0.08)]"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-[13px] font-bold">Password</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-lg text-[#6b7280]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 8V7a6 6 0 1 1 12 0v1h1a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1Zm2 0h8V7a4 4 0 0 0-8 0v1Zm3 5.2V16h2v-2.8a2 2 0 0 0-2-4 2 2 0 0 0-2 4h2Z"/></svg>
                  </span>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-12 w-full rounded-lg border border-[#e2e8f0] bg-[#fbfcff] pl-[42px] pr-11 text-sm font-semibold outline-none transition focus:border-[#191970] focus:bg-white focus:ring-[3px] focus:ring-[rgba(25,25,112,0.08)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-[#6b7280]"
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full cursor-pointer rounded-lg bg-[#191970] font-bold text-white transition hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(25,25,112,0.2)] disabled:opacity-60"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}