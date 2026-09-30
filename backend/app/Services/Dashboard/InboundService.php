<?php

namespace App\Services\Dashboard;

use App\Support\Dashboard\DashboardSql;
use App\Support\Dashboard\LokasiFilter;
use Illuminate\Support\Facades\DB;

/**
 * Query inbound (barang masuk) untuk dashboard:
 * statistik ringkas + series, dan breakdown per tipe penerimaan.
 *
 * Catatan hitungan: SATU transaksi = kombinasi `driver + shipment_id`
 * (lihat {@see DashboardSql::inboundTxKey()}), BUKAN per baris/item.
 * Satu transaksi bisa berisi 2-4 item. Rumus ini terbukti cocok dengan
 * halaman Inbound dan hitungan manual (mis. lok 9021 / 15 Sep = 289).
 */
class InboundService
{
    /** Kunci transaksi inbound (expression SQL, reusable). */
    private static function txKey(string $alias = 'bm'): string
    {
        return DashboardSql::inboundTxKey($alias);
    }

    /**
     * Statistik inbound: total DN, qty, bulan ini, hari ini + series harian/bulanan.
     *
     * Series yang dikembalikan:
     * - `series`          : qty terkonfirmasi per tanggal (periode lama, dipertahankan).
     * - `series_planned`  : jumlah transaksi (COUNT) per tanggal, semua status kecuali cancel.
     * - `series_actual`   : jumlah transaksi (COUNT) per tanggal, hanya confirmed/selesai.
     *
     * @param  array<int,string>  $dates
     * @param  array<int,string>  $produkFilter
     * @return array{total:int,total_qty:int,bulan_ini:int,qty_bulan_ini:int,qty_today:int,series:array<int,array{tanggal:string,qty:int}>,series_planned:array<int,array{tanggal:string,qty:int}>,series_actual:array<int,array{tanggal:string,qty:int}>}
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
        $base = DB::table('barang_masuk as bm');
        DashboardSql::whereConfirmed($base, 'bm.status');
        $base
            ->selectRaw('COUNT(DISTINCT '.self::txKey().') AS total')
            ->selectRaw('COALESCE(SUM(bm.jumlah),0) AS total_qty')
            ->selectRaw('COUNT(DISTINCT CASE WHEN DATE(bm.tanggal_masuk) BETWEEN ? AND ? THEN '.self::txKey().' END) AS bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bm.tanggal_masuk) BETWEEN ? AND ? THEN bm.jumlah ELSE 0 END) AS qty_bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bm.tanggal_masuk) = ? THEN bm.jumlah ELSE 0 END) AS qty_today', [$today]);

        $base = LokasiFilter::apply($base, 'bm.id_pengguna_lokasi', $lokasiFilter);
        if (! empty($produkFilter)) {
            $base->whereIn('bm.nama_produk', $produkFilter);
        }
        $r = (array) $base->first();

        $series = [];
        $seriesQ = DB::table('barang_masuk as bm')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd]);
        DashboardSql::whereConfirmed($seriesQ, 'bm.status');
        if ($granularity === 'month') {
            $seriesQ->selectRaw("DATE_FORMAT(bm.tanggal_masuk, '%Y-%m') AS tgl, bm.jumlah AS qty");
        } else {
            $seriesQ->selectRaw('DATE(bm.tanggal_masuk) AS tgl, bm.jumlah AS qty');
        }
        $seriesQ = LokasiFilter::apply($seriesQ, 'bm.id_pengguna_lokasi', $lokasiFilter);
        if (! empty($produkFilter)) {
            $seriesQ->whereIn('bm.nama_produk', $produkFilter);
        }
        $smap = $seriesQ->get()->groupBy('tgl')->map(fn ($g) => (int) $g->sum('qty'))->toArray();

        foreach ($dates as $d) {
            $series[] = ['tanggal' => $d, 'qty' => (int) ($smap[$d] ?? 0)];
        }

        // Series COUNT transaksi per tanggal: planned (semua kecuali cancel) vs actual (confirmed/selesai).
        $countByDate = function (bool $onlyConfirmed) use ($lokasiFilter, $rangeStart, $rangeEnd, $dates, $produkFilter, $granularity): array {
            $q = DB::table('barang_masuk as bm')
                ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd]);

            if ($onlyConfirmed) {
                DashboardSql::whereConfirmed($q, 'bm.status');
            } else {
                DashboardSql::whereNotCanceled($q, 'bm.status');
            }

            if ($granularity === 'month') {
                $q->selectRaw("DATE_FORMAT(bm.tanggal_masuk, '%Y-%m') AS tgl, COUNT(DISTINCT ".self::txKey().') AS c');
            } else {
                $q->selectRaw('DATE(bm.tanggal_masuk) AS tgl, COUNT(DISTINCT '.self::txKey().') AS c');
            }

            $q = LokasiFilter::apply($q, 'bm.id_pengguna_lokasi', $lokasiFilter);
            if (! empty($produkFilter)) {
                $q->whereIn('bm.nama_produk', $produkFilter);
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
            'series' => $series,
            'series_planned' => $countByDate(false),
            'series_actual' => $countByDate(true),
        ];
    }

    /**
     * Inbound per tipe_penerimaan: planned (semua status) vs actual (confirmed/selesai).
     *
     * @param  array<int,string>  $produkFilter
     * @return array{data:array<int,array<string,mixed>>,overall:array<string,mixed>}
     */
    public function byType(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter = []): array
    {
        $q = DB::table('barang_masuk as bm')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd]);
        DashboardSql::whereNotCanceled($q, 'bm.status');
        $q->selectRaw("COALESCE(NULLIF(TRIM(bm.tipe_penerimaan), ''), 'LAINNYA') AS tipe")
            ->selectRaw(DashboardSql::countTxExpr(self::txKey(), 'bm.status', 'not_canceled').' AS planned')
            ->selectRaw(DashboardSql::countTxExpr(self::txKey(), 'bm.status', 'confirmed').' AS actual')
            ->selectRaw('COALESCE(SUM(bm.jumlah),0) AS planned_qty')
            ->selectRaw('COALESCE(SUM('.DashboardSql::confirmedCase('bm.status', 'bm.jumlah').'),0) AS actual_qty');
        if (! empty($produkFilter)) {
            $q->whereIn('bm.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'bm.id_pengguna_lokasi', $lokasiFilter);

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
     * Series inbound per tipe_penerimaan untuk grafik deret waktu.
     *
     * Untuk tiap tipe dihasilkan dua deret (mengikuti $dates, zero-filled):
     * - `series_planned` : jumlah transaksi (COUNT) per tanggal, semua status kecuali cancel.
     * - `series_actual`  : jumlah transaksi (COUNT) per tanggal, hanya confirmed/selesai.
     *
     * Urutan tipe mengikuti total planned desc (konsisten dengan byType()).
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
        $q = DB::table('barang_masuk as bm')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd]);
        DashboardSql::whereNotCanceled($q, 'bm.status');

        $plannedExpr = DashboardSql::countTxExpr(self::txKey(), 'bm.status', 'not_canceled');
        $actualExpr = DashboardSql::countTxExpr(self::txKey(), 'bm.status', 'confirmed');

        if ($granularity === 'month') {
            $q->selectRaw("COALESCE(NULLIF(TRIM(bm.tipe_penerimaan), ''), 'LAINNYA') AS tipe")
                ->selectRaw("DATE_FORMAT(bm.tanggal_masuk, '%Y-%m') AS tgl")
                ->selectRaw($plannedExpr.' AS planned')
                ->selectRaw($actualExpr.' AS actual');
        } else {
            $q->selectRaw("COALESCE(NULLIF(TRIM(bm.tipe_penerimaan), ''), 'LAINNYA') AS tipe")
                ->selectRaw('DATE(bm.tanggal_masuk) AS tgl')
                ->selectRaw($plannedExpr.' AS planned')
                ->selectRaw($actualExpr.' AS actual');
        }

        if (! empty($produkFilter)) {
            $q->whereIn('bm.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'bm.id_pengguna_lokasi', $lokasiFilter);

        // Akumulasi per tipe => per tanggal.
        $byType = [];
        foreach ($q->groupBy(DB::raw('tipe'), DB::raw('tgl'))->get() as $row) {
            $tipe = $row->tipe;
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
     * Total transaksi inbound + qty barang datang (hanya terkonfirmasi).
     *
     * Angka transaksi (`shipment`) dihitung SAMA PERSIS dengan grafik
     * "Inbound Total / planned": COUNT(DISTINCT driver+shipment_id) per
     * TANGGAL, lalu dijumlahkan. Konsekuensinya transaksi yang itemnya
     * tersebar di beberapa tanggal ikut terhitung di tiap tanggal itu,
     * sehingga card selalu konsisten dengan jumlah bar pada grafik.
     *
     * Qty barang datang tetap dihitung unik per baris (confirmed).
     *
     * @param  array<int,string>  $produkFilter
     * @return array{shipment:int,barang_datang:int}
     */
    public function totals(?array $lokasiFilter, string $rangeStart, string $rangeEnd, array $produkFilter = []): array
    {
        // Jumlah transaksi = jumlah bar di grafik (per-tanggal lalu dijumlah).
        $perTanggal = DB::table('barang_masuk as bm')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd])
            ->selectRaw('DATE(bm.tanggal_masuk) AS tgl, COUNT(DISTINCT '.self::txKey().') AS c')
            ->groupBy('tgl');
        DashboardSql::whereNotCanceled($perTanggal, 'bm.status');
        if (! empty($produkFilter)) {
            $perTanggal->whereIn('bm.nama_produk', $produkFilter);
        }
        $perTanggal = LokasiFilter::apply($perTanggal, 'bm.id_pengguna_lokasi', $lokasiFilter);
        $shipment = (int) $perTanggal->get()->sum('c');

        $bm = DB::table('barang_masuk as bm')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd])
            ->selectRaw('COALESCE(SUM('.DashboardSql::confirmedCase('bm.status', 'bm.jumlah').'),0) AS barang_datang');
        if (! empty($produkFilter)) {
            $bm->whereIn('bm.nama_produk', $produkFilter);
        }
        $bm = LokasiFilter::apply($bm, 'bm.id_pengguna_lokasi', $lokasiFilter);
        $row = (array) $bm->first();

        return [
            'shipment' => $shipment,
            'barang_datang' => (int) ($row['barang_datang'] ?? 0),
        ];
    }

    /**
     * Sum baris tipe menjadi "overall".
     */
    public function sumTypeRows(array $rows): array
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
