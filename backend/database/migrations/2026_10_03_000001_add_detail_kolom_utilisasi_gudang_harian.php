<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi tabel snapshot utilisasi_gudang_harian dengan kolom
 * breakdown gallon/jug dan ringkasan per zona.
 *
 * Migration ini aman untuk DB yang sudah punya tabel lama (kolom
 * ditambahkan bila belum ada) maupun DB baru.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('utilisasi_gudang_harian')) {
            return;
        }

        Schema::table('utilisasi_gudang_harian', function (Blueprint $table) {
            $kolom = [
                'gallon_vip', 'gallon_aqua', 'gallon_vit', 'jug_aqua', 'jug_vit',
                'zona_reguler_qty', 'zona_reguler_kapasitas',
                'zona_mobil_qty', 'zona_mobil_kapasitas',
                'zona_transit_qty', 'zona_transit_kapasitas',
                'zona_bad_reject_qty', 'zona_bad_reject_kapasitas',
            ];

            foreach ($kolom as $nama) {
                if (! Schema::hasColumn('utilisasi_gudang_harian', $nama)) {
                    $table->integer($nama)->default(0);
                }
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('utilisasi_gudang_harian')) {
            return;
        }

        Schema::table('utilisasi_gudang_harian', function (Blueprint $table) {
            foreach ([
                'gallon_vip', 'gallon_aqua', 'gallon_vit', 'jug_aqua', 'jug_vit',
                'zona_reguler_qty', 'zona_reguler_kapasitas',
                'zona_mobil_qty', 'zona_mobil_kapasitas',
                'zona_transit_qty', 'zona_transit_kapasitas',
                'zona_bad_reject_qty', 'zona_bad_reject_kapasitas',
            ] as $nama) {
                if (Schema::hasColumn('utilisasi_gudang_harian', $nama)) {
                    $table->dropColumn($nama);
                }
            }
        });
    }
};
