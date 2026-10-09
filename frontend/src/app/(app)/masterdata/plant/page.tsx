"use client";

import { useState } from "react";
import MasterCrud, { type MasterCrudConfig } from "@/components/MasterCrud";
import UploadModal from "@/components/UploadModal";
import { MASTER_DATA_ROLES, useSession } from "@/lib/auth";

const sekel = (v: unknown) => String(v ?? "");

const config: MasterCrudConfig = {
  addLabel: "Tambah Plant",
  entityLabel: "Plant",
  endpoint: "/plant",
  idField: "id_plant",
  searchPlaceholder: "Cari ID / nama plant",
  emptyLabel: "Data plant tidak ditemukan.",
  displayName: (row) => sekel(row.nama_plant) || "-",
  columns: [
    {
      key: "id_plant",
      label: "ID Plant",
      width: 110,
      render: (r) => <span className="master-id-pill">{sekel(r.id_plant)}</span>,
    },
    {
      key: "nama_plant",
      label: "Nama Plant",
      render: (r) => <div className="master-name-text">{sekel(r.id_plant)} - {sekel(r.nama_plant)}</div>,
    },
  ],
  fields: [
    { key: "id_plant", label: "ID Plant", type: "text" },
    { key: "nama_plant", label: "Nama Plant", type: "text" },
  ],
};

export default function PlantPage() {
  const session = useSession();
  const [showUpload, setShowUpload] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const bolehUpload = !!session && MASTER_DATA_ROLES.includes(session.user.role);

  const downloadTemplate = async () => {
    try {
      const res = await fetch("/api/plant/download-template", {
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      if (!res.ok) throw new Error("Gagal mengunduh template.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template-plant.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* silent */
    }
  };

  const importPlant = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    setImporting(true);
    try {
      const res = await fetch("/api/plant/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.token || ""}` },
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) {
        throw new Error(body?.message || "Gagal mengimpor plant.");
      }
      sessionStorage.setItem(
        "sailendra_flash_toast",
        JSON.stringify({ message: body?.message || "Berhasil mengimpor plant.", type: "success" })
      );
      setShowUpload(false);
      setRefreshKey((v) => v + 1);
      window.location.reload();
    } catch (e) {
      // UploadModal tidak menampilkan error sendiri, jadi tampilkan lewat note.
      setUploadError((e as Error).message || "Gagal mengimpor plant.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {bolehUpload && (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="master-add-btn" onClick={() => { setUploadError(""); setShowUpload(true); }}>
            <i className="bi bi-upload"></i>
            <span>Upload List Plant</span>
          </button>
        </div>
      )}

      <MasterCrud key={refreshKey} config={config} />

      <UploadModal
        open={showUpload}
        title="Upload List Plant"
        note={`Kolom: nama_plant (alias Dest Name didukung). Kode plant otomatis berkepala 7. Nama yang 100% sama persis akan terskip.${uploadError ? ` Gagal: ${uploadError}` : ""}`}
        onClose={() => !importing && setShowUpload(false)}
        onDownload={downloadTemplate}
        onSubmit={importPlant}
        busy={importing}
      />
    </>
  );
}
