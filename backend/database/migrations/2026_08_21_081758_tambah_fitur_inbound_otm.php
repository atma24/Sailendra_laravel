<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Tambah kolom di tabel barang_masuk
        Schema::table('barang_masuk', function (Blueprint $table) {
            if (!Schema::hasColumn('barang_masuk', 'shipment_id')) {
                $table->string('shipment_id', 100)->nullable()->after('id_barang_masuk');
            }
            if (!Schema::hasColumn('barang_masuk', 'status')) {
                $table->string('status', 20)->default('Selesai')->after('catatan');
            }
        });

        // 2. Buat tabel rencana_masuk_deep untuk booking kapasitas
        if (!Schema::hasTable('rencana_masuk_deep')) {
            Schema::create('rencana_masuk_deep', function (Blueprint $table) {
                $table->id('id_rencana');
                $table->integer('id_barang_masuk');
                $table->string('id_pengguna_lokasi', 11);
                $table->integer('id_deep');
                $table->integer('jumlah_rencana');
                $table->date('best_before')->nullable();
                $table->string('batch', 50)->nullable();
                
                // Cukup created_at saja sesuai SQL sebelumnya
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop tabel rencana_masuk_deep
        Schema::dropIfExists('rencana_masuk_deep');

        // Drop kolom di tabel barang_masuk
        Schema::table('barang_masuk', function (Blueprint $table) {
            if (Schema::hasColumn('barang_masuk', 'status')) {
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('barang_masuk', 'shipment_id')) {
                $table->dropColumn('shipment_id');
            }
        });
    }
};