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
     * Storage LUAR gudang — HANYA blok khusus (mobil, transit, bad stock,
     * reject, receh, festive, hold, ...).
     *
     * Terpakai = qty (non-QI) pada blok khusus;
     * Kapasitas = SUM(deep.kapasitas) pada blok khusus.
     *
     * @param  array<int,string>  $produkFilter
     * @return array{terpakai:int,kapasitas:int,persen:float|int}
     */
    public function storageLuar(?array $lokasiFilter, array $produkFilter = []): array
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
            ->whereRaw($specialCondition)
            ->selectRaw('COALESCE(SUM(sd.jumlah),0) AS qty');

        if (! empty($produkFilter)) {
            $terpakaiQ->whereIn('sg.nama_produk', $produkFilter);
        }
        $terpakaiQ = LokasiFilter::apply($terpakaiQ, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $terpakaiQ = LokasiFilter::apply($terpakaiQ, 'sd.id_pengguna_lokasi', $lokasiFilter);
        $terpakai = (int) ($terpakaiQ->value('qty') ?? 0);

        // Kapasitas: seluruh deep pada blok khusus.
        $kapQ = DB::table('deep as d')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->whereRaw($specialCondition)
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
     * Pemetaan produk gallon/jug → label ringkas untuk kartu stok.
     *
     * @var array<string,array{0:string,1:string}> [nama_produk => [grup, item]]
     */
    private const GALLON_JUG_MAP = [
        '5 GALLON AQUA LOCAL VVIP' => ['gallon', 'vip'],
        '5 GALLON AQUA LOCAL' => ['gallon', 'aqua'],
        '5 GALLON VIT LOCAL' => ['gallon', 'vit'],
        'JUG AQUA 19L PC 55 MM' => ['jug', 'aqua'],
        'JUG VIT 19L PC 55 MM' => ['jug', 'vit'],
    ];

    /** Daftar nama produk per grup (untuk breakdown per zona). */

    /**
     * Expression SQL pengelompokan block ke jenis lokasi penyimpanan.
     * REGULER (default) / MOBIL / TRANSIT / BAD_REJECT (bad stock + reject).
     */
    private static function zonaGrupExpr(string $blockAlias = 'b'): string
    {
        $blk = "UPPER(REPLACE(TRIM({$blockAlias}.kode_block), ' ', ''))";

        return "CASE
            WHEN {$blk} = 'MOBIL' THEN 'MOBIL'
            WHEN {$blk} = 'TRANSIT' THEN 'TRANSIT'
            WHEN {$blk} IN ('BAD','BS','BADSTOCK','REJECT') THEN 'BAD_REJECT'
            ELSE 'REGULER'
        END";
    }

    /**
     * Detail stok gallon & jug (realtime) untuk kartu dashboard.
     *
     * Hanya mengikuti filter LOKASI (depo). Filter periode/produk sengaja
     * TIDAK diterapkan agar angka gallon/jug selalu tampil utuh.
     * Status yang dihitung: hanya stok 'normal' (QI dikecualikan).
     *
     * @return array{gallon:array{vip:int,aqua:int,vit:int},jug:array{aqua:int,vit:int}}
     */
    public function gallonBreakdown(?array $lokasiFilter): array
    {
        $query = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->where('sd.jumlah', '>', 0)
            ->whereRaw("UPPER(COALESCE(sg.status, 'normal')) = 'NORMAL'")
            ->whereIn('sg.nama_produk', array_keys(self::GALLON_JUG_MAP))
            ->selectRaw('sg.nama_produk AS nama, COALESCE(SUM(sd.jumlah),0) AS qty')
            ->groupBy('sg.nama_produk');

        $query = LokasiFilter::apply($query, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $query = LokasiFilter::apply($query, 'sd.id_pengguna_lokasi', $lokasiFilter);

        $qty = $query->pluck('qty', 'nama')->toArray();

        $gallon = ['vip' => 0, 'aqua' => 0, 'vit' => 0];
        $jug = ['aqua' => 0, 'vit' => 0];

        foreach (self::GALLON_JUG_MAP as $produk => [$grup, $item]) {
            $nilai = (int) ($qty[$produk] ?? 0);
            if ($grup === 'gallon') {
                $gallon[$item] = $nilai;
            } else {
                $jug[$item] = $nilai;
            }
        }

        return ['gallon' => $gallon, 'jug' => $jug];
    }

    /**
     * Breakdown stok & kapasitas gallon/jug per ITEM produk, dipecah per
     * jenis lokasi penyimpanan (REGULER / MOBIL / TRANSIT / BAD_REJECT).
     *
     * Stok = qty produk (status normal) pada zona tsb, mengikuti filter LOKASI.
     * Kapasitas = kapasitas slot yang DITUJU produk tsb (tabel
     * prioritas_lokasi_produk), pada zona tsb — bukan seluruh block.
     *
     * @return array{gallon:array<string,array<string,array{qty:int,kapasitas:int,persen:float|int}>>,jug:array<string,array<string,array{qty:int,kapasitas:int,persen:float|int}>>}
     */
    public function gallonJugByZona(?array $lokasiFilter): array
    {
        $zonaExpr = self::zonaGrupExpr('b');
        $grupZona = ['REGULER', 'MOBIL', 'TRANSIT', 'BAD_REJECT'];

        // --- Stok per item produk per zona ---
        $stokQ = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
            ->join('deep as d', 'd.id_deep', '=', 'sd.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->where('sd.jumlah', '>', 0)
            ->whereRaw("UPPER(COALESCE(sg.status, 'normal')) = 'NORMAL'")
            ->whereIn('sg.nama_produk', array_keys(self::GALLON_JUG_MAP))
            ->selectRaw("{$zonaExpr} AS zona, sg.nama_produk AS nama, COALESCE(SUM(sd.jumlah),0) AS qty")
            ->groupBy(DB::raw('zona'), 'sg.nama_produk');

        $stokQ = LokasiFilter::apply($stokQ, 'sg.id_pengguna_lokasi', $lokasiFilter);
        $stokQ = LokasiFilter::apply($stokQ, 'sd.id_pengguna_lokasi', $lokasiFilter);
        $stokRows = $stokQ->get();

        // stok[grup][item][ZONA] = qty
        $stok = ['gallon' => ['vip' => [], 'aqua' => [], 'vit' => []], 'jug' => ['aqua' => [], 'vit' => []]];
        foreach ($stokRows as $row) {
            $map = self::GALLON_JUG_MAP[$row->nama] ?? null;
            if ($map === null || ! isset($stok[$map[0]][$map[1]])) {
                continue;
            }
            $stok[$map[0]][$map[1]][$row->zona] = (int) $row->qty;
        }

        // --- Kapasitas prioritas per item produk per zona ---
        // Peta item → id_produk.
        $idByProduk = DB::table('produk')
            ->whereIn('nama_produk', array_keys(self::GALLON_JUG_MAP))
            ->pluck('id_produk', 'nama_produk')
            ->toArray();

        $out = ['gallon' => [], 'jug' => []];
        foreach (self::GALLON_JUG_MAP as $produk => [$grup, $item]) {
            $idProduk = $idByProduk[$produk] ?? null;
            $itemOut = [];
            foreach ($grupZona as $zona) {
                $qty = (int) ($stok[$grup][$item][$zona] ?? 0);
                $kap = $idProduk !== null
                    ? $this->kapasitasPrioritas((int) $idProduk, $lokasiFilter, $zona)
                    : 0;
                $itemOut[strtolower($zona)] = [
                    'qty' => $qty,
                    'kapasitas' => $kap,
                    'persen' => $kap > 0 ? round($qty / $kap * 100, 1) : 0,
                ];
            }
            $out[$grup][$item] = $itemOut;
        }

        return $out;
    }

    /**
     * Kapasitas slot yang DITUJU sebuah produk (tabel prioritas_lokasi_produk),
     * dibatasi pada satu zona penyimpanan. Mereplikasi logika StokController
     * (segmen deep/level/line/block/lokasi) dengan penyaring blok reguler.
     *
     * @param  array{0:string,1:array<int,string>}|null  $lokasiFilter
     */
    private function kapasitasPrioritas(int $idProduk, ?array $lokasiFilter, string $zona): int
    {
        $zonaCond = match ($zona) {
            'MOBIL' => " AND UPPER(REPLACE(TRIM(b.kode_block), ' ', '')) = 'MOBIL'",
            'TRANSIT' => " AND UPPER(REPLACE(TRIM(b.kode_block), ' ', '')) = 'TRANSIT'",
            'BAD_REJECT' => " AND UPPER(REPLACE(TRIM(b.kode_block), ' ', '')) IN ('BAD','BS','BADSTOCK','REJECT')",
            default => " AND UPPER(REPLACE(TRIM(b.kode_block), ' ', '')) NOT IN ('MOBIL','TRANSIT','BAD','BS','BADSTOCK','REJECT')",
        };

        $segs = [
            'FROM prioritas_lokasi_produk plp
                INNER JOIN deep d ON d.id_deep = plp.id_deep
                INNER JOIN level lv ON lv.id_level = d.id_level
                INNER JOIN line ln ON ln.id_line = lv.id_line
                INNER JOIN block b ON b.id_block = ln.id_block
                WHERE plp.id_produk = __ID__ AND plp.id_deep IS NOT NULL __ZONA__ __LOK_plp__',
            'FROM prioritas_lokasi_produk plp
                INNER JOIN deep d ON d.id_level = plp.id_level
                INNER JOIN level lv ON lv.id_level = d.id_level
                INNER JOIN line ln ON ln.id_line = lv.id_line
                INNER JOIN block b ON b.id_block = ln.id_block
                WHERE plp.id_produk = __ID__ AND plp.id_deep IS NULL AND plp.id_level IS NOT NULL __ZONA__ __LOK_plp__',
            'FROM prioritas_lokasi_produk plp
                INNER JOIN level lv ON lv.id_line = plp.id_line
                INNER JOIN line ln ON ln.id_line = lv.id_line
                INNER JOIN block b ON b.id_block = ln.id_block
                INNER JOIN deep d ON d.id_level = lv.id_level
                WHERE plp.id_produk = __ID__ AND plp.id_deep IS NULL AND plp.id_level IS NULL AND plp.id_line IS NOT NULL __ZONA__ __LOK_plp__',
            'FROM prioritas_lokasi_produk plp
                INNER JOIN block b ON b.id_block = plp.id_block
                INNER JOIN line ln ON ln.id_block = b.id_block
                INNER JOIN level lv ON lv.id_line = ln.id_line
                INNER JOIN deep d ON d.id_level = lv.id_level
                WHERE plp.id_produk = __ID__ AND plp.id_deep IS NULL AND plp.id_level IS NULL AND plp.id_line IS NULL AND plp.id_block IS NOT NULL __ZONA__ __LOK_plp__',
            'FROM prioritas_lokasi_produk plp
                INNER JOIN lokasi l ON l.id_lokasi = plp.id_lokasi
                INNER JOIN block b ON b.id_lokasi = l.id_lokasi
                INNER JOIN line ln ON ln.id_block = b.id_block
                INNER JOIN level lv ON lv.id_line = ln.id_line
                INNER JOIN deep d ON d.id_level = lv.id_level
                WHERE plp.id_produk = __ID__ AND plp.id_deep IS NULL AND plp.id_level IS NULL AND plp.id_line IS NULL AND plp.id_block IS NULL AND plp.id_lokasi IS NOT NULL __ZONA__ __LOK_plp__',
        ];

        $lokAll = $lokasiFilter === null;
        $lokCond = '';
        $bind = [(string) $idProduk];
        if (! $lokAll) {
            $lokIds = $lokasiFilter[0] === 'eq' ? [$lokasiFilter[1][0]] : $lokasiFilter[1];
            $ph = implode(',', array_fill(0, count($lokIds), '?'));
            $lokCond = " AND plp.id_pengguna_lokasi IN ({$ph})";
            foreach ($lokIds as $l) {
                $bind[] = $l;
            }
        }

        $total = 0;
        foreach ($segs as $seg) {
            $sql = 'SELECT COALESCE(SUM(COALESCE(d.kapasitas,0)),0) AS v '
                .str_replace(
                    ['__ID__', '__ZONA__', '__LOK_plp__'],
                    ['?', $zonaCond, $lokCond],
                    $seg
                );
            $total += (int) DB::selectOne($sql, $bind)->v;
        }

        return $total;
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
