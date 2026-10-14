<?php

namespace App\Console\Commands;

use App\Services\PendingKedaluarsaService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Sweep Pending kedaluwarsa -> Draft (inbound + outbound).
 *
 * Dijadwalkan tiap menit (lihat routes/console.php). Bisa juga dijalankan
 * manual, mis.:
 *   php artisan pending:sweep
 *   php artisan pending:sweep --menit=15 --lok=9021
 *   php artisan pending:sweep --dry-run --lok=9021
 */
class SweepPendingKedaluarsa extends Command
{
    protected $signature = 'pending:sweep
        {--menit=15 : Umur Pending (menit sejak submit) yang dianggap kedaluwarsa}
        {--limit=500 : Maks baris diproses per tabel per jalan}
        {--lok= : Batasi ke satu id_pengguna_lokasi (opsional)}
        {--dry-run : Hitung saja, tanpa mengubah data}';

    protected $description = 'Kembalikan Pending kedaluwarsa (> batas menit sejak submit) ke Draft + lepas booking';

    public function handle(PendingKedaluarsaService $service): int
    {
        $menit = max(1, (int) ($this->option('menit') ?: PendingKedaluarsaService::BATAS_MENIT_DEFAULT));
        $limit = max(1, min(5000, (int) ($this->option('limit') ?: 500)));
        $lok = trim((string) ($this->option('lok') ?: ''));
        $lok = $lok !== '' ? $lok : null;
        $dryRun = (bool) $this->option('dry-run');

        try {
            if ($dryRun) {
                $hasil = $this->hitungCalon($lok, $menit, $limit);
            } else {
                $hasil = $service->sweep($lok, $menit, $limit);
            }
        } catch (\Throwable $e) {
            Log::error('Sweep Pending kedaluwarsa gagal.', [
                'lok' => $lok, 'menit' => $menit, 'error' => $e->getMessage(),
            ]);
            $this->error('Sweep gagal: '.$e->getMessage());

            return self::FAILURE;
        }

        $label = $dryRun ? '[DRY-RUN] ' : '';
        $this->info(sprintf(
            '%sPending kedaluwarsa (>%d mnt)%s: outbound %d baris (%d grup), inbound %d baris (%d grup).',
            $label, $menit, $lok ? " lok {$lok}" : '',
            $hasil['outbound_baris'], $hasil['outbound_grup'],
            $hasil['inbound_baris'], $hasil['inbound_grup']
        ));

        return self::SUCCESS;
    }

    private function hitungCalon(?string $lok, int $menit, int $limit): array
    {
        $keluar = \Illuminate\Support\Facades\DB::table('barang_keluar as bk')
            ->when($lok, fn ($q) => $q->where('bk.id_pengguna_lokasi', $lok))
            ->whereRaw("LOWER(TRIM(bk.status)) = 'pending'")
            ->whereRaw('COALESCE(bk.diperbarui_pada, bk.created_at) < DATE_SUB(NOW(), INTERVAL '.(int) $menit.' MINUTE)')
            ->count();

        $masuk = \Illuminate\Support\Facades\DB::table('barang_masuk as bm')
            ->when($lok, fn ($q) => $q->where('bm.id_pengguna_lokasi', $lok))
            ->whereRaw("LOWER(TRIM(bm.status)) = 'pending'")
            ->whereRaw('COALESCE(bm.diperbarui_pada, bm.created_at) < DATE_SUB(NOW(), INTERVAL '.(int) $menit.' MINUTE)')
            ->count();

        return [
            'outbound_grup' => 0, 'outbound_baris' => (int) $keluar,
            'inbound_grup' => 0, 'inbound_baris' => (int) $masuk,
        ];
    }
}
