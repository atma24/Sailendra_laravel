"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiGet, ApiError } from "@/lib/api";
import { getSession, isMultiRole } from "@/lib/auth";

type Lokasi = { id_lokasi: number; nama_lokasi: string; kategori: string };
type Block = { id_block: number; id_lokasi: number; kode_block: string; jumlah_line: number };
type DeepCell = { id_deep: number; deep: number; kapasitas: number; terpakai: number; status: string };
type Level = { id_level: number; level: number; deep: DeepCell[] };
type Line = {
  id_line: number;
  nomor_line: number;
  total_kapasitas: number;
  total_terpakai: number;
  nama_produk: string;
  level: Level[];
};
type BlockLayout = {
  id_block: number;
  id_lokasi: number;
  kode_block: string;
  total_kapasitas: number;
  total_terpakai: number;
  line: Line[];
};

const inputCls =
  "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";

export default function HistoryLayoutPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [depoList, setDepoList] = useState<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>([]);
  const [selectedDepo, setSelectedDepo] = useState("");
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [selectedLokasi, setSelectedLokasi] = useState(0);
  const [blockList, setBlockList] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [layout, setLayout] = useState<BlockLayout[]>([]);
  const [keyword, setKeyword] = useState("");

  const [showSalin, setShowSalin] = useState(false);
  const [salinType, setSalinType] = useState("reguler");
  const [salinKode, setSalinKode] = useState("");
  const [showAddLine, setShowAddLine] = useState(false);
  const [addLineNomor, setAddLineNomor] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<Record<string, HTMLDivElement>>({});

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
  }, [router]);

  useEffect(() => {
    if (!session) return;
    apiGet<{ data: { id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[] }>("/pengguna-lokasi")
      .then((r) => {
        const list = r.data || [];
        setDepoList(list);
        if (multi && !list.some((x) => x.id_pengguna_lokasi === aktifDepoId()) && list.length > 0) {
          setSelectedDepo(list[0].id_pengguna_lokasi);
        }
      })
      .catch((e) => setError(e.message));
    apiGet<{ data: Lokasi[] }>("/lokasi")
      .then((r) => setLokasiList(r.data || []))
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const depo = aktifDepoId();
    if (!depo) return;
    const q = selectedLokasi > 0 ? `&id_lokasi=${selectedLokasi}` : "";
    apiGet<{ data: Block[] }>(`/block?id_pengguna_lokasi=${depo}${q}`)
      .then((r) => {
        setBlockList(r.data || []);
        setSelectedBlock(0);
        setLayout([]);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepo, selectedLokasi, session]);

  useEffect(() => {
    const depo = aktifDepoId();
    if (!depo || selectedBlock <= 0) return;
    const q = selectedLokasi > 0 ? `&id_lokasi=${selectedLokasi}` : "";
    apiGet<{ data: BlockLayout[] }>(`/layout-gudang/ambil-layout?id_pengguna_lokasi=${depo}&id_block=${selectedBlock}${q}`)
      .then((r) => setLayout(r.data || []))
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlock, selectedDepo, selectedLokasi, session]);

  const activeBlock = layout[0] || null;

  const filteredLines = useMemo(() => {
    if (!activeBlock) return [];
    const kw = keyword.trim().toUpperCase();
    return (activeBlock.line || []).filter((ln) => {
      if (!kw) return true;
      const kode = activeBlock.kode_block.toUpperCase();
      return `${kode}-${ln.nomor_line} ${kode} ${ln.nomor_line}`.includes(kw);
    });
  }, [activeBlock, keyword]);

  function scrollDeepRow(key: string, dir: number) {
    const el = scrollRef.current[key];
    if (!el) return;
    el.scrollBy({ left: dir * 160, behavior: "smooth" });
  }

  async function eksekusiSalin() {
    const kode = salinKode.trim().toUpperCase();
    if (!kode) return setError("Isi kode block baru.");
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api("/layout-gudang/salin-block", {
        method: "POST",
        body: JSON.stringify({
          role: session!.user.role,
          id_pengguna_lokasi: aktifDepoId(),
          id_block_sumber: selectedBlock,
          kode_block_baru: kode,
        }),
      });
      setMsg(`Block berhasil disalin ke ${kode}.`);
      setShowSalin(false);
      setSalinKode("");
      const q = selectedLokasi > 0 ? `&id_lokasi=${selectedLokasi}` : "";
      const r = await apiGet<{ data: Block[] }>(`/block?id_pengguna_lokasi=${aktifDepoId()}${q}`);
      setBlockList(r.data || []);
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Gagal menyalin block");
    } finally {
      setBusy(false);
    }
  }

  async function hapusBlock() {
    if (!selectedBlock) return;
    const ok = window.confirm("Hapus block ini? Block hanya bisa dihapus jika sudah tidak memiliki line.");
    if (!ok) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api(`/block/${selectedBlock}`, {
        method: "DELETE",
        body: JSON.stringify({ role: session!.user.role, id_pengguna_lokasi: aktifDepoId() }),
      });
      setMsg("Block berhasil dihapus.");
      setSelectedBlock(0);
      setLayout([]);
      const q = selectedLokasi > 0 ? `&id_lokasi=${selectedLokasi}` : "";
      const r = await apiGet<{ data: Block[] }>(`/block?id_pengguna_lokasi=${aktifDepoId()}${q}`);
      setBlockList(r.data || []);
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Gagal menghapus block");
    } finally {
      setBusy(false);
    }
  }

  async function tambahLine() {
    const n = parseInt(addLineNomor, 10);
    if (!n) return setError("Isi nomor line baru.");
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api("/line", {
        method: "POST",
        body: JSON.stringify({
          role: session!.user.role,
          id_pengguna_lokasi: aktifDepoId(),
          id_block: selectedBlock,
          nomor_line: n,
        }),
      });
      setMsg(`Line ${n} ditambahkan.`);
      setShowAddLine(false);
      setAddLineNomor("");
      const q = selectedLokasi > 0 ? `&id_lokasi=${selectedLokasi}` : "";
      const r = await apiGet<{ data: BlockLayout[] }>(`/layout-gudang/ambil-layout?id_pengguna_lokasi=${aktifDepoId()}&id_block=${selectedBlock}${q}`);
      setLayout(r.data || []);
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Gagal menambah line");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[7px]">
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

      <div className="flex items-center gap-[6px] overflow-x-auto rounded-[11px] border border-[#e9edf5] bg-white px-2.5 py-2">
        {lokasiList.map((l) => {
          const chosen = l.id_lokasi === selectedLokasi;
          return (
            <button
              key={l.id_lokasi}
              onClick={() => setSelectedLokasi(chosen ? 0 : l.id_lokasi)}
              className={`h-[30px] shrink-0 cursor-pointer rounded-[9px] px-3 text-[11px] font-black transition ${chosen ? "bg-[#191970] text-white" : "bg-[#f6f7f9] text-[#172033] hover:bg-[#eef0ff]"}`}
            >
              {l.kategori || l.nama_lokasi}
            </button>
          );
        })}
      </div>

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-2.5">
        <div className="relative">
          <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#8a93a3]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari line contoh: A-1"
            className="h-[33px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] pl-[31px] text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white"
          />
        </div>

        {blockList.length === 0 ? (
          <div className="mt-2 text-[11px] font-bold text-[#6b7280]">Data block belum tersedia untuk lokasi ini.</div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {blockList.map((b) => (
              <button
                key={b.id_block}
                onClick={() => setSelectedBlock(b.id_block)}
                className={`h-[28px] cursor-pointer rounded-lg border px-3 text-[11px] font-black transition ${
                  selectedBlock === b.id_block
                    ? "border-[#191970] bg-[#191970] text-white"
                    : "border-[#e2e7f0] bg-white text-[#172033] hover:border-[#191970] hover:text-[#191970]"
                }`}
              >
                Block {b.kode_block}
              </button>
            ))}
          </div>
        )}

        {selectedBlock > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[#e9edf5] pt-2.5">
            <button
              onClick={() => setShowSalin(true)}
              className="flex h-[28px] cursor-pointer items-center gap-1.5 rounded-lg bg-[#191970] px-3 text-[11px] font-black text-white"
            >
              <i className="bi bi-files" />
              Salin block ini
            </button>
            <button
              onClick={() => setShowAddLine(true)}
              className="flex h-[28px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#e2e7f0] bg-white px-3 text-[11px] font-black text-[#172033] hover:text-[#191970]"
            >
              <i className="bi bi-plus-lg" />
              Tambah line
            </button>
            <button
              onClick={hapusBlock}
              disabled={busy}
              className="flex h-[28px] cursor-pointer items-center gap-1.5 rounded-lg bg-[#fff0f0] px-3 text-[11px] font-black text-[#ef4444] disabled:opacity-50"
            >
              <i className="bi bi-trash3" />
              Hapus block
            </button>
          </div>
        )}
      </div>

      {selectedBlock <= 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-3 py-4 text-center text-[11px] font-bold text-[#6b7280]">
          Pilih block untuk melihat layout.
        </div>
      ) : !activeBlock || filteredLines.length === 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-3 py-4 text-center text-[11px] font-bold text-[#6b7280]">
          Layout pada block ini belum memiliki line, level, atau deep.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[7px] xl:grid-cols-2">
          {filteredLines.map((line) => {
            const levels = [...(line.level || [])].sort((a, b) => b.level - a.level);
            return (
              <div key={line.id_line} className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-black tracking-tight text-[#172033]">
                      Block {activeBlock.kode_block} Line {line.nomor_line}
                    </div>
                    {line.nama_produk && <div className="text-[11px] font-bold text-[#191970]">{line.nama_produk}</div>}
                    <div className="text-[10px] font-semibold text-[#6b7280]">
                      Kapasitas total: <strong className="text-[#172033]">{line.total_kapasitas}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {levels.map((lv) => {
                    const deeps = [...(lv.deep || [])].sort((a, b) => a.deep - b.deep);
                    const many = deeps.length > 7;
                    const key = `deepRow_${selectedBlock}_${line.nomor_line}_${lv.level}`;
                    return (
                      <div key={lv.id_level} className="flex items-center gap-2">
                        <span className="w-[17px] shrink-0 text-[10px] font-black text-[#6b7280]">L{lv.level}</span>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          {many && (
                            <button
                              onClick={() => scrollDeepRow(key, -1)}
                              className="flex h-[26px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#e2e7f0] bg-white text-[10px] text-[#6b7280]"
                            >
                              <i className="bi bi-chevron-left" />
                            </button>
                          )}
                          <div
                            ref={(el) => {
                              if (el) scrollRef.current[key] = el;
                            }}
                            className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
                          >
                            {deeps.map((d) => (
                              <span
                                key={d.id_deep}
                                className="flex h-[27px] w-full min-w-[46px] shrink-0 items-center justify-center rounded-[7px] border border-[#dcdfe6] bg-[#f6f7f9] text-[10px] font-black text-[#b5bac2]"
                              >
                                {d.kapasitas || "-"}
                              </span>
                            ))}
                          </div>
                          {many && (
                            <button
                              onClick={() => scrollDeepRow(key, 1)}
                              className="flex h-[26px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#e2e7f0] bg-white text-[10px] text-[#6b7280]"
                            >
                              <i className="bi bi-chevron-right" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showSalin && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4" onClick={() => setShowSalin(false)}>
          <div className="w-full max-w-[400px] rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[15px] font-black tracking-tight text-[#191970]">Salin Block</div>
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="mb-1 block text-[10px] font-extrabold text-[#172033]">Tipe Block</label>
                <select value={salinType} onChange={(e) => { setSalinType(e.target.value); if (e.target.value !== "reguler") setSalinKode(e.target.value); }} className={inputCls}>
                  <option value="reguler">Reguler (isi kode sendiri)</option>
                  <option value="MOBIL">MOBIL</option>
                  <option value="RECEH">RECEH</option>
                  <option value="TRANSIT">TRANSIT</option>
                  <option value="BADSTOCK">BADSTOCK</option>
                  <option value="REJECT">REJECT</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold text-[#172033]">Kode Block Baru</label>
                <input value={salinKode} onChange={(e) => setSalinKode(e.target.value.toUpperCase())} placeholder="Contoh B" className={inputCls} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={eksekusiSalin} disabled={busy} className="flex h-[32px] flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#191970] text-[11px] font-black text-white disabled:opacity-50">
                {busy ? "Menyimpan..." : "Salin Block"}
              </button>
              <button onClick={() => setShowSalin(false)} className="flex h-[32px] cursor-pointer items-center justify-center rounded-lg border border-[#e2e7f0] bg-white px-3 text-[11px] font-extrabold text-[#172033]">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddLine && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4" onClick={() => setShowAddLine(false)}>
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[15px] font-black tracking-tight text-[#191970]">Tambah Line di Block Ini</div>
            <input type="number" min="1" value={addLineNomor} onChange={(e) => setAddLineNomor(e.target.value)} placeholder="Nomor line (contoh 5)" className={inputCls} />
            <div className="mt-1 text-[10px] font-semibold text-[#6b7280]">Line baru mengikuti struktur level &amp; deep dari line tertinggi.</div>
            <div className="mt-3 flex gap-2">
              <button onClick={tambahLine} disabled={busy} className="flex h-[32px] flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#191970] text-[11px] font-black text-white disabled:opacity-50">
                {busy ? "Menyimpan..." : "Tambah Line"}
              </button>
              <button onClick={() => setShowAddLine(false)} className="flex h-[32px] cursor-pointer items-center justify-center rounded-lg border border-[#e2e7f0] bg-white px-3 text-[11px] font-extrabold text-[#172033]">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
