"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { getSession, setSession, clearSession } from "@/lib/auth";
import AuthShell, { AUTH_FORM_CSS } from "@/components/AuthShell";

type Depo = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };

const MODAL_CSS = `
.custom-modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(15, 23, 42, 0.4); z-index: 9999;
  align-items: center; justify-content: center;
}

.custom-modal-content {
  background: #FFFFFF; width: 100%; max-width: 430px;
  border-radius: 12px;
  display: flex; flex-direction: column;
  max-height: 85vh;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
  margin: 20px;
}

.c-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 20px 16px;
}

.c-modal-title { font-weight: 700; color: var(--primary); font-size: 16px; margin: 0; }
.c-modal-action { color: var(--primary); font-size: 13px; cursor: pointer; font-weight: 600; }
.c-modal-search { padding: 0 20px 16px; }
.c-search-wrap { position: relative; }
.c-search-wrap i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-soft); }
.c-search-input {
  width: 100%; padding: 12px 14px 12px 40px; border-radius: 8px;
  border: 1px solid var(--line); outline: none; font-size: 13px; color: var(--text-main);
  font-family: inherit;
}
.c-modal-body { flex: 1; overflow-y: auto; padding: 0 20px 20px; }
.c-checkbox-item {
  display: flex; align-items: center; padding: 12px 16px;
  border: 1px solid var(--line); border-radius: 8px;
  margin-bottom: 10px; cursor: pointer; transition: all .2s;
}
.c-checkbox-item.checked { border-color: var(--primary); background: #fbfcff; }
.c-checkbox-item input { display: none; }
.c-checkbox-item .custom-box {
  width: 20px; height: 20px; border: 2px solid var(--line); border-radius: 4px;
  margin-right: 12px; display: flex; align-items: center; justify-content: center;
}
.c-checkbox-item.checked .custom-box { background: var(--primary); border-color: var(--primary); }
.c-checkbox-item.checked .custom-box::after { content: '\\2713'; color: #fff; font-size: 12px; font-weight: bold; }
.c-checkbox-text { font-size: 13px; font-weight: 600; color: var(--text-main); }
.c-modal-footer { padding: 16px 20px; background: #fff; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e7f0; }
.c-btn-apply {
  width: 100%; padding: 12px; background: var(--primary); color: #FFFFFF;
  border: none; border-radius: 8px;
  font-weight: 700; font-size: 13px; cursor: pointer;
}

.select-wrap {
  position: relative;
  margin-bottom: 18px;
}

.select-icon-right {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  right: 14px;
  color: var(--text-main);
  font-size: 16px;
}

.fake-select {
  width: 100%;
  height: 48px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 42px;
  background: #fbfcff;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: .2s ease;
}

.fake-select:hover {
  border-color: var(--primary);
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(25, 25, 112, 0.08);
}
`;

export default function PilihLokasiPage() {
  const router = useRouter();
  const [depo, setDepo] = useState<Depo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    apiGet<Depo[]>("/pengguna-lokasi")
      .then((r) => setDepo(r.data || []))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Gagal memuat lokasi"));
  }, [router]);

  const filtered =
    search.trim() === ""
      ? depo
      : depo.filter((d) =>
          `${d.id_pengguna_lokasi} - ${d.nama_pengguna_lokasi}`.toLowerCase().includes(search.toLowerCase())
        );

  const allChecked = depo.length > 0 && depo.every((d) => selected.has(d.id_pengguna_lokasi));
  const checkedCount = depo.filter((d) => selected.has(d.id_pengguna_lokasi)).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allChecked ? new Set() : new Set(depo.map((d) => d.id_pengguna_lokasi)));
  }

  function applySelection() {
    const s = getSession();
    if (!s) return;
    if (checkedCount === 0) {
      setModalOpen(true);
      return;
    }
    setLoading(true);
    const lokasi = allChecked ? "all" : depo.filter((d) => selected.has(d.id_pengguna_lokasi)).map((d) => d.id_pengguna_lokasi);
    setSession({ ...s, lokasi });
    setModalOpen(false);
    router.replace("/dashboard");
  }

  const triggerText =
    selected.size === 0
      ? "Pilih 1 atau lebih lokasi"
      : allChecked
        ? "Semua Lokasi Dipilih"
        : `${checkedCount} lokasi dipilih`;

  return (
    <AuthShell
      title="Pilih Lokasi"
      error={error}
      onBack={() => {
        clearSession();
        router.replace("/login");
      }}
    >
      <style>{AUTH_FORM_CSS}</style>
      <style>{MODAL_CSS}</style>

      <div className="select-wrap">
        <div className="fake-select" onClick={() => setModalOpen(true)}>
          <span id="triggerText">{triggerText}</span>
        </div>
        <i className="bi bi-caret-down-fill select-icon-right"></i>
      </div>
      <button type="button" className="auth-btn" disabled={loading} onClick={applySelection}>
        {loading ? "Memproses..." : "Lanjut"}
      </button>

      {modalOpen && (
        <div className="custom-modal-overlay" style={{ display: "flex", opacity: 1 }} onClick={() => setModalOpen(false)}>
          <div className="custom-modal-content" style={{ transform: "translateY(0)" }} onClick={(e) => e.stopPropagation()}>
            <div className="c-modal-header">
              <h3 className="c-modal-title">Pilih Lokasi Support</h3>
              <span className="c-modal-action" style={{ cursor: "pointer" }} onClick={toggleSelectAll}>
                {allChecked ? "Deselect All" : "Select All"}
              </span>
            </div>

            <div className="c-modal-search">
              <div className="c-search-wrap">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  className="c-search-input"
                  placeholder="Cari ID Lokasi atau Nama Lokasi"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="c-modal-body" id="lokasiList">
              {filtered.map((d) => {
                const checked = selected.has(d.id_pengguna_lokasi);
                const full = `${d.id_pengguna_lokasi} - ${d.nama_pengguna_lokasi}`;
                return (
                  <label
                    key={d.id_pengguna_lokasi}
                    className={`c-checkbox-item ${checked ? "checked" : ""}`}
                    style={{ display: "flex" }}
                  >
                    <input
                      type="checkbox"
                      className="loc-checkbox"
                      value={d.id_pengguna_lokasi}
                      checked={checked}
                      onChange={() => toggle(d.id_pengguna_lokasi)}
                    />
                    <div className="custom-box"></div>
                    <span className="c-checkbox-text">{full}</span>
                  </label>
                );
              })}
            </div>

            <div className="c-modal-footer">
              <button type="button" className="c-btn-apply" onClick={applySelection}>
                {checkedCount > 0 ? `Gunakan ${checkedCount} Lokasi` : "Pilih Lokasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  );
}