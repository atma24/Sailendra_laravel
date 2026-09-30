<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Api\Concerns\FiltersByLokasi;
use App\Http\Controllers\Api\Concerns\ParsesPeriode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\DashboardSummaryRequest;
use App\Http\Resources\Dashboard\DashboardSummaryResource;
use App\Services\Dashboard\DashboardSummaryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    use ApiResponse;
    use FiltersByLokasi;
    use ParsesPeriode;

    public function __construct(
        private readonly DashboardSummaryService $summary,
    ) {}

    /**
     * GET /api/dashboard/summary
     */
    public function summary(DashboardSummaryRequest $request)
    {
        $lokasiFilter = $request->lokasiFilter();
        $produkFilter = $request->produkFilter();

        $periode = $this->resolvePeriode($request);
        $isWeekly = $request->isWeekly();

        if ($isWeekly) {
            [$rangeStart, $rangeEnd] = $this->weekRange($request, $periode['monthStart'], $periode['monthEnd']);
        } else {
            $rangeStart = $periode['monthStart'];
            $rangeEnd = $periode['monthEnd'];
        }

        $granularity = 'day';
        $dates = $this->datesBetween($rangeStart, $rangeEnd);

        $mutasiTotal = $this->countMutasi($lokasiFilter);

        $payload = $this->summary->build(
            $lokasiFilter,
            $produkFilter,
            [
                'mulai' => $rangeStart,
                'sampai' => $rangeEnd,
                'month_start' => $periode['monthStart'],
                'month_end' => $periode['monthEnd'],
                'label' => [
                    'bulan' => $periode['bulan'],
                    'tahun' => $periode['tahun'],
                    'minggu' => $request->mingguLabel(),
                    'mulai' => $rangeStart,
                    'sampai' => $rangeEnd,
                    'granularity' => $granularity,
                    'jumlah_minggu' => $this->jumlahMingguDalamBulan($periode['monthStart'], $periode['monthEnd']),
                ],
            ],
            $dates,
            $granularity,
            $request->top(),
            $mutasiTotal
        );

        return new DashboardSummaryResource($payload);
    }

    /**
     * GET /api/dashboard/tahun-tersedia
     */
    public function tahunTersedia(Request $request)
    {
        $filter = $this->lokasiFilterFromRequest($request);

        $minIn = $this->withLokasiFilter(
            DB::table('barang_masuk as bm')->selectRaw('MIN(DATE(bm.tanggal_masuk)) AS minTgl'),
            'bm.id_pengguna_lokasi',
            $filter
        )->value('minTgl');

        $minOut = $this->withLokasiFilter(
            DB::table('barang_keluar as bk')->selectRaw('MIN(DATE(bk.tanggal_keluar)) AS minTgl'),
            'bk.id_pengguna_lokasi',
            $filter
        )->value('minTgl');

        $candidates = array_filter([$minIn, $minOut]);
        $nowYear = (int) now()->format('Y');
        $startYear = ! empty($candidates) ? (int) min(array_map(fn ($d) => (int) substr((string) $d, 0, 4), $candidates)) : $nowYear;

        if ($startYear > $nowYear) {
            $startYear = $nowYear;
        }

        $years = [];
        for ($y = $startYear; $y <= $nowYear; $y++) {
            $years[] = $y;
        }

        return $this->ok($years);
    }

    /**
     * @return array<int,string>
     */
    private function datesBetween(string $start, string $end): array
    {
        $dates = [];
        $cursor = now()->parse($start);
        $last = now()->parse($end);
        while ($cursor->lte($last)) {
            $dates[] = $cursor->format('Y-m-d');
            $cursor->addDay();
        }

        return $dates;
    }

    private function countMutasi(?array $lokasiFilter): int
    {
        return (int) $this->withLokasiFilter(
            DB::table('mutasi as m')->selectRaw('COUNT(*) AS c'),
            'm.id_pengguna_lokasi',
            $lokasiFilter
        )->value('c');
    }
}
