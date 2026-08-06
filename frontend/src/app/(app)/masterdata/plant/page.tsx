"use client";

import MasterCrud, { type MasterCrudConfig } from "@/components/MasterCrud";

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
  return <MasterCrud config={config} />;
}