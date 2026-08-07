"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { aktifLokasiId, getSession, isMultiRole, setSession, useSession, type Session } from "@/lib/auth";

type Loc = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };
type Pengguna = { id_pengguna: number; id_pengguna_lokasi: string; nama_pengguna_lokasi: string | null; username: string; role: string; status: string };

const css = `
.profile-page { display: flex; flex-direction: column; gap: 12px; }
.profile-info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.profile-info-card { border: 1px solid var(--line); background: #fff; box-shadow: var(--shadow-card); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.profile-info-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 8px; }
.profile-info-label { font-size: 11px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: .3px; }
.profile-info-value { font-size: 14px; font-weight: 800; color: var(--text-main); }
.management-card { border: 1px solid var(--line); background: #fff; box-shadow: var(--shadow-card); border-radius: 12px; padding: 14px; }
.management-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.management-title-wrap { display: flex; align-items: center; gap: 10px; }
.management-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.management-title { font-size: 13px; font-weight: 800; color: var(--text-main); }
.management-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.management-stat-box { border: 1px solid var(--line); border-radius: 10px; background: var(--card-soft); padding: 10px 8px; text-align: center; display: block; text-decoration: none; color: inherit; }
.management-stat-box:hover { transform: translateY(-1px); border-color: var(--primary); background: #fff; }
.management-stat-number { font-size: 17px; font-weight: 800; color: var(--primary); line-height: 1; margin-bottom: 4px; }
.management-stat-label { font-size: 10px; font-weight: 700; color: var(--text-main); line-height: 1.2; }
.add-user-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--primary); color: #fff; border: 0; border-radius: 9px; padding: 10px 16px; font-size: 12px; font-weight: 800; cursor: pointer; text-decoration: none; font-family: inherit; }
.add-user-btn:hover { filter: brightness(1.08); }
.loc-select-wrap { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 42px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--line); background: #fff; box-shadow: 0 2px 6px rgba(15,23,42,.04); cursor: pointer; }
.loc-trigger { flex: 1; display: flex; align-items: center; justify-content: space-between; border: 0; outline: 0; background: transparent; font-size: 12px; font-weight: 750; color: var(--text-main); cursor: pointer; font-family: inherit; padding: 12px 0; }
.profile-note { font-size: 12px; font-weight: 750; color: var(--text-soft); margin: 0 0 12px; }
.select-all { color: var(--primary); font-size: 12px; cursor: pointer; font-weight: 700; background: none; border: 0; font-family: inherit; }
@media (max-width: 576px) { .management-stats { grid-template-columns: repeat(2, 1fr); } }
`; 

const MODAL_CSS = `
.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,.5); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
.content { background: #fff; width: 100%; max-width: 440px; border-radius: 12px; display: flex; flex-direction: column; max-height: 85vh; margin: 20px; box-shadow: 0 20px 50px rgba(15,23,42,.2); overflow: hidden; }
.hdr { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 16px; border-bottom: 1px solid #f1f5f9; }
.hdr h3 { font-weight: 800; color: var(--primary); font-size: 15px; margin: 0; }
.search { padding: 16px 20px; position: relative; }
.search i { position: absolute; left: 34px; top: 26px; color: var(--text-soft); }
.search input { width: 100%; padding: 10px 14px 10px 40px; border-radius: 8px; border: 1px solid #e2e7f0; outline: none; font-size: 13px; color: var(--text-main); background: #fbfcff; font-family: inherit; }
.body { flex: 1; overflow-y: auto; padding: 0 20px 20px; }
.cb { display: flex; align-items: center; padding: 12px; border: 1px solid #e2e7f0; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: .2s; }
.cb:hover { border-color: var(--primary); }
.cb.checked { border-color: var(--primary); background: #f7f9ff; }
.cb input { display: none; }
.box { width: 18px; height: 18px; border: 2px solid #e2e7f0; border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center; }
.cb.checked .box { background: var(--primary); border-color: var(--primary); }
.cb.checked .box::after { content: '✓'; color: #fff; font-size: 10px; font-weight: bold; }
.cbtext { font-size: 13px; font-weight: 600; color: var(--text-main); }
.footer { padding: 16px 20px; background: #fff; border-top: 1px solid #f1f5f9; }
.apply { width: 100%; padding: 12px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
.apply:hover { filter: brightness(1.1); }
.empty { padding: 20px; text-align: center; color: var(--text-soft); font-size: 12px; font-weight: 700; }
`;

