<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Tambah tipe pengeluaran FOC (Free of Charge).
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `tipe_pengeluaran` ENUM('Primary','Secondary','Pemusnahan','FOC') NOT NULL DEFAULT 'Primary'");
    }

    public function down(): void
    {
        // Kembalikan enum tanpa FOC (gagal bila masih ada baris bertipe FOC).
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `tipe_pengeluaran` ENUM('Primary','Secondary','Pemusnahan') NOT NULL DEFAULT 'Primary'");
    }
};
