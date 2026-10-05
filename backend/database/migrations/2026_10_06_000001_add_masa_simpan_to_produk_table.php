<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('produk', 'masa_simpan_hari')) {
            Schema::table('produk', function (Blueprint $table) {
                $table->integer('masa_simpan_hari')->default(730)->after('tanpa_batch');
            });
        }

        // Samakan data lama yang null/0 dengan default 2 tahun (730 hari).
        DB::table('produk')
            ->whereNull('masa_simpan_hari')
            ->orWhere('masa_simpan_hari', '<=', 0)
            ->update(['masa_simpan_hari' => 730]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('produk', 'masa_simpan_hari')) {
            Schema::table('produk', function (Blueprint $table) {
                $table->dropColumn('masa_simpan_hari');
            });
        }
    }
};