const SUPERVISOR_ROLES: Record<string, boolean> = { Supervisor: true, SuperAdmin: true };

export default function ProfilePage() {
  const session = useSession();
  const router = useRouter();
  const [pengguna, setPengguna] = useState<Pengguna[]>([]);
  const [penggunaErr, setPenggunaErr] = useState("");

  const [locs, setLocs] = useState<Loc[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) return;
    const role = session.user.role || "";
    const isSup = !!SUPERVISOR_ROLES[role];

    if (isSup) {
      const sp = new URLSearchParams();
      const id = aktifLokasiId(session);
      if (id) sp.set("id_pengguna_lokasi", id);
      apiGet<Pengguna[]>(`/pengguna?${sp.toString()}`)
        .then((r) => setPengguna(r.data || []))
        .catch((e) => setPenggunaErr(e instanceof Error ? e.message : "Gagal memuat pengguna"));
    }

    if (isMultiRole(role)) {
      apiGet<Loc[]>("/pengguna-lokasi").then((r) => setLocs(r.data || [])).catch(() => {});
    }
  }, [session]);

  const counts = useMemo(() => {
    const lower = (r: unknown) => String(r ?? "").toLowerCase();
    const c = { total: pengguna.length, supervisor: 0, checker: 0, forklift: 0 };
    for (const p of pengguna) {
      const r = lower(p.role);
      if (r === "supervisor" || r === "support" || r === "superadmin") c.supervisor++;
      else if (r === "checker") c.checker++;
      else if (r === "forklift") c.forklift++;
    }
    return c;
  }, [pengguna]);

  if (!session) return null;
  const role = session.user.role || "";
  const isSup = !!SUPERVISOR_ROLES[role];
  const multi = isMultiRole(role);

  const activeLocId = aktifLokasiId(session);
  const activeLocName =
    session.lokasi === "all"
      ? "Semua Lokasi"
      : locs.find((l) => String(l.id_pengguna_lokasi) === String(activeLocId))?.nama_pengguna_lokasi || activeLocId;

  const filtered = useMemo(
    () => locs.filter((l) => `${l.id_pengguna_lokasi} - ${l.nama_pengguna_lokasi}`.toLowerCase().includes(search.toLowerCase())),
    [locs, search]
  );

  const allChecked = locs.length > 0 && locs.every((l) => selected.has(l.id_pengguna_lokasi));
  const checkedCount = selected.size;

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(locs.map((l) => l.id_pengguna_lokasi)));
  }
  function applyLokasi() {
    const s = getSession();
    if (!s) return;
    if (checkedCount === 0) { setModalOpen(true); return; }
    const lokasi = allChecked ? "all" : locs.filter((l) => selected.has(l.id_pengguna_lokasi)).map((l) => l.id_pengguna_lokasi);
    setSession({ ...s, lokasi });
    setModalOpen(false);
    router.refresh();
  }

  const triggerText = selected.size === 0 ? "Pilih 1 atau lebih lokasi" : allChecked ? "-- Semua Lokasi --" : `${selected.size} lokasi dipilih`;

  return (
    <div className="profile-page">
      <style>{css}</style>
      <style>{MODAL_CSS}</style>

      {isSup && (
        <div className="management-card">
          <div className="management-header">
            <div className="management-title-wrap">
              <div className="management-icon"><i className="bi bi-person-gear"></i></div>
              <div className="management-title">Manajemen Pengguna</div>
            </div>
          </div>

          {penggunaErr && <p style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{penggunaErr}</p>}

          <div className="management-stats">
            <Link href="/profile/users/all" className="management-stat-box">
              <div className="management-stat-number">{counts.total}</div>
              <div className="management-stat-label">Total Pengguna</div>
            </Link>
            <Link href="/profile/users/supervisor" className="management-stat-box">
              <div className="management-stat-number">{counts.supervisor}</div>
              <div className="management-stat-label">Supervisor</div>
            </Link>
            <Link href="/profile/users/checker" className="management-stat-box">
              <div className="management-stat-number">{counts.checker}</div>
              <div className="management-stat-label">Checker</div>
            </Link>
            <Link href="/profile/users/forklift" className="management-stat-box">
              <div className="management-stat-number">{counts.forklift}</div>
              <div className="management-stat-label">Forklift</div>
            </Link>
          </div>

          <Link href="/profile/user-form" className="add-user-btn">
            <i className="bi bi-person-plus-fill"></i>
            <span>Tambah User</span>
          </Link>
        </div>
      )}

      {multi && (
        <div className="management-card">
          <div className="management-header">
            <div className="management-title-wrap">
              <div className="management-icon"><i className="bi bi-geo-alt"></i></div>
              <div className="management-title">Pindah Lokasi</div>
            </div>
          </div>
          <p className="profile-note">
            Lokasi aktif: <strong style={{ color: "var(--text-main)" }}>{activeLocName}</strong>
          </p>
          <div className="loc-select-wrap" onClick={() => setModalOpen(true)}>
            <i className="bi bi-building" style={{ fontSize: 14, color: "var(--primary)", flexShrink: 0 }}></i>
            <div className="loc-trigger">
              <span>{triggerText}</span>
              <i className="bi bi-chevron-down" style={{ fontSize: 12, color: "var(--text-soft)" }}></i>
            </div>
          </div>
        </div>
      )}

      <div className="profile-info-grid">
        <div className="profile-info-card">
          <div className="profile-info-icon"><i className="bi bi-person"></i></div>
          <div className="profile-info-label">Username</div>
          <div className="profile-info-value">{session.user.username}</div>
        </div>
        <div className="profile-info-card">
          <div className="profile-info-icon"><i className="bi bi-shield-check"></i></div>
          <div className="profile-info-label">Role</div>
          <div className="profile-info-value">{session.user.role}</div>
        </div>
        <div className="profile-info-card">
          <div className="profile-info-icon"><i className="bi bi-geo-alt"></i></div>
          <div className="profile-info-label">ID Lokasi</div>
          <div className="profile-info-value">{session.lokasi === "all" ? "Semua Lokasi" : activeLocName}</div>
        </div>
      </div>

      {modalOpen && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="content" onClick={(e) => e.stopPropagation()}>
            <div className="hdr">
              <h3>Pilih Lokasi</h3>
              <button type="button" className="select-all" onClick={toggleAll}>{allChecked ? "Deselect All" : "Select All"}</button>
            </div>
            <div className="search">
              <i className="bi bi-search"></i>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari ID atau Nama Lokasi" />
            </div>
            <div className="body">
              {filtered.length === 0 && <div className="empty">Tidak ada lokasi</div>}
              {filtered.map((l) => {
                const checked = selected.has(l.id_pengguna_lokasi);
                return (
                  <label key={l.id_pengguna_lokasi} className={`cb ${checked ? "checked" : ""}`} onClick={() => toggle(l.id_pengguna_lokasi)}>
                    <input type="checkbox" checked={checked} readOnly />
                    <div className="box"></div>
                    <span className="cbtext">{l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}</span>
                  </label>
                );
              })}
            </div>
            <div className="footer">
              <button type="button" className="apply" onClick={applyLokasi}>
                {checkedCount === 0 ? "Pilih Lokasi" : allChecked ? "Gunakan Semua Lokasi" : `Gunakan ${checkedCount} Lokasi`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}