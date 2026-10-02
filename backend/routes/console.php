<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Snapshot harian card "Warehouse Utilization" — 1 report per depo per hari.
// Dijalankan tiap 23:59 WIB. Butuh cron `schedule:run` tiap menit di server:
//   * * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1
Schedule::command('snapshot:utilisasi-gudang')
    ->dailyAt('23:59')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping();
