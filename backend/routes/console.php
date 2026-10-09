<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Snapshot harian card "Warehouse Utilization" — 1 report per depo per hari.
// TEST: sementara dimajukan ke 09:00 WIB untuk membuktikan kegagalan 23:59
// adalah window maintenance MySQL tengah malam (bukan config salah).
// Butuh cron `schedule:run` tiap menit di server:
//   * * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1
Schedule::command('snapshot:utilisasi-gudang')
    ->dailyAt('09:00')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping(60)
    ->appendOutputTo(storage_path('logs/snapshot-utilisasi.log'));
