<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Tambah satuan RAW & RTP (perlakuan sama seperti BOX, tanpa logika khusus).
        DB::statement("ALTER TABLE `produk` MODIFY `satuan` ENUM('GALLON','BOX','MP','RAW','RTP') NOT NULL");
        DB::statement("ALTER TABLE `barang_masuk` MODIFY `satuan` ENUM('GALLON','BOX','MP','PCS','RAW','RTP') NOT NULL");
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `satuan` ENUM('GALLON','BOX','MP','RAW','RTP') DEFAULT NULL");
        DB::statement("ALTER TABLE `mutasi` MODIFY `satuan` ENUM('GALLON','BOX','MP','RAW','RTP') NOT NULL");
    }

    public function down(): void
    {
        // Kembalikan enum tanpa RAW/RTP (gagal bila masih ada baris bersatuan RAW/RTP).
        DB::statement("ALTER TABLE `mutasi` MODIFY `satuan` ENUM('GALLON','BOX','MP') NOT NULL");
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `satuan` ENUM('GALLON','BOX','MP') DEFAULT NULL");
        DB::statement("ALTER TABLE `barang_masuk` MODIFY `satuan` ENUM('GALLON','BOX','MP','PCS') NOT NULL");
        DB::statement("ALTER TABLE `produk` MODIFY `satuan` ENUM('GALLON','BOX','MP') NOT NULL");
    }
};
