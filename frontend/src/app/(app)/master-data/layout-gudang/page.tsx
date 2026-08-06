"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSession, isMultiRole } from "@/lib/auth";

type Lokasi = { id_lokasi: number; nama_lokasi: string; kategori: string; label_lokasi?: string };
type Block = { id_block: number; id_lokasi: number; kode_block: string; jumlah_line: number };
type DeepCell = {
  id_deep: number;
  deep: number;
  kapasitas: number;
  terpakai: number;
  status: string;
  best_before: string | null;
  batch: string;
};
type Level = { id_level: number; level: number; deep: DeepCell[] };
type Line = {
  id_line: number;
  nomor_line: number;
  total_kapasitas: number;
  total_terpakai: number;
  id_produk: number;
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

const STATUS_META: Record<string, { label: string; color: string; border: string; fill: string }> = {
  release: { label: "Release", color: "#2E7D32", border: "rgba(46,125,50,.45)", fill: "rgba(46,125,50,.22)" },
  hold: { label: "Hold", color: "#F9A825", border: "rgba(249,168,37,.45)", fill: "rgba(249,168,37,.22)" },
  blank: { label: "-", color: "#BDBDBD", border: "rgba(189,189,189,.45)", fill: "rgba(189,189,189,.22)" },
  full: { label: "Full", color: "#D32F2F", border: "rgba(211,47,47,.45)", fill: "rgba(211,47,47,.22)" },
  gallon: { label: "Gallon Kosong", color: "#7E57C2", border: "rgba(126,87,194,.45)", fill: "rgba(126,87,194,.22)" },
  reject: { label: "Reject", color: "#C62828", border: "rgba(211,47,47,.55)", fill: "rgba(211,47,47,.25)" },
  badstok: { label: "Bad Stock", color: "#424242", border: "rgba(97,97,97,.5)", fill: "rgba(97,97,97,.22)" },
};

const LEGEND_ORDER = ["release", "hold", "blank", "full", "gallon", "reject", "badstok"];

export default function LayoutGudangPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [error, setError] = useState("");

  const [depoList, setDepoList] = useState<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>([]);
  const [selectedDepo, setSelectedDepo] = useState("");
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [selectedLokasi, setSelectedLokasi] = useState(0);
  const [blockList, setBlockList] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [layout, setLayout] = useState<BlockLayout[]>([]);
  const [keyword, setKeyword] = useState("");

  const [detailDeep, setDetailDeep] = useState<{ line: string; status: string; batch: string; qty: string } | null>(null);
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
    const depo = aktifDepoId();
    if (!depo) return;

    apiGet<{ data: { id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[] }>("/pengguna-lokasi")
      .then((r) => {
        const list = r.data || [];
        setDepoList(list);
        if (multi && !list.some((x) => x.id_pengguna_lokasi === depo) && list.length > 0) {
          setSelectedDepo(list[0].id_pengguna_lokasi);
        }
      })
      .catch((e) => setError(e.message));

    apiGet<{ data: Lokasi[] }>("/lokasi")
      .then((r) => {
        setLokasiList(r.data || []);
      })
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

  function statusOf(deep: DeepCell): string {
    const s = (deep.status || "blank").toLowerCase();
    if (STATUS_META[s]) return s;
    if ((deep.terpakai ?? 0) <= 0) return "blank";
    if ((deep.kapasitas ?? 0) > 0 && deep.terpakai >= deep.kapasitas) return "full";
    return "blank";
  }

  const canEdit = session && (session.user.role === "Supervisor" || session.user.role === "SuperAdmin");

  return (
    <div className="flex flex-col gap-[7px]">
      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff0f0] px-2.5 py-2 text-[10px] font-extrabold text-[#dc2626]">
          {error}
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
        {lokasiList.length === 0 && <div className="text-[11px] font-bold text-[#6b7280]">Data lokasi belum tersedia.</div>}
        {lokasiList.map((l) => {
          const label = l.kategori || l.nama_lokasi || "-";
          const active = l.id_lokasi === selectedLokasi || (selectedLokasi === 0 && l.id_lokasi === lokasiList[0]?.id_lokasi);
          const chosen = l.id_lokasi === selectedLokasi;
          return (
            <button
              key={l.id_lokasi}
              onClick={() => setSelectedLokasi(chosen ? 0 : l.id_lokasi)}
              className={`h-[30px] shrink-0 cursor-pointer rounded-[9px] px-3 text-[11px] font-black transition ${active && !chosen ? "bg-[#191970] text-white" : active ? "bg-[#eef0ff] text-[#191970]" : "bg-[#f6f7f9] text-[#172033] hover:bg-[#eef0ff]"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {LEGEND_ORDER.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold"
              style={{ color: STATUS_META[k].color, borderColor: STATUS_META[k].border }}
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_META[k].color }} />
              {STATUS_META[k].label}
            </span>
          ))}
        </div>

        <div className="relative mt-2">
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
          <div className="mt-2 flex flex-wrap gap-1.5">
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
      </div>

      {selectedBlock <= 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-3 py-4 text-center text-[11px] font-bold text-[#6b7280]">
          Pilih block untuk melihat layout gudang.
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
                      Total: <strong className="text-[#172033]">{line.total_terpakai}</strong> /{" "}
                      <strong className="text-[#172033]">{line.total_kapasitas}</strong>
                    </div>
                  </div>
                  {canEdit && (
                    <span className="flex h-[28px] w-[28px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#eef0ff] text-[12px] text-[#191970]" title="Ubah BB dan Transfer Stok">
                      <i className="bi bi-pencil-fill" />
                    </span>
                  )}
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
                              title="Geser kiri"
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
                            {deeps.map((d) => {
                              const st = statusOf(d);
                              const meta = STATUS_META[st];
                              const pct = d.kapasitas > 0 && d.terpakai > 0 ? Math.min(100, Math.max(0, (d.terpakai / d.kapasitas) * 100)) : 0;
                              const batch = d.batch && d.batch !== "null" && d.batch !== "-" ? d.batch : d.best_before || "Batch belum tersedia";
                              return (
                                <button
                                  key={d.id_deep}
                                  onClick={() =>
                                    setDetailDeep({
                                      line: `Block ${activeBlock.kode_block} Line ${line.nomor_line}`,
                                      status: meta.label,
                                      batch,
                                      qty: `${d.terpakai}/${d.kapasitas}`,
                                    })
                                  }
                                  title={`${meta.label} | ${d.terpakai}/${d.kapasitas}`}
                                  className="relative h-[27px] w-full min-w-[46px] shrink-0 cursor-pointer overflow-hidden rounded-[7px] border text-[10px] font-black leading-none transition hover:-translate-y-px hover:shadow-[0_5px_12px_rgba(15,23,42,0.07)]"
                                  style={{ background: "#f6f7f9", borderColor: meta.border, color: meta.color }}
                                >
                                  <span className="pointer-events-none absolute left-0 top-0 bottom-0 rounded-[7px]" style={{ width: `${pct}%`, background: meta.fill }} />
                                  <span className="relative z-[2]">{d.terpakai}/{d.kapasitas}</span>
                                </button>
                              );
                            })}
                          </div>
                          {many && (
                            <button
                              onClick={() => scrollDeepRow(key, 1)}
                              className="flex h-[26px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#e2e7f0] bg-white text-[10px] text-[#6b7280]"
                              title="Geser kanan"
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

      {detailDeep && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4" onClick={() => setDetailDeep(null)}>
          <div className="w-full max-w-[380px] rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-[15px] font-black tracking-tight text-[#191970]">Detail Batch</div>
                <div className="mt-0.5 text-[12px] font-bold text-[#6b7280]">{detailDeep.line}</div>
              </div>
              <button onClick={() => setDetailDeep(null)} className="cursor-pointer p-1 text-[#6b7280]">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-[16px] text-white" style={{ background: STATUS_META[statusKeyOf(detailDeep.status)]?.color || "#9ca3af" }}>
                <i className="bi bi-calendar-event-fill" />
              </div>
              <div className="min-w-0 flex-1 text-[16px] font-black text-[#172033]">{detailDeep.batch}</div>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: STATUS_META[statusKeyOf(detailDeep.status)]?.fill || "#eee", color: STATUS_META[statusKeyOf(detailDeep.status)]?.color || "#6b7280" }}>
                {detailDeep.status}
              </span>
            </div>
            <div className="mt-3 text-[11px] font-bold text-[#6b7280]">Terpakai: {detailDeep.qty}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function statusKeyOf(label: string): string {
  const found = Object.entries(STATUS_META).find(([, v]) => v.label === label);
  return found ? found[0] : "blank";
}
