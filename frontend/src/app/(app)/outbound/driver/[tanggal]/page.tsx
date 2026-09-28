"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { isMultiRole, lokasiParam, useSession } from "@/lib/auth";
import { useToast } from "@/components/ToastProvider";

type BkRow = {
  id_barang_keluar: number;
  id_pengguna_lokasi: string;
  nama_produk: string;
  jumlah: number;
  tanggal_keluar: string;
  nama_driver: string;
  no_mobil: string;
  status: string;
  tipe_pengeluaran: string;
};

type DriverItem = {
  nama_driver: string;
  total_item: number;
  total_qty: number;
  no_mobil: string;
  status: string;
  _semua_selesai: boolean;
};

// Item Draft/Pending yang boleh dihapus permanen (Selesai/Confirmed/Canceled tidak dihapus).
type HapusTarget = { nama_driver: string; items: { id: number; id_lokasi: string }[] };

const angka = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? 0 : n;
};

const statusStyle = (s: string): { bg: string; color: string } => {
  const st = (s || "").toLowerCase();
  if (st === "pending") return { bg: "#fef3c7", color: "#92400e" };
  if (st === "selesai" || st === "confirmed") return { bg: "#d1fae5", color: "#065f46" };
  if (st === "canceled" || st === "cancelled" || st === "batal") return { bg: "#fee2e2", color: "#b91c1c" };
  return { bg: "#e5e7eb", color: "#4b5563" };
};

const css = `
.outbound-page { display: flex; flex-direction: column; gap: 7px; }
.outbound-card { background: #FFFFFF; border: 1px solid #e9edf5; border-radius: 11px; box-shadow: none; }
.outbound-back-row { display: flex; align-items: center; justify-content: space-between; gap: 7px; padding: 8px; }
.outbound-back-btn { height: 30px; border-radius: 8px; padding: 0 9px; background: #fbfcff; border: 1px solid #e2e7f0; color: var(--text-main); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; }
.outbound-back-btn:hover { color: var(--primary); border-color: rgba(25,25,112,0.22); transform: translateY(-1px); }
.outbound-date-chip { border-radius: 999px; background: var(--primary-soft); color: var(--primary); padding: 5px 9px; font-size: 10px; font-weight: 900; white-space: nowrap; }
.outbound-search-input { width: 100%; height: 31px; border-radius: 8px; border: 1px solid #e2e7f0; background: #fbfcff; padding: 0 31px; font-size: 11px; font-weight: 700; color: var(--text-main); outline: none; }
.outbound-search-input:focus { background: #FFFFFF; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(25,25,112,0.07); }
.outbound-toolbar { padding: 8px; position: relative; }
.outbound-status-filter { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 8px 8px; }
.outbound-status-chip { display: inline-flex; align-items: center; gap: 5px; height: 27px; padding: 0 10px; border-radius: 999px; border: 1px solid #e2e7f0; background: #fbfcff; color: var(--text-main); font-size: 11px; font-weight: 800; text-decoration: none; white-space: nowrap; }
.outbound-status-chip.is-active { background: var(--primary); border-color: var(--primary); color: #fff; }
.outbound-status-chip .chip-count { background: rgba(15,23,42,0.06); border-radius: 999px; padding: 1px 6px; font-size: 10px; font-weight: 800; }
.outbound-status-chip.is-active .chip-count { background: rgba(255,255,255,0.25); color: #fff; }
.outbound-driver-grid { display: flex; flex-direction: column; gap: 7px; }
.outbound-driver-card { padding: 8px; text-decoration: none; color: inherit; display: flex; align-items: center; gap: 7px; }
.outbound-driver-card:hover { transform: translateY(-1px); border-color: rgba(25,25,112,.18); box-shadow: 0 8px 20px rgba(15,23,42,0.06); }
.outbound-driver-link { flex: 1; min-width: 0; text-decoration: none; color: inherit; display: block; }
.driver-del-btn { flex: none; width: 30px; height: 30px; border-radius: 8px; border: 1px solid #fecaca; background: #fef2f2; color: #dc2626; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer; transition: background .15s, transform .15s; }
.driver-del-btn:hover:not(:disabled) { background: #fee2e2; transform: translateY(-1px); }
.driver-del-btn:disabled { opacity: .4; cursor: not-allowed; }
.driver-top { display: flex; gap: 7px; align-items: center; }
.driver-name { font-size: 12px; font-weight: 900; color: var(--text-main); letter-spacing: -0.2px; line-height: 1.2; }
.driver-sub { font-size: 10px; font-weight: 750; color: var(--text-soft); line-height: 1.3; }
.outbound-empty { padding: 12px 10px; color: var(--text-soft); font-size: 11px; font-weight: 750; }
.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; white-space: nowrap; }
`;

