<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Edit BB/jumlah/plant dari card line dicatat sebagai mutasi GS_GS,
        // satuannya mengikuti stok (bisa PCS dari hasil konversi reject).
        DB::statement("ALTER TABLE `mutasi` MODIFY `satuan` ENUM('GALLON','BOX','MP','PCS','RAW','RTP') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `mutasi` MODIFY `satuan` ENUM('GALLON','BOX','MP','RAW','RTP') NOT NULL");
    }
};
