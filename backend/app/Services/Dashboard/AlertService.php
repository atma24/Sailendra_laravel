<?php

namespace App\Services\Dashboard;

use App\Support\Dashboard\DashboardConstants;
use App\Support\Dashboard\LokasiFilter;
use Illuminate\Support\Facades\DB;

/**
 * Query alert stok mendekati/melewati kadaluarsa (best_before).
 */
class AlertService
{
    /**
     * Daftar produk dengan best_before <= threshold (mode 'h30', default
     * 30 hari) atau semua stok ber-best-before (mode 'all'),
     * satu baris per produk + best_before.
     *
     * Kolom: nama_produk, qty (agregat), best_before (expired date),
     * production_date (MIN tanggal_masuk inbound terkait), aging_hari
     * (best_before - hari ini, realtime dalam hari; negatif = sudah lewat expired).
     *
     * @param  array<int,string>  $produkFilter
     * @param  string  $mode  'h30' (default) atau 'all'
     * @return array<int,array{nama_produk:string,qty:int,best_before:string,production_date:?string,aging_hari:?int,expired:bool}>
     */
    public function expired(?array $lokasiFilter, array $produkFilter = [], string $mode = 'h30'): array
    {
        $thresholdDays = DashboardConstants::EXPIRED_ALERT_DAYS;
        $threshold = now()->addDays($thresholdDays)->format('Y-m-d');
        $today = now()->format('Y-m-d');

        $q = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->leftJoin('barang_masuk as bm', 'bm.id_barang_masuk', '=', 'sg.id_barang_masuk')
            ->leftJoin('produk as p', 'p.id_produk', '=', 'sg.id_produk')
            ->where('sd.jumlah', '>', 0)
            ->whereNotNull('sg.best_before')
            // Produk tanpa batch (otomatis best_before 9999) tidak dihitung aging.
            ->whereRaw('COALESCE(p.tanpa_batch, 0) = 0');
        if (strtolower(trim($mode)) !== 'all') {
            $q->where('sg.best_before', '<=', $threshold);
        }
        $q = $q
            ->selectRaw('sg.nama_produk AS nama_produk')
            ->selectRaw('sg.nama_produk AS nama_produk')
            ->selectRaw('sg.best_before AS best_before')
            ->selectRaw('MIN(bm.tanggal_masuk) AS production_date')
            ->selectRaw('SUM(sd.jumlah) AS qty')
            ->groupBy('sg.nama_produk', 'sg.best_before')
            ->orderBy('sg.best_before');
        if (! empty($produkFilter)) {
            $q->whereIn('sg.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $q = LokasiFilter::apply($q, 'sd.id_pengguna_lokasi', $lokasiFilter);

        $list = [];
        foreach ($q->get() as $row) {
            $bb = (string) $row->best_before;
            $prod = $row->production_date !== null ? (string) $row->production_date : null;
            $aging = null;
            if ($bb !== '') {
                $aging = (int) now()->parse($today)->diffInDays(now()->parse($bb), false);
            }
            $list[] = [
                'nama_produk' => $row->nama_produk,
                'qty' => (int) $row->qty,
                'best_before' => $bb,
                'production_date' => $prod,
                'aging_hari' => $aging,
                'expired' => $bb !== '' && $bb < $today,
            ];
        }

        return $list;
    }
}
