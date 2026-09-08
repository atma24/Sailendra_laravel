<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bersihkan sisa percobaan migrate yang gagal di tengah (tabel tanpa FK).
        Schema::dropIfExists('pengaturan_produk');

        Schema::create('pengaturan_produk', function (Blueprint $table) {
            // Samakan dengan tabel legacy agar FK varchar lolos (mereka utf8mb4_general_ci).
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_general_ci';
            $table->engine = 'InnoDB';

            $table->increments('id_pengaturan');
            $table->string('id_pengguna_lokasi', 11);
            $table->integer('id_produk');
            $table->boolean('ikut_fefo')->default(true);
            $table->json('urutan_blok')->nullable();
            $table->timestamps();

            $table->unique(['id_pengguna_lokasi', 'id_produk'], 'uq_pengaturan_produk_lokasi');
            $table->foreign('id_pengguna_lokasi', 'fk_pengaturan_produk_lokasi')
                ->references('id_pengguna_lokasi')->on('pengguna_lokasi')->onUpdate('cascade');
            $table->foreign('id_produk', 'fk_pengaturan_produk_produk')
                ->references('id_produk')->on('produk')->onUpdate('cascade');
        });

        Schema::table('produk', function (Blueprint $table) {
            $table->boolean('tanpa_batch')->default(false)->after('isi_per_pcs');
        });

        // Tandai 2 produk JUG lama sebagai tanpa batch (menggantikan hardcode ID di kode).
        DB::table('produk')->whereIn('id_produk', [10516938, 10516939])->update(['tanpa_batch' => true]);
    }

    public function down(): void
    {
        Schema::table('produk', function (Blueprint $table) {
            $table->dropColumn('tanpa_batch');
        });

        Schema::dropIfExists('pengaturan_produk');
    }
};
