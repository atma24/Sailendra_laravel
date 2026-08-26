"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, getUploadUrl } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import UploadModal from "@/components/UploadModal";
import { useToast } from "@/components/ToastProvider";
import { chunkExcelFile } from "@/lib/excelChunk";

type BkRow = {
  id_barang_keluar: number;
  id_pengguna_lokasi: string;
  nama_pengguna_lokasi: string;
  nama_produk: string;
  jumlah: number;
  tanggal_keluar: string;
  nama_driver: string;
  status: string;
};

type TanggalItem = { tanggal: string; total_item: number; total_qty: number };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};
const dateOnly = (v: unknown) => String(v ?? "").slice(0, 10);

const css = `
.outbound-page { display: flex; flex-direction: column; gap: 7px; }
.outbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.outbound-toolbar { padding: 8px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; align-items: center; }
.outbound-search-wrap { position: relative; }
.outbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.outbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.outbound-add-btn { height: 31px; border-radius: 8px; padding: 0 11px; background: var(--primary); color: #FFFFFF; font-size: 11px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.outbound-add-btn:hover { color: #FFFFFF; transform: translateY(-1px); box-shadow: 0 7px 16px rgba(25,25,112,0.15); }
.outbound-toolbar-right { display: flex; gap: 7px; }
.outbound-grid { display: flex; flex-direction: column; gap: 7px; }
.outbound-date-card { padding: 8px; text-decoration: none; color: inherit; display: block; }
.outbound-date-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.outbound-card-top { display: flex; align-items: center; gap: 8px; }
.outbound-date-title { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; }
.outbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.outbound-meta { font-size: 10px; font-weight: 750; color: var(--text-soft); margin-top: 3px; }
`;

