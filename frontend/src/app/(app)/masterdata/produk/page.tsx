"use client";

import MasterCrud, { type MasterCrudConfig } from "@/components/MasterCrud";

const sekel = (v: unknown) => String(v ?? "");

const config: MasterCrudConfig = {
  addLabel: "Tambah Produk",
  entityLabel: "Produk",
  endpoint: "/produk",
  idField: "id_produk",
  searchPlaceholder: "Cari ID / nama produk",
  emptyLabel: "Data produk tidak ditemukan.",
  displayName: (row) => sekel(row.nama_produk) || "-",
  columns: [
    {
      key: "id_produk",
      label: "ID",
      width: 80,
      render: (r) => <span className="master-id-pill">{sekel(r.id_produk)}</span>,
    },
    {
      key: "nama_produk",
      label: "Nama Produk",
      render: (r) => <div className="master-name-text">{sekel(r.nama_produk)}</div>,
    },
    {
      key: "satuan",
      label: "Satuan",
      width: 110,
      render: (r) => (sekel(r.satuan) !== "" ? sekel(r.satuan) : "-"),
    },
    {
      key: "isi_per_pcs",
      label: "Isi / PCS",
      width: 120,
      render: (r) => (sekel(r.isi_per_pcs) !== "" ? sekel(r.isi_per_pcs) : "-"),
    },
  ],
  fields: [
    { key: "id_produk", label: "ID Produk", type: "number", min: 1, maxLength: 15 },
    { key: "nama_produk", label: "Nama Produk", type: "text", maxLength: 60 },
    { key: "satuan", label: "Satuan", type: "select", options: ["BOX", "GALLON", "MP"] },
    { key: "isi_per_pcs", label: "Isi per pcs", type: "number", min: 1 },
  ],
};

export default function ProdukPage() {
  return <MasterCrud config={config} />;
}