<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tanggal produksi per shipment inbound (wajib diisi manual form,
        // wajib dilengkapi di detail sebelum confirm). Nullable agar data
        // Selesai lama + Draft OTM lama tidak pecah; kewajiban ditegakkan
        // di validasi aplikasi (store/storeBatch + gate submit/konfirmasi).
        Schema::table('barang_masuk', function (Blueprint $table) {
            $table->date('tanggal_produksi')->nullable()->after('tanggal_masuk');
        });
    }

    public function down(): void
    {
        Schema::table('barang_masuk', function (Blueprint $table) {
            $table->dropColumn('tanggal_produksi');
        });
    }
};
