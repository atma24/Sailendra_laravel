"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, isMultiRole, setSession } from "@/lib/auth";

type Lokasi = { id_pengguna_lokasi: string; nama_pengguna_lokasi: string };

export default function PilihLokasiPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [lokasi, setLokasi] = useState<Lokasi[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [multiValue, setMultiValue] = useState<"all" | string[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const multi = user ? isMultiRole(user.role) : false;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setUser(s.user);
    if (isMultiRole(s.user.role)) {
      apiGet<{ data: Lokasi[] }>("/pengguna-lokasi")
        .then((r) => setLokasi(r.data || []))
        .catch(() => setLokasi([]))
        .finally(() => setReady(true));
    } else {
      // role biasa: lokasi milik user dari hasil login (akun_lokasi)
      const akun = (s.user.akun_lokasi || []).filter(
        (a: any) => a.id_pengguna_lokasi != null
      );
      setLokasi(
        akun.map((a: any) => ({
          id_pengguna_lokasi: String(a.id_pengguna_lokasi),
          nama_pengguna_lokasi: a.nama_pengguna_lokasi || "",
        }))
      );
      setReady(true);
    }
  }, [router]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === lokasi.length ? new Set() : new Set(lokasi.map((l) => l.id_pengguna_lokasi))));
  }

  function apply() {
    if (selected.size === 0) return;
    const val: "all" | string[] = selected.size === lokasi.length ? "all" : [...selected];
    setMultiValue(val);
    setShowModal(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (multi) {
      if (multiValue === "all") {
        setSession({ user, lokasi: "all" });
        router.replace("/dashboard");
      } else if (multiValue.length > 0) {
        setSession({ user, lokasi: multiValue });
        router.replace("/dashboard");
      } else {
        setError("Silakan pilih minimal 1 lokasi terlebih dahulu.");
      }
    } else {
      const sel = lokasi.find((l) => selected.has(l.id_pengguna_lokasi));
      if (!sel) return;
      setSession({ user, lokasi: [sel.id_pengguna_lokasi] });
      router.replace("/dashboard");
    }
  }

  if (!ready || !user) return null;

  const filtered = lokasi.filter(
    (l) => `${l.id_pengguna_lokasi} ${l.nama_pengguna_lokasi}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb] p-6">
      <div className="relative grid w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08)] md:grid-cols-[0.9fr_1.1fr]">
        <button
          onClick={() => router.replace("/login")}
          className="absolute left-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-[#e2e8f0] bg-[#f4f6fb] text-[20px] transition hover:border-[#191970] hover:bg-white hover:text-[#191970]"
          aria-label="Kembali"
        >
          ‹
        </button>
        <div
          className="hidden min-h-[600px] bg-white bg-center bg-no-repeat md:block"
          style={{ backgroundImage: "url(/logo-login.jpg)", backgroundSize: "82% auto" }}
        />
        <div className="flex items-center justify-center p-[52px]">
          <div className="w-full max-w-[380px]">
            <h1 className="mb-6 text-[28px] font-extrabold leading-tight tracking-tight text-[#191970]">
              Pilih Lokasi
            </h1>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-[13px] font-bold text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              {multi ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="flex h-12 w-full cursor-pointer items-center justify-between rounded-lg border border-[#e2e8f0] bg-[#fbfcff] px-[42px] text-sm font-semibold outline-none transition focus:border-[#191970] focus:ring-[3px] focus:ring-[rgba(25,25,112,0.08)]"
                  >
                    <span className="text-left">
                      {multiValue === "all" ? "Semua Lokasi Dipilih" : multiValue.length ? `${multiValue.length} lokasi dipilih` : "Pilih 1 atau lebih lokasi"}
                    </span>
                    <span className="text-[#6b7280]">▼</span>
                  </button>
                  {/* trigger semantics handled via hidden field */}
                  <input type="checkbox" checked={multiValue === "all"} readOnly className="hidden" />
                </>
              ) : (
                <select
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) setSelected(new Set([id]));
                  }}
                  className="h-12 w-full cursor-pointer appearance-none rounded-lg border border-[#e2e8f0] bg-[#fbfcff] px-4 text-sm font-semibold outline-none transition focus:border-[#191970] focus:ring-[3px] focus:ring-[rgba(25,25,112,0.08)]"
                >
                  <option value="">Pilih Lokasi Anda</option>
                  {lokasi.map((l) => (
                    <option key={l.id_pengguna_lokasi} value={l.id_pengguna_lokasi}>
                      {l.id_pengguna_lokasi} - {l.nama_pengguna_lokasi}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="submit"
                className="mt-2 h-12 w-full cursor-pointer rounded-lg bg-[#191970] font-bold text-white transition hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(25,25,112,0.2)]"
              >
                Lanjut
              </button>
            </form>
          </div>
        </div>
      </div>

      {showModal && multi && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(15,23,42,0.4)] p-5">
          <div className="flex max-h-[85vh] w-full max-w-[430px] flex-col rounded-xl bg-white shadow-[0_10px_30px_rgba(15,23,42,0.15)]">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <h3 className="m-0 text-base font-bold text-[#191970]">Pilih Lokasi Support</h3>
              <button
                onClick={toggleAll}
                className="cursor-pointer text-[13px] font-semibold text-[#191970]"
              >
                {selected.size === lokasi.length && lokasi.length > 0 ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="px-5 pb-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari ID Lokasi atau Nama Lokasi"
                  className="w-full rounded-lg border border-[#e2e8f0] py-3 pl-10 pr-4 text-[13px] outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {filtered.map((l) => {
                const id = l.id_pengguna_lokasi;
                const checked = selected.has(id);
                return (
                  <label
                    key={id}
                    onClick={() => toggle(id)}
                    className={`mb-2.5 flex cursor-pointer items-center rounded-lg border p-3 transition ${checked ? "border-[#191970] bg-[#fbfcff]" : "border-[#e2e8f0]"}`}
                  >
                    <span className={`mr-3 flex h-5 w-5 items-center justify-center rounded border-2 ${checked ? "border-[#191970] bg-[#191970]" : "border-[#e2e8f0]"}`}>
                      {checked && <span className="text-[12px] font-bold text-white">✓</span>}
                    </span>
                    <span className="text-[13px] font-semibold">{id} - {l.nama_pengguna_lokasi}</span>
                  </label>
                );
              })}
            </div>
            <div className="rounded-b-xl border-t border-[#e2e8f0] bg-white px-5 py-4">
              <button
                onClick={apply}
                className="w-full cursor-pointer rounded-lg bg-[#191970] py-3 text-[13px] font-bold text-white"
              >
                {selected.size > 0 ? `Gunakan ${selected.size} Lokasi` : "Pilih Lokasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}