const STATUS_OPTIONS = [
  { v: "", label: "Semua" },
  { v: "Draft", label: "Draft" },
  { v: "Pending", label: "Pending" },
  { v: "Selesai", label: "Selesai" },
  { v: "Canceled", label: "Canceled" },
];

export default function OutboundDriverPage() {
  const params = useParams<{ tanggal: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const { toast } = useToast();
  const multi = !!session && isMultiRole(session.user.role);

  const tanggal = decodeURIComponent(params.tanggal || "");
  const lok = searchParams.get("lok") || "";
  const statusFilter = searchParams.get("status") || "";
  const tipeFilter = searchParams.get("tipe") || "";
  const [rows, setRows] = useState<BkRow[]>([]);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [hapusTarget, setHapusTarget] = useState<HapusTarget | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session || !tanggal) return;
    let cancelled = false;
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.append("tanggal", tanggal);
        if (multi) {
          if (lok) sp.append("id_pengguna_lokasi", lok);
          else {
            const l = lokasiParam(session);
            if (l) sp.set("id_pengguna_lokasi_multi", l.split("=")[1] || "");
          }
        } else {
          sp.append("id_pengguna_lokasi", String(session.user.id_pengguna_lokasi || ""));
        }
        const r = await apiGet<BkRow[]>(`/barang-keluar?${sp.toString()}`);
        if (!cancelled) setRows(r.data || []);
      } catch {
        /* keep old */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, tanggal, lok, multi]);

  const konfirmasiHapus = async () => {
    if (!hapusTarget || hapusTarget.items.length === 0) return;
    setBusy(true);
    let sukses = 0;
    let gagal = 0;
    for (const it of hapusTarget.items) {
      try {
        await apiPost("/barang-keluar/hapus", {
          id_barang_keluar: it.id,
          id_pengguna_lokasi: it.id_lokasi,
        });
        sukses++;
      } catch {
        gagal++;
      }
    }
    setBusy(false);
    setHapusTarget(null);
    if (sukses > 0 && gagal === 0) {
      toast(`${sukses} item driver ${hapusTarget.nama_driver} berhasil dihapus.`, "success");
    } else if (sukses > 0) {
      toast(`${sukses} item dihapus, ${gagal} item gagal dihapus.`, "warning");
    } else {
      toast("Gagal menghapus item.", "error");
    }
    setRows((prev) => {
      const idSet = new Set(hapusTarget.items.map((it) => it.id));
      return prev.filter((r) => !idSet.has(r.id_barang_keluar));
    });
    router.refresh();
  };

  if (!session || !loaded) return null;

  const kw = q.trim().toLowerCase();
  const tipeNorm = (v: unknown) => String(v ?? "").trim().toUpperCase();
  const matchTipe = (r: BkRow) => {
    if (!tipeFilter) return true;
    const t = tipeNorm(r.tipe_pengeluaran);
    if (tipeFilter === "primary") return t === "PRIMARY" || t === "PEMUSNAHAN" || t === "";
    if (tipeFilter === "secondary") return t === "SECONDARY";
    if (tipeFilter === "foc") return t === "FOC";
    // Kompatibilitas URL lama: ?tipe=normal = semua non-FOC.
    if (tipeFilter === "normal") return t !== "FOC";
    return true;
  };
  const filteredRows = rows.filter(matchTipe);
  const sectionLabel = tipeFilter === "foc" ? "FOC" : tipeFilter === "primary" ? "Primary" : tipeFilter === "secondary" ? "Secondary" : tipeFilter === "normal" ? "Normal" : "";
  const driverMap: Record<string, DriverItem> = {};
  const hapusMap: Record<string, { id: number; id_lokasi: string }[]> = {};
  filteredRows.forEach((row) => {
    const nama = (row.nama_driver || "").trim() || "Tanpa nama driver";
    if (kw !== "" && !nama.toLowerCase().includes(kw)) return;
    if (!driverMap[nama]) {
      driverMap[nama] = {
        nama_driver: nama, total_item: 0, total_qty: 0,
        no_mobil: row.no_mobil || "", status: row.status || "", _semua_selesai: true, _semua_batal: true,
      } as DriverItem & { _semua_batal: boolean };
      hapusMap[nama] = [];
    }
    driverMap[nama].total_item++;
    driverMap[nama].total_qty += angka(row.jumlah);
    if (!driverMap[nama].no_mobil && row.no_mobil) driverMap[nama].no_mobil = row.no_mobil;
    const st = (row.status || "").toLowerCase();
    if (st !== "selesai" && st !== "confirmed") driverMap[nama]._semua_selesai = false;
    if (st !== "canceled" && st !== "cancelled" && st !== "batal") (driverMap[nama] as unknown as Record<string, boolean>)._semua_batal = false;
    // Hanya item Draft/Pending yang boleh dihapus permanen.
    if (st === "draft" || st === "pending") {
      hapusMap[nama].push({ id: row.id_barang_keluar, id_lokasi: row.id_pengguna_lokasi });
    }
  });

  Object.values(driverMap).forEach((d) => {
    const semuaBatal = (d as unknown as Record<string, boolean>)._semua_batal;
    if (semuaBatal) d.status = "Canceled";
    else if (d._semua_selesai) d.status = "Selesai";
    else if (!d.status) d.status = "Draft";
    delete (d as Record<string, unknown>)._semua_selesai;
    delete (d as Record<string, unknown>)._semua_batal;
  });

  const statusCounts = { Draft: 0, Pending: 0, Selesai: 0, Canceled: 0 };
  Object.values(driverMap).forEach((d) => {
    if (statusCounts[d.status as keyof typeof statusCounts] !== undefined) statusCounts[d.status as keyof typeof statusCounts]++;
    else statusCounts.Draft++;
  });
  const totalDriverAll = Object.keys(driverMap).length;

  let driverList = Object.values(driverMap).sort((a, b) => a.nama_driver.localeCompare(b.nama_driver, "id"));
  if (statusFilter !== "") driverList = driverList.filter((d) => d.status.toLowerCase() === statusFilter.toLowerCase());

  const buildUrl = (sv: string) => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (lok) p.set("lok", lok);
    if (sv) p.set("status", sv);
    if (tipeFilter) p.set("tipe", tipeFilter);
    const qs = p.toString();
    return `/outbound/driver/${encodeURIComponent(tanggal)}${qs ? `?${qs}` : ""}`;
  };

  const backHref = `/outbound${lok ? `?lok=${encodeURIComponent(lok)}` : ""}${tipeFilter ? `${lok ? "&" : "?"}tipe=${tipeFilter}` : ""}`;

  return (
    <div className="outbound-page">
      <style>{css}</style>
      <div className="outbound-card outbound-back-row">
        <Link className="outbound-back-btn" href={backHref}>
          <i className="bi bi-arrow-left"></i>
          <span>Kembali ke tanggal</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {sectionLabel && <span style={{ borderRadius: 999, background: sectionLabel === "FOC" ? "#F0FDF4" : "var(--primary-soft, #EEF2FF)", color: sectionLabel === "FOC" ? "#166534" : "var(--primary, #191970)", padding: "4px 9px", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>{sectionLabel}</span>}
          <div className="outbound-date-chip">{tanggal}</div>
        </div>
      </div>

      <div className="outbound-card">
        <div className="outbound-toolbar">
          <input type="text" className="outbound-search-input" value={q}
            placeholder="Cari nama driver" autoComplete="off" onChange={(e) => setQ(e.target.value)} />
          {q.trim() !== "" && (
            <a href="#" style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-soft)", textDecoration: "none" }}
              onClick={(e) => { e.preventDefault(); setQ(""); }}>
              <i className="bi bi-x-lg"></i>
            </a>
          )}
        </div>
        <div className="outbound-status-filter">
          {STATUS_OPTIONS.map((o) => {
            const count = o.v === "" ? totalDriverAll : (statusCounts[o.v as keyof typeof statusCounts] || 0);
            const active = (statusFilter === o.v);
            return (
              <Link key={o.v || "_"} className={`outbound-status-chip ${active ? "is-active" : ""}`} href={buildUrl(o.v)}>
                <span>{o.label}</span>
                <span className="chip-count">{count}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {driverList.length === 0 ? (
        <div className="outbound-card outbound-empty">Driver tidak ditemukan pada tanggal ini.</div>
      ) : (
        <div className="outbound-driver-grid">
          {driverList.map((d) => {
            const ss = statusStyle(d.status);
            const bolehHapus = (hapusMap[d.nama_driver] || []).length > 0;
            return (
              <div key={d.nama_driver} className="outbound-card outbound-driver-card">
                <Link className="outbound-driver-link"
                  href={`/outbound/detail/${encodeURIComponent(tanggal)}?driver=${encodeURIComponent(d.nama_driver)}${lok ? `&lok=${encodeURIComponent(lok)}` : ""}${tipeFilter ? `&tipe=${tipeFilter}` : ""}`}>
                  <div className="driver-top">
                    <i className="bi bi-truck" style={{ color: "var(--primary)", fontSize: 16 }}></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="driver-name">{d.nama_driver}</div>
                      <div className="driver-sub">
                        {d.total_item} item · {d.total_qty} qty{d.no_mobil ? ` · ${d.no_mobil}` : ""}
                      </div>
                    </div>
                    <span className="status-badge" style={ss}>{d.status}</span>
                    <i className="bi bi-chevron-right" style={{ color: "var(--text-soft)", fontSize: 14 }}></i>
                  </div>
                </Link>
                <button type="button" className="driver-del-btn"
                  title={bolehHapus ? `Hapus item Draft/Pending driver ${d.nama_driver}` : "Tidak ada item Draft/Pending yang bisa dihapus"}
                  disabled={!bolehHapus}
                  onClick={() => setHapusTarget({ nama_driver: d.nama_driver, items: hapusMap[d.nama_driver] || [] })}>
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hapusTarget && (
        <ConfirmDialog
          title="Hapus Item Outbound"
          message={`Hapus permanen ${hapusTarget.items.length} item Draft/Pending milik driver "${hapusTarget.nama_driver}"? Data yang dihapus tidak bisa dikembalikan.`}
          busy={busy}
          onCancel={() => { if (!busy) setHapusTarget(null); }}
          onOk={konfirmasiHapus}
        />
      )}
    </div>
  );
}

function ConfirmDialog({ title, message, onCancel, onOk, busy }: {
  title: string; message: string; onCancel: () => void; onOk: () => void; busy?: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 18, width: "100%", maxWidth: 440, boxShadow: "0 25px 50px -12px rgba(15,23,42,0.35)", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: "#fee2e2", color: "#dc2626", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            <i className="bi bi-trash"></i>
          </span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>{title}</h3>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.6, color: "var(--text-soft)" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCancel} disabled={busy}
            style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "1px solid #e2e7f0", background: "#fbfcff", color: "var(--text-main)", fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
            Batal
          </button>
          <button type="button" onClick={onOk} disabled={busy}
            style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", boxShadow: "0 2px 6px rgba(239, 68, 68, 0.25)" }}>
            {busy ? "Memproses..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}