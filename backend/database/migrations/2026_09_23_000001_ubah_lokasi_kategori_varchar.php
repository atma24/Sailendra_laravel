<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Lepas ENUM kategori lokasi agar lokasi/kategori baru bisa ditambah lewat UI
     * tanpa migrasi lagi. Nilai lama (GALLON/SPS/XWH) tetap valid di VARCHAR.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE `lokasi` MODIFY `kategori` VARCHAR(50) NOT NULL DEFAULT ''");
    }

    public function down(): void
    {
        // Kembalikan ke ENUM semula (akan gagal bila ada kategori di luar daftar).
        DB::statement("ALTER TABLE `lokasi` MODIFY `kategori` ENUM('GALLON','SPS','XWH') NOT NULL");
    }
};
