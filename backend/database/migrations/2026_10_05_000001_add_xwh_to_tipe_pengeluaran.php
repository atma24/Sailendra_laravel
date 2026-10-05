<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Tambah tipe pengeluaran XWH (strict: hanya ambil stok lokasi XWH).
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `tipe_pengeluaran` ENUM('Primary','Secondary','Pemusnahan','FOC','XWH') NOT NULL DEFAULT 'Primary'");
    }

    public function down(): void
    {
        // Kembalikan enum tanpa XWH (gagal bila masih ada baris bertipe XWH).
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `tipe_pengeluaran` ENUM('Primary','Secondary','Pemusnahan','FOC') NOT NULL DEFAULT 'Primary'");
    }
};
