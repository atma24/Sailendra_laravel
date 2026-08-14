<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StokController extends Controller
{
    use ApiResponse;

    private const INT_KEYS = ['id_stok', 'id_produk', 'id_barang_masuk', 'id_lokasi', 'id_block', 'id_line', 'qty_sisa', 'total_qty', 'total_kapasitas'];

    private function normUnit(string $u): string
    {
        $u = strtoupper(trim($u));
        if (in_array($u, ['GALON', 'GALLON'], true)) {
            return 'GALLON';
        }
        if ($u === 'BOX') {
            return 'BOX';
        }
        if ($u === 'MP' || $u === 'MULTIPACK') {
            return 'MP';
        }

        return $u;
    }

    private function resolveLokasiIds(Request $request): array
    {
        $multi = trim((string) $request->query('id_pengguna_lokasi_multi', ''));
        if ($multi !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $multi)), fn ($id) => $id !== ''));
        }

        $single = trim((string) $request->query('id_pengguna_lokasi', ''));

        return $single !== '' ? [$single] : [];
    }

    private function zonaWhere(string $zona): string
    {
        $loc = "UPPER(TRIM(CONCAT(b.kode_block, '-', ln.nomor_line)))";
        $cat = "UPPER(TRIM(COALESCE(l.kategori,'')))";

        $zones = [
            'bad' => " AND ( {$cat} IN ('BAD STOCK','BADSTOCK') OR {$loc} LIKE 'BAD STOCK-%' OR {$loc} LIKE 'BADSTOCK-%' OR {$loc} LIKE 'BS-%' ) ",
            'reject' => " AND ( {$cat} = 'REJECT' OR {$loc} LIKE 'REJECT-%' ) ",
            'receh' => " AND ( {$cat} = 'RECEH' OR {$loc} LIKE 'RECEH-%' ) ",
            'festive' => " AND ( {$cat} = 'FESTIVE' OR {$loc} LIKE 'FESTIVE-%' ) ",
            'transit' => " AND ( {$cat} = 'TRANSIT' OR {$loc} LIKE 'TRANSIT-%' ) ",
            'hold' => " AND ( {$cat} = 'HOLD' OR {$loc} LIKE 'HOLD-%' ) ",
            'qa' => " AND sg.status = 'qa' ",
            'normal' => " AND NOT ( {$cat} IN ('BAD STOCK','BADSTOCK','REJECT','RECEH','FESTIVE','TRANSIT','HOLD')"
                ." OR {$loc} LIKE 'BAD STOCK-%' OR {$loc} LIKE 'BADSTOCK-%' OR {$loc} LIKE 'BS-%'"
                ." OR {$loc} LIKE 'REJECT-%' OR {$loc} LIKE 'RECEH-%' OR {$loc} LIKE 'FESTIVE-%'"
                ." OR {$loc} LIKE 'TRANSIT-%' OR {$loc} LIKE 'HOLD-%' ) ",
        ];

        return $zones[$zona] ?? '';
    }

    private function satuanCaseSg(): string
    {
        return "CASE
            WHEN UPPER(sg.satuan) IN ('GALON','GALLON') THEN 'GALLON'
            WHEN UPPER(sg.satuan) = 'BOX' THEN 'BOX'
            WHEN UPPER(sg.satuan) = 'MP' THEN 'MP'
            ELSE UPPER(sg.satuan)
        END";
    }

    private function satuanCaseP(): string
    {
        return "CASE
            WHEN UPPER(p.satuan) IN ('GALON','GALLON') THEN 'GALLON'
            WHEN UPPER(p.satuan) = 'BOX' THEN 'BOX'
            WHEN UPPER(p.satuan) IN ('MP','MULTIPACK') THEN 'MP'
            ELSE UPPER(p.satuan)
        END";
    }

    public function __invoke(Request $request): JsonResponse
    {
        try {
            $lokasiIds = $this->resolveLokasiIds($request);
            $rawMode = strtolower(trim((string) $request->query('mode', '')));
            $idProduk = (int) $request->query('id_produk', 0);
            $zonaParam = strtolower(trim((string) $request->query('zona', 'normal')));

            if (! in_array($zonaParam, ['normal', 'bad', 'reject', 'receh', 'festive', 'transit', 'hold', 'qa', 'all'], true)) {
                $zonaParam = 'normal';
            }
            $zona = $zonaParam;

            $mode = match (true) {
                $rawMode === 'batches' => 'batches',
                $rawMode === 'manual_lokasi' => 'manual_lokasi',
                $rawMode === 'manual_block' => 'manual_block',
                $rawMode === 'manual_line' => 'manual_line',
                $rawMode === 'manual_batch' => 'manual_batch',
                $rawMode === 'kapasitas' => 'kapasitas',
                $rawMode === 'kapasitas_produk' => 'kapasitas_produk',
                $rawMode === 'layout_list' => 'layout_list',
                $rawMode === 'layout_detail' => 'layout_detail',
                $idProduk > 0 => 'detail',
                default => in_array($rawMode, ['list', 'detail'], true) ? $rawMode : 'list',
            };

            $zonaWhere = $zona === 'all' ? '' : $this->zonaWhere($zona);

            $result = $this->build($mode, $lokasiIds, $idProduk, $zona, $zonaWhere, $request);

            if (isset($result['error'])) {
                return $this->fail($result['error']);
            }

            $rows = DB::select($result['sql'], $result['bind']);

            $data = [];
            foreach ($rows as $r) {
                $row = (array) $r;
                foreach (self::INT_KEYS as $k) {
                    if (array_key_exists($k, $row)) {
                        $row[$k] = (int) $row[$k];
                    }
                }
                if (isset($row['satuan'])) {
                    $row['satuan'] = $this->normUnit((string) $row['satuan']);
                }
                if (in_array($mode, ['detail', 'batches', 'manual_batch'], true)) {
                    $row['zone'] = 'RELEASE';
                }
                $data[] = $row;
            }

            return $this->ok($data);
        } catch (\Throwable $e) {
            return $this->fail('Kesalahan server: '.$e->getMessage());
        }
    }

    private function build(string $mode, array $lokArr, int $idProduk, string $zona, string $zonaWhere, Request $request): array
    {
        $lokCount = count($lokArr);

        if ($lokCount === 1) {
            $lokSgSd = ' AND sg.id_pengguna_lokasi = ? AND sd.id_pengguna_lokasi = ?';
            $baseBind = [$lokArr[0], $lokArr[0]];
            $whereB = ' WHERE b.id_pengguna_lokasi = ?';
            $bindB = [$lokArr[0]];
        } elseif ($lokCount > 1) {
            $ph = implode(',', array_fill(0, $lokCount, '?'));
            $lokSgSd = " AND sg.id_pengguna_lokasi IN ($ph) AND sd.id_pengguna_lokasi IN ($ph)";
            $baseBind = array_merge($lokArr, $lokArr);
            $whereB = " WHERE b.id_pengguna_lokasi IN ($ph)";
            $bindB = $lokArr;
        } else {
            $lokSgSd = '';
            $baseBind = [];
            $whereB = '';
            $bindB = [];
        }

        $satuan = $this->satuanCaseSg();

        switch ($mode) {
            case 'manual_lokasi':
                if ($idProduk <= 0) {
                    return ['error' => 'id_produk wajib untuk mode=manual_lokasi'];
                }
                $sql = "SELECT l.id_lokasi, l.nama_lokasi, l.kategori, SUM(sd.jumlah) AS total_qty
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    WHERE sd.jumlah > 0 AND sg.id_produk = ? AND sg.status != 'qa' {$lokSgSd}{$zonaWhere}
                    GROUP BY l.id_lokasi, l.nama_lokasi, l.kategori
                    ORDER BY l.nama_lokasi ASC";

                return ['sql' => $sql, 'bind' => array_merge([$idProduk], $baseBind)];

            case 'manual_block':
                if ($idProduk <= 0) {
                    return ['error' => 'id_produk wajib untuk mode=manual_block'];
                }
                $idLokasi = (int) $request->query('id_lokasi', 0);
                if ($idLokasi <= 0) {
                    return ['error' => 'id_lokasi wajib untuk mode=manual_block'];
                }
                $sql = "SELECT b.id_block, b.id_lokasi, b.kode_block, SUM(sd.jumlah) AS total_qty
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    WHERE sd.jumlah > 0 AND sg.id_produk = ? AND b.id_lokasi = ? AND sg.status != 'qa' {$lokSgSd}{$zonaWhere}
                    GROUP BY b.id_block, b.id_lokasi, b.kode_block
                    ORDER BY b.kode_block ASC";

                return ['sql' => $sql, 'bind' => array_merge([$idProduk, $idLokasi], $baseBind)];

            case 'manual_line':
                if ($idProduk <= 0) {
                    return ['error' => 'id_produk wajib untuk mode=manual_line'];
                }
                $idBlock = (int) $request->query('id_block', 0);
                if ($idBlock <= 0) {
                    return ['error' => 'id_block wajib untuk mode=manual_line'];
                }
                $sql = "SELECT ln.id_line, ln.id_block, ln.nomor_line, SUM(sd.jumlah) AS total_qty
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    WHERE sd.jumlah > 0 AND sg.id_produk = ? AND ln.id_block = ? AND sg.status != 'qa' {$lokSgSd}{$zonaWhere}
                    GROUP BY ln.id_line, ln.id_block, ln.nomor_line
                    ORDER BY CAST(ln.nomor_line AS UNSIGNED) ASC, ln.nomor_line ASC";

                return ['sql' => $sql, 'bind' => array_merge([$idProduk, $idBlock], $baseBind)];

            case 'manual_batch':
                if ($idProduk <= 0) {
                    return ['error' => 'id_produk wajib untuk mode=manual_batch'];
                }
                $idLine = (int) $request->query('id_line', 0);
                if ($idLine <= 0) {
                    return ['error' => 'id_line wajib untuk mode=manual_batch'];
                }
                $sql = "SELECT
                    MIN(sg.id_stok) AS id_stok,
                    MIN(sg.id_barang_masuk) AS id_barang_masuk,
                    sg.id_produk,
                    COALESCE(sg.nama_produk, p.nama_produk, CONCAT('Produk ', sg.id_produk)) AS nama_produk,
                    COALESCE(sd.batch, sg.batch) AS batch,
                    SUM(sd.jumlah) AS qty_sisa,
                    {$satuan} AS satuan,
                    sd.best_before,
                    l.id_lokasi, l.nama_lokasi,
                    b.id_block, b.kode_block,
                    ln.id_line, ln.nomor_line,
                    CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi_block,
                    CONCAT(COALESCE(sd.batch, sg.batch, '-'), ' - Sisa ', SUM(sd.jumlah), ' ', {$satuan}) AS label
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    LEFT JOIN produk p ON p.id_produk = sg.id_produk
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    WHERE sd.jumlah > 0 AND sg.id_produk = ? AND ln.id_line = ? AND sg.status != 'qa' {$lokSgSd}{$zonaWhere}
                    GROUP BY sg.id_produk,
                        COALESCE(sg.nama_produk, p.nama_produk, CONCAT('Produk ', sg.id_produk)),
                        COALESCE(sd.batch, sg.batch),
                        {$satuan},
                        sd.best_before,
                        l.id_lokasi, l.nama_lokasi, b.id_block, b.kode_block, ln.id_line, ln.nomor_line
                    ORDER BY COALESCE(sd.best_before,'9999-12-31') ASC, batch ASC";

                return ['sql' => $sql, 'bind' => array_merge([$idProduk, $idLine], $baseBind)];

            case 'batches':
                $sql = "SELECT
                    MIN(sg.id_stok) AS id_stok,
                    sg.id_produk,
                    MIN(sg.id_barang_masuk) AS id_barang_masuk,
                    COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)) AS nama_produk,
                    SUM(sd.jumlah) AS qty_sisa,
                    {$satuan} AS satuan,
                    sd.best_before,
                    CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi_block
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    LEFT JOIN produk p ON p.id_produk = sg.id_produk
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    WHERE sd.jumlah > 0 {$lokSgSd}
                    GROUP BY sg.id_produk,
                        COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)),
                        {$satuan},
                        sd.best_before,
                        b.kode_block, ln.nomor_line
                    ORDER BY b.kode_block ASC, ln.nomor_line ASC, COALESCE(sd.best_before,'9999-12-31') ASC";

                return ['sql' => $sql, 'bind' => $baseBind];

            case 'list':
                $sql = "SELECT
                    sg.id_produk,
                    COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)) AS nama_produk,
                    UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori_lokasi,
                    {$satuan} AS satuan,
                    SUM(CASE WHEN sd.jumlah > 0 THEN sd.jumlah ELSE 0 END) AS total_qty,
                    SUM(CASE WHEN sd.jumlah > 0 AND sg.status = 'qa' THEN sd.jumlah ELSE 0 END) AS qty_qa,
                    MIN(CASE WHEN sd.jumlah > 0 THEN sd.best_before END) AS best_before_terdekat
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    LEFT JOIN produk p ON p.id_produk = sg.id_produk
                    WHERE sd.jumlah > 0 {$lokSgSd}{$zonaWhere}
                    GROUP BY sg.id_produk,
                        COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)),
                        UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')),
                        {$satuan}
                    ORDER BY nama_produk ASC, satuan ASC";

                return ['sql' => $sql, 'bind' => $baseBind];

            case 'layout_list':
                $whereProduk = $idProduk > 0 ? ' AND sg.id_produk = ?' : '';
                $bind = $idProduk > 0 ? array_merge([$idProduk], $baseBind) : $baseBind;
                $sql = "SELECT
                    sg.id_produk,
                    COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)) AS nama_produk,
                    UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori_lokasi,
                    {$satuan} AS satuan,
                    SUM(CASE WHEN sd.jumlah > 0 THEN sd.jumlah ELSE 0 END) AS total_qty,
                    MIN(CASE WHEN sd.jumlah > 0 THEN sd.best_before END) AS best_before_terdekat,
                    CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi_block
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    LEFT JOIN produk p ON p.id_produk = sg.id_produk
                    WHERE sd.jumlah > 0 {$lokSgSd}{$whereProduk}{$zonaWhere}
                    GROUP BY sg.id_produk,
                        COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)),
                        UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')),
                        {$satuan},
                        b.kode_block, ln.nomor_line
                    ORDER BY nama_produk ASC, satuan ASC, b.kode_block ASC, ln.nomor_line ASC";

                return ['sql' => $sql, 'bind' => $bind];

            case 'layout_detail':
                if ($idProduk <= 0) {
                    return ['error' => 'id_produk wajib untuk mode=layout_detail'];
                }
                $sql = "SELECT
                    MIN(sg.id_stok) AS id_stok,
                    sg.id_produk,
                    MIN(sg.id_barang_masuk) AS id_barang_masuk,
                    COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)) AS nama_produk,
                    SUM(sd.jumlah) AS qty_sisa,
                    {$satuan} AS satuan,
                    sd.best_before,
                    CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi_block
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    LEFT JOIN produk p ON p.id_produk = sg.id_produk
                    WHERE sg.id_produk = ? AND sd.jumlah > 0 {$lokSgSd}{$zonaWhere}
                    GROUP BY sg.id_produk,
                        COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)),
                        {$satuan},
                        sd.best_before,
                        b.kode_block, ln.nomor_line
                    ORDER BY b.kode_block ASC, ln.nomor_line ASC, COALESCE(sd.best_before,'9999-12-31') ASC";

                return ['sql' => $sql, 'bind' => array_merge([$idProduk], $baseBind)];

            case 'detail':
                if ($idProduk <= 0) {
                    return ['error' => 'id_produk wajib untuk mode=detail'];
                }
                $sql = "SELECT
                    MIN(sg.id_stok) AS id_stok,
                    sg.id_produk,
                    MIN(sg.id_barang_masuk) AS id_barang_masuk,
                    COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)) AS nama_produk,
                    SUM(sd.jumlah) AS qty_sisa,
                    {$satuan} AS satuan,
                    sd.best_before,
                    MAX(sg.status) AS status,
                    CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi_block
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    LEFT JOIN produk p ON p.id_produk = sg.id_produk
                    WHERE sg.id_produk = ? AND sd.jumlah > 0 {$lokSgSd}{$zonaWhere}
                    GROUP BY sg.id_produk,
                        COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)),
                        {$satuan},
                        sd.best_before,
                        b.kode_block, ln.nomor_line
                    ORDER BY b.kode_block ASC, ln.nomor_line ASC, COALESCE(sd.best_before,'9999-12-31') ASC";

                return ['sql' => $sql, 'bind' => array_merge([$idProduk], $baseBind)];

            case 'kapasitas':
                $sql = "SELECT
                    UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori,
                    SUM(COALESCE(d.kapasitas,0)) AS total_kapasitas
                    FROM deep d
                    INNER JOIN level lv ON lv.id_level = d.id_level
                    INNER JOIN line ln ON ln.id_line = lv.id_line
                    INNER JOIN block b ON b.id_block = ln.id_block
                    INNER JOIN lokasi l ON l.id_lokasi = b.id_lokasi
                    {$whereB}
                    GROUP BY UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA'))
                    ORDER BY kategori ASC";

                return ['sql' => $sql, 'bind' => $bindB];

            case 'kapasitas_produk':
                return $this->kapasitasProduk($lokArr);

            default:
                $sql = "SELECT
                    sg.id_stok, sg.id_produk,
                    COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)) AS nama_produk,
                    sg.id_barang_masuk,
                    SUM(sd.jumlah) AS qty_sisa,
                    {$satuan} AS satuan,
                    sd.best_before,
                    MAX(sg.status) AS status,
                    CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi_block
                    FROM stok_gudang_deep sd
                    JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header
                    JOIN deep d ON d.id_deep = sd.id_deep
                    JOIN level lv ON lv.id_level = d.id_level
                    JOIN line ln ON ln.id_line = lv.id_line
                    JOIN block b ON b.id_block = ln.id_block
                    LEFT JOIN produk p ON p.id_produk = sg.id_produk
                    WHERE sd.jumlah > 0 {$lokSgSd}
                    GROUP BY sg.id_stok, sg.id_produk,
                        COALESCE(p.nama_produk, CONCAT('Produk ', sg.id_produk)),
                        sg.id_barang_masuk,
                        {$satuan},
                        sd.best_before,
                        b.kode_block, ln.nomor_line
                    ORDER BY b.kode_block ASC, ln.nomor_line ASC, COALESCE(sd.best_before,'9999-12-31') ASC,
                        sg.id_barang_masuk ASC, sg.id_stok ASC";

                return ['sql' => $sql, 'bind' => $baseBind];
        }
    }

    private function kapasitasProduk(array $lokArr): array
    {
        $satuan = $this->satuanCaseP();

        $lokCount = count($lokArr);
        if ($lokCount === 1) {
            $wherePlp = ' AND plp.id_pengguna_lokasi = ?';
            $repeatBind = array_fill(0, 5, $lokArr[0]);
        } elseif ($lokCount > 1) {
            $ph = implode(',', array_fill(0, $lokCount, '?'));
            $wherePlp = " AND plp.id_pengguna_lokasi IN ($ph)";
            $repeatBind = [];
            for ($i = 0; $i < 5; $i++) {
                $repeatBind = array_merge($repeatBind, $lokArr);
            }
        } else {
            $wherePlp = '';
            $repeatBind = [];
        }

        $seg = "SELECT
            p.id_produk,
            COALESCE(p.nama_produk, CONCAT('Produk ', p.id_produk)) AS nama_produk,
            UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori_lokasi,
            {$satuan} AS satuan,
            COALESCE(d.kapasitas,0) AS kapasitas
            FROM prioritas_lokasi_produk plp
            INNER JOIN produk p ON p.id_produk = plp.id_produk
            INNER JOIN deep d ON d.id_deep = plp.id_deep
            INNER JOIN level lv ON lv.id_level = d.id_level
            INNER JOIN line ln ON ln.id_line = lv.id_line
            INNER JOIN block b ON b.id_block = ln.id_block
            INNER JOIN lokasi l ON l.id_lokasi = b.id_lokasi
            WHERE plp.id_deep IS NOT NULL{$wherePlp}";

        $seg2 = "SELECT
            p.id_produk,
            COALESCE(p.nama_produk, CONCAT('Produk ', p.id_produk)) AS nama_produk,
            UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori_lokasi,
            {$satuan} AS satuan,
            COALESCE(d.kapasitas,0) AS kapasitas
            FROM prioritas_lokasi_produk plp
            INNER JOIN produk p ON p.id_produk = plp.id_produk
            INNER JOIN deep d ON d.id_level = plp.id_level
            INNER JOIN level lv ON lv.id_level = d.id_level
            INNER JOIN line ln ON ln.id_line = lv.id_line
            INNER JOIN block b ON b.id_block = ln.id_block
            INNER JOIN lokasi l ON l.id_lokasi = b.id_lokasi
            WHERE plp.id_deep IS NULL AND plp.id_level IS NOT NULL{$wherePlp}";

        $seg3 = "SELECT
            p.id_produk,
            COALESCE(p.nama_produk, CONCAT('Produk ', p.id_produk)) AS nama_produk,
            UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori_lokasi,
            {$satuan} AS satuan,
            COALESCE(d.kapasitas,0) AS kapasitas
            FROM prioritas_lokasi_produk plp
            INNER JOIN produk p ON p.id_produk = plp.id_produk
            INNER JOIN level lv ON lv.id_line = plp.id_line
            INNER JOIN line ln ON ln.id_line = lv.id_line
            INNER JOIN block b ON b.id_block = ln.id_block
            INNER JOIN lokasi l ON l.id_lokasi = b.id_lokasi
            INNER JOIN deep d ON d.id_level = lv.id_level
            WHERE plp.id_deep IS NULL AND plp.id_level IS NULL AND plp.id_line IS NOT NULL{$wherePlp}";

        $seg4 = "SELECT
            p.id_produk,
            COALESCE(p.nama_produk, CONCAT('Produk ', p.id_produk)) AS nama_produk,
            UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori_lokasi,
            {$satuan} AS satuan,
            COALESCE(d.kapasitas,0) AS kapasitas
            FROM prioritas_lokasi_produk plp
            INNER JOIN produk p ON p.id_produk = plp.id_produk
            INNER JOIN block b ON b.id_block = plp.id_block
            INNER JOIN lokasi l ON l.id_lokasi = b.id_lokasi
            INNER JOIN line ln ON ln.id_block = b.id_block
            INNER JOIN level lv ON lv.id_line = ln.id_line
            INNER JOIN deep d ON d.id_level = lv.id_level
            WHERE plp.id_deep IS NULL AND plp.id_level IS NULL AND plp.id_line IS NULL AND plp.id_block IS NOT NULL{$wherePlp}";

        $seg5 = "SELECT
            p.id_produk,
            COALESCE(p.nama_produk, CONCAT('Produk ', p.id_produk)) AS nama_produk,
            UPPER(COALESCE(l.kategori, l.nama_lokasi, 'LAINNYA')) AS kategori_lokasi,
            {$satuan} AS satuan,
            COALESCE(d.kapasitas,0) AS kapasitas
            FROM prioritas_lokasi_produk plp
            INNER JOIN produk p ON p.id_produk = plp.id_produk
            INNER JOIN lokasi l ON l.id_lokasi = plp.id_lokasi
            INNER JOIN block b ON b.id_lokasi = l.id_lokasi
            INNER JOIN line ln ON ln.id_block = b.id_block
            INNER JOIN level lv ON lv.id_line = ln.id_line
            INNER JOIN deep d ON d.id_level = lv.id_level
            WHERE plp.id_deep IS NULL AND plp.id_level IS NULL AND plp.id_line IS NULL
                AND plp.id_block IS NULL AND plp.id_lokasi IS NOT NULL{$wherePlp}";

        $sql = "SELECT x.id_produk, x.nama_produk, x.kategori_lokasi, x.satuan, SUM(x.kapasitas) AS total_kapasitas
            FROM (
                {$seg}
                UNION ALL
                {$seg2}
                UNION ALL
                {$seg3}
                UNION ALL
                {$seg4}
                UNION ALL
                {$seg5}
            ) AS x
            GROUP BY x.id_produk, x.nama_produk, x.kategori_lokasi, x.satuan
            ORDER BY x.kategori_lokasi ASC, x.nama_produk ASC";

        return ['sql' => $sql, 'bind' => $repeatBind];
    }
}
