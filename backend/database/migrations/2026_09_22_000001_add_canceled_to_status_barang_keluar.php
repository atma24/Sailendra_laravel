<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Status baru Canceled untuk soft-cancel (pengganti hapus) inbound/outbound Draft/Pending.
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `status` ENUM('Draft','Pending','Selesai','Canceled') NOT NULL DEFAULT 'Draft'");
    }

    public function down(): void
    {
        // Kembalikan enum tanpa Canceled (gagal bila masih ada baris berstatus Canceled).
        DB::statement("ALTER TABLE `barang_keluar` MODIFY `status` ENUM('Draft','Pending','Selesai') NOT NULL DEFAULT 'Draft'");
    }
};
