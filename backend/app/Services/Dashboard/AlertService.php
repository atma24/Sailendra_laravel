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
     * Daftar produk dengan best_before <= threshold (default 30 hari).
     *
     * @param  array<int,string>  $produkFilter
     * @return array<int,array<string,mixed>>
     */
    public function expired(?array $lokasiFilter, array $produkFilter = []): array
    {
        $thresholdDays = DashboardConstants::EXPIRED_ALERT_DAYS;
        $threshold = now()->addDays($thresholdDays)->format('Y-m-d');
        $today = now()->format('Y-m-d');

        $q = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->join('deep as d', 'd.id_deep', '=', 'sd.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->where('sd.jumlah', '>', 0)
            ->whereNotNull('sg.best_before')
            ->where('sg.best_before', '<=', $threshold)
            ->selectRaw('sg.nama_produk AS nama_produk')
            ->selectRaw("COALESCE(NULLIF(TRIM(sg.batch), ''), '-') AS batch")
            ->selectRaw('sg.best_before AS best_before')
            ->selectRaw("CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi")
            ->selectRaw("UPPER(COALESCE(l.kategori, l.nama_lokasi, '')) AS kategori")
            ->selectRaw('SUM(sd.jumlah) AS qty')
            ->groupBy('sg.nama_produk', 'sg.batch', 'sg.best_before', 'b.kode_block', 'ln.nomor_line', 'l.kategori', 'l.nama_lokasi')
            ->orderBy('sg.best_before');
        if (! empty($produkFilter)) {
            $q->whereIn('sg.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $q = LokasiFilter::apply($q, 'sd.id_pengguna_lokasi', $lokasiFilter);

        $list = [];
        foreach ($q->get() as $row) {
            $bb = (string) $row->best_before;
            $sisa = null;
            if ($bb !== '') {
                $sisa = (int) now()->parse($today)->diffInDays(now()->parse($bb), false);
            }
            $list[] = [
                'nama_produk' => $row->nama_produk,
                'batch' => $row->batch,
                'best_before' => $bb,
                'lokasi' => $row->lokasi,
                'kategori' => $row->kategori,
                'qty' => (int) $row->qty,
                'sisa_hari' => $sisa,
                'expired' => $bb !== '' && $bb < $today,
            ];
        }

        return $list;
    }
}
