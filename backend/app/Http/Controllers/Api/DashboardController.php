<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
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

        $produkFilter = $this->produkFilter($request);

        // Periode: tahun + bulan (tahun pelengkap bulan). Minggu opsional sebagai filter rentang.
        $bulan = trim((string) $request->query('bulan'));
        $bulan = $bulan !== '' ? $bulan : now()->format('Y-m');
        $tahun = trim((string) $request->query('tahun'));
        if ($tahun !== '' && preg_match('/^\d{4}$/', $tahun)) {
            $bulan = $tahun.'-'.substr($bulan, 5, 2);
        }
        $monthStart = $bulan.'-01';
        $monthEnd = now()->parse($monthStart)->endOfMonth()->format('Y-m-d');
        $today = now()->format('Y-m-d');

        // Filter minggu (Senin sebagai awal minggu). Kosong = seluruh bulan.
        [$rangeStart, $rangeEnd] = $this->weekRange($request, $monthStart, $monthEnd);
        $weekLabel = $request->query('minggu') !== null ? trim((string) $request->query('minggu')) : '';

        $dates = [];
        for ($i = 1; $i <= (int) now()->parse($monthStart)->daysInMonth; $i++) {
            $dates[] = $bulan.'-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT);
        }

        $mutasiTotal = $this->withLokasiFilter(
            DB::table('mutasi as m')->selectRaw('COUNT(*) AS c'),
            'm.id_pengguna_lokasi',
            $filter
        )->value('c') ?? 0;

        $inbound = $this->inboundStats($filter, $monthStart, $monthEnd, $today, $dates, $produkFilter);
        $outbound = $this->outboundStats($filter, $monthStart, $monthEnd, $today, $dates, $produkFilter);
        $stock = $this->ringkasanStok($filter, $produkFilter);
        $stokList = $this->stokList($filter);
        $penjualan = $this->penjualanBulan($filter, $monthStart, $monthEnd);

        $top = (int) $request->query('top');
        $top = $top > 0 ? min($top, 50) : 10;

        return response()->json([
            'success' => true,
            'periode' => [
                'bulan' => $bulan,
                'tahun' => substr($bulan, 0, 4),
                'minggu' => $weekLabel,
                'mulai' => $rangeStart,
                'sampai' => $rangeEnd,
            ],
            'inbound' => $inbound,
            'outbound' => $outbound,
            'mutasi_total' => $mutasiTotal,
            'stock' => $stock,
            'stok_list' => $stokList,
            'penjualan' => $penjualan,
            'produk_realtime' => $this->produkRealtime($filter, $produkFilter),
            'storage_regular' => $this->storageRegular($filter, $produkFilter),
            'totals' => $this->totals($filter, $rangeStart, $rangeEnd, $produkFilter),
            'inbound_by_type' => $this->inboundByType($filter, $rangeStart, $rangeEnd, $produkFilter),
            'outbound_by_type' => $this->outboundByType($filter, $rangeStart, $rangeEnd, $produkFilter),
            'outbound_per_gin' => $this->outboundPerGin($filter, $rangeStart, $rangeEnd, $produkFilter, $top),
            'outbound_per_so' => $this->outboundPerSo($filter, $rangeStart, $rangeEnd, $produkFilter, $top),
            'expired_alert' => $this->expiredAlert($filter, $produkFilter),
        ]);
    }

    private function produkFilter(Request $request): array
    {
        $raw = $request->query('produk');
        if (empty($raw)) {
            return [];
        }
        $produks = is_array($raw) ? $raw : explode(',', (string) $raw);

        return array_values(array_filter(array_map('trim', $produks)));
    }

    /**
     * Rentang minggu (Senin sebagai awal minggu).
     * Nilai "minggu" = nomor minggu kalender (1-6) atau "all".
     */
    private function weekRange(Request $request, string $monthStart, string $monthEnd): array
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

        // Cari hari Senin pertama pada/ setelah awal bulan, lalu rentang minggu ke-num.
        $start = now()->parse($monthStart);
        $firstMonday = $start->copy()->startOfWeek();
        if ($firstMonday->lt($start)) {
            $firstMonday->addWeek();
        }
        $rangeStart = $firstMonday->copy()->addWeeks($num - 1)->format('Y-m-d');
        $rangeEnd = $firstMonday->copy()->addWeeks($num)->subDay()->format('Y-m-d');

        if ($rangeStart < $monthStart) {
            $rangeStart = $monthStart;
        }
        if ($rangeEnd > $monthEnd) {
            $rangeEnd = $monthEnd;
        }

        return [$rangeStart, $rangeEnd];
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

    private function inboundStats(?array $filter, string $rangeStart, string $rangeEnd, string $today, array $dates, array $produkFilter = []): array
    {
        $base = DB::table('barang_masuk as bm')
            ->whereIn(DB::raw("LOWER(COALESCE(bm.status, ''))"), ['confirmed', 'selesai'])
            ->selectRaw('COUNT(DISTINCT bm.no_dn) AS total')
            ->selectRaw('COALESCE(SUM(bm.jumlah),0) AS total_qty')
            ->selectRaw('COUNT(DISTINCT CASE WHEN DATE(bm.tanggal_masuk) BETWEEN ? AND ? THEN bm.no_dn END) AS bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bm.tanggal_masuk) BETWEEN ? AND ? THEN bm.jumlah ELSE 0 END) AS qty_bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bm.tanggal_masuk) = ? THEN bm.jumlah ELSE 0 END) AS qty_today', [$today]);

        $base = $this->withLokasiFilter($base, 'bm.id_pengguna_lokasi', $filter);
        if (!empty($produkFilter)) {
            $base->whereIn('bm.nama_produk', $produkFilter);
        }
        $r = (array) $base->first();

        $series = [];
        $seriesQ = DB::table('barang_masuk as bm')
            ->whereIn(DB::raw("LOWER(COALESCE(bm.status, ''))"), ['confirmed', 'selesai'])
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd])
            ->selectRaw('DATE(bm.tanggal_masuk) AS tgl, bm.jumlah AS qty');
        $seriesQ = $this->withLokasiFilter($seriesQ, 'bm.id_pengguna_lokasi', $filter);
        if (!empty($produkFilter)) {
            $seriesQ->whereIn('bm.nama_produk', $produkFilter);
        }
        $smap = $seriesQ->get()->groupBy('tgl')->map(fn ($g) => (int) $g->sum('qty'))->toArray();

        foreach ($dates as $d) {
            if ($d < $rangeStart || $d > $rangeEnd) {
                continue;
            }
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

    private function outboundStats(?array $filter, string $rangeStart, string $rangeEnd, string $today, array $dates, array $produkFilter = []): array
    {
        $base = DB::table('barang_keluar as bk')
            ->whereIn(DB::raw("LOWER(COALESCE(bk.status, ''))"), ['confirmed', 'selesai'])
            ->selectRaw('COUNT(DISTINCT bk.gin_no) AS total')
            ->selectRaw('COALESCE(SUM(bk.jumlah),0) AS total_qty')
            ->selectRaw('COUNT(DISTINCT CASE WHEN DATE(bk.tanggal_keluar) BETWEEN ? AND ? THEN bk.gin_no END) AS bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bk.tanggal_keluar) BETWEEN ? AND ? THEN bk.jumlah ELSE 0 END) AS qty_bulan_ini', [$rangeStart, $rangeEnd])
            ->selectRaw('SUM(CASE WHEN DATE(bk.tanggal_keluar) = ? THEN bk.jumlah ELSE 0 END) AS qty_today', [$today])
            ->selectRaw("COUNT(DISTINCT CASE WHEN LOWER(COALESCE(bk.status,'')) NOT IN ('confirmed','selesai','canceled','cancelled') THEN bk.gin_no END) AS pending");

        $base = $this->withLokasiFilter($base, 'bk.id_pengguna_lokasi', $filter);
        if (!empty($produkFilter)) {
            $base->whereIn('bk.nama_produk', $produkFilter);
        }
        $r = (array) $base->first();

        $series = [];
        $seriesQ = DB::table('barang_keluar as bk')
            ->whereIn(DB::raw("LOWER(COALESCE(bk.status, ''))"), ['confirmed', 'selesai'])
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->selectRaw('DATE(bk.tanggal_keluar) AS d, bk.jumlah AS qty');
        $seriesQ = $this->withLokasiFilter($seriesQ, 'bk.id_pengguna_lokasi', $filter);
        if (!empty($produkFilter)) {
            $seriesQ->whereIn('bk.nama_produk', $produkFilter);
        }
        $smap = $seriesQ->get()->groupBy('d')->map(fn ($g) => (int) $g->sum('qty'))->toArray();

        foreach ($dates as $d) {
            if ($d < $rangeStart || $d > $rangeEnd) {
                continue;
            }
            $series[] = ['tanggal' => $d, 'qty' => (int) ($smap[$d] ?? 0)];
        }

        return [
            'total' => (int) ($r['total'] ?? 0),
            'total_qty' => (int) ($r['total_qty'] ?? 0),
            'bulan_ini' => (int) ($r['bulan_ini'] ?? 0),
            'qty_bulan_ini' => (int) ($r['qty_bulan_ini'] ?? 0),
            'qty_today' => (int) ($r['qty_today'] ?? 0),
            'pending' => (int) ($r['pending'] ?? 0),
            'series' => $series,
        ];
    }

    private function penjualanBulan(?array $filter, string $monthStart, string $monthEnd): array
    {
        $q = DB::table('barang_keluar as bk')
            ->whereIn(DB::raw("LOWER(COALESCE(bk.status, ''))"), ['confirmed', 'selesai'])
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$monthStart, $monthEnd])
            ->selectRaw('bk.nama_produk AS nama_produk, SUM(bk.jumlah) AS qty')
            ->groupBy('bk.nama_produk')
            ->orderByRaw('SUM(bk.jumlah) DESC');

        $q = $this->withLokasiFilter($q, 'bk.id_pengguna_lokasi', $filter);

        $rows = [];
        foreach ($q->get() as $row) {
            $rows[] = ['nama_produk' => $row->nama_produk, 'qty' => (int) $row->qty];
        }

        return $rows;
    }

    private function stokList(?array $filter): array
    {
        $query = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->leftJoin('produk as p', 'p.id_produk', '=', 'sg.id_produk')
            ->where('sd.jumlah', '>', 0)
            ->selectRaw("sg.nama_produk AS nama_produk, COALESCE(NULLIF(TRIM(sg.satuan), ''), NULLIF(TRIM(p.satuan), ''), 'PCS') AS satuan, SUM(sd.jumlah) AS stok")
            ->groupBy('sg.nama_produk', 'sg.satuan', 'p.satuan')
            ->orderByDesc('stok');

        $query = $this->withLokasiFilter($query, 'sg.id_pengguna_lokasi', $filter);
        $query = $this->withLokasiFilter($query, 'sd.id_pengguna_lokasi', $filter);

        $list = [];
        foreach ($query->get() as $row) {
            $list[] = [
                'nama_produk' => $row->nama_produk,
                'satuan' => $row->satuan,
                'stok' => (int) $row->stok
            ];
        }

        return $list;
    }

    private function ringkasanStok(?array $filter, $produkFilter = null): array
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
            ->where('sd.jumlah', '>', 0);

        if (!empty($produkFilter)) {
            $produks = is_array($produkFilter) ? $produkFilter : explode(',', (string) $produkFilter);
            $produks = array_filter(array_map('trim', $produks));
            if (!empty($produks)) {
                $zonaQuery->whereIn('sg.nama_produk', $produks);
            }
        }

        $zonaQuery->selectRaw("CASE
                WHEN UPPER(COALESCE(sg.status, 'normal')) = 'QI' THEN 'qi'
                WHEN $kategoriExpr IN ('BAD STOCK','BADSTOCK') OR $lokasiExpr LIKE 'BAD STOCK-%' OR $lokasiExpr LIKE 'BADSTOCK-%' OR $lokasiExpr LIKE 'BS-%' THEN 'bad'
                WHEN $kategoriExpr = 'REJECT' OR $lokasiExpr LIKE 'REJECT-%' THEN 'reject'
                WHEN $kategoriExpr = 'RECEH' OR $lokasiExpr LIKE 'RECEH-%' THEN 'receh'
                WHEN $kategoriExpr = 'MOBIL' OR $lokasiExpr LIKE 'MOBIL-%' THEN 'mobil'
                WHEN $kategoriExpr = 'FESTIVE' OR $lokasiExpr LIKE 'FESTIVE-%' THEN 'festive'
                WHEN $kategoriExpr = 'TRANSIT' OR $lokasiExpr LIKE 'TRANSIT-%' THEN 'transit'
                WHEN $kategoriExpr = 'HOLD' OR $lokasiExpr LIKE 'HOLD-%' THEN 'hold'
                ELSE 'normal'
            END AS zona, SUM(sd.jumlah) AS qty");

        $zonaQuery = $this->withLokasiFilter($zonaQuery, 'sg.id_pengguna_lokasi', $filter);
        $zonaQuery = $this->withLokasiFilter($zonaQuery, 'sd.id_pengguna_lokasi', $filter);
        $zonaRows = $zonaQuery->groupBy(DB::raw('zona'))->get();

        $zones = ['normal' => 0, 'bad' => 0, 'reject' => 0, 'receh' => 0, 'mobil' => 0, 'festive' => 0, 'transit' => 0, 'hold' => 0, 'qi' => 0];
        foreach ($zonaRows as $row) {
            $zones[$row->zona] = (int) $row->qty;
        }

        $skuQuery = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->where('sd.jumlah', '>', 0);

        if (!empty($produkFilter)) {
            $produks = is_array($produkFilter) ? $produkFilter : explode(',', (string) $produkFilter);
            $produks = array_filter(array_map('trim', $produks));
            if (!empty($produks)) {
                $skuQuery->whereIn('sg.nama_produk', $produks);
            }
        }

        $skuQuery->selectRaw('COUNT(DISTINCT sg.id_produk) AS sku, SUM(sd.jumlah) AS qty');

        $skuQuery = $this->withLokasiFilter($skuQuery, 'sg.id_pengguna_lokasi', $filter);
        $skuQuery = $this->withLokasiFilter($skuQuery, 'sd.id_pengguna_lokasi', $filter);
        $sku = (array) $skuQuery->first();

        return [
            'zona' => $zones,
            'total_sku' => (int) ($sku['sku'] ?? 0),
            'total_qty' => (int) ($sku['qty'] ?? 0),
        ];
    }

    /**
     * Total produk realtime di stok gudang (distinct produk & qty fisik).
     */
    private function produkRealtime(?array $filter, array $produkFilter = []): array
    {
        $q = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->where('sd.jumlah', '>', 0)
            ->selectRaw('COUNT(DISTINCT sg.id_produk) AS total_produk, COALESCE(SUM(sd.jumlah),0) AS total_qty');

        if (!empty($produkFilter)) {
            $q->whereIn('sg.nama_produk', $produkFilter);
        }
        $q = $this->withLokasiFilter($q, 'sg.id_pengguna_lokasi', $filter);
        $q = $this->withLokasiFilter($q, 'sd.id_pengguna_lokasi', $filter);
        $r = (array) $q->first();

        return [
            'total_produk' => (int) ($r['total_produk'] ?? 0),
            'total_qty' => (int) ($r['total_qty'] ?? 0),
        ];
    }

    /**
     * Persentase storage terpakai — HANYA blok regular (exclude zona khusus:
     * bad/reject/receh/mobil/festive/transit/hold/qi).
     * Terpakai = qty zona normal; Kapasitas = SUM(deep.kapasitas) blok non-spesial.
     */
    private function storageRegular(?array $filter, array $produkFilter = []): array
    {
        $kategoriExpr = "UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA'))";
        $lokasiExpr = 'UPPER(TRIM(CONCAT(b.kode_block, \'-\', ln.nomor_line)))';
        $specialCondition = "(
            UPPER(COALESCE(l.kategori, l.nama_lokasi, '')) IN ('BAD STOCK','BADSTOCK','REJECT','RECEH','MOBIL','FESTIVE','TRANSIT','HOLD')
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'BAD STOCK-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'BADSTOCK-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'BS-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'REJECT-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'RECEH-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'MOBIL-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'FESTIVE-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'TRANSIT-%'
            OR UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line))) LIKE 'HOLD-%'
        )";

        // Terpakai: stok fisik di blok regular (status bukan QI, kategori non-spesial).
        $terpakaiQ = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->join('deep as d', 'd.id_deep', '=', 'sd.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->where('sd.jumlah', '>', 0)
            ->whereRaw("UPPER(COALESCE(sg.status, 'normal')) <> 'QI'")
            ->whereRaw("NOT $specialCondition")
            ->selectRaw('COALESCE(SUM(sd.jumlah),0) AS qty');
        if (!empty($produkFilter)) {
            $terpakaiQ->whereIn('sg.nama_produk', $produkFilter);
        }
        $terpakaiQ = $this->withLokasiFilter($terpakaiQ, 'sg.id_pengguna_lokasi', $filter);
        $terpakaiQ = $this->withLokasiFilter($terpakaiQ, 'sd.id_pengguna_lokasi', $filter);
        $terpakai = (int) ($terpakaiQ->value('qty') ?? 0);

        // Kapasitas: seluruh deep pada blok regular.
        $kapQ = DB::table('deep as d')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->whereRaw("NOT $specialCondition")
            ->selectRaw('COALESCE(SUM(d.kapasitas),0) AS kapasitas');
        $kapQ = $this->withLokasiFilter($kapQ, 'd.id_pengguna_lokasi', $filter);
        $kapasitas = (int) ($kapQ->value('kapasitas') ?? 0);

        $persen = $kapasitas > 0 ? round(($terpakai / $kapasitas) * 100, 1) : 0;

        return [
            'terpakai' => $terpakai,
            'kapasitas' => $kapasitas,
            'persen' => $persen,
        ];
    }

    /**
     * Total shipment, SO, GIN, barang datang & terkirim (semua status untuk
     * shipment/SO/GIN; barang datang/terkirim hanya yang terkonfirmasi).
     */
    private function totals(?array $filter, string $rangeStart, string $rangeEnd, array $produkFilter = []): array
    {
        $bm = DB::table('barang_masuk as bm')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd])
            ->selectRaw("COUNT(DISTINCT bm.shipment_id) AS shipment")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bm.status,'')) IN ('confirmed','selesai') THEN bm.jumlah ELSE 0 END) AS barang_datang");
        if (!empty($produkFilter)) {
            $bm->whereIn('bm.nama_produk', $produkFilter);
        }
        $bm = $this->withLokasiFilter($bm, 'bm.id_pengguna_lokasi', $filter);
        $bmRow = (array) $bm->first();

        $bk = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->selectRaw("COUNT(DISTINCT bk.gin_no) AS gin")
            ->selectRaw("COUNT(DISTINCT bk.so_number) AS so")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bk.status,'')) IN ('confirmed','selesai') THEN bk.jumlah ELSE 0 END) AS barang_terkirim");
        if (!empty($produkFilter)) {
            $bk->whereIn('bk.nama_produk', $produkFilter);
        }
        $bk = $this->withLokasiFilter($bk, 'bk.id_pengguna_lokasi', $filter);
        $bkRow = (array) $bk->first();

        return [
            'shipment' => (int) ($bmRow['shipment'] ?? 0),
            'so' => (int) ($bkRow['so'] ?? 0),
            'gin' => (int) ($bkRow['gin'] ?? 0),
            'barang_datang' => (int) ($bmRow['barang_datang'] ?? 0),
            'barang_terkirim' => (int) ($bkRow['barang_terkirim'] ?? 0),
        ];
    }

    /**
     * Inbound per tipe_penerimaan: planned (semua status) vs actual (confirmed/selesai).
     * Disertai "overall".
     */
    private function inboundByType(?array $filter, string $rangeStart, string $rangeEnd, array $produkFilter = []): array
    {
        $q = DB::table('barang_masuk as bm')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$rangeStart, $rangeEnd])
            ->whereRaw("LOWER(COALESCE(bm.status,'')) NOT IN ('canceled','cancelled')")
            ->selectRaw("COALESCE(NULLIF(TRIM(bm.tipe_penerimaan), ''), 'LAINNYA') AS tipe")
            ->selectRaw('COUNT(*) AS planned')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bm.status,'')) IN ('confirmed','selesai') THEN 1 ELSE 0 END) AS actual")
            ->selectRaw('COALESCE(SUM(bm.jumlah),0) AS planned_qty')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bm.status,'')) IN ('confirmed','selesai') THEN bm.jumlah ELSE 0 END) AS actual_qty");
        if (!empty($produkFilter)) {
            $q->whereIn('bm.nama_produk', $produkFilter);
        }
        $q = $this->withLokasiFilter($q, 'bm.id_pengguna_lokasi', $filter);

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
     * Outbound per tipe_pengeluaran: planned vs actual + overall.
     */
    private function outboundByType(?array $filter, string $rangeStart, string $rangeEnd, array $produkFilter = []): array
    {
        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->whereRaw("LOWER(COALESCE(bk.status,'')) NOT IN ('canceled','cancelled')")
            ->selectRaw("COALESCE(NULLIF(TRIM(bk.tipe_pengeluaran), ''), 'LAINNYA') AS tipe")
            ->selectRaw('COUNT(*) AS planned')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bk.status,'')) IN ('confirmed','selesai') THEN 1 ELSE 0 END) AS actual")
            ->selectRaw('COALESCE(SUM(bk.jumlah),0) AS planned_qty')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bk.status,'')) IN ('confirmed','selesai') THEN bk.jumlah ELSE 0 END) AS actual_qty");
        if (!empty($produkFilter)) {
            $q->whereIn('bk.nama_produk', $produkFilter);
        }
        $q = $this->withLokasiFilter($q, 'bk.id_pengguna_lokasi', $filter);

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

    /**
     * Outbound per GIN (Top-N): planned vs actual.
     */
    private function outboundPerGin(?array $filter, string $rangeStart, string $rangeEnd, array $produkFilter = [], int $top = 10): array
    {
        return $this->groupOutbound($filter, $rangeStart, $rangeEnd, $produkFilter, 'bk.gin_no', 'gin_no', $top);
    }

    /**
     * Outbound per no_so (Top-N): planned vs actual. Satu GIN bisa banyak SO.
     */
    private function outboundPerSo(?array $filter, string $rangeStart, string $rangeEnd, array $produkFilter = [], int $top = 10): array
    {
        return $this->groupOutbound($filter, $rangeStart, $rangeEnd, $produkFilter, 'bk.so_number', 'so_number', $top);
    }

    private function groupOutbound(?array $filter, string $rangeStart, string $rangeEnd, array $produkFilter, string $column, string $alias, int $top): array
    {
        $q = DB::table('barang_keluar as bk')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$rangeStart, $rangeEnd])
            ->whereRaw("LOWER(COALESCE(bk.status,'')) NOT IN ('canceled','cancelled')")
            ->whereNotNull($column)
            ->where($column, '<>', '')
            ->selectRaw("$column AS label")
            ->selectRaw('COUNT(*) AS planned')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bk.status,'')) IN ('confirmed','selesai') THEN 1 ELSE 0 END) AS actual")
            ->selectRaw('COALESCE(SUM(bk.jumlah),0) AS planned_qty')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(bk.status,'')) IN ('confirmed','selesai') THEN bk.jumlah ELSE 0 END) AS actual_qty");
        if (!empty($produkFilter)) {
            $q->whereIn('bk.nama_produk', $produkFilter);
        }
        $q = $this->withLokasiFilter($q, 'bk.id_pengguna_lokasi', $filter);

        $rows = [];
        foreach ($q->groupBy($column)->orderByDesc('planned_qty')->limit($top)->get() as $row) {
            $rows[] = [
                'label' => (string) $row->label,
                'planned' => (int) $row->planned,
                'actual' => (int) $row->actual,
                'planned_qty' => (int) $row->planned_qty,
                'actual_qty' => (int) $row->actual_qty,
            ];
        }

        return $rows;
    }

    /**
     * Alert produk mendekati/kadaluarsa: best_before <= H+30 atau sudah lewat.
     * Terus muncul sampai batch habis dari stok.
     */
    private function expiredAlert(?array $filter, array $produkFilter = []): array
    {
        $threshold = now()->addDays(30)->format('Y-m-d');
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
            ->selectRaw("sg.nama_produk AS nama_produk")
            ->selectRaw("COALESCE(NULLIF(TRIM(sg.batch), ''), '-') AS batch")
            ->selectRaw("sg.best_before AS best_before")
            ->selectRaw("CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi")
            ->selectRaw("UPPER(COALESCE(l.kategori, l.nama_lokasi, '')) AS kategori")
            ->selectRaw("SUM(sd.jumlah) AS qty")
            ->groupBy('sg.nama_produk', 'sg.batch', 'sg.best_before', 'b.kode_block', 'ln.nomor_line', 'l.kategori', 'l.nama_lokasi')
            ->orderBy('sg.best_before');
        if (!empty($produkFilter)) {
            $q->whereIn('sg.nama_produk', $produkFilter);
        }
        $q = $this->withLokasiFilter($q, 'sg.id_pengguna_lokasi', $filter);
        $q = $this->withLokasiFilter($q, 'sd.id_pengguna_lokasi', $filter);

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
