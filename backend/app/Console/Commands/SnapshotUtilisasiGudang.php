<?php

namespace App\Console\Commands;

use App\Services\Dashboard\UtilisasiSnapshotService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Simpan snapshot harian card "Warehouse Utilization" (1 baris/depo/hari).
 *
 * Dijadwalkan tiap 23:59 WIB (lihat routes/console.php). Bisa juga
 * dijalankan manual untuk backfill, mis.:
 *   php artisan snapshot:utilisasi-gudang --tanggal=2026-10-01
 *   php artisan snapshot:utilisasi-gudang --tanggal=2026-10-01 --depo=9021
 */
class SnapshotUtilisasiGudang extends Command
{
    protected $signature = 'snapshot:utilisasi-gudang
        {--tanggal= : Tanggal snapshot (YYYY-MM-DD); default hari ini}
        {--depo= : Batasi ke satu id_pengguna_lokasi (opsional)}';

    protected $description = 'Simpan snapshot harian Warehouse Utilization per depo';

    public function handle(UtilisasiSnapshotService $service): int
    {
        $tanggal = (string) ($this->option('tanggal') ?: now()->format('Y-m-d'));

        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
            $this->error("Format tanggal tidak valid: {$tanggal} (harus YYYY-MM-DD)");

            return self::FAILURE;
        }

        $depo = $this->option('depo');
        $depoFilter = $depo ? [trim((string) $depo)] : null;

        try {
            $hasil = $service->jalankan($tanggal, $depoFilter);
        } catch (\Throwable $e) {
            Log::error('Snapshot Warehouse Utilization gagal.', [
                'tanggal' => $tanggal,
                'depo' => $depoFilter,
                'error' => $e->getMessage(),
            ]);
            $this->error('Snapshot gagal: '.$e->getMessage());

            return self::FAILURE;
        }

        Log::info('Snapshot Warehouse Utilization tersimpan.', [
            'tanggal' => $hasil['tanggal'],
            'jumlah' => $hasil['jumlah'],
        ]);

        $this->info(sprintf(
            'Snapshot Warehouse Utilization tersimpan: %d depo untuk %s.',
            $hasil['jumlah'],
            $hasil['tanggal']
        ));

        return self::SUCCESS;
    }
}
