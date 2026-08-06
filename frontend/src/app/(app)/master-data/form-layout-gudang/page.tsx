"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiGet, ApiError } from "@/lib/api";
import { getSession, isMultiRole } from "@/lib/auth";

type Produk = { id_produk: number; nama_produk: string };
type Lokasi = { id_lokasi: number; nama_lokasi: string; kategori: string };

const BLOCK_TYPES = ["reguler", "MOBIL", "RECEH", "TRANSIT", "BADSTOCK", "REJECT"];

const inputCls =
  "h-[34px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[12px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";

export default function FormLayoutGudangPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [depoList, setDepoList] = useState<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>([]);
  const [selectedDepo, setSelectedDepo] = useState("");

  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [idProduk, setIdProduk] = useState(0);
  const [produkLabel, setProdukLabel] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [produkSearch, setProdukSearch] = useState("");

  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [idLokasi, setIdLokasi] = useState(0);
  const [blockType, setBlockType] = useState("reguler");
  const [kodeBlock, setKodeBlock] = useState("");

  const [lineDari, setLineDari] = useState("");
  const [lineSampai, setLineSampai] = useState("");

  // config per line: [nomor_line][{level, jumlah_deep, kapasitas}]
  const [lineConfig, setLineConfig] = useState<Record<number, { level: number; jumlah_deep: number; kapasitas: number }[]>>({});

  const multi = session ? isMultiRole(session.user.role) : false;

  function aktifDepoId() {
    if (!session) return "";
    if (multi) return selectedDepo || String(session.lokasi?.[0] ?? session.user.id_pengguna_lokasi ?? "");
    return String(session.user.id_pengguna_lokasi ?? "");
  }

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    apiGet<{ data: Produk[] }>("/produk?limit=1000")
      .then((r) => setProdukList(r.data || []))
      .catch((e) => setError(e.message));
    apiGet<{ data: Lokasi[] }>("/lokasi")
      .then((r) => setLokasiList(r.data || []))
      .catch((e) => setError(e.message));
    if (isMultiRole(s.user.role)) {
      apiGet<{ data: { id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[] }>("/pengguna-lokasi")
        .then((r) => {
          const list = r.data || [];
          setDepoList(list);
          const cur = String(s.lokasi?.[0] ?? s.user.id_pengguna_lokasi ?? "");
          if (cur && list.some((x) => x.id_pengguna_lokasi === cur)) setSelectedDepo(cur);
        })
        .catch((e) => setError(e.message));
    }
  }, [router]);

  const lineNumbers = (() => {
    const a = parseInt(lineDari, 10);
    const b = parseInt(lineSampai, 10);
    if (!a || !b) return [];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  })();

  const filteredProduk = produkList.filter(
    (p) =>
      !produkSearch ||
      `${p.id_produk} ${p.nama_produk}`.toUpperCase().includes(produkSearch.trim().toUpperCase())
  );

  function addLevel(line: number) {
    setLineConfig((prev) => {
      const cur = prev[line] || [];
      const nextLevel = cur.length > 0 ? Math.max(...cur.map((l) => l.level)) + 1 : 1;
      return { ...prev, [line]: [...cur, { level: nextLevel, jumlah_deep: 1, kapasitas: 0 }] };
    });
  }

  function updateLevel(line: number, idx: number, patch: Partial<{ level: number; jumlah_deep: number; kapasitas: number }>) {
    setLineConfig((prev) => {
      const cur = [...(prev[line] || [])];
      cur[idx] = { ...cur[idx], ...patch };
      return { ...prev, [line]: cur };
    });
  }

  function removeLevel(line: number, idx: number) {
    setLineConfig((prev) => {
      const cur = [...(prev[line] || [])];
      cur.splice(idx, 1);
      return { ...prev, [line]: cur };
    });
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!idProduk) return setError("Pilih produk terlebih dahulu.");
    if (!idLokasi) return setError("Pilih lokasi.");
    const kode = kodeBlock.trim().toUpperCase();
    if (!kode) return setError("Isi kode block.");

    const lines = lineNumbers;
    if (lines.length === 0) return setError("Isi range line (dari & sampai).");

    const payload = lines.map((n) => {
      const lv = lineConfig[n] || [];
      return {
        line: n,
        levels: lv.map((l) => ({ level: l.level, jumlah_deep: l.jumlah_deep, kapasitas: l.kapasitas })),
      };
    });

    if (payload.some((p) => p.levels.length === 0)) {
      return setError(`Line ${payload.find((p) => p.levels.length === 0)!.line}: tambahkan minimal 1 level.`);
    }
    if (payload.some((p) => p.levels.some((l) => l.jumlah_deep <= 0 || l.kapasitas <= 0))) {
      return setError("Setiap level wajib jumlah deep & kapasitas > 0.");
    }

    setSaving(true);
    try {
      await api("/layout-gudang/simpan-layout", {
        method: "POST",
        body: JSON.stringify({
          role: session!.user.role,
          id_pengguna_lokasi: aktifDepoId(),
          id_lokasi: idLokasi,
          id_produk: idProduk,
          kode_block: kode,
          kode_block_type: blockType,
          lines: payload,
        }),
      });
      setMsg("Layout gudang berhasil disimpan.");
      setIdProduk(0);
      setProdukLabel("");
      setKodeBlock("");
      setLineDari("");
      setLineSampai("");
      setLineConfig({});
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Gagal menyimpan layout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-[7px]">
      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[11px] font-extrabold text-[#dc2626]">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[11px] font-extrabold text-[#15803d]">
          {msg}
        </div>
      )}

      {multi && depoList.length > 1 && (
        <div className="flex items-center gap-2.5 rounded-[11px] border border-[#e9edf5] bg-white px-3 py-2.5">
          <span className="text-[11px] font-black text-[#172033]">Pilih Lokasi/Depo:</span>
          <select
            value={selectedDepo || aktifDepoId()}
            onChange={(e) => setSelectedDepo(e.target.value)}
            className="h-[31px] rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none"
          >
            {depoList.map((d) => (
              <option key={d.id_pengguna_lokasi} value={d.id_pengguna_lokasi}>
                {d.id_pengguna_lokasi} - {d.nama_pengguna_lokasi}
              </option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={simpan} className="flex flex-col gap-[7px]">
        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-2 text-[14px] font-black tracking-tight text-[#191970]">1. Produk</div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="flex h-[34px] w-full items-center justify-between rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[12px] font-bold text-[#172033]"
            >
              <span className={produkLabel ? "" : "text-[#8a93a3]"}>{produkLabel || "Pilih produk"}</span>
              <i className="bi bi-chevron-down text-[11px] text-[#6b7280]" />
            </button>
            {showPicker && (
              <div className="absolute left-0 right-0 top-[38px] z-[1050] rounded-xl border border-[#e2e7f0] bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                <div className="relative mb-1.5">
                  <i className="bi bi-search absolute left-[9px] top-1/2 -translate-y-1/2 text-[12px] text-[#8a93a3]" />
                  <input
                    value={produkSearch}
                    onChange={(e) => setProdukSearch(e.target.value)}
                    placeholder="Cari ID atau nama produk"
                    className={`${inputCls} pl-[27px]`}
                    autoFocus
                  />
                </div>
                <div className="max-h-[220px] overflow-y-auto">
                  {filteredProduk.length === 0 && (
                    <div className="px-2 py-2 text-[11px] font-bold text-[#6b7280]">Produk tidak ditemukan</div>
                  )}
                  {filteredProduk.map((p) => (
                    <button
                      key={p.id_produk}
                      type="button"
                      onClick={() => {
                        setIdProduk(p.id_produk);
                        setProdukLabel(`${p.id_produk} - ${p.nama_produk}`);
                        setShowPicker(false);
                      }}
                      className="block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-[12px] font-bold text-[#172033] hover:bg-[#f3f5fb]"
                    >
                      {p.id_produk} - {p.nama_produk}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-1 text-[10px] font-semibold text-[#6b7280]">Satu kali simpan hanya untuk satu produk.</div>
        </div>

        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-2 text-[14px] font-black tracking-tight text-[#191970]">2. Lokasi &amp; Block</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[#172033]">Lokasi</label>
              <select value={idLokasi} onChange={(e) => setIdLokasi(+e.target.value)} className={inputCls}>
                <option value={0}>Pilih lokasi</option>
                {lokasiList.map((l) => (
                  <option key={l.id_lokasi} value={l.id_lokasi}>
                    {l.kategori || l.nama_lokasi}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[#172033]">Tipe Block</label>
              <select
                value={blockType}
                onChange={(e) => {
                  const t = e.target.value;
                  setBlockType(t);
                  if (t !== "reguler" && (kodeBlock === "" || kodeBlock === blockType)) {
                    setKodeBlock(t);
                  }
                }}
                className={inputCls}
              >
                {BLOCK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "reguler" ? "Reguler (isi kode sendiri)" : t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[#172033]">Kode Block</label>
              <input
                value={kodeBlock}
                onChange={(e) => setKodeBlock(e.target.value.toUpperCase())}
                placeholder="Contoh A, B, AA, B2"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-2 text-[14px] font-black tracking-tight text-[#191970]">3. Line</div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[#172033]">Dari Line</label>
              <input type="number" min="1" value={lineDari} onChange={(e) => setLineDari(e.target.value)} placeholder="Contoh 1" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[#172033]">Sampai Line</label>
              <input type="number" min="1" value={lineSampai} onChange={(e) => setLineSampai(e.target.value)} placeholder="Contoh 4" className={inputCls} />
            </div>
          </div>
          <div className="mt-1 text-[10px] font-semibold text-[#6b7280]">
            Contoh: dari 1 sampai 4 berarti sistem membuat Line 1, Line 2, Line 3, dan Line 4.
          </div>
        </div>

        <div className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
          <div className="mb-2 text-[14px] font-black tracking-tight text-[#191970]">4. Level dan Deep</div>
          {lineNumbers.length === 0 ? (
            <div className="rounded-lg bg-[#fbfcff] px-3 py-3 text-[11px] font-bold text-[#6b7280]">
              Isi range line terlebih dahulu, lalu form level dan deep akan muncul otomatis.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {lineNumbers.map((n) => {
                const lv = lineConfig[n] || [];
                return (
                  <div key={n} className="rounded-xl border border-[#e9edf5] bg-[#fbfcff] p-2.5">
                    <div className="mb-2 text-[12px] font-black text-[#191970]">Line {n}</div>
                    {lv.map((l, idx) => (
                      <div key={idx} className="mb-2 rounded-lg border border-[#e9edf5] bg-white p-2">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-black text-[#172033]">Level {l.level}</span>
                          <button type="button" onClick={() => removeLevel(n, idx)} className="cursor-pointer p-0.5 text-[#ef4444]">
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[9px] font-extrabold text-[#6b7280]">Level</label>
                            <input type="number" min="1" value={l.level} onChange={(e) => updateLevel(n, idx, { level: +e.target.value })} className={inputCls} />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[9px] font-extrabold text-[#6b7280]">Jumlah Deep</label>
                            <input type="number" min="1" value={l.jumlah_deep} onChange={(e) => updateLevel(n, idx, { jumlah_deep: +e.target.value })} className={inputCls} />
                          </div>
                          <div className="col-span-2">
                            <label className="mb-0.5 block text-[9px] font-extrabold text-[#6b7280]">Kapasitas per Deep</label>
                            <input type="number" min="1" value={l.kapasitas} onChange={(e) => updateLevel(n, idx, { kapasitas: +e.target.value })} className={inputCls} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addLevel(n)}
                      className="flex h-[30px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#191970] text-[11px] font-extrabold text-[#191970] hover:bg-[#eef0ff]"
                    >
                      <i className="bi bi-plus-lg" />
                      Tambah Level
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#191970] text-[13px] font-black text-white transition hover:-translate-y-px hover:shadow-[0_14px_28px_rgba(25,25,112,0.22)] disabled:opacity-50"
        >
          <i className="bi bi-save2" />
          {saving ? "Menyimpan..." : "Simpan Layout Gudang"}
        </button>
      </form>
    </div>
  );
}
