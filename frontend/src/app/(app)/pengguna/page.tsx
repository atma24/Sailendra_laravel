"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiGet, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

type Pengguna = {
  id_pengguna: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string | null;
  username: string;
  role: string;
  status: string;
};

const ROLES = ["Supervisor", "Checker", "Forklift", "Support", "SuperAdmin"];

export default function MasterPenggunaPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Pengguna[]>([]);
  const [lokasiOptions, setLokasiOptions] = useState<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>([]);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [f, setF] = useState({ id_pengguna_lokasi: "", username: "", password: "", role: "Supervisor", status: "Aktif" });
  const [saving, setSaving] = useState(false);

  function load() {
    apiGet<{ data: Pengguna[] }>("/pengguna")
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    load();
    apiGet<{ data: { id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[] }>("/pengguna-lokasi")
      .then((r) => setLokasiOptions(r.data || []))
      .catch(() => {});
  }, [router]);

  const filtered = rows.filter(
    (r) =>
      !keyword ||
      `${r.username} ${r.role} ${r.id_pengguna_lokasi}`.toLowerCase().includes(keyword.toLowerCase())
  );

  const lokasiLabel = (id: string) => {
    const l = lokasiOptions.find((x) => String(x.id_pengguna_lokasi) === id);
    return l ? `${l.id_pengguna_lokasi} - ${l.nama_pengguna_lokasi}` : id;
  };

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      if (editId) {
        const body: any = { role: f.role, status: f.status };
        if (f.id_pengguna_lokasi) body.id_pengguna_lokasi = f.id_pengguna_lokasi;
        if (f.username) body.username = f.username;
        if (f.password) body.password = f.password;
        await api(`/pengguna/${editId}`, { method: "PUT", body: JSON.stringify(body) });
        setMsg("Pengguna diperbarui.");
      } else {
        await api("/pengguna", { method: "POST", body: JSON.stringify(f) });
        setMsg("Pengguna disimpan.");
      }
      setShowForm(false);
      setEditId(null);
      setF({ id_pengguna_lokasi: "", username: "", password: "", role: "Supervisor", status: "Aktif" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal simpan");
    } finally {
      setSaving(false);
    }
  }

  async function hapus(id: number) {
    const ok = await window.confirm(`Hapus pengguna ${id}?`);
    if (!ok) return;
    try {
      await api(`/pengguna/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal hapus");
    }
  }

  const inputCls =
    "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";
  const labelCls = "mb-1 block text-[10px] font-extrabold text-[#172033]";

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2 text-[11px] font-extrabold text-[#172033] transition hover:border-[rgba(25,25,112,0.22)] hover:bg-white hover:text-[#191970]"
        >
          <i className="bi bi-arrow-left" />
          Kembali
        </button>
        <span className="ml-auto text-[10px] font-bold text-[#6b7280]">{filtered.length} pengguna</span>
      </div>

      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[10px] font-extrabold text-[#dc2626]">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-extrabold text-[#15803d]">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[7px] rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <div className="relative">
          <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#6b7280]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari username, role, atau lokasi"
            className={`${inputCls} pl-[31px]`}
          />
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            setF({ id_pengguna_lokasi: "", username: "", password: "", role: "Supervisor", status: "Aktif" });
          }}
          className="inline-flex h-[31px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#191970] px-2.5 text-[11px] font-extrabold text-white"
        >
          <i className="bi bi-plus-lg" />
          Tambah
        </button>
      </div>

      {showForm && (
        <form onSubmit={simpan} className="rounded-[11px] border border-[#191970] bg-white p-3">
          <div className="mb-2 text-[12px] font-black text-[#191970]">{editId ? `Edit Pengguna ${editId}` : "Tambah Pengguna"}</div>
          <div className="flex flex-col gap-[7px]">
            <div>
              <label className={labelCls}>Lokasi</label>
              <select className={inputCls} value={f.id_pengguna_lokasi} onChange={(e) => setF({ ...f, id_pengguna_lokasi: e.target.value })} required>
                <option value="">Pilih lokasi</option>
                {lokasiOptions.map((l) => (
                  <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                    {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required={!editId} />
            </div>
            <div>
              <label className={labelCls}>{editId ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}</label>
              <input type="password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required={!editId} />
            </div>
            <div className="grid grid-cols-2 gap-[7px]">
              <div>
                <label className={labelCls}>Role</label>
                <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="submit" disabled={saving} className="flex h-[31px] flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#191970] text-[11px] font-black text-white disabled:opacity-50">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="flex h-[31px] cursor-pointer items-center justify-center rounded-lg border border-[#e2e7f0] bg-white px-3 text-[11px] font-extrabold text-[#172033]">
              Batal
            </button>
          </div>
        </form>
      )}

      {filtered.map((r) => (
        <div key={r.id_pengguna} className="flex items-center gap-2 rounded-[11px] border border-[#e9edf5] bg-white px-3 py-2">
          <div className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-lg bg-[#eef0ff] text-[12px] font-extrabold text-[#191970]">
            {(r.username || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[12px] font-black text-[#172033]">
              {r.username}
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${r.status === "Aktif" ? "bg-[#d1fae5] text-[#065f46]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
                {r.status}
              </span>
            </div>
            <div className="text-[10px] font-semibold text-[#6b7280]">
              {r.role} | {lokasiLabel(r.id_pengguna_lokasi)}
            </div>
          </div>
          <button
            onClick={() => {
              setEditId(r.id_pengguna);
              setF({ id_pengguna_lokasi: r.id_pengguna_lokasi, username: r.username, password: "", role: r.role, status: r.status });
              setShowForm(true);
            }}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#eef0ff] text-[12px] text-[#191970]"
          >
            <i className="bi bi-pencil" />
          </button>
          <button
            onClick={() => hapus(r.id_pengguna)}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#fff0f0] text-[12px] text-[#ef4444]"
          >
            <i className="bi bi-trash3" />
          </button>
        </div>
      ))}
    </div>
  );
}