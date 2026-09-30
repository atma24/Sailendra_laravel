<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;

/**
 * Parsing periode (bulan + tahun + minggu opsional) bersama.
 *
 * Konvensi: `tahun` melengkapi `bulan` (tahun lebih diprioritaskan).
 * `minggu` = nomor minggu (1-6) atau "all"/kosong untuk seluruh bulan.
 *
 * Definisi minggu: **Minggu 1 dimulai tanggal 1 bulan tersebut dan berakhir
 * pada hari Minggu pertama** (bisa jadi minggu parsial/pendek). Minggu 2 dst.
 * berjalan Senin–Minggu penuh. Contoh September 2025 (1 Sep = Senin):
 *   Minggu 1 = 1–7 Sep, Minggu 2 = 8–14 Sep, ...
 * Contoh September 2024 (1 Sep = Minggu):
 *   Minggu 1 = 1 Sep saja, Minggu 2 = 2–8 Sep, ...
 */
trait ParsesPeriode
{
    /**
     * Resolusi bulan efektif + rentang tanggal (start/end).
     *
     * @return array{bulan:string,tahun:string,monthStart:string,monthEnd:string}
     */
    protected function resolvePeriode(Request $request): array
    {
        $bulan = trim((string) $request->query('bulan'));
        $bulan = $bulan !== '' ? $bulan : now()->format('Y-m');

        $tahun = trim((string) $request->query('tahun'));
        if ($tahun !== '' && preg_match('/^\d{4}$/', $tahun)) {
            $bulan = $tahun.'-'.substr($bulan, 5, 2);
        }

        $monthStart = $bulan.'-01';
        $monthEnd = now()->parse($monthStart)->endOfMonth()->format('Y-m-d');

        return [
            'bulan' => $bulan,
            'tahun' => substr($bulan, 0, 4),
            'monthStart' => $monthStart,
            'monthEnd' => $monthEnd,
        ];
    }

    /**
     * Rentang minggu di dalam bulan (Minggu 1 = tgl 1 s/d Minggu pertama).
     * Mengembalikan rentang penuh bulan bila minggu kosong/"all", dan rentang
     * kosong bila nomor minggu di luar jumlah minggu yang ada di bulan tsb.
     *
     * @return array{0:string,1:string} [start, end]
     */
    protected function weekRange(Request $request, string $monthStart, string $monthEnd): array
    {
        $minggu = $request->query('minggu');
        $minggu = $minggu === null ? '' : trim((string) $minggu);
        if ($minggu === '' || strtolower($minggu) === 'all') {
            return [$monthStart, $monthEnd];
        }

        $num = (int) preg_replace('/\D/', '', $minggu);
        if ($num <= 0) {
            return [$monthStart, $monthEnd];
        }

        if ($num > $this->jumlahMingguDalamBulan($monthStart, $monthEnd)) {
            // Minggu tidak ada di bulan ini → rentang kosong.
            return ['', ''];
        }

        // Minggu 1: dari tgl 1 s/d hari Minggu pertama (bisa parsial).
        $start = now()->parse($monthStart);
        $firstSunday = $start->copy()->startOfWeek(\Carbon\CarbonInterface::SUNDAY);
        if ($firstSunday->lt($start)) {
            $firstSunday->addWeek();
        }

        if ($num === 1) {
            $rangeStart = $start->format('Y-m-d');
            $rangeEnd = $firstSunday->format('Y-m-d');
        } else {
            // Minggu 2+ : Senin berikutnya, tiap blok 7 hari.
            $weekStart = $firstSunday->copy()->addDay()->addWeeks($num - 2);
            $rangeStart = $weekStart->format('Y-m-d');
            $rangeEnd = $weekStart->copy()->addDays(6)->format('Y-m-d');
        }

        if ($rangeStart < $monthStart) {
            $rangeStart = $monthStart;
        }
        if ($rangeEnd > $monthEnd) {
            $rangeEnd = $monthEnd;
        }

        return [$rangeStart, $rangeEnd];
    }

    /**
     * Jumlah minggu dalam bulan (Minggu 1 = tgl 1 s/d Minggu pertama).
     */
    protected function jumlahMingguDalamBulan(string $monthStart, string $monthEnd): int
    {
        $start = now()->parse($monthStart);
        $end = now()->parse($monthEnd);

        $firstSunday = $start->copy()->startOfWeek(\Carbon\CarbonInterface::SUNDAY);
        if ($firstSunday->lt($start)) {
            $firstSunday->addWeek();
        }

        // Minggu 1 selalu ada; sisanya tiap blok Senin–Minggu penuh.
        $count = 1;
        $cursor = $firstSunday->copy()->addDay();
        while ($cursor->lte($end)) {
            $count++;
            $cursor->addWeek();
        }

        return $count;
    }
}
