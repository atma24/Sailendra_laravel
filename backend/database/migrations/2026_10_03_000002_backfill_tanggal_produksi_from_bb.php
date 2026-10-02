<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Tanggal produksi kini otomatis = best before - 2 tahun (per item).
     * Backfill data lama yang masih kosong agar tidak ada lagi item yang
     * terlihat "Belum diisi".
     */
    public function up(): void
    {
        DB::table('barang_masuk')
            ->select('id_barang_masuk', 'best_before')
            ->whereNull('tanggal_produksi')
            ->whereNotNull('best_before')
            ->where('best_before', '<', '9999-01-01')
            ->orderBy('id_barang_masuk')
            ->chunk(500, function ($rows) {
                foreach ($rows as $row) {
                    $bb = trim((string) $row->best_before);
                    $dt = DateTime::createFromFormat('Y-m-d', $bb);
                    if (! $dt || $dt->format('Y-m-d') !== $bb) {
                        continue;
                    }
                    DB::table('barang_masuk')
                        ->where('id_barang_masuk', $row->id_barang_masuk)
                        ->update(['tanggal_produksi' => $dt->modify('-2 years')->format('Y-m-d')]);
                }
            });
    }

    public function down(): void
    {
        // Tidak ada rollback: data hasil backfill tetap valid.
    }
};
