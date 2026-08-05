<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Plant;
use App\Models\Produk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    use ApiResponse;

    public function summary(Request $request)
    {
        $id = trim((string) $request->query('id_pengguna_lokasi'));
        $multi = trim((string) $request->query('id_pengguna_lokasi_multi'));

        $filter = $this->lokasiFilter($id, $multi);

        $bulan = trim((string) $request->query('bulan'));
        $bulan = $bulan !== '' ? $bulan : now()->format('Y-m');
        $monthStart = $bulan.'-01';
        $monthEnd = now()->parse($monthStart)->endOfMonth()->format('Y-m-d');
        $today = now()->format('Y-m-d');

        $dates = [];
        for ($i = 1; $i <= (int) now()->parse($monthStart)->daysInMonth; $i++) {
            $dates[] = $bulan.'-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT);
        }

        $produkTotal = Produk::count();
        $plantTotal = Plant::count();

        $mutasiTotal = $this->withLokasiFilter(
            DB::table('mutasi as m')->selectRaw('COUNT(*) AS c'),
            'm.id_pengguna_lokasi',
            $filter
        )->value('c') ?? 0;

        $inbound = $this->inboundStats($filter, $monthStart, $monthEnd, $today, $dates);
        $outbound = $this->outboundStats($filter, $monthStart, $monthEnd, $today, $dates);
        $stock = $this->ringkasanStok($filter);

        return response()->json([
            'success' => true,
            'produk_total' => $produkTotal,
            'plant_total' => $plantTotal,
            'inbound' => $inbound,
            'outbound' => $outbound,
            'mutasi_total' => $mutasiTotal,
            'stock' => $stock,
        ]);
    }

    private function lokasiFilter(string $id, string $multi): ?array
    {
        if ($multi !== '') {
            $ids = array_values(array_filter(array_map('trim', explode(',', $multi))));
            if (empty($ids)) {
                return null;
            }

            return ['in', $ids];
        }

        if ($id !== '') {
            return ['eq', [$id]];
        }

        return null;
    }

    private function withLokasiFilter($query, string $column, ?array $filter)
    {
        if ($filter === null) {
            return $query;
        }

        if ($filter[0] === 'eq') {
            return $query->where($column, $filter[1][0]);
        }

        return $query->whereIn($column, $filter[1]);
    }

    private function inboundStats(?array $filter, string $monthStart, string $monthEnd, string $today, array $dates): array
    {
        $base = DB::table('barang_masuk as bm')
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('COALESCE(SUM(bm.jumlah),0) AS total_qty')
            ->selectRaw('SUM(CASE WHEN DATE(bm.tanggal_masuk) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS bulan_ini', [$monthStart, $monthEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bm.tanggal_masuk) BETWEEN ? AND ? THEN bm.jumlah ELSE 0 END) AS qty_bulan_ini', [$monthStart, $monthEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bm.tanggal_masuk) = ? THEN bm.jumlah ELSE 0 END) AS qty_today', [$today]);

        $base = $this->withLokasiFilter($base, 'bm.id_pengguna_lokasi', $filter);
        $r = (array) $base->first();

        $series = [];
        $smap = $this->withLokasiFilter(
            DB::table('barang_masuk as bm')->selectRaw('DATE(bm.tanggal_masuk) AS tgl, bm.jumlah AS qty'),
            'bm.id_pengguna_lokasi',
            $filter
        )->get()->groupBy('tgl')->map(fn ($g) => (int) $g->sum('qty'))->toArray();

        foreach ($dates as $d) {
            $series[] = ['tanggal' => $d, 'qty' => (int) ($smap[$d] ?? 0)];
        }

        return [
            'total' => (int) ($r['total'] ?? 0),
            'total_qty' => (int) ($r['total_qty'] ?? 0),
            'bulan_ini' => (int) ($r['bulan_ini'] ?? 0),
            'qty_bulan_ini' => (int) ($r['qty_bulan_ini'] ?? 0),
            'qty_today' => (int) ($r['qty_today'] ?? 0),
            'series' => $series,
        ];
    }

    private function outboundStats(?array $filter, string $monthStart, string $monthEnd, string $today, array $dates): array
    {
        $base = DB::table('barang_keluar as bk')
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('COALESCE(SUM(bk.jumlah),0) AS total_qty')
            ->selectRaw('SUM(CASE WHEN DATE(bk.tanggal_keluar) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS bulan_ini', [$monthStart, $monthEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bk.tanggal_keluar) BETWEEN ? AND ? THEN bk.jumlah ELSE 0 END) AS qty_bulan_ini', [$monthStart, $monthEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bk.tanggal_keluar) = ? THEN bk.jumlah ELSE 0 END) AS qty_today', [$today])
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bk.status,'')) NOT IN ('confirmed','selesai') THEN 1 ELSE 0 END) AS pending");

        $base = $this->withLokasiFilter($base, 'bk.id_pengguna_lokasi', $filter);
        $r = (array) $base->first();

        $series = [];
        $smap = $this->withLokasiFilter(
            DB::table('barang_keluar as bk')->selectRaw('DATE(bk.tanggal_keluar) AS d, bk.jumlah AS qty'),
            'bk.id_pengguna_lokasi',
            $filter
        )->get()->groupBy('d')->map(fn ($g) => (int) $g->sum('qty'))->toArray();

        foreach ($dates as $d) {
            $series[] = ['tanggal' => $d, 'qty' => (int) ($smap[$d] ?? 0)];
        }

        $topQuery = DB::table('barang_keluar as bk')
            ->selectRaw('bk.nama_produk AS nama_produk, SUM(bk.jumlah) AS qty')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$monthStart, $monthEnd])
            ->groupBy('bk.nama_produk')
            ->orderByDesc('qty')
            ->limit(10);

        $topQuery = $this->withLokasiFilter($topQuery, 'bk.id_pengguna_lokasi', $filter);

        $top = [];
        foreach ($topQuery->get() as $row) {
            $top[] = ['nama_produk' => $row->nama_produk, 'qty' => (int) $row->qty];
        }

        return [
            'total' => (int) ($r['total'] ?? 0),
            'total_qty' => (int) ($r['total_qty'] ?? 0),
            'bulan_ini' => (int) ($r['bulan_ini'] ?? 0),
            'qty_bulan_ini' => (int) ($r['qty_bulan_ini'] ?? 0),
            'qty_today' => (int) ($r['qty_today'] ?? 0),
            'pending' => (int) ($r['pending'] ?? 0),
            'top10' => $top,
            'series' => $series,
        ];
    }

    private function ringkasanStok(?array $filter): array
    {
        $kategoriExpr = "UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA'))";
        $lokasiExpr = 'UPPER(TRIM(CONCAT(b.kode_block, \'-\', ln.nomor_line)))';

        $zonaQuery = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->join('deep as d', 'd.id_deep', '=', 'sd.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->where('sd.jumlah', '>', 0)
            ->selectRaw("CASE
                WHEN $kategoriExpr IN ('BAD STOCK','BADSTOCK') OR $lokasiExpr LIKE 'BAD STOCK-%' OR $lokasiExpr LIKE 'BADSTOCK-%' OR $lokasiExpr LIKE 'BS-%' THEN 'bad'
                WHEN $kategoriExpr = 'REJECT' OR $lokasiExpr LIKE 'REJECT-%' THEN 'reject'
                WHEN $kategoriExpr = 'RECEH' OR $lokasiExpr LIKE 'RECEH-%' THEN 'receh'
                WHEN $kategoriExpr = 'FESTIVE' OR $lokasiExpr LIKE 'FESTIVE-%' THEN 'festive'
                WHEN $kategoriExpr = 'TRANSIT' OR $lokasiExpr LIKE 'TRANSIT-%' THEN 'transit'
                WHEN $kategoriExpr = 'HOLD' OR $lokasiExpr LIKE 'HOLD-%' THEN 'hold'
                ELSE 'normal'
            END AS zona, SUM(sd.jumlah) AS qty");

        $zonaQuery = $this->withLokasiFilter($zonaQuery, 'sg.id_pengguna_lokasi', $filter);
        $zonaRows = $zonaQuery->groupBy(DB::raw('zona'))->get();

        $zones = ['normal' => 0, 'bad' => 0, 'reject' => 0, 'receh' => 0, 'festive' => 0, 'transit' => 0, 'hold' => 0];
        foreach ($zonaRows as $row) {
            $zones[$row->zona] = (int) $row->qty;
        }

        $skuQuery = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->where('sd.jumlah', '>', 0)
            ->selectRaw('COUNT(DISTINCT sg.id_produk) AS sku, SUM(sd.jumlah) AS qty');

        $skuQuery = $this->withLokasiFilter($skuQuery, 'sg.id_pengguna_lokasi', $filter);
        $sku = (array) $skuQuery->first();

        return [
            'zona' => $zones,
            'total_sku' => (int) ($sku['sku'] ?? 0),
            'total_qty' => (int) ($sku['qty'] ?? 0),
        ];
    }
}
