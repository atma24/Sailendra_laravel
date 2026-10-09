<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Snapshot harian card "Warehouse Utilization" — 1 report per depo per hari.
// Dijalankan in-process (Schedule::call + Artisan::call) karena shared hosting
// memblokir proc_open/dkk sehingga Schedule::command() mati instan (~30ms)
// tanpa output dan tanpa menulis DB.
// Dijalankan tiap 23:59 WIB. Butuh cron `schedule:run` tiap menit di server:
//   * * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1
Schedule::call(function () {
    $exit = Artisan::call('snapshot:utilisasi-gudang');
    $output = (string) Artisan::output();

    Log::info('Scheduler snapshot utilisasi selesai.', ['exit' => $exit, 'output' => $output]);

    if ($exit !== 0) {
        throw new RuntimeException('snapshot:utilisasi-gudang gagal (exit '.$exit.'): '.$output);
    }
})->dailyAt('23:59')
    ->timezone('Asia/Jakarta')
    ->name('snapshot-utilisasi-gudang')
    ->withoutOverlapping(60)
    ->onSuccess(fn () => Log::info('Scheduler snapshot utilisasi OK.'))
    ->onFailure(fn () => Log::error('Scheduler snapshot utilisasi GAGAL.'));
