-- Koreksi untuk database yang telanjur membuat tanggal_produksi sebagai NOT NULL.
-- Produk tanpa batch dan REJECT tidak mempunyai tanggal produksi yang nyata.
ALTER TABLE `barang_masuk`
    MODIFY COLUMN `tanggal_produksi` DATE NULL;
