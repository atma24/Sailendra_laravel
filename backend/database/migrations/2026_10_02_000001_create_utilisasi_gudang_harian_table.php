<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot harian card "Warehouse Utilization" — 1 baris per depo per hari.
 *
 * Diisi oleh command `snapshot:utilisasi-gudang` yang dijadwalkan
 * tiap 23:59 WIB (lihat routes/console.php).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('utilisasi_gudang_harian', function (Blueprint $table) {
            $table->id();
            $table->date('tanggal');
            $table->string('id_pengguna_lokasi', 11);

            // produk_realtime
            $table->integer('produk_total')->default(0);
            $table->integer('produk_qty')->default(0);

            // storage_regular + storage_luar
            $table->integer('dalam_terpakai')->default(0);
            $table->integer('dalam_kapasitas')->default(0);
            $table->decimal('dalam_persen', 6, 2)->default(0);
            $table->integer('luar_terpakai')->default(0);
            $table->integer('luar_kapasitas')->default(0);
            $table->decimal('luar_persen', 6, 2)->default(0);

            // Breakdown gallon/jug per item (dari gallon_breakdown).
            $table->integer('gallon_vip')->default(0);
            $table->integer('gallon_aqua')->default(0);
            $table->integer('gallon_vit')->default(0);
            $table->integer('jug_aqua')->default(0);
            $table->integer('jug_vit')->default(0);

            // Ringkasan per zona (dari produk_per_kategori): qty & kapasitas.
            foreach (['reguler', 'mobil', 'transit', 'bad_reject'] as $zona) {
                $table->integer('zona_'.$zona.'_qty')->default(0);
                $table->integer('zona_'.$zona.'_kapasitas')->default(0);
            }

            // Detail penuh (persis payload card): produk_realtime,
            // gallon_breakdown, gallon_zona, produk_per_kategori.
            $table->json('detail')->nullable();

            $table->timestamps();

            $table->unique(['tanggal', 'id_pengguna_lokasi'], 'uq_utilisasi_harian');
            $table->index(['id_pengguna_lokasi', 'tanggal'], 'idx_utilisasi_depo_tgl');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('utilisasi_gudang_harian');
    }
};
