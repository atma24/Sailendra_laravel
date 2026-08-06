"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getSession, lokasiParam } from "@/lib/auth";

type Row = {
  id_traceability: number;
  so_number: string;
  nama_produk: string;
  id_produk: number;
  jumlah: number;
  batch_number: string;
  best_before: string;
  nama_customer: string;
  no_dn: string;
  status_delivery: string;
  gin_no: string;
  lokasi_block: string;
  nama_plant: string;
  nama_depo: string;
};

export default function TraceabilityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [bbOptions, setBbOptions] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [bb, setBb] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hapusMsg, setHapusMsg] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    apiGet<{ data: string[] }>(`/traceability/best-before?${lokasiParam(s)}`)
      .then((r) => setBbOptions(r.data || []))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const s = getSession();
    if (!s) return;
    setLoading(true);
    const params = new URLSearchParams(lokasiParam(s));
    if (q) params.set("q", q);
    if (bb) params.set("best_before", bb);
    params.set("page", String(page));
    params.set("limit", "50");
    apiGet<{ data: Row[]; total: number; page: number; pages: number }>(`/traceability?${params.toString()}`)
      .then((r) => {
        setRows(r.data || []);
        setTotal(r.total || 0);
        setPages(r.pages || 1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router, q, bb, page]);

  async function hapus(id: number) {
    const ok = await window.confirm("Hapus data traceability ini?");
    if (!ok) return;
    try {
      await apiPost("/traceability/hapus", { id_traceability: id });
      setRows((prev) => prev.filter((r) => r.id_traceability !== id));
      setTotal((t) => t - 1);
      setHapusMsg("Data traceability berhasil dihapus.");
    } catch (e) {
      setHapusMsg(e instanceof ApiError ? e.message : "Gagal hapus");
    }
  }

  if (loading && page === 1) return <div className="p-8 text-center font-semibold text-[#6b7280]">Memuat...</div>;
  if (error && rows.length === 0) return <div className="p-8 text-center font-bold text-[#ef2b2d]">{error}</div>;

  const inputCls =
    "h-[31px] w-full rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-bold text-[#172033] outline-none transition focus:border-[#191970] focus:bg-white focus:shadow-[0_0_0_3px_rgba(25,25,112,0.07)]";

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="rounded-[11px] border border-[#e9edf5] bg-white p-2">
        <div className="relative">
          <i className="bi bi-search absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-[#6b7280]" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Cari SO, produk, customer, GIN, batch..."
            className={`${inputCls} pl-[31px]`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-0 pt-2">
          <span className="text-[10px] font-extrabold text-[#6b7280]">BB:</span>
          <select className={`${inputCls} h-[27px] w-auto`} value={bb} onChange={(e) => { setBb(e.target.value); setPage(1); }}>
            <option value="">Semua</option>
            {bbOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <span className="ml-auto text-[10px] font-bold text-[#6b7280]">{total} data</span>
        </div>
      </div>

      {hapusMsg && (
        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-extrabold text-[#15803d]">
          {hapusMsg}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-[11px] border border-[#e9edf5] bg-white px-2.5 py-3 text-[11px] font-bold text-[#6b7280]">
          Tidak ada data traceability.
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {rows.map((r) => (
            <div key={r.id_traceability} className="rounded-[11px] border border-[#e9edf5] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-extrabold text-[#172033]">{r.nama_produk}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">
                    SO {r.so_number || "-"} {r.gin_no ? `| GIN ${r.gin_no}` : ""} {r.no_dn ? `| DN ${r.no_dn}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => hapus(r.id_traceability)}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#fff0f0] text-[12px] text-[#ef4444] transition hover:bg-[#ef4444] hover:text-white"
                  title="Hapus"
                >
                  <i className="bi bi-trash3" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[#e9edf5] pt-2 text-center">
                <div>
                  <div className="text-[9px] font-extrabold text-[#6b7280]">JUMLAH</div>
                  <div className="text-[12px] font-black text-[#172033]">{r.jumlah}</div>
                </div>
                <div>
                  <div className="text-[9px] font-extrabold text-[#6b7280]">BATCH</div>
                  <div className="text-[11px] font-black text-[#172033]">{r.batch_number || "-"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-extrabold text-[#6b7280]">BB</div>
                  <div className="text-[11px] font-black text-[#172033]">{r.best_before || "-"}</div>
                </div>
              </div>
              <div className="mt-2 space-y-1 border-t border-[#e9edf5] pt-2 text-[9px] font-semibold text-[#6b7280]">
                <div>Customer: {r.nama_customer || "-"} | Plant: {r.nama_plant || "-"} | Depo: {r.nama_depo || "-"}</div>
                <div>Status: {r.status_delivery || "-"}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 rounded-[11px] border border-[#e9edf5] bg-white p-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex h-[28px] cursor-pointer items-center gap-1 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-extrabold text-[#172033] disabled:opacity-40"
          >
            <i className="bi bi-chevron-left" />
            Prev
          </button>
          <span className="text-[11px] font-bold text-[#6b7280]">
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="inline-flex h-[28px] cursor-pointer items-center gap-1 rounded-lg border border-[#e2e7f0] bg-[#fbfcff] px-2.5 text-[11px] font-extrabold text-[#172033] disabled:opacity-40"
          >
            Next
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