export default function OutboundTanggalPage() {
  const { toast } = useToast();
  const session = useSession();
  const multi = !!session && isMultiRole(session.user.role);
  const [rows, setRows] = useState<BkRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<"" | "upload" | "import">("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [lokasiList, setLokasiList] = useState<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>([]);
  const [uploadLok, setUploadLok] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams(lokasiParam(session));
        if (keyword.trim()) q.append("cari", keyword.trim());
        const r = await apiGet<BkRow[]>(`/barang-keluar?${q.toString()}`);
        if (!cancelled) setRows(r.data || []);
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, keyword]);

  if (!session || !loaded) return null;

  const q = search.trim().toLowerCase();
  const singleMap: Record<string, TanggalItem> = {};
  const lokasiMap: Record<string, { nama: string; tanggal_map: Record<string, TanggalItem> }> = {};

  const push = (map: Record<string, TanggalItem>, tgl: string, row: BkRow) => {
    if (!map[tgl]) map[tgl] = { tanggal: tgl, total_item: 0, total_qty: 0 };
    map[tgl].total_item++;
    map[tgl].total_qty += angka(row.jumlah);
  };

  rows.forEach((row) => {
    const t = dateOnly(row.tanggal_keluar);
    if (!t || t.startsWith("0000")) return;
    const key = `${t} ${row.nama_driver || ""} ${row.nama_produk || ""}`.toLowerCase();
    if (q !== "" && !key.includes(q)) return;

    if (multi) {
      const lok = String(row.id_pengguna_lokasi || "");
      if (!lokasiMap[lok]) lokasiMap[lok] = { nama: row.nama_pengguna_lokasi || lok, tanggal_map: {} };
      push(lokasiMap[lok].tanggal_map, t, row);
    } else {
      push(singleMap, t, row);
    }
  });

  const singleList = Object.values(singleMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const canAdd = !!session && ["SuperAdmin", "Supervisor", "Checker"].includes(session.user.role);
  const [progressText, setProgressText] = useState("");

  const isSuperAdmin = !!session && session.user.role === "SuperAdmin";

  const openModal = async (which: "upload" | "import") => {
    setUploadMsg("");
    setUploadLok("");
    setProgressText("");
    if (fileRef.current) fileRef.current.value = "";
    if (multi) {
      try {
        const r = await apiGet<{ id_pengguna_lokasi: string; nama_pengguna_lokasi: string }[]>("/pengguna-lokasi");
        setLokasiList(r.data || []);
      } catch {
        setLokasiList([]);
      }
    }
    setModal(which);
  };

  const uploadFileSubmit = async (file: File) => {
    const lok = uploadLok || String(session!.user.id_pengguna_lokasi || "");
    if (!lok) { setUploadMsg("Pilih lokasi upload."); return; }
    setUploadBusy(true);
    setUploadMsg("");
    setProgressText("Membaca file Excel...");

    try {
      // Pecah file Excel menjadi batch per 40 baris agar tidak memicu timeout 60s cPanel
      const chunks = await chunkExcelFile(file, 40);
      const totalChunks = chunks.length;

      const raw = localStorage.getItem("sailendra_session");
      const s = raw ? JSON.parse(raw) : null;
      const headers: HeadersInit = { Accept: "application/json" };
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;
      const uploadUrl = getUploadUrl(`/api/barang-keluar/${modal === "import" ? "import-file" : "upload-file"}`);

      let lastMessage = "Upload selesai.";

      for (let i = 0; i < totalChunks; i++) {
        const currentChunk = chunks[i];
        if (totalChunks > 1) {
          setProgressText(`Memproses bagian ${i + 1} dari ${totalChunks} batch data...`);
        } else {
          setProgressText("Memproses data...");
        }

        const fd = new FormData();
        fd.append("file_excel", currentChunk);
        fd.append("upload_lokasi", lok);
        fd.append("id_pengguna", String(session!.user.id_pengguna));

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers,
          body: fd,
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.success === false) {
          throw new Error(`Batch ${i + 1}/${totalChunks} gagal: ${body.message || "Upload gagal."}`);
        }
        if (body.message) lastMessage = body.message;
      }

      sessionStorage.setItem("sailendra_flash_toast", JSON.stringify({ message: lastMessage, type: "success" }));
      setKeyword(" ");
      setKeyword("");
      window.setTimeout(() => setModal(""), 500);
      window.location.reload();
    } catch (e) {
      setUploadMsg(`Gagal: ${(e as Error).message}`);
      toast((e as Error).message || "Upload gagal.", "error");
    } finally {
      setUploadBusy(false);
      setProgressText("");
    }
  };

  const renderTanggal = (list: TanggalItem[], lokasiName?: string) =>
    list.length === 0 ? (
      <div className="outbound-card outbound-empty">
        {lokasiName ? "Tidak ada data outbound untuk lokasi ini." : "Tidak ada data tanggal outbound."}
      </div>
    ) : (
      <div className="outbound-grid">
        {list.map((item) => (
          <Link key={item.tanggal} className="outbound-card outbound-date-card"
            href={`/outbound/driver/${encodeURIComponent(item.tanggal)}`}>
            <div className="outbound-card-top">
              <i className="bi bi-calendar3" style={{ color: "var(--primary)", fontSize: 16 }}></i>
              <div>
                <div className="outbound-date-title">{item.tanggal}</div>
                <div className="outbound-meta">{item.total_item} item · {item.total_qty} qty</div>
              </div>
              <i className="bi bi-chevron-right ms-auto" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
            </div>
          </Link>
        ))}
      </div>
    );

  return (
    <div className="outbound-page">
      <style>{css}</style>
      <div className="outbound-card">
        <div className="outbound-toolbar">
          <div className="outbound-search-wrap">
            <input type="text" className="outbound-search-input" value={search}
              placeholder="Cari tanggal contoh: 2026-05-09" autoComplete="off"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setKeyword(search); }} />
            {keyword.trim() !== "" && (
              <a href="#" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-soft)", textDecoration: "none" }}
                onClick={(e) => { e.preventDefault(); setSearch(""); setKeyword(""); }}>
                <i className="bi bi-x-lg"></i>
              </a>
            )}
          </div>
          {canAdd && (
            <div className="outbound-toolbar-right">
              <button type="button" className="outbound-add-btn" style={{ border: "none", cursor: "pointer" }} onClick={() => openModal("upload")}>
                <i className="bi bi-file-earmark-excel"></i>
                Upload Excel
              </button>
              {isSuperAdmin && (
                <button type="button" className="outbound-add-btn" style={{ border: "none", cursor: "pointer" }} onClick={() => openModal("import")}>
                  <i className="bi bi-clock-history"></i>
                  Import Historical
                </button>
              )}
              <Link className="outbound-add-btn" href="/outbound/form">
                <i className="bi bi-plus-lg"></i>
                Tambah Outbound
              </Link>
            </div>
          )}
        </div>
      </div>

      {multi ? (
        Object.entries(lokasiMap).map(([lok, g]) => (
          <div key={lok} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--primary)", marginBottom: 7 }}>
              <i className="bi bi-geo-alt" style={{ marginRight: 6 }}></i>
              {lok} - {g.nama}
            </div>
            {renderTanggal(Object.values(g.tanggal_map).sort((a, b) => b.tanggal.localeCompare(a.tanggal)), g.nama)}
          </div>
        ))
      ) : (
        renderTanggal(singleList)
      )}

      {modal && (
        <UploadModal
          open={!!modal}
          title={modal === "import" ? "Import Outbound Historical" : "Upload Outbound"}
          note={
            modal === "import"
              ? "Format Excel: GIN NO, NAMA CUSTOMER, DRIVER GUDANG, STATUS (Default Selesai), NO MOBIL, NAMA DRIVER, TANGGAL KELUAR, ID PRODUK, NAMA PRODUK, QTY, NO BATCH, BEST BEFORE, SO NUMBER, SALLE GROUP"
              : "Upload data pengeluaran barang (Outbound) format Excel."
          }
          onClose={() => setModal("")}
          onSubmit={uploadFileSubmit}
          busy={uploadBusy}
          progressText={progressText}
        />
      )}
    </div>
  );
}