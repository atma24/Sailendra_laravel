"use client";

import MasterCrud, { type MasterCrudConfig } from "@/components/MasterCrud";

const sekel = (v: unknown) => String(v ?? "");

const config: MasterCrudConfig = {
  addLabel: "Tambah Lokasi",
  entityLabel: "Lokasi",
  endpoint: "/lokasi",
  idField: "id_lokasi",
  searchPlaceholder: "Cari ID / nama / kategori lokasi",
  emptyLabel: "Data lokasi tidak ditemukan.",
  displayName: (row) => sekel(row.nama_lokasi) || "-",
  columns: [
    {
      key: "id_lokasi",
      label: "ID Lokasi",
      width: 110,
      render: (r) => <span className="master-id-pill">{sekel(r.id_lokasi)}</span>,
    },
    {
      key: "nama_lokasi",
      label: "Nama Lokasi",
      render: (r) => <div className="master-name-text">{sekel(r.nama_lokasi) || "-"}</div>,
    },
    {
      key: "kategori",
      label: "Kategori",
      render: (r) => <div className="master-name-text">{sekel(r.kategori) || "-"}</div>,
    },
  ],
  fields: [
    { key: "nama_lokasi", label: "Nama Lokasi", type: "text", maxLength: 50 },
    { key: "kategori", label: "Kategori", type: "text", maxLength: 50 },
  ],
};

export default function LokasiPage() {
  return <MasterCrud config={config} />;
}
