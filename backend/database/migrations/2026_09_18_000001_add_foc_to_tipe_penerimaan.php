<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Tambah tipe penerimaan FOC (Free of Charge, hasil auto-inbound dari outbound FOC + input manual).
        DB::statement("ALTER TABLE `barang_masuk` MODIFY `tipe_penerimaan` ENUM('Primary','Secondary','Primary XWH','REJECT','FOC') NOT NULL DEFAULT 'Primary'");
    }

    public function down(): void
    {
        // Kembalikan enum tanpa FOC (gagal bila masih ada baris bertipe FOC).
        DB::statement("ALTER TABLE `barang_masuk` MODIFY `tipe_penerimaan` ENUM('Primary','Secondary','Primary XWH','REJECT') NOT NULL DEFAULT 'Primary'");
    }
};
