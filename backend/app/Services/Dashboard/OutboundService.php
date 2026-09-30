<?php

namespace App\Services\Dashboard;

use App\Http\Controllers\Api\Concerns\ParsesSo;
use App\Support\Dashboard\DashboardConstants;
use App\Support\Dashboard\DashboardSql;
use App\Support\Dashboard\LokasiFilter;
use Illuminate\Support\Facades\DB;

/**
 * Query outbound (barang keluar) untuk dashboard:
 * statistik ringkas + series, breakdown per tipe, per GIN, per SO,
 * dan penjualan per produk.
 */
class OutboundService
{
    use ParsesSo;

    /**
     * Statistik outbound: total GIN, qty, bulan ini, hari ini, pending + series.
     *
     * @param  array<int,string>  $dates
     * @param  array<int,string>  $produkFilter
     * @return array{total:int,total_qty:int,bulan_ini:int,qty_bulan_ini:int,qty_today:int,pending:int,series:array<int,array{tanggal:string,qty:int}>,series_planned:array<int,array{tanggal:string,qty:int}>,series_actual:array<int,array{tanggal:string,qty:int}>}
     */
    public function stats(
        ?array $lokasiFilter,
        string $rangeStart,
        string $rangeEnd,
        string $today,
        array $dates,
        array $produkFilter = [],
        string $granularity = 'day'
    ): array {
        $key = DashboardSql::outboundTxKey();

        $base = DB::table('barang_keluar as bk')
            ->selectRaw(DashboardSql::countTxExpr($key, 'bk.status', 'confirmed').' AS total')
            ->selectRaw('COALESCE(SUM('.DashboardSql::confirmedCase('bk.status', 'bk.jumlah').'),0) AS total_qty')
            ->selectRaw('COUNT(DISTINCT CASE WHEN DATE(bk.tanggal_keluar) BETWEEN ? AND ? THEN '.$key.' END) AS bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bk.tanggal_keluar) BETWEEN ? AND ? THEN bk.jumlah ELSE 0 END) AS qty_bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bk.tanggal_keluar) = ? THEN bk.jumlah ELSE 0 END) AS qty_today', [$today])
            ->selectRaw(DashboardSql::countTxExpr($key, 'bk.status', 'pending').' AS pending');
        DashboardSql::whereConfirmed($base, 'bk.status');

        $base = LokasiFilter::apply($base, 'bk.id_pengguna_lokasi', $lokasiFilter);
        if (! empty($produkFilter)) {
            $base->whereIn('bk.nama_produk', $produkFilter);
        }
        $r = (array) $base->first();

        $series = [];
        $seriesQ = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd]);
        DashboardSql::whereConfirmed($seriesQ, 'bk.status');
        if ($granularity === 'month') {
            $seriesQ->selectRaw("DATE_FORMAT(bk.tanggal_keluar, '%Y-%m') AS d, bk.jumlah AS qty");
        } else {
            $seriesQ->selectRaw('DATE(bk.tanggal_keluar) AS d, bk.jumlah AS qty');
        }
        $seriesQ = LokasiFilter::apply($seriesQ, 'bk.id_pengguna_lokasi', $lokasiFilter);
        if (! empty($produkFilter)) {
            $seriesQ->whereIn('bk.nama_produk', $produkFilter);
        }
        $smap = $seriesQ->get()->groupBy('d')->map(fn ($g) => (int) $g->sum('qty'))->toArray();

        foreach ($dates as $d) {
            $series[] = ['tanggal' => $d, 'qty' => (int) ($smap[$d] ?? 0)];
        }

        // Series COUNT transaksi per tanggal: planned (non-cancel) vs actual (confirmed/selesai).
        // Kunci transaksi = driver + gin_no (lihat DashboardSql::outboundTxKey()).
        $countByDate = function (bool $onlyConfirmed) use ($lokasiFilter, $rangeStart, $rangeEnd, $dates, $produkFilter, $granularity, $key): array {
            $q = DB::table('barang_keluar as bk')
                ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd]);

            if ($onlyConfirmed) {
                DashboardSql::whereConfirmed($q, 'bk.status');
            } else {
                DashboardSql::whereNotCanceled($q, 'bk.status');
            }

            if ($granularity === 'month') {
                $q->selectRaw("DATE_FORMAT(bk.tanggal_keluar, '%Y-%m') AS tgl");
            } else {
                $q->selectRaw('DATE(bk.tanggal_keluar) AS tgl');
            }
            $q->selectRaw('COUNT(DISTINCT '.$key.') AS c');

            $q = LokasiFilter::apply($q, 'bk.id_pengguna_lokasi', $lokasiFilter);
            if (! empty($produkFilter)) {
                $q->whereIn('bk.nama_produk', $produkFilter);
            }

            $map = $q->groupBy('tgl')->pluck('c', 'tgl')->toArray();

            $out = [];
            foreach ($dates as $d) {
                $out[] = ['tanggal' => $d, 'qty' => (int) ($map[$d] ?? 0)];
            }

            return $out;
        };

        return [
            'total' => (int) ($r['total'] ?? 0),
            'total_qty' => (int) ($r['total_qty'] ?? 0),
            'bulan_ini' => (int) ($r['bulan_ini'] ?? 0),
            'qty_bulan_ini' => (int) ($r['qty_bulan_ini'] ?? 0),
            'qty_today' => (int) ($r['qty_today'] ?? 0),
            'pending' => (int) ($r['pending'] ?? 0),
            'series' => $series,
            'series_planned' => $countByDate(false),
            'series_actual' => $countByDate(true),
        ];
    }

    /**
     * Outbound per tipe_pengeluaran: planned vs actual + overall.
     *
     * @param  array<int,string>  $produkFilter
     * @return array{data:array<int,array<string,mixed>>,overall:array<string,mixed>}
     */
    public function byType(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter = []): array
    {
        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->selectRaw("COALESCE(NULLIF(TRIM(bk.tipe_pengeluaran), ''), 'LAINNYA') AS tipe")
            ->selectRaw(DashboardSql::countTxExpr(DashboardSql::outboundTxKey(), 'bk.status', 'not_canceled').' AS planned')
            ->selectRaw(DashboardSql::countTxExpr(DashboardSql::outboundTxKey(), 'bk.status', 'confirmed').' AS actual')
            ->selectRaw('COALESCE(SUM(bk.jumlah),0) AS planned_qty')
            ->selectRaw('COALESCE(SUM('.DashboardSql::confirmedCase('bk.status', 'bk.jumlah').'),0) AS actual_qty');
        DashboardSql::whereNotCanceled($q, 'bk.status');
        if (! empty($produkFilter)) {
            $q->whereIn('bk.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'bk.id_pengguna_lokasi', $lokasiFilter);

        $rows = [];
        foreach ($q->groupBy(DB::raw('tipe'))->orderByDesc('planned')->get() as $row) {
            $rows[] = [
                'tipe' => $row->tipe,
                'planned' => (int) $row->planned,
                'actual' => (int) $row->actual,
                'planned_qty' => (int) $row->planned_qty,
                'actual_qty' => (int) $row->actual_qty,
            ];
        }

        return ['data' => $rows, 'overall' => $this->sumTypeRows($rows)];
    }

    /**
     * Series outbound per tipe_pengeluaran untuk grafik deret waktu.
     *
     * Untuk tiap tipe dihasilkan dua deret (mengikuti $dates, zero-filled):
     * - `series_planned` : jumlah transaksi (COUNT) per tanggal, semua status kecuali cancel.
     * - `series_actual`  : jumlah transaksi (COUNT) per tanggal, hanya confirmed/selesai.
     *
     * Kunci transaksi = driver + gin_no (lihat {@see DashboardSql::outboundTxKey()}).
     * Urutan tipe mengikuti total planned menurun.
     *
     * @param  array<int,string>  $dates
     * @param  array<int,string>  $produkFilter
     * @return array<int,array{tipe:string,series_planned:array<int,array{tanggal:string,qty:int}>,series_actual:array<int,array{tanggal:string,qty:int}>}>
     */
    public function seriesByType(
        ?array $lokasiFilter,
        string $rangeStart,
        string $rangeEnd,
        array $dates,
        array $produkFilter = [],
        string $granularity = 'day'
    ): array {
        $key = DashboardSql::outboundTxKey();

        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd]);
        DashboardSql::whereNotCanceled($q, 'bk.status');

        $plannedExpr = DashboardSql::countTxExpr($key, 'bk.status', 'not_canceled');
        $actualExpr = DashboardSql::countTxExpr($key, 'bk.status', 'confirmed');

        $q->selectRaw("COALESCE(NULLIF(TRIM(bk.tipe_pengeluaran), ''), 'LAINNYA') AS tipe");

        if ($granularity === 'month') {
            $q->selectRaw("DATE_FORMAT(bk.tanggal_keluar, '%Y-%m') AS tgl");
        } else {
            $q->selectRaw('DATE(bk.tanggal_keluar) AS tgl');
        }
        $q->selectRaw($plannedExpr.' AS planned')->selectRaw($actualExpr.' AS actual');

        $q = LokasiFilter::apply($q, 'bk.id_pengguna_lokasi', $lokasiFilter);
        if (! empty($produkFilter)) {
            $q->whereIn('bk.nama_produk', $produkFilter);
        }

        // tipe => ['planned' => [tgl=>n], 'actual' => [tgl=>n]]
        $byType = [];
        foreach ($q->groupBy(DB::raw('tipe'))->groupBy('tgl')->get() as $row) {
            $tipe = (string) $row->tipe;
            if (! isset($byType[$tipe])) {
                $byType[$tipe] = ['planned' => [], 'actual' => []];
            }
            $byType[$tipe]['planned'][$row->tgl] = (int) $row->planned;
            $byType[$tipe]['actual'][$row->tgl] = (int) $row->actual;
        }

        // Urut tipe by total planned desc.
        uksort($byType, function ($a, $b) use ($byType) {
            return array_sum($byType[$b]['planned'] ?? []) <=> array_sum($byType[$a]['planned'] ?? []);
        });

        $out = [];
        foreach ($byType as $tipe => $maps) {
            $planned = [];
            $actual = [];
            foreach ($dates as $d) {
                $planned[] = ['tanggal' => $d, 'qty' => (int) ($maps['planned'][$d] ?? 0)];
                $actual[] = ['tanggal' => $d, 'qty' => (int) ($maps['actual'][$d] ?? 0)];
            }
            $out[] = [
                'tipe' => $tipe,
                'series_planned' => $planned,
                'series_actual' => $actual,
            ];
        }

        return $out;
    }

    /**
     * Outbound per GIN (Top-N): planned vs actual.
     *
     * @return array<int,array<string,mixed>>
     */
    public function perGin(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter = [], int $top = 10): array
    {
        return $this->groupOutbound($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter, 'bk.gin_no', 'gin_no', $top);
    }

    /**
     * Outbound per no_so (Top-N). Satu baris barang_keluar bisa memuat banyak
     * SO dipisah koma, sehingga tiap SO dihitung sebagai transaksi tersendiri.
     *
     * @return array<int,array<string,mixed>>
     */
    public function perSo(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter = [], int $top = 10): array
    {
        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->whereNotNull('bk.so_number')
            ->where('bk.so_number', '<>', '')
            ->selectRaw('bk.so_number AS so_number')
            ->selectRaw(DashboardSql::statusExpr('bk.status').' AS status');
        DashboardSql::whereNotCanceled($q, 'bk.status');
        if (! empty($produkFilter)) {
            $q->whereIn('bk.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'bk.id_pengguna_lokasi', $lokasiFilter);

        $map = [];
        foreach ($q->get() as $row) {
            $confirmed = in_array($row->status, DashboardConstants::CONFIRMED_STATUSES, true);
            foreach ($this->splitSo($row->so_number) as $so) {
                if (! isset($map[$so])) {
                    $map[$so] = ['label' => $so, 'planned' => 0, 'actual' => 0];
                }
                $map[$so]['planned']++;
                if ($confirmed) {
                    $map[$so]['actual']++;
                }
            }
        }

        $rows = array_values($map);
        usort($rows, fn ($a, $b) => $b['planned'] <=> $a['planned']);
        $rows = array_slice($rows, 0, $top);

        return array_map(fn ($r) => [
            'label' => $r['label'],
            'planned' => $r['planned'],
            'actual' => $r['actual'],
            'planned_qty' => $r['planned'],
            'actual_qty' => $r['actual'],
        ], $rows);
    }

    /**
     * Jumlah SO unik (pecah multi-SO per baris, lalu deduplikasi).
     *
     * @param  array<int,string>  $produkFilter
     */
    public function countUniqueSo(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter = []): int
    {
        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->whereNotNull('bk.so_number')
            ->where('bk.so_number', '<>', '')
            ->select('bk.so_number');
        DashboardSql::whereNotCanceled($q, 'bk.status');
        if (! empty($produkFilter)) {
            $q->whereIn('bk.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'bk.id_pengguna_lokasi', $lokasiFilter);

        $unique = [];
        foreach ($q->get() as $row) {
            foreach ($this->splitSo($row->so_number) as $so) {
                $unique[$so] = true;
            }
        }

        return count($unique);
    }

    /**
     * Total transaksi outbound + barang terkirim (terkonfirmasi).
     *
     * Angka transaksi (`gin`) dihitung SAMA PERSIS dengan grafik
     * "Outbound Total / planned": COUNT(DISTINCT driver+gin_no) per
     * TANGGAL, lalu dijumlahkan. Konsekuensinya transaksi yang itemnya
     * tersebar di beberapa tanggal ikut terhitung di tiap tanggal itu,
     * sehingga card selalu konsisten dengan jumlah bar pada grafik.
     *
     * Barang terkirim tetap dihitung unik per baris (confirmed).
     *
     * @param  array<int,string>  $produkFilter
     * @return array{gin:int,barang_terkirim:int}
     */
    public function totals(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter = []): array
    {
        // Jumlah transaksi = jumlah bar di grafik (per-tanggal lalu dijumlah).
        $perTanggal = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->selectRaw('DATE(bk.tanggal_keluar) AS tgl, COUNT(DISTINCT '.DashboardSql::outboundTxKey().') AS c')
            ->groupBy('tgl');
        DashboardSql::whereNotCanceled($perTanggal, 'bk.status');
        if (! empty($produkFilter)) {
            $perTanggal->whereIn('bk.nama_produk', $produkFilter);
        }
        $perTanggal = LokasiFilter::apply($perTanggal, 'bk.id_pengguna_lokasi', $lokasiFilter);
        $gin = (int) $perTanggal->get()->sum('c');

        $bk = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->selectRaw('COALESCE(SUM('.DashboardSql::confirmedCase('bk.status', 'bk.jumlah').'),0) AS barang_terkirim');
        if (! empty($produkFilter)) {
            $bk->whereIn('bk.nama_produk', $produkFilter);
        }
        $bk = LokasiFilter::apply($bk, 'bk.id_pengguna_lokasi', $lokasiFilter);
        $row = (array) $bk->first();

        return [
            'gin' => $gin,
            'barang_terkirim' => (int) ($row['barang_terkirim'] ?? 0),
        ];
    }

    /**
     * Penjualan (outbound terkonfirmasi) per produk dalam rentang bulan.
     *
     * @return array<int,array{nama_produk:string,qty:int}>
     */
    public function penjualan(?array $lokasiFilter, string $monthStart, string $monthEnd): array
    {
        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$monthStart, $monthEnd])
            ->selectRaw('bk.nama_produk AS nama_produk, SUM(bk.jumlah) AS qty')
            ->groupBy('bk.nama_produk')
            ->orderByRaw('SUM(bk.jumlah) DESC');
        DashboardSql::whereConfirmed($q, 'bk.status');

        $q = LokasiFilter::apply($q, 'bk.id_pengguna_lokasi', $lokasiFilter);

        $rows = [];
        foreach ($q->get() as $row) {
            $rows[] = ['nama_produk' => $row->nama_produk, 'qty' => (int) $row->qty];
        }

        return $rows;
    }

    /**
     * Group outbound generik (per kolom) menjadi top-N planned vs actual.
     *
     * @return array<int,array<string,mixed>>
     */
    private function groupOutbound(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter, string $column, string $alias, int $top): array
    {
        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->whereNotNull($column)
            ->where($column, '<>', '')
            ->selectRaw("$column AS $alias")
            ->selectRaw(DashboardSql::statusExpr('bk.status').' AS status');
        DashboardSql::whereNotCanceled($q, 'bk.status');
        if (! empty($produkFilter)) {
            $q->whereIn('bk.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'bk.id_pengguna_lokasi', $lokasiFilter);

        $map = [];
        foreach ($q->get() as $row) {
            $label = (string) $row->{$alias};
            $confirmed = in_array($row->status, DashboardConstants::CONFIRMED_STATUSES, true);
            if (! isset($map[$label])) {
                $map[$label] = ['label' => $label, 'planned' => 0, 'actual' => 0];
            }
            $map[$label]['planned']++;
            if ($confirmed) {
                $map[$label]['actual']++;
            }
        }

        $rows = array_values($map);
        usort($rows, fn ($a, $b) => $b['planned'] <=> $a['planned']);
        $rows = array_slice($rows, 0, $top);

        return array_map(fn ($r) => [
            'label' => $r['label'],
            'planned' => $r['planned'],
            'actual' => $r['actual'],
            'planned_qty' => $r['planned'],
            'actual_qty' => $r['actual'],
        ], $rows);
    }

    /**
     * Sum baris tipe menjadi "overall".
     */
    private function sumTypeRows(array $rows): array
    {
        $sum = ['tipe' => 'Overall', 'planned' => 0, 'actual' => 0, 'planned_qty' => 0, 'actual_qty' => 0];
        foreach ($rows as $row) {
            $sum['planned'] += $row['planned'];
            $sum['actual'] += $row['actual'];
            $sum['planned_qty'] += $row['planned_qty'];
            $sum['actual_qty'] += $row['actual_qty'];
        }

        return $sum;
    }
}
