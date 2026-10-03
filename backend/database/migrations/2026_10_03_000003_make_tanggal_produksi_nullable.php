<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Produk tanpa batch dan REJECT memakai BB sentinel 9999-12-31,
        // sehingga tidak memiliki tanggal produksi yang nyata.
        // Sebagian database sudah memiliki kolom ini sebagai NOT NULL;
        // samakan kembali dengan kontrak aplikasi dan migration awal.
        Schema::table('barang_masuk', function (Blueprint $table) {
            $table->date('tanggal_produksi')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Sengaja tidak dikembalikan ke NOT NULL. Data tanpa batch/REJECT
        // memang sah bernilai NULL dan rollback constraint akan merusaknya.
    }
};
