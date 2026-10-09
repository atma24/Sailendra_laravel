<?php

namespace App\Services\Dashboard;

use App\Support\Dashboard\DashboardConstants;
use App\Support\Dashboard\LokasiFilter;
use Illuminate\Support\Facades\DB;

/**
 * Query detail aging produk per batch/lokasi.
 */
class AlertService
{
    /**
     * Daftar detail stok semua stok ber-best-before (mode 'all', default)
     * atau dengan best_before <= threshold (mode 'h30', 30 hari),
     * satu baris per baris stok deep (batch + lokasi).
     *
     * Kolom: nama_produk, batch, production_date (tanggal_produksi,
     * fallback ke tanggal_masuk), production_fallback, tanggal_masuk
     * (tgl inbound), best_before, lokasi (blok), qty, aging_hari
     * (hari ini - production_date), sisa_hari (best_before - hari ini),
     * status (Fresh bila sisa > 45, Warning bila 1-45, Expired bila <= 0),
     * expired (sisa <= 0).
     *
     * @param  array<int,string>  $produkFilter
     * @param  string  $mode  'all' (default) atau 'h30'
     * @return array<int,array{nama_produk:string,batch:?string,production_date:?string,production_fallback:bool,tanggal_masuk:?string,best_before:string,lokasi:?string,qty:int,aging_hari:?int,sisa_hari:?int,status:string,expired:bool}>
     */
    public function expired(?array $lokasiFilter, array $produkFilter = [], string $mode = 'all'): array
    {
        $thresholdDays = DashboardConstants::EXPIRED_ALERT_DAYS;
        $threshold = now()->addDays($thresholdDays)->format('Y-m-d');
        $today = now()->format('Y-m-d');

        $q = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->leftJoin('barang_masuk as bm', 'bm.id_barang_masuk', '=', 'sg.id_barang_masuk')
            ->leftJoin('produk as p', 'p.id_produk', '=', 'sg.id_produk')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'sg.id_pengguna_lokasi')
            ->where('sd.jumlah', '>', 0)
            ->whereNotNull(DB::raw('COALESCE(sd.best_before, sg.best_before)'))
            // Produk tanpa batch (otomatis best_before 9999) tidak dihitung aging.
            ->whereRaw('COALESCE(p.tanpa_batch, 0) = 0');
        if (strtolower(trim($mode)) !== 'all') {
            $q->where(DB::raw('COALESCE(sd.best_before, sg.best_before)'), '<=', $threshold);
        }
        $q = $q
            ->selectRaw('sg.nama_produk AS nama_produk')
            ->selectRaw('COALESCE(sd.batch, sg.batch, bm.batch) AS batch')
            ->selectRaw('COALESCE(sd.best_before, sg.best_before) AS best_before')
            ->selectRaw('COALESCE(bm.tanggal_produksi, bm.tanggal_masuk) AS production_date')
            ->selectRaw('CASE WHEN bm.tanggal_produksi IS NULL THEN 1 ELSE 0 END AS production_fallback')
            ->selectRaw('bm.tanggal_masuk AS tanggal_masuk')
            ->selectRaw("COALESCE(NULLIF(TRIM(COALESCE(sd.lokasi_block, sg.lokasi_block, '')), ''), pl.nama_pengguna_lokasi) AS lokasi")
            ->selectRaw('sd.jumlah AS qty')
            ->orderByRaw('COALESCE(sd.best_before, sg.best_before)')
            ->limit(500);
        if (! empty($produkFilter)) {
            $q->whereIn('sg.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $q = LokasiFilter::apply($q, 'sd.id_pengguna_lokasi', $lokasiFilter);

        $list = [];
        foreach ($q->get() as $row) {
            $bb = $row->best_before !== null ? (string) $row->best_before : '';
            $prod = $row->production_date !== null ? substr((string) $row->production_date, 0, 10) : null;
            $masuk = $row->tanggal_masuk !== null ? substr((string) $row->tanggal_masuk, 0, 10) : null;
            $isFallback = (int) ($row->production_fallback ?? 0) === 1;
            $aging = null;
            $sisa = null;
            try {
                if ($bb !== '') {
                    // Sisa menuju expired: best_before - hari ini (negatif = lewat).
                    $sisa = (int) now()->parse($today)->diffInDays(now()->parse(substr($bb, 0, 10)), false);
                }
                if ($prod !== null && $prod !== '') {
                    // Aging: hari ini - tanggal produksi.
                    $aging = (int) now()->parse($prod)->diffInDays(now()->parse($today), false);
                }
            } catch (\Throwable $e) {
                // Biarkan null bila format tanggal tidak valid.
            }
            $expired = $sisa !== null && $sisa <= 0;
            $status = $expired ? 'Expired' : (($sisa !== null && $sisa <= 45) ? 'Warning' : 'Fresh');
            $list[] = [
                'nama_produk' => $row->nama_produk,
                'batch' => $row->batch !== null ? (string) $row->batch : null,
                'best_before' => substr($bb, 0, 10),
                'production_date' => $prod,
                'production_fallback' => $isFallback,
                'tanggal_masuk' => $masuk,
                'lokasi' => $row->lokasi !== null ? (string) $row->lokasi : null,
                'qty' => (int) $row->qty,
                'aging_hari' => $aging,
                'sisa_hari' => $sisa,
                'status' => $status,
                'expired' => $expired,
            ];
        }

        return $list;
    }
}
