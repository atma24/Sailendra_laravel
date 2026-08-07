"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { aktifLokasiId, useSession } from "@/lib/auth";

type Pengguna = { id_pengguna: number; id_pengguna_lokasi: string; nama_pengguna_lokasi: string | null; username: string; role: string; status: string };

const ROLE_LABEL: Record<string, string> = {
  supervisor: "Supervisor",
  support: "Support",
  superadmin: "Super Admin",
  checker: "Checker",
  forklift: "Forklift",
};

function roleLabel(r: string) {
  const k = String(r).toLowerCase();
  return ROLE_LABEL[k] || r || "-";
}
function statusLabel(s: string) {
  return String(s).toLowerCase() === "nonaktif" ? "Nonaktif" : "Aktif";
}

const css = `
.user-list-card, .user-form-card { border: 1px solid var(--line); background: #fff; box-shadow: var(--shadow-card); border-radius: 14px; padding: 12px; }
.user-list-top, .user-form-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.user-back-btn, .user-add-small-btn { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; border-radius: 10px; padding: 8px 11px; font-size: 12px; font-weight: 800; font-family: inherit; }
.user-back-btn { background: var(--primary-soft); color: var(--primary); }
.user-add-small-btn { background: var(--primary); color: #fff; }
.user-search-wrap { display: flex; align-items: center; gap: 8px; background: #f7f7fb; border: 1px solid var(--line); border-radius: 12px; padding: 8px 11px; margin-bottom: 10px; }
.user-search-wrap i { color: var(--text-soft); }
.user-search-wrap input { border: 0; outline: 0; background: transparent; width: 100%; font-size: 12px; font-weight: 600; font-family: inherit; }
.user-list-wrap { display: grid; gap: 8px; }
.user-row-card { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 10px; }
.user-avatar-list { width: 34px; height: 34px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }
.user-row-main { flex: 1; min-width: 0; }
.user-row-name { font-size: 13px; font-weight: 800; color: var(--text-main); margin-bottom: 5px; }
.user-row-meta { display: flex; flex-wrap: wrap; gap: 5px; }
.user-chip { padding: 4px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; }
.role-chip { background: rgba(25,25,112,.10); color: var(--primary); }
.status-chip.aktif { background: rgba(34,197,94,.13); color: #15803d; }
.status-chip.nonaktif { background: rgba(239,43,45,.12); color: var(--danger); }
.user-edit-btn { width: 32px; height: 32px; border-radius: 10px; color: var(--text-main); text-decoration: none; display: flex; align-items: center; justify-content: center; }
.user-edit-btn:hover { background: var(--primary-soft); color: var(--primary); }
.user-empty { padding: 26px; text-align: center; font-weight: 700; color: var(--text-soft); }
.user-err { padding: 16px; text-align: center; font-weight: 700; color: #dc2626; font-size: 12px; }
`;

const FILTERS: Record<string, { title: string; filter?: (r: string) => boolean }> = {
  all: { title: "Semua Pengguna" },
  supervisor: { title: "Daftar Supervisor", filter: (r) => r === "supervisor" || r === "support" },
  checker: { title: "Daftar Checker", filter: (r) => r === "checker" },
  forklift: { title: "Daftar Forklift", filter: (r) => r === "forklift" },
};

export default function UserListPage() {
  const session = useSession();
  const params = useParams<{ filter: string }>();
  const [pengguna, setPengguna] = useState<Pengguna[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const filter = (params?.filter || "all") as string;
  const def = FILTERS[filter] || FILTERS.all;

  useEffect(() => {
    if (!session) return;
    const sp = new URLSearchParams();
    const id = aktifLokasiId(session);
    if (id) sp.set("id_pengguna_lokasi", id);
    apiGet<Pengguna[]>(`/pengguna?${sp.toString()}`)
      .then((r) => setPengguna(r.data || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat data"));
  }, [session]);

  const filtered = useMemo(() => {
    let list = def.filter ? pengguna.filter((p) => def.filter!(String(p.role).toLowerCase())) : pengguna;
    if (q.trim() !== "") {
      const needle = q.toLowerCase();
      list = list.filter((p) =>
        `${p.username} ${roleLabel(p.role)} ${statusLabel(p.status)}`.toLowerCase().includes(needle)
      );
    }
    return list;
  }, [pengguna, def, q]);

  if (!session) return null;

  return (
    <div className="user-list-card">
      <style>{css}</style>

      <div className="user-list-top">
        <Link href="/profile" className="user-back-btn" style={{ flex: 1, minWidth: 130, textAlign: "center", justifyContent: "center" }}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali</span>
        </Link>
        <Link href="/profile/user-form" className="user-add-small-btn" style={{ flex: 1, minWidth: 130, textAlign: "center", justifyContent: "center" }}>
          <i className="bi bi-person-plus-fill"></i>
          <span>Tambah User</span>
        </Link>
      </div>

      <div className="user-search-wrap">
        <i className="bi bi-search"></i>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari username" />
      </div>

      <div className="user-list-wrap" id="userListWrap">
        {err ? (
          <div className="user-empty">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="user-empty">Tidak ada data pengguna</div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id_pengguna}
              className="user-row-card"
              data-search={`${u.username} ${roleLabel(u.role)} ${statusLabel(u.status)}`.toLowerCase()}
            >
              <div className="user-avatar-list">{u.username.slice(0, 1).toUpperCase()}</div>
              <div className="user-row-main">
                <div className="user-row-name">{u.username}</div>
                <div className="user-row-meta">
                  {filter === "all" && <span className={`user-chip role-chip ${roleLabel(u.role).toLowerCase()}`}>{roleLabel(u.role)}</span>}
                  <span className={`user-chip status-chip ${String(u.status).toLowerCase() === "nonaktif" ? "nonaktif" : "aktif"}`}>
                    {statusLabel(u.status)}
                  </span>
                </div>
              </div>
              <Link className="user-edit-btn" href={`/profile/user-form/${u.id_pengguna}`}>
                <i className="bi bi-pencil-fill"></i>
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}