<?php

namespace App\Services\Dashboard;

use App\Support\Dashboard\DashboardConstants;
use App\Support\Dashboard\DashboardSql;
use App\Support\Dashboard\LokasiFilter;
use Illuminate\Support\Facades\DB;

/**
 * Query terkait stok untuk dashboard:
 * ringkasan zona, produk realtime, storage terpakai, dan stok per produk.
 */
class StockService
{
    /**
     * Ringkasan stok per zona + total SKU/qty.
     *
     * @param  array<int,string>  $produkFilter
     * @return array{zona:array<string,int>,total_sku:int,total_qty:int}
     */
    public function ringkasan(?array $lokasiFilter, array $produkFilter = []): array
    {
        $zonaExpr = DashboardSql::zonaExpr('sg', 'l', 'b', 'ln');

        $zonaQuery = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->join('deep as d', 'd.id_deep', '=', 'sd.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->where('sd.jumlah', '>', 0);

        if (! empty($produkFilter)) {
            $zonaQuery->whereIn('sg.nama_produk', $produkFilter);
        }

        $zonaQuery->selectRaw("{$zonaExpr} AS zona, SUM(sd.jumlah) AS qty");
        $zonaQuery = LokasiFilter::apply($zonaQuery, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $zonaQuery = LokasiFilter::apply($zonaQuery, 'sd.id_pengguna_lokasi', $lokasiFilter);

        $zones = array_fill_keys(DashboardConstants::ZONA_ORDER, 0);
        foreach ($zonaQuery->groupBy(DB::raw('zona'))->get() as $row) {
            $zones[$row->zona] = (int) $row->qty;
        }

        $skuQuery = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->where('sd.jumlah', '>', 0)
            ->selectRaw('COUNT(DISTINCT sg.id_produk) AS sku, SUM(sd.jumlah) AS qty');

        if (! empty($produkFilter)) {
            $skuQuery->whereIn('sg.nama_produk', $produkFilter);
        }

        $skuQuery = LokasiFilter::apply($skuQuery, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $skuQuery = LokasiFilter::apply($skuQuery, 'sd.id_pengguna_lokasi', $lokasiFilter);
        $sku = (array) $skuQuery->first();

        return [
            'zona' => $zones,
            'total_sku' => (int) ($sku['sku'] ?? 0),
            'total_qty' => (int) ($sku['qty'] ?? 0),
        ];
    }

    /**
     * Total produk realtime (distinct produk & qty fisik).
     *
     * @param  array<int,string>  $produkFilter
     * @return array{total_produk:int,total_qty:int}
     */
    public function produkRealtime(?array $lokasiFilter, array $produkFilter = []): array
    {
        $q = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->where('sd.jumlah', '>', 0)
            ->selectRaw('COUNT(DISTINCT sg.id_produk) AS total_produk, COALESCE(SUM(sd.jumlah),0) AS total_qty');

        if (! empty($produkFilter)) {
            $q->whereIn('sg.nama_produk', $produkFilter);
        }
        $q = LokasiFilter::apply($q, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $q = LokasiFilter::apply($q, 'sd.id_pengguna_lokasi', $lokasiFilter);
        $r = (array) $q->first();

        return [
            'total_produk' => (int) ($r['total_produk'] ?? 0),
            'total_qty' => (int) ($r['total_qty'] ?? 0),
        ];
    }

    /**
     * Storage terpakai — HANYA blok regular (exclude zona khusus).
     * Terpakai = qty zona normal; Kapasitas = SUM(deep.kapasitas) blok non-spesial.
     *
     * @param  array<int,string>  $produkFilter
     * @return array{terpakai:int,kapasitas:int,persen:float|int}
     */
    public function storageRegular(?array $lokasiFilter, array $produkFilter = []): array
    {
        $specialCondition = DashboardSql::specialCondition('l', 'b', 'ln');

        $terpakaiQ = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->join('deep as d', 'd.id_deep', '=', 'sd.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->where('sd.jumlah', '>', 0)
            ->whereRaw("UPPER(COALESCE(sg.status, 'normal')) <> 'QI'")
            ->whereRaw("NOT {$specialCondition}")
            ->selectRaw('COALESCE(SUM(sd.jumlah),0) AS qty');

        if (! empty($produkFilter)) {
            $terpakaiQ->whereIn('sg.nama_produk', $produkFilter);
        }
        $terpakaiQ = LokasiFilter::apply($terpakaiQ, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $terpakaiQ = LokasiFilter::apply($terpakaiQ, 'sd.id_pengguna_lokasi', $lokasiFilter);
        $terpakai = (int) ($terpakaiQ->value('qty') ?? 0);

        // Kapasitas: seluruh deep pada blok regular.
        $kapQ = DB::table('deep as d')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->whereRaw("NOT {$specialCondition}")
            ->selectRaw('COALESCE(SUM(d.kapasitas),0) AS kapasitas');
        $kapQ = LokasiFilter::apply($kapQ, 'd.id_pengguna_lokasi', $lokasiFilter);
        $kapasitas = (int) ($kapQ->value('kapasitas') ?? 0);

        $persen = $kapasitas > 0 ? round(($terpakai / $kapasitas) * 100, 1) : 0;

        return [
            'terpakai' => $terpakai,
            'kapasitas' => $kapasitas,
            'persen' => $persen,
        ];
    }

    /**
     * Daftar stok per produk (nama, satuan, total qty).
     *
     * @return array<int,array{nama_produk:string,satuan:string,stok:int}>
     */
    public function stokList(?array $lokasiFilter): array
    {
        $query = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->leftJoin('produk as p', 'p.id_produk', '=', 'sg.id_produk')
            ->where('sd.jumlah', '>', 0)
            ->selectRaw("sg.nama_produk AS nama_produk, COALESCE(NULLIF(TRIM(sg.satuan), ''), NULLIF(TRIM(p.satuan), ''), 'PCS') AS satuan, SUM(sd.jumlah) AS stok")
            ->groupBy('sg.nama_produk', 'sg.satuan', 'p.satuan')
            ->orderByDesc('stok');

        $query = LokasiFilter::apply($query, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $query = LokasiFilter::apply($query, 'sd.id_pengguna_lokasi', $lokasiFilter);

        $list = [];
        foreach ($query->get() as $row) {
            $list[] = [
                'nama_produk' => $row->nama_produk,
                'satuan' => $row->satuan,
                'stok' => (int) $row->stok,
            ];
        }

        return $list;
    }
}
