<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tanggal produksi per item inbound. Diturunkan otomatis dari
        // best before (BB - 2 tahun) di aplikasi; nullable agar data lama
        // tidak pecah saat kolom ditambahkan.
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
