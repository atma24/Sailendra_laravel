<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Skema 18 tabel legacy app (disalin persis dari SHOW CREATE TABLE).
     * urutan = dependensi FK (child dibuat setelah parent). down() = kebalikan.
     */
    private array $ddl = [
        'pengguna_lokasi' => <<<'SQL'
CREATE TABLE `pengguna_lokasi` (
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `nama_pengguna_lokasi` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_pengguna_lokasi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'lokasi' => <<<'SQL'
CREATE TABLE `lokasi` (
  `id_lokasi` int(11) NOT NULL AUTO_INCREMENT,
  `nama_lokasi` varchar(100) NOT NULL,
  `kategori` enum('GALLON','SPS','XWH') NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_lokasi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'produk' => <<<'SQL'
CREATE TABLE `produk` (
  `id_produk` int(11) NOT NULL AUTO_INCREMENT,
  `nama_produk` varchar(150) NOT NULL,
  `satuan` enum('GALLON','BOX','MP') NOT NULL,
  `isi_per_pcs` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_produk`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'plant' => <<<'SQL'
CREATE TABLE `plant` (
  `id_plant` varchar(11) NOT NULL,
  `nama_plant` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plant`),
  KEY `idx_plant_id_plant` (`id_plant`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'pengguna' => <<<'SQL'
CREATE TABLE `pengguna` (
  `id_pengguna` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(100) NOT NULL,
  `role` enum('Supervisor','Checker','Support','Forklift','SuperAdmin') NOT NULL,
  `status` enum('Aktif','Nonaktif') NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_pengguna`),
  KEY `idx_pengguna_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_pengguna_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'block' => <<<'SQL'
CREATE TABLE `block` (
  `id_block` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_lokasi` int(11) NOT NULL,
  `kode_block` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_block`),
  KEY `fk_block_lokasi` (`id_lokasi`),
  KEY `idx_block_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_block_lokasi` FOREIGN KEY (`id_lokasi`) REFERENCES `lokasi` (`id_lokasi`) ON UPDATE CASCADE,
  CONSTRAINT `fk_block_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'line' => <<<'SQL'
CREATE TABLE `line` (
  `id_line` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_block` int(11) NOT NULL,
  `nomor_line` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_line`),
  KEY `fk_line_block` (`id_block`),
  KEY `idx_line_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_line_block` FOREIGN KEY (`id_block`) REFERENCES `block` (`id_block`) ON UPDATE CASCADE,
  CONSTRAINT `fk_line_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'level' => <<<'SQL'
CREATE TABLE `level` (
  `id_level` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_line` int(11) NOT NULL,
  `level` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_level`),
  KEY `fk_level_line` (`id_line`),
  KEY `idx_level_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_level_line` FOREIGN KEY (`id_line`) REFERENCES `line` (`id_line`) ON UPDATE CASCADE,
  CONSTRAINT `fk_level_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'deep' => <<<'SQL'
CREATE TABLE `deep` (
  `id_deep` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_level` int(11) NOT NULL,
  `deep` int(11) NOT NULL,
  `kapasitas` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_deep`),
  KEY `fk_deep_level` (`id_level`),
  KEY `idx_deep_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_deep_level` FOREIGN KEY (`id_level`) REFERENCES `level` (`id_level`) ON UPDATE CASCADE,
  CONSTRAINT `fk_deep_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'barang_masuk' => <<<'SQL'
CREATE TABLE `barang_masuk` (
  `id_barang_masuk` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_pengguna` int(11) NOT NULL,
  `id_produk` int(11) NOT NULL,
  `nama_produk` varchar(150) DEFAULT NULL,
  `tanggal_masuk` date NOT NULL,
  `tipe_penerimaan` enum('Primary','Secondary','Primary XWH','REJECT') NOT NULL DEFAULT 'Primary',
  `asal_pabrik` varchar(150) DEFAULT NULL,
  `no_dn` varchar(100) DEFAULT NULL,
  `nama_driver` varchar(100) DEFAULT NULL,
  `no_mobil` varchar(50) NOT NULL,
  `jumlah` int(11) NOT NULL,
  `best_before` date DEFAULT NULL,
  `batch` varchar(50) DEFAULT NULL,
  `batch_sekarang` varchar(50) DEFAULT NULL,
  `catatan` text DEFAULT NULL,
  `satuan` enum('GALLON','BOX','MP') NOT NULL,
  `lokasi_block` varchar(100) DEFAULT NULL,
  `diperbarui_pada` datetime DEFAULT NULL,
  `diperbarui_oleh` varchar(100) DEFAULT NULL,
  `catatan_perubahan` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `waktu_mulai_input` datetime DEFAULT NULL,
  `durasi_detik` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_barang_masuk`),
  KEY `fk_barang_masuk_pengguna` (`id_pengguna`),
  KEY `fk_barang_masuk_produk` (`id_produk`),
  KEY `idx_barang_masuk_id_plant` (`id_pengguna_lokasi`),
  KEY `idx_barang_masuk_batch` (`batch`),
  CONSTRAINT `fk_barang_masuk_pengguna` FOREIGN KEY (`id_pengguna`) REFERENCES `pengguna` (`id_pengguna`) ON UPDATE CASCADE,
  CONSTRAINT `fk_barang_masuk_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE,
  CONSTRAINT `fk_barang_masuk_produk` FOREIGN KEY (`id_produk`) REFERENCES `produk` (`id_produk`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'barang_keluar' => <<<'SQL'
CREATE TABLE `barang_keluar` (
  `id_barang_keluar` int(11) NOT NULL AUTO_INCREMENT,
  `gin_no` varchar(100) DEFAULT NULL,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_pengguna` int(11) NOT NULL,
  `id_produk` int(11) DEFAULT NULL,
  `nama_produk` varchar(150) DEFAULT NULL,
  `tipe_pengeluaran` enum('Primary','Secondary','Pemusnahan') NOT NULL DEFAULT 'Primary',
  `tujuan` varchar(150) DEFAULT NULL,
  `nama_driver` varchar(100) NOT NULL,
  `no_mobil` varchar(50) NOT NULL,
  `jumlah` int(11) DEFAULT NULL,
  `best_before` date DEFAULT NULL,
  `batch` varchar(50) DEFAULT NULL,
  `satuan` enum('GALLON','BOX','MP') DEFAULT NULL,
  `lokasi_block` varchar(100) DEFAULT NULL,
  `catatan` text DEFAULT NULL,
  `tanggal_keluar` date NOT NULL,
  `no_dn` varchar(100) DEFAULT NULL,
  `so_number` varchar(500) DEFAULT NULL,
  `tanggal_pengiriman` date NOT NULL,
  `ritase` int(11) NOT NULL DEFAULT 1,
  `status` enum('Draft','Pending','Selesai') NOT NULL DEFAULT 'Draft',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `waktu_mulai_input` datetime DEFAULT NULL,
  `durasi_detik` int(11) DEFAULT NULL,
  `diperbarui_pada` datetime DEFAULT NULL,
  `diperbarui_oleh` varchar(100) DEFAULT NULL,
  `catatan_perubahan` text DEFAULT NULL,
  PRIMARY KEY (`id_barang_keluar`),
  KEY `fk_barang_keluar_pengguna` (`id_pengguna`),
  KEY `idx_barang_keluar_id_plant` (`id_pengguna_lokasi`),
  KEY `idx_barang_keluar_so_number` (`so_number`),
  KEY `idx_barang_keluar_composite` (`id_produk`,`id_pengguna_lokasi`),
  CONSTRAINT `fk_barang_keluar_pengguna` FOREIGN KEY (`id_pengguna`) REFERENCES `pengguna` (`id_pengguna`) ON UPDATE CASCADE,
  CONSTRAINT `fk_barang_keluar_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'prioritas_lokasi_produk' => <<<'SQL'
CREATE TABLE `prioritas_lokasi_produk` (
  `id_prioritas` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_produk` int(11) NOT NULL,
  `id_lokasi` int(11) NOT NULL,
  `id_block` int(11) NOT NULL,
  `id_line` int(11) NOT NULL,
  `id_level` int(11) DEFAULT NULL,
  `id_deep` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_prioritas`),
  KEY `fk_prioritas_produk` (`id_produk`),
  KEY `fk_prioritas_lokasi` (`id_lokasi`),
  KEY `fk_prioritas_block` (`id_block`),
  KEY `fk_prioritas_line` (`id_line`),
  KEY `fk_prioritas_level` (`id_level`),
  KEY `fk_prioritas_deep` (`id_deep`),
  KEY `idx_prioritas_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_prioritas_produk` FOREIGN KEY (`id_produk`) REFERENCES `produk` (`id_produk`) ON UPDATE CASCADE,
  CONSTRAINT `fk_prioritas_lokasi` FOREIGN KEY (`id_lokasi`) REFERENCES `lokasi` (`id_lokasi`) ON UPDATE CASCADE,
  CONSTRAINT `fk_prioritas_block` FOREIGN KEY (`id_block`) REFERENCES `block` (`id_block`) ON UPDATE CASCADE,
  CONSTRAINT `fk_prioritas_line` FOREIGN KEY (`id_line`) REFERENCES `line` (`id_line`) ON UPDATE CASCADE,
  CONSTRAINT `fk_prioritas_level` FOREIGN KEY (`id_level`) REFERENCES `level` (`id_level`) ON UPDATE CASCADE,
  CONSTRAINT `fk_prioritas_deep` FOREIGN KEY (`id_deep`) REFERENCES `deep` (`id_deep`) ON UPDATE CASCADE,
  CONSTRAINT `fk_prioritas_lokasi_produk_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'stok_gudang' => <<<'SQL'
CREATE TABLE `stok_gudang` (
  `id_stok` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_produk` int(11) NOT NULL,
  `nama_produk` varchar(150) DEFAULT NULL,
  `id_barang_masuk` int(11) NOT NULL,
  `jumlah_sisa` int(11) NOT NULL,
  `batch` varchar(50) DEFAULT NULL,
  `best_before` date DEFAULT NULL,
  `satuan` enum('GALLON','BOX','MP') NOT NULL,
  `lokasi_block` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_stok`),
  KEY `fk_stok_gudang_produk` (`id_produk`),
  KEY `fk_stok_gudang_barang_masuk` (`id_barang_masuk`),
  KEY `idx_stok_gudang_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_stok_gudang_produk` FOREIGN KEY (`id_produk`) REFERENCES `produk` (`id_produk`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stok_gudang_barang_masuk` FOREIGN KEY (`id_barang_masuk`) REFERENCES `barang_masuk` (`id_barang_masuk`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stok_gudang_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'stok_gudang_deep' => <<<'SQL'
CREATE TABLE `stok_gudang_deep` (
  `id_detail_stok` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_stok_header` int(11) NOT NULL,
  `id_deep` int(11) NOT NULL,
  `jumlah` int(11) NOT NULL,
  `best_before` date DEFAULT NULL,
  `batch` varchar(50) DEFAULT NULL,
  `lokasi_block` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_detail_stok`),
  KEY `fk_stok_gudang_deep_deep` (`id_deep`),
  KEY `idx_stok_gudang_deep_id_plant` (`id_pengguna_lokasi`),
  KEY `fk_stok_gudang_deep_header` (`id_stok_header`),
  CONSTRAINT `fk_stok_gudang_deep_deep` FOREIGN KEY (`id_deep`) REFERENCES `deep` (`id_deep`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stok_gudang_deep_header` FOREIGN KEY (`id_stok_header`) REFERENCES `stok_gudang` (`id_stok`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stok_gudang_deep_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'rencana_keluar_deep' => <<<'SQL'
CREATE TABLE `rencana_keluar_deep` (
  `id_rencana` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_barang_keluar` int(11) DEFAULT NULL,
  `id_detail_stok` int(11) DEFAULT NULL,
  `id_deep` int(11) NOT NULL,
  `jumlah_rencana` int(11) NOT NULL,
  `best_before` date DEFAULT NULL,
  `batch` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_rencana`),
  KEY `idx_rencana_plant` (`id_pengguna_lokasi`),
  KEY `idx_rencana_detail_stok` (`id_detail_stok`),
  KEY `idx_rencana_deep` (`id_deep`),
  KEY `idx_rencana_barang_keluar` (`id_barang_keluar`),
  CONSTRAINT `fk_rencana_keluar_deep_deep` FOREIGN KEY (`id_deep`) REFERENCES `deep` (`id_deep`) ON UPDATE CASCADE,
  CONSTRAINT `fk_rencana_keluar_deep_detail_stok` FOREIGN KEY (`id_detail_stok`) REFERENCES `stok_gudang_deep` (`id_detail_stok`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_rencana_keluar_deep_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'stok_opname' => <<<'SQL'
CREATE TABLE `stok_opname` (
  `id_opname` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `tanggal_opname` date NOT NULL,
  `id_pengguna` int(11) NOT NULL,
  `id_produk` int(11) NOT NULL,
  `nama_produk` varchar(150) NOT NULL,
  `lokasi_block` varchar(100) NOT NULL,
  `best_before` date DEFAULT NULL,
  `satuan` varchar(30) DEFAULT NULL,
  `stok_fisik` int(11) NOT NULL,
  `stok_sistem` int(11) NOT NULL,
  `selisih` int(11) NOT NULL,
  `alasan` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `jenis_opname` varchar(50) DEFAULT 'Akurasi',
  `stok_sebelumnya` int(11) DEFAULT NULL,
  `dirubah_oleh` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id_opname`),
  KEY `fk_stok_opname_pengguna` (`id_pengguna`),
  KEY `fk_stok_opname_produk` (`id_produk`),
  KEY `idx_stok_opname_id_plant` (`id_pengguna_lokasi`),
  KEY `idx_opname_lokasi_created` (`id_pengguna_lokasi`,`created_at`),
  KEY `idx_opname_lokasi_tanggal` (`id_pengguna_lokasi`,`tanggal_opname`),
  KEY `idx_opname_produk_batch_line` (`id_pengguna_lokasi`,`id_produk`,`lokasi_block`,`best_before`),
  CONSTRAINT `fk_stok_opname_pengguna` FOREIGN KEY (`id_pengguna`) REFERENCES `pengguna` (`id_pengguna`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stok_opname_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stok_opname_produk` FOREIGN KEY (`id_produk`) REFERENCES `produk` (`id_produk`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'mutasi' => <<<'SQL'
CREATE TABLE `mutasi` (
  `id_mutasi` int(11) NOT NULL AUTO_INCREMENT,
  `id_pengguna_lokasi` varchar(11) NOT NULL,
  `id_pengguna` int(11) NOT NULL,
  `id_produk` int(11) NOT NULL,
  `lokasi_sumber` varchar(50) NOT NULL,
  `lokasi_tujuan` varchar(50) NOT NULL,
  `jumlah` int(11) NOT NULL,
  `best_before` date DEFAULT NULL,
  `jenis_mutasi` varchar(20) NOT NULL,
  `satuan` enum('GALLON','BOX','MP') NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `catatan` text DEFAULT NULL,
  PRIMARY KEY (`id_mutasi`),
  KEY `fk_mutasi_pengguna` (`id_pengguna`),
  KEY `fk_mutasi_produk` (`id_produk`),
  KEY `idx_mutasi_id_plant` (`id_pengguna_lokasi`),
  CONSTRAINT `fk_mutasi_pengguna` FOREIGN KEY (`id_pengguna`) REFERENCES `pengguna` (`id_pengguna`) ON UPDATE CASCADE,
  CONSTRAINT `fk_mutasi_pengguna_lokasi` FOREIGN KEY (`id_pengguna_lokasi`) REFERENCES `pengguna_lokasi` (`id_pengguna_lokasi`) ON UPDATE CASCADE,
  CONSTRAINT `fk_mutasi_produk` FOREIGN KEY (`id_produk`) REFERENCES `produk` (`id_produk`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        'traceability' => <<<'SQL'
CREATE TABLE `traceability` (
  `id_traceability` int(11) NOT NULL AUTO_INCREMENT,
  `id_barang_keluar` int(11) DEFAULT NULL,
  `id_pengguna_lokasi` varchar(100) DEFAULT NULL,
  `id_route` varchar(50) DEFAULT NULL,
  `nama_driver` varchar(100) DEFAULT NULL,
  `id_customer` varchar(50) DEFAULT NULL,
  `nama_customer` varchar(150) DEFAULT NULL,
  `sales_group` varchar(100) DEFAULT NULL,
  `so_number` varchar(500) DEFAULT NULL,
  `no_dn` varchar(500) DEFAULT NULL,
  `nama_produk` varchar(150) DEFAULT NULL,
  `id_produk` int(11) DEFAULT NULL,
  `tanggal_pengiriman` date DEFAULT NULL,
  `jumlah` int(11) DEFAULT 0,
  `batch_number` varchar(50) DEFAULT NULL,
  `best_before` date DEFAULT NULL,
  `status_delivery` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_traceability`),
  KEY `id_barang_keluar` (`id_barang_keluar`),
  KEY `so_number` (`so_number`),
  KEY `id_produk` (`id_produk`),
  KEY `idx_traceability_id_pengguna_lokasi` (`id_pengguna_lokasi`),
  KEY `idx_traceability_best_before` (`best_before`),
  KEY `idx_traceability_id_produk` (`id_produk`),
  CONSTRAINT `traceability_ibfk_1` FOREIGN KEY (`id_barang_keluar`) REFERENCES `barang_keluar` (`id_barang_keluar`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
    ];

    public function up(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        foreach ($this->ddl as $sql) {
            DB::statement($sql);
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }

    public function down(): void
    {
        $tables = array_reverse(array_keys($this->ddl));
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        foreach ($tables as $table) {
            Schema::dropIfExists($table);
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }
};