"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { aktifLokasiId, isMultiRole, useSession, type Session } from "@/lib/auth";

type Pengguna = { id_pengguna: number; id_pengguna_lokasi: string | null; nama_pengguna_lokasi: string | null; username: string; role: string; status: string };
type Loc = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };

const css = `
.user-b-wrap { border: 1px solid var(--line); background: #fff; box-shadow: var(--shadow-card); border-radius: 14px; padding: 12px; }
.user-form-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.user-back-btn { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; border-radius: 10px; padding: 8px 11px; font-size: 12px; font-weight: 800; font-family: inherit; background: var(--primary-soft); color: var(--primary); }
.user-form-box { border: 1px solid var(--line); background: #fbfbff; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.form-group-custom { margin-bottom: 11px; }
.form-group-custom label { display: block; font-size: 10px; font-weight: 700; color: var(--text-soft); margin-bottom: 4px; }
.readonly-field, .input-icon-wrap, .form-group-custom select { width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 11px; min-height: 42px; font-family: inherit; }
.readonly-field { display: flex; align-items: center; padding: 9px 11px; font-size: 12px; font-weight: 700; }
.input-icon-wrap { display: flex; align-items: center; gap: 8px; padding: 0 11px; }
.input-icon-wrap i { color: var(--text-soft); }
.input-icon-wrap input { border: 0; outline: 0; width: 100%; height: 40px; font-size: 12px; font-weight: 650; font-family: inherit; }
.form-group-custom select { padding: 0 10px; font-size: 12px; font-weight: 650; outline: 0; }
.user-form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.user-save-btn { width: 100%; border: 0; outline: 0; border-radius: 11px; background: var(--primary); color: #fff; padding: 10px 12px; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 7px; font-family: inherit; cursor: pointer; }
.user-save-btn:hover { box-shadow: 0 10px 20px rgba(25,25,112,.18); }
.user-save-btn:disabled { opacity: .6; cursor: not-allowed; }
.user-err { padding: 12px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
@media (max-width: 576px) { .user-form-row { grid-template-columns: 1fr; } }
`;

const ROLES = ["Supervisor", "Checker", "Forklift", "Auditor"];
const STATUSES = ["Aktif", "Nonaktif"];

function tokenHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("sailendra_session");
    if (raw) { const s = JSON.parse(raw); if (s?.token) return { "Content-Type": "application/json", Authorization: `Bearer ${s.token}` }; }
  } catch { /* ignore */ }
  return { "Content-Type": "application/json" };
}

export default function UserFormPage({ editId }: { editId?: number }) {
  const session = useSession();
  const router = useRouter();
  const isEdit = !!editId && editId > 0;

  const [lokasiName, setLokasiName] = useState("");
  const [lokasiOptions, setLokasiOptions] = useState<Loc[]>([]);
  const [lokasiTerpilih, setLokasiTerpilih] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Checker");
  const [status, setStatus] = useState("Aktif");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    const multi = isMultiRole(session.user.role);

    if (multi) {
      // SuperAdmin/Support: bisa memilih lokasi dari daftar semua lokasi
      apiGet<Loc[]>("/pengguna-lokasi")
        .then((r) => {
          const list = r.data || [];
          setLokasiOptions(list);
          if (!isEdit) {
            const awal = aktifLokasiId(session);
            setLokasiTerpilih(awal && list.some((l) => String(l.id_pengguna_lokasi) === String(awal)) ? String(awal) : "");
          } else {
            setLokasiTerpilih(String(aktifLokasiId(session) || ""));
          }
        })
        .catch(() => {});
    } else {
      const id = aktifLokasiId(session);
      if (id) {
        apiGet<Loc[]>(`/pengguna-lokasi?id_pengguna_lokasi=${id}`)
          .then((r) => { const l = (r.data || [])[0]; if (l) { setLokasiName(l.nama_pengguna_lokasi); setLokasiTerpilih(String(l.id_pengguna_lokasi)); } })
          .catch(() => {});
      }
    }
    if (isEdit) {
      apiGet<Pengguna[]>(`/pengguna?id_pengguna=${editId}`)
        .then((r) => {
          const u = (r.data || [])[0];
          if (u) {
            setUsername(u.username); setRole(u.role); setStatus(u.status);
            if (u.id_pengguna_lokasi) setLokasiTerpilih(String(u.id_pengguna_lokasi));
          }
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat data"));
    }
  }, [session, isEdit, editId]);

  if (!session) return null;
  const multi = isMultiRole(session.user.role);
  const activeLocId = lokasiTerpilih || aktifLokasiId(session) || "-";
  const lokasiTampil = lokasiName
    ? `${activeLocId} - ${lokasiName}`
    : lokasiOptions.find((l) => String(l.id_pengguna_lokasi) === String(activeLocId))?.nama_pengguna_lokasi
      ? `${activeLocId} - ${lokasiOptions.find((l) => String(l.id_pengguna_lokasi) === String(activeLocId))?.nama_pengguna_lokasi}`
      : activeLocId;

  const save = async () => {
    setErr("");
    if (username.trim() === "") { setErr("Username wajib diisi"); return; }
    if (!isEdit && password.trim() === "") { setErr("Kata sandi wajib diisi untuk pengguna baru"); return; }
    const body: Record<string, unknown> = { id_pengguna_lokasi: String(activeLocId), username: username.trim(), role, status };
    if (password.trim() !== "") body.password = password.trim();
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/pengguna/${editId}` : "/api/pengguna", {
        method: isEdit ? "PUT" : "POST",
        headers: tokenHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setErr(j?.message || "Gagal menyimpan");
        return;
      }
      router.push("/profile/users/all");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-b-wrap">
      <style>{css}</style>

      <div className="user-form-top">
        <Link href="/profile/users/all" className="user-back-btn">
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>
      </div>

      {err && <div className="user-err">{err}</div>}

      <div className="user-form-box">
        <div className="form-group-custom">
          <label>Lokasi Pengguna</label>
          {multi ? (
            <select className="user-select-input" value={activeLocId} onChange={(e) => setLokasiTerpilih(e.target.value)}>
              <option value="">Pilih Lokasi</option>
              {lokasiOptions.map((l) => (
                <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                  {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                </option>
              ))}
            </select>
          ) : (
            <div className="readonly-field">{lokasiTampil}</div>
          )}
        </div>

        <div className="form-group-custom">
          <label>Username</label>
          <div className="input-icon-wrap">
            <i className="bi bi-person-fill"></i>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" maxLength={25} />
          </div>
        </div>

        <div className="form-group-custom">
          <label>{isEdit ? "Kata sandi baru (opsional)" : "Kata sandi"}</label>
          <div className="input-icon-wrap">
            <i className="bi bi-lock-fill"></i>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? "Kata sandi baru (opsional)" : "Kata sandi"} maxLength={25} />
          </div>
        </div>

        <div className="user-form-row">
          <div className="form-group-custom">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group-custom">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <button type="button" className="user-save-btn" onClick={save} disabled={saving}>
        <i className="bi bi-save-fill"></i>
        <span>{saving ? "Menyimpan..." : "Simpan"}</span>
      </button>
    </div>
  );
}