<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Api\Concerns\ExcelReader;
use App\Http\Controllers\Controller;
use App\Models\Deep;
use App\Models\Plant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Lokasi;
use App\Models\Produk;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class LayoutGudangController extends Controller
{
    use ApiResponse;
    use ExcelReader;

    public function ambilLayout(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));
        $idLokasi = (int) $request->query('id_lokasi', 0);
        $idBlock = (int) $request->query('id_block', 0);
        $idProduk = (int) $request->query('id_produk', 0);

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib', 400);
        }

        $q = DB::table('block as b')
            ->where('b.id_pengguna_lokasi', $idPenggunaLokasi)
            ->when($idLokasi > 0, fn ($qq) => $qq->where('b.id_lokasi', $idLokasi))
            ->when($idBlock > 0, fn ($qq) => $qq->where('b.id_block', $idBlock));

        $rows = $q
            ->leftJoin('line as ln', fn ($j) => $j
                ->on('ln.id_block', '=', 'b.id_block')
                ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi'))
            ->leftJoin('level as lv', fn ($j) => $j
                ->on('lv.id_line', '=', 'ln.id_line')
                ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
            ->leftJoin('deep as d', fn ($j) => $j
                ->on('d.id_level', '=', 'lv.id_level')
                ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang_deep as sd', fn ($j) => $j
                ->on('sd.id_deep', '=', 'd.id_deep')
                ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang as sh', fn ($j) => $j
                ->on('sh.id_stok', '=', 'sd.id_stok_header')
                ->on('sh.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi'))
            ->select(
                'b.id_block', 'b.id_lokasi', 'b.kode_block',
                'ln.id_line', 'ln.nomor_line',
                'lv.id_level', 'lv.level',
                'd.id_deep', 'd.deep', 'd.kapasitas'
            )
            ->selectRaw('MAX(CASE WHEN sd.jumlah > 0 THEN sd.id_stok_header END) AS id_stok_header')
            ->selectRaw("CONCAT(b.kode_block,' Line ',ln.nomor_line,' L',lv.level,' D',d.deep) AS alamat")
            ->selectRaw('MAX(CASE WHEN sd.jumlah > 0 THEN sh.id_produk END) AS id_produk_deep')
            ->selectRaw('COALESCE(SUM(sd.jumlah),0) AS terpakai_total')
            ->selectRaw('COALESCE(SUM(CASE WHEN sh.id_produk = ? THEN sd.jumlah ELSE 0 END),0) AS qty_produk', [$idProduk])
            ->selectRaw('MIN(CASE WHEN sd.jumlah > 0 THEN sh.best_before END) AS min_bb_deep')
            ->selectRaw('MIN(CASE WHEN sh.id_produk = ? AND sd.jumlah > 0 THEN sh.best_before END) AS min_bb_produk', [$idProduk])
            ->selectRaw('MAX(CASE WHEN sd.jumlah > 0 THEN sh.status END) AS status_deep')
            ->selectRaw('MIN(COALESCE(sd.batch, sh.batch)) AS batch_produk')
            ->groupBy('b.id_block', 'b.id_lokasi', 'b.kode_block', 'ln.id_line', 'ln.nomor_line', 'lv.id_level', 'lv.level', 'd.id_deep', 'd.deep', 'd.kapasitas')
            ->orderBy('b.kode_block')
            ->orderByRaw('COALESCE(ln.nomor_line, 0)')
            ->orderByRaw('COALESCE(lv.level, 0)')
            ->orderByRaw('COALESCE(d.deep, 0)')
            ->get();

        $produkLine = $this->ambilProdukLineMap($idPenggunaLokasi, $idLokasi, $idBlock);
        $bbLineMap = $this->ambilBbLineMap($idPenggunaLokasi, $idLokasi, $idBlock);
        $globalMinByProduct = $this->ambilGlobalMinBb($idPenggunaLokasi);

        $byBlock = [];
        foreach ($rows as $row) {
            $blockId = (int) $row->id_block;
            $lineId = (int) $row->id_line;
            $levelId = (int) $row->id_level;

            if (! isset($byBlock[$blockId])) {
                $byBlock[$blockId] = [
                    'id_block' => $blockId,
                    'id_lokasi' => (int) $row->id_lokasi,
                    'kode_block' => $row->kode_block,
                    'total_kapasitas' => 0,
                    'total_terpakai' => 0,
                    'line' => [],
                ];
            }

            if (is_null($row->id_line) || is_null($row->id_level) || is_null($row->id_deep)) {
                continue;
            }

            if (! isset($byBlock[$blockId]['line'][$lineId])) {
                $byBlock[$blockId]['line'][$lineId] = [
                    'id_line' => $lineId,
                    'nomor_line' => (int) $row->nomor_line,
                    'total_kapasitas' => 0,
                    'total_terpakai' => 0,
                    'id_produk' => 0,
                    'nama_produk' => '',
                    'level' => [],
                ];
            }

            if (! isset($byBlock[$blockId]['line'][$lineId]['level'][$levelId])) {
                $byBlock[$blockId]['line'][$lineId]['level'][$levelId] = [
                    'id_level' => $levelId,
                    'level' => (int) $row->level,
                    'total_kapasitas' => 0,
                    'total_terpakai' => 0,
                    'deep' => [],
                ];
            }

            $kap = (int) $row->kapasitas;
            $useTotal = (int) $row->terpakai_total;
            $qtyProduk = (int) $row->qty_produk;
            $minBbProd = $row->min_bb_produk;

            $byBlock[$blockId]['line'][$lineId]['level'][$levelId]['deep'][] = [
                'id_deep' => (int) $row->id_deep,
                'deep' => (int) $row->deep,
                'kapasitas' => $kap,
                'terpakai' => $useTotal,
                'qty_produk' => $qtyProduk,
                'alamat' => $row->alamat,
                'min_bb_prod' => $minBbProd,
                'min_bb_deep' => $row->min_bb_deep,
                'batch' => trim((string) ($row->batch_produk ?? '')),
                'batch_produk' => trim((string) ($row->batch_produk ?? '')),
                'id_produk' => (int) ($row->id_produk_deep ?? 0),
                'id_stok_header' => (int) ($row->id_stok_header ?? 0),
                'id_stok' => (int) ($row->id_stok_header ?? 0),
                'status' => 'blank',
                'status_deep' => (string) ($row->status_deep ?? 'normal'),
            ];

            $byBlock[$blockId]['total_kapasitas'] += $kap;
            $byBlock[$blockId]['total_terpakai'] += $useTotal;
            $byBlock[$blockId]['line'][$lineId]['total_kapasitas'] += $kap;
            $byBlock[$blockId]['line'][$lineId]['total_terpakai'] += $useTotal;
            $byBlock[$blockId]['line'][$lineId]['level'][$levelId]['total_kapasitas'] += $kap;
            $byBlock[$blockId]['line'][$lineId]['level'][$levelId]['total_terpakai'] += $useTotal;
        }

        $out = [];
        foreach ($byBlock as $block) {
            $isSpecialBlock = in_array(strtoupper(trim($block['kode_block'])), ['BS', 'BAD', 'BADSTOCK', 'REJECT']);
            $rows2 = [];

            foreach ($block['line'] as $lineId => $line) {
                $kProduk = $block['id_block'].':'.$lineId;

                if (isset($produkLine[$kProduk])) {
                    if (is_array($produkLine[$kProduk])) {
                        $line['id_produk'] = (int) ($produkLine[$kProduk]['id_produk'] ?? 0);
                        $line['nama_produk'] = $produkLine[$kProduk]['nama_produk'] ?? '';
                    } else {
                        $line['nama_produk'] = $produkLine[$kProduk];
                    }
                }

                $lineIdProduk = (int) ($line['id_produk'] ?? 0);
                $bbKey = $block['id_block'].':'.$lineId.':'.$lineIdProduk;
                $line['bb_line'] = ($lineIdProduk > 0 && isset($bbLineMap[$bbKey])) ? $bbLineMap[$bbKey] : [];

                $levels = [];
                foreach ($line['level'] as $level) {
                    foreach ($level['deep'] as &$deep) {
                        $terpakai = (int) $deep['terpakai'];
                        $pidDeep = (int) ($deep['id_produk'] ?? 0);
                        $bbProdDeep = $deep['min_bb_deep'];

                        $bbRef = ($pidDeep > 0 && isset($globalMinByProduct[$pidDeep]))
                            ? $globalMinByProduct[$pidDeep]
                            : null;

                        $bbFinal = null;

                        if ($terpakai > 0 && $pidDeep > 0) {
                            if (in_array($pidDeep, [10516938, 10516939], true)) {
                                $bbFinal = '9999-12-31';
                            } else {
                                $bbFinal = $bbProdDeep;
                            }
                        }

                        $deep['best_before'] = $bbFinal;
                        if (in_array($pidDeep, [10516938, 10516939], true)) {
                            $deep['batch'] = '-';
                            $deep['batch_produk'] = '-';
                        }

                        if (strtolower((string) ($deep['status_deep'] ?? 'normal')) === 'qi') {
                            $deep['status'] = 'qi';
                        } elseif ($isSpecialBlock) {
                            $kode = strtoupper(trim($block['kode_block']));
                            if ($kode === 'REJECT') {
                                $deep['status'] = 'reject';
                                $deep['best_before'] = '9999/99/99';
                                $deep['batch'] = '999999';
                                $deep['batch_produk'] = '999999';
                            } else {
                                $deep['status'] = 'badstok';
                            }
                        } elseif ($terpakai <= 0 || $pidDeep <= 0) {
                            $deep['status'] = 'blank';
                        } else {
                            if (in_array($pidDeep, [10516938, 10516939], true)) {
                                $deep['status'] = 'gallon';
                            } else {
                                if ($bbRef === null) {
                                    $deep['status'] = 'release';
                                } elseif ($bbProdDeep !== null && $bbProdDeep === $bbRef) {
                                    $deep['status'] = 'release';
                                } else {
                                    $deep['status'] = 'hold';
                                }
                            }
                        }

                        unset($deep['min_bb_prod']);
                        unset($deep['min_bb_deep']);
                    }
                    unset($deep);

                    $levels[] = $level;
                }

                $line['level'] = $levels;
                $rows2[] = $line;
            }

            $block['line'] = $rows2;
            $out[] = $block;
        }

        return response()->json(['success' => true, 'data' => $out, 'items' => $out, 'layout' => $out]);
    }

    private function ambilProdukLineMap(string $idPenggunaLokasi, int $idLokasi, int $idBlock): array
    {
        $q = DB::table('prioritas_lokasi_produk as pl')
            ->join('produk as pr', 'pr.id_produk', '=', 'pl.id_produk')
            ->join('block as b2', 'b2.id_block', '=', 'pl.id_block')
            ->whereNotNull('pl.id_line')
            ->where('b2.id_pengguna_lokasi', $idPenggunaLokasi)
            ->when($idLokasi > 0, fn ($qq) => $qq->where('b2.id_lokasi', $idLokasi))
            ->when($idBlock > 0, fn ($qq) => $qq->where('b2.id_block', $idBlock))
            ->select('pl.id_block', 'pl.id_line', 'pl.id_produk', 'pr.nama_produk')
            ->selectRaw('COUNT(*) AS cnt')
            ->groupBy('pl.id_block', 'pl.id_line', 'pl.id_produk', 'pr.nama_produk')
            ->get();

        $maxCnt = [];
        foreach ($q as $row) {
            $k = $row->id_block.':'.$row->id_line;
            $cnt = (int) $row->cnt;
            if (! isset($maxCnt[$k]) || $cnt > $maxCnt[$k]['cnt']) {
                $maxCnt[$k] = [
                    'cnt' => $cnt,
                    'id_produk' => (int) $row->id_produk,
                    'nama_produk' => $row->nama_produk,
                ];
            }
        }

        $produkLine = [];
        foreach ($maxCnt as $k => $v) {
            $produkLine[$k] = ['id_produk' => $v['id_produk'], 'nama_produk' => $v['nama_produk']];
        }

        $f = DB::table('block as b')
            ->join('line as ln', fn ($j) => $j
                ->on('ln.id_block', '=', 'b.id_block')
                ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_line', '=', 'ln.id_line')
                ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_level', '=', 'lv.id_level')
                ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang_deep as sd', fn ($j) => $j
                ->on('sd.id_deep', '=', 'd.id_deep')
                ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang as sh', fn ($j) => $j
                ->on('sh.id_stok', '=', 'sd.id_stok_header')
                ->on('sh.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi'))
            ->leftJoin('produk as pr', 'pr.id_produk', '=', 'sh.id_produk')
            ->where('b.id_pengguna_lokasi', $idPenggunaLokasi)
            ->when($idLokasi > 0, fn ($qq) => $qq->where('b.id_lokasi', $idLokasi))
            ->when($idBlock > 0, fn ($qq) => $qq->where('b.id_block', $idBlock))
            ->select('b.id_block', 'ln.id_line', 'sh.id_produk', 'pr.nama_produk')
            ->selectRaw('SUM(sd.jumlah) AS total_sisa')
            ->groupBy('b.id_block', 'ln.id_line', 'sh.id_produk', 'pr.nama_produk')
            ->havingRaw('COALESCE(SUM(sd.jumlah),0) > 0')
            ->get();

        $maxSisa = [];
        foreach ($f as $row) {
            $k = $row->id_block.':'.$row->id_line;
            $tot = (int) $row->total_sisa;
            if (! isset($maxSisa[$k]) || $tot > $maxSisa[$k]['total_sisa']) {
                $maxSisa[$k] = [
                    'total_sisa' => $tot,
                    'id_produk' => (int) ($row->id_produk ?? 0),
                    'nama_produk' => $row->nama_produk ?: '',
                ];
            }
        }

        foreach ($maxSisa as $k => $v) {
            if (empty($v['nama_produk'])) {
                continue;
            }

            $stokId = (int) $v['id_produk'];
            $stokNama = $v['nama_produk'];

            if (! isset($produkLine[$k])) {
                $produkLine[$k] = ['id_produk' => $stokId, 'nama_produk' => $stokNama];

                continue;
            }

            $ownerId = (int) ($produkLine[$k]['id_produk'] ?? 0);

            if ($stokId > 0 && $stokId !== $ownerId) {
                $produkLine[$k]['id_produk'] = $stokId;
                $produkLine[$k]['nama_produk'] = $stokNama;
            }
        }

        return $produkLine;
    }

    private function ambilBbLineMap(string $idPenggunaLokasi, int $idLokasi, int $idBlock): array
    {
        $q = DB::table('block as b')
            ->join('line as ln', fn ($j) => $j
                ->on('ln.id_block', '=', 'b.id_block')
                ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_line', '=', 'ln.id_line')
                ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_level', '=', 'lv.id_level')
                ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang_deep as sd', fn ($j) => $j
                ->on('sd.id_deep', '=', 'd.id_deep')
                ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang as sh', fn ($j) => $j
                ->on('sh.id_stok', '=', 'sd.id_stok_header')
                ->on('sh.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi'))
            ->where('b.id_pengguna_lokasi', $idPenggunaLokasi)
            ->when($idLokasi > 0, fn ($qq) => $qq->where('b.id_lokasi', $idLokasi))
            ->when($idBlock > 0, fn ($qq) => $qq->where('b.id_block', $idBlock))
            ->select('b.id_block', 'ln.id_line', 'sh.id_produk', 'sh.best_before')
            ->selectRaw('SUM(sd.jumlah) AS total_sisa')
            ->groupBy('b.id_block', 'ln.id_line', 'sh.id_produk', 'sh.best_before')
            ->havingRaw('COALESCE(SUM(sd.jumlah),0) > 0')
            ->get();

        $map = [];
        foreach ($q as $row) {
            $idBlock = (int) $row->id_block;
            $idLine = (int) $row->id_line;
            $idProduk = (int) ($row->id_produk ?? 0);
            $bb = $row->best_before;
            $total = (int) $row->total_sisa;

            if ($idBlock <= 0 || $idLine <= 0 || $idProduk <= 0 || empty($bb)) {
                continue;
            }

            $key = $idBlock.':'.$idLine.':'.$idProduk;
            $map[$key][] = ['best_before' => $bb, 'jumlah' => $total];
        }

        return $map;
    }

    private function ambilGlobalMinBb(string $idPenggunaLokasi): array
    {
        $q = DB::table('stok_gudang as sh')
            ->join('stok_gudang_deep as sd', fn ($j) => $j
                ->on('sd.id_stok_header', '=', 'sh.id_stok')
                ->on('sd.id_pengguna_lokasi', '=', 'sh.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_deep', '=', 'sd.id_deep')
                ->on('d.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_level', '=', 'd.id_level')
                ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->join('line as ln', fn ($j) => $j
                ->on('ln.id_line', '=', 'lv.id_line')
                ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi'))
            ->join('block as b', fn ($j) => $j
                ->on('b.id_block', '=', 'ln.id_block')
                ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
            ->where('sh.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sh.jumlah_sisa', '>', 0)
            ->where('sd.jumlah', '>', 0)
            ->whereNotIn(DB::raw('UPPER(TRIM(b.kode_block))'), ['BS', 'BAD', 'BADSTOCK', 'REJECT'])
            ->where('sh.status', '!=', 'qi')
            ->select('sh.id_produk')
            ->selectRaw('MIN(sh.best_before) AS bb')
            ->groupBy('sh.id_produk')
            ->get();

        $map = [];
        foreach ($q as $row) {
            $pid = (int) $row->id_produk;
            if ($pid > 0 && ! empty($row->bb)) {
                $map[$pid] = $row->bb;
            }
        }

        return $map;
    }

    public function ambilPlantLine(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));
        $idLine = (int) $request->query('id_line', 0);

        if ($idPenggunaLokasi === '' || $idLine <= 0) {
            return $this->fail('Parameter tidak lengkap');
        }

        $data = DB::table('stok_gudang_deep as sgd')
            ->join('stok_gudang as sg', fn ($j) => $j
                ->on('sg.id_stok', '=', 'sgd.id_stok_header')
                ->on('sg.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('barang_masuk as b', 'b.id_barang_masuk', '=', 'sg.id_barang_masuk')
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_deep', '=', 'sgd.id_deep')
                ->on('d.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_level', '=', 'd.id_level')
                ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->where('lv.id_line', $idLine)
            ->where('sgd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sgd.jumlah', '>', 0)
            ->whereNotNull(DB::raw("COALESCE(NULLIF(sg.batch, ''), NULLIF(b.batch_sekarang, ''), NULLIF(b.batch, ''))"))
            ->select('sgd.id_stok_header as id_stok')
            ->selectRaw("RIGHT(COALESCE(NULLIF(sg.batch, ''), NULLIF(b.batch_sekarang, ''), NULLIF(b.batch, '')), 4) AS id_plant")
            ->distinct()
            ->get()
            ->map(fn ($r) => ['id_stok' => (int) $r->id_stok, 'id_plant' => $r->id_plant]);

        return $this->ok($data);
    }

    public function cekLineLayout(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));
        $idLokasi = (int) $request->query('id_lokasi', 0);
        $kodeBlock = strtoupper(trim((string) $request->query('kode_block')));
        $lineDari = (int) $request->query('line_dari', 0);
        $lineSampai = (int) $request->query('line_sampai', 0);

        if ($idPenggunaLokasi === '') {
            return $this->fail('ID lokasi pengguna tidak ditemukan. Silakan login ulang.');
        }

        if ($idLokasi <= 0 || $kodeBlock === '' || $lineDari <= 0 || $lineSampai <= 0 || $lineSampai < $lineDari) {
            return response()->json(['success' => true, 'bentrok' => false, 'message' => '']);
        }

        $block = DB::table('block')
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('id_lokasi', $idLokasi)
            ->whereRaw('UPPER(kode_block) = ?', [$kodeBlock])
            ->first();

        if (! $block) {
            return response()->json(['success' => true, 'bentrok' => false, 'message' => '']);
        }

        $existing = DB::table('line')
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('id_block', $block->id_block)
            ->pluck('nomor_line')
            ->map(fn ($n) => (int) $n)
            ->all();

        $bentrok = [];
        for ($l = $lineDari; $l <= $lineSampai; $l++) {
            if (in_array($l, $existing, true)) {
                $bentrok[] = $l;
            }
        }

        if (! empty($bentrok)) {
            return response()->json([
                'success' => true,
                'bentrok' => true,
                'line_bentrok' => $bentrok,
                'message' => 'Line '.implode(', ', $bentrok).' sudah terpakai. Silakan pakai line lain.',
            ]);
        }

        return response()->json(['success' => true, 'bentrok' => false, 'message' => '']);
    }

    public function ambilRingkasanDeep(Request $request)
    {
        $idDeep = (int) $request->query('id_deep', 0);
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));

        if ($idDeep <= 0) {
            return $this->fail('id_deep wajib');
        }

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        $deep = Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereKey($idDeep)
            ->first();

        if (! $deep) {
            return $this->fail('Deep tidak ditemukan');
        }

        $kap = (int) $deep->kapasitas;

        $rows = DB::table('stok_gudang_deep as sgd')
            ->join('stok_gudang as sg', fn ($j) => $j
                ->on('sg.id_stok', '=', 'sgd.id_stok_header')
                ->on('sg.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('produk as p', 'p.id_produk', '=', 'sg.id_produk')
            ->leftJoin('barang_masuk as bm', fn ($j) => $j
                ->on('bm.id_barang_masuk', '=', 'sg.id_barang_masuk')
                ->on('bm.id_pengguna_lokasi', '=', 'sg.id_pengguna_lokasi'))
            ->where('sgd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sgd.id_deep', $idDeep)
            ->where('sgd.jumlah', '>', 0)
            ->where('sg.jumlah_sisa', '>', 0)
            ->orderBy('sgd.best_before')
            ->orderBy('sg.id_stok')
            ->select(
                'sg.id_stok',
                'sg.id_produk',
                'p.nama_produk',
                'sgd.jumlah',
                'sg.satuan',
                'sgd.best_before'
            )
            ->selectRaw("COALESCE(bm.batch, '') AS batch")
            ->get();

        $detail = [];
        $terisi = 0;
        $bb = null;
        foreach ($rows as $row) {
            $detail[] = (array) $row;
            $terisi += (int) $row->jumlah;
            if ($bb === null) {
                $bb = $row->best_before;
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data' => [
                'id_deep' => $idDeep,
                'id_pengguna_lokasi' => $idPenggunaLokasi,
                'kapasitas' => $kap,
                'terisi' => $terisi,
                'sisa' => max(0, $kap - $terisi),
                'best_before_terdekat' => $bb,
                'detail_stok' => $detail,
            ],
        ]);
    }

    public function cekKapasitasDeep(Request $request)
    {
        $idDeep = (int) $request->query('id_deep', 0);
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));

        if ($idDeep <= 0) {
            return $this->fail('id_deep wajib');
        }

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        $deep = Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereKey($idDeep)
            ->first();

        if (! $deep) {
            return $this->fail('Deep tidak ditemukan');
        }

        $kap = (int) $deep->kapasitas;

        $x = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as s', fn ($j) => $j
                ->on('s.id_stok', '=', 'sd.id_stok_header')
                ->on('s.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi'))
            ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sd.id_deep', $idDeep)
            ->where('sd.jumlah', '>', 0)
            ->where('s.jumlah_sisa', '>', 0)
            ->selectRaw('COALESCE(SUM(sd.jumlah),0) AS terisi, MIN(sd.best_before) AS bb')
            ->first();

        $terisi = (int) ($x->terisi ?? 0);
        $bb = $x->bb ?? null;

        return $this->ok([
            'id_pengguna_lokasi' => $idPenggunaLokasi,
            'id_deep' => $idDeep,
            'kapasitas' => $kap,
            'terisi' => $terisi,
            'sisa' => max(0, $kap - $terisi),
            'best_before_terdekat' => $bb,
        ]);
    }

    public function ubahPlantLine(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));
        $idStok = (int) $request->input('id_stok', 0);
        $namaPengguna = trim((string) $request->input('nama_pengguna'));
        $idProduk = (int) $request->input('id_produk', 0);
        $bestBefore = trim((string) $request->input('best_before'));
        $idPlantBaru = trim((string) $request->input('id_plant'));
        $catatanPerubahan = trim((string) $request->input('catatan_perubahan'));

        if ($idPenggunaLokasi === '' || $idStok <= 0 || $namaPengguna === ''
            || $idProduk <= 0 || $bestBefore === '' || $idPlantBaru === '') {
            return $this->fail('Parameter tidak lengkap');
        }

        if (! Plant::whereKey($idPlantBaru)->exists()) {
            return $this->fail('Plant tidak ditemukan');
        }

        $batchBaru = $this->buatBatchDariBbPlant($bestBefore, $idPlantBaru);
        if ($batchBaru === '') {
            return $this->fail('Gagal membuat batch baru');
        }

        try {
            return DB::transaction(function () use ($idPenggunaLokasi, $idStok, $idPlantBaru, $bestBefore, $batchBaru, $catatanPerubahan, $namaPengguna) {
                $rowBm = DB::table('stok_gudang')
                    ->where('id_stok', $idStok)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->lockForUpdate()
                    ->value('id_barang_masuk');

                if (! $rowBm) {
                    throw new \Exception('Data stok tidak ditemukan');
                }

                $idBm = (int) $rowBm;

                $rowBatch = DB::table('barang_masuk')
                    ->where('id_barang_masuk', $idBm)
                    ->lockForUpdate()
                    ->first();

                $batchLama = $rowBatch->batch_sekarang ?? $rowBatch->batch ?? '-';

                $catatan = $catatanPerubahan;
                if ($catatan === '') {
                    $catatan = "Batch $batchLama -> $batchBaru (Plant $idPlantBaru)";
                }

                DB::table('stok_gudang')
                    ->where('id_stok', $idStok)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->update(['batch' => $batchBaru, 'best_before' => $bestBefore]);

                DB::table('stok_gudang_deep')
                    ->where('id_stok_header', $idStok)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->update(['batch' => $batchBaru, 'best_before' => $bestBefore]);

                DB::table('barang_masuk')
                    ->where('id_barang_masuk', $idBm)
                    ->update(['batch_sekarang' => $batchBaru]);

                $auditCatatan = $catatan !== ''
                    ? $catatan
                    : "Plant berubah -> $idPlantBaru (batch $batchBaru)";

                DB::table('barang_masuk')
                    ->where('id_barang_masuk', $idBm)
                    ->update([
                        'diperbarui_pada' => now(),
                        'diperbarui_oleh' => $namaPengguna,
                        'catatan_perubahan' => $auditCatatan,
                    ]);

                return $this->okMessage("Plant berhasil diubah. Batch baru: $batchBaru");
            });
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage(), 500);
        }
    }

    public function prioritasLokasiProduk(Request $request)
    {
        $idProduk = (int) $request->input('id_produk', 0);
        if ($idProduk <= 0) {
            return $this->fail('id_produk wajib');
        }

        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof \Illuminate\Http\JsonResponse) {
            return $idPenggunaLokasi;
        }

        if (! DB::table('produk')->where('id_produk', $idProduk)->exists()) {
            return $this->fail('Produk tidak ditemukan');
        }

        $idLokasi = (int) $request->input('id_lokasi', 0);
        $idBlock = (int) $request->input('id_block', 0);
        $idLine = (int) $request->input('id_line', 0);
        $idLevel = (int) $request->input('id_level', 0);
        $idDeep = (int) $request->input('id_deep', 0);
        $lineDari = (int) $request->input('line_dari', 0);
        $lineSampai = (int) $request->input('line_sampai', 0);

        if ($lineDari > 0 && $lineSampai > 0 && $lineDari > $lineSampai) {
            $tmp = $lineDari;
            $lineDari = $lineSampai;
            $lineSampai = $tmp;
        }

        $hasRange = ($idLokasi > 0 && $idBlock > 0 && $lineDari > 0 && $lineSampai > 0);
        $hasSingle = ($idLokasi > 0 && $idBlock > 0 && $idLine > 0);
        $hasDeep = $idDeep > 0;
        $hasLevel = $idLevel > 0;

        if (! ($hasRange || $hasSingle || $hasDeep || $hasLevel)) {
            return $this->fail('Wajib: (id_lokasi,id_block,line_dari,line_sampai) ATAU (id_lokasi,id_block,id_line) ATAU id_deep ATAU id_level');
        }

        if ($hasDeep) {
            $loc = $this->lokasiDariDeep($idPenggunaLokasi, $idDeep);
            if (! $loc) {
                return $this->fail('id_deep tidak ditemukan');
            }

            $this->upsertPrioritas($idPenggunaLokasi, $idProduk, $loc, (int) $loc['id_deep']);

            return $this->ok([
                'mode' => 'DEEP',
                'id_produk' => $idProduk,
                'id_lokasi' => (int) $loc['id_lokasi'],
                'id_block' => (int) $loc['id_block'],
                'id_line' => (int) $loc['id_line'],
                'id_level' => (int) $loc['id_level'],
                'id_deep' => (int) $loc['id_deep'],
            ]);
        }

        if ($hasLevel) {
            $loc = $this->lokasiLevel($idLevel);
            if (! $loc) {
                return $this->fail('id_level tidak ditemukan');
            }

            DB::table('prioritas_lokasi_produk')->insertOrIgnore([
                'id_pengguna_lokasi' => $idPenggunaLokasi,
                'id_produk' => $idProduk,
                'id_lokasi' => (int) $loc['id_lokasi'],
                'id_block' => (int) $loc['id_block'],
                'id_line' => (int) $loc['id_line'],
                'id_level' => (int) $loc['id_level'],
                'id_deep' => 0,
            ]);

            return $this->ok([
                'mode' => 'LEVEL',
                'id_produk' => $idProduk,
                'id_lokasi' => (int) $loc['id_lokasi'],
                'id_block' => (int) $loc['id_block'],
                'id_line' => (int) $loc['id_line'],
                'id_level' => (int) $loc['id_level'],
            ]);
        }

        if ($hasRange) {
            $listLine = DB::table('line')
                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('id_block', $idBlock)
                ->whereBetween('nomor_line', [$lineDari, $lineSampai])
                ->orderBy('nomor_line')
                ->get(['id_line', 'nomor_line']);

            if ($listLine->isEmpty()) {
                return $this->fail('Range line tidak ditemukan pada block ini');
            }

            $countOk = 0;
            foreach ($listLine as $ln) {
                $ok = DB::table('prioritas_lokasi_produk')->insertOrIgnore([
                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                    'id_produk' => $idProduk,
                    'id_lokasi' => $idLokasi,
                    'id_block' => $idBlock,
                    'id_line' => (int) $ln->id_line,
                    'id_level' => 0,
                    'id_deep' => 0,
                ]);
                if ($ok) {
                    $countOk++;
                }
            }

            return $this->ok([
                'mode' => 'RANGE',
                'id_produk' => $idProduk,
                'id_lokasi' => $idLokasi,
                'id_block' => $idBlock,
                'line_dari' => $lineDari,
                'line_sampai' => $lineSampai,
                'total_line' => $listLine->count(),
                'insert_ok' => $countOk,
            ]);
        }

        if ($idLine <= 0) {
            return $this->fail('id_line wajib jika tidak menggunakan range');
        }

        $rowLine = DB::table('line as ln')
            ->join('block as b', fn ($j) => $j
                ->on('b.id_block', '=', 'ln.id_block')
                ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->where('b.id_block', $idBlock)
            ->where('b.id_lokasi', $idLokasi)
            ->select('ln.id_line', 'b.id_block', 'b.id_lokasi')
            ->first();

        if (! $rowLine) {
            return $this->fail('Line tidak valid untuk plant ini');
        }

        $resCek = DB::table('prioritas_lokasi_produk')
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('id_lokasi', $idLokasi)
            ->where('id_block', $idBlock)
            ->where('id_line', $idLine)
            ->whereNull('id_level')
            ->whereNull('id_deep')
            ->first();

        $produkLama = $resCek ? (int) $resCek->id_produk : 0;

        $totalSisa = (int) $this->totalSisaStok($idPenggunaLokasi, $idLine);

        if ($totalSisa > 0 && $produkLama > 0 && $produkLama !== $idProduk) {
            return $this->fail("Line ini masih memiliki stok (total: $totalSisa). Produk tidak boleh diganti sebelum stok habis.");
        }

        if ($resCek) {
            DB::table('prioritas_lokasi_produk')
                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('id_prioritas', (int) $resCek->id_prioritas)
                ->update(['id_produk' => $idProduk]);
        } else {
            DB::table('prioritas_lokasi_produk')->insert([
                'id_pengguna_lokasi' => $idPenggunaLokasi,
                'id_produk' => $idProduk,
                'id_lokasi' => $idLokasi,
                'id_block' => $idBlock,
                'id_line' => $idLine,
                'id_level' => null,
                'id_deep' => null,
            ]);
        }

        return $this->ok([
            'mode' => 'SINGLE',
            'id_produk' => $idProduk,
            'id_lokasi' => $idLokasi,
            'id_block' => $idBlock,
            'id_line' => $idLine,
            'level' => 'LINE',
        ]);
    }

    private function lokasiDeep(string $idPenggunaLokasi, int $idDeep): ?array
    {
        $row = DB::table('deep as d')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('d.id_deep', $idDeep)
            ->select('d.id_deep', 'lv.id_level', 'ln.id_line', 'b.id_block', 'b.id_lokasi')
            ->first();

        return $row ? (array) $row : null;
    }

    private function lokasiLevel(int $idLevel): ?array
    {
        $row = DB::table('level as lv')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->where('lv.id_level', $idLevel)
            ->select('lv.id_level', 'ln.id_line', 'b.id_block', 'b.id_lokasi')
            ->first();

        return $row ? (array) $row : null;
    }

    private function lokasiDariDeep(string $idPenggunaLokasi, int $idDeep): ?array
    {
        $row = DB::table('deep as d')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->where('d.id_deep', $idDeep)
            ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
            ->select('d.id_deep', 'lv.id_level', 'ln.id_line', 'b.id_block', 'b.id_lokasi')
            ->first();

        return $row ? (array) $row : null;
    }

    private function upsertPrioritas(string $idPenggunaLokasi, int $idProduk, array $loc, int $idDeep): void
    {
        DB::table('prioritas_lokasi_produk')->insertOrIgnore([
            'id_pengguna_lokasi' => $idPenggunaLokasi,
            'id_produk' => $idProduk,
            'id_lokasi' => (int) $loc['id_lokasi'],
            'id_block' => (int) $loc['id_block'],
            'id_line' => (int) $loc['id_line'],
            'id_level' => (int) $loc['id_level'],
            'id_deep' => $idDeep,
        ]);
    }

    private function totalSisaStok(string $idPenggunaLokasi, int $idLine): int
    {
        return (int) DB::table('line as ln')
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_line', '=', 'ln.id_line')
                ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_level', '=', 'lv.id_level')
                ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang_deep as sd', fn ($j) => $j
                ->on('sd.id_deep', '=', 'd.id_deep')
                ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang as sg', fn ($j) => $j
                ->on('sg.id_stok', '=', 'sd.id_stok_header')
                ->on('sg.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi'))
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->where(fn ($w) => $w->whereNull('sg.id_stok')->orWhere('sg.jumlah_sisa', '>', 0))
            ->sum('sd.jumlah');
    }

    public function salinBlock(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof \Illuminate\Http\JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idBlockSumber = (int) $request->input('id_block_sumber', 0);
        $kodeBlockBaru = strtoupper(trim((string) $request->input('kode_block_baru')));

        if ($idBlockSumber <= 0 || $kodeBlockBaru === '') {
            return $this->fail('id_block_sumber dan kode_block_baru wajib diisi');
        }

        try {
            return DB::transaction(function () use ($idPenggunaLokasi, $idBlockSumber, $kodeBlockBaru) {
                $blockSumber = DB::table('block')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_block', $idBlockSumber)
                    ->first();

                if (! $blockSumber) {
                    throw new \Exception('Block sumber tidak ditemukan pada lokasi aktif');
                }

                $idLokasiSumber = (int) $blockSumber->id_lokasi;

                if (DB::table('block')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_lokasi', $idLokasiSumber)
                    ->whereRaw('UPPER(kode_block) = ?', [$kodeBlockBaru])
                    ->exists()) {
                    throw new \RuntimeException('Kode block sudah digunakan di lokasi ini');
                }

                $idBlockBaru = DB::table('block')->insertGetId([
                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                    'id_lokasi' => $idLokasiSumber,
                    'kode_block' => $kodeBlockBaru,
                    'created_at' => now(),
                ]);

                $lines = DB::table('line')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_block', $idBlockSumber)
                    ->orderBy('nomor_line')
                    ->orderBy('id_line')
                    ->get();

                foreach ($lines as $line) {
                    $idLineBaru = DB::table('line')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_block' => $idBlockBaru,
                        'nomor_line' => (int) $line->nomor_line,
                        'created_at' => now(),
                    ]);

                    $levels = DB::table('level')
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->where('id_line', (int) $line->id_line)
                        ->orderBy('level')
                        ->orderBy('id_level')
                        ->get();

                    foreach ($levels as $level) {
                        $idLevelBaru = DB::table('level')->insertGetId([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_line' => $idLineBaru,
                            'level' => (int) $level->level,
                            'created_at' => now(),
                        ]);

                        DB::table('deep')->insert(
                            DB::table('deep')
                                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                                ->where('id_level', (int) $level->id_level)
                                ->orderBy('deep')
                                ->orderBy('id_deep')
                                ->get(['id_pengguna_lokasi', 'deep', 'kapasitas'])
                                ->map(function ($d) use ($idPenggunaLokasi, $idLevelBaru) {
                                    return [
                                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                                        'id_level' => $idLevelBaru,
                                        'deep' => (int) $d->deep,
                                        'kapasitas' => (int) $d->kapasitas,
                                        'created_at' => now(),
                                    ];
                                })->all()
                        );
                    }
                }

                return $this->okMessage('Block berhasil disalin', [
                    'id_block_baru' => $idBlockBaru,
                    'kode_block_baru' => $kodeBlockBaru,
                ]);
            });
        } catch (\Throwable $e) {
            return $this->fail($e instanceof \RuntimeException ? $e->getMessage() : 'Gagal menyalin block');
        }
    }

    public function simpanLayout(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof \Illuminate\Http\JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idLokasi = (int) $request->input('id_lokasi', 0);
        $idProduk = (int) $request->input('id_produk', 0);
        $kodeBlock = strtoupper(trim((string) $request->input('kode_block')));
        $kodeBlockType = strtoupper(trim((string) $request->input('kode_block_type')));

        if ($kodeBlock === '' && $kodeBlockType !== '') {
            $kodeBlock = $kodeBlockType;
        }

        if ($idLokasi <= 0 || $idProduk <= 0 || $kodeBlock === '') {
            return $this->fail('id_lokasi, id_produk & kode_block wajib');
        }

        if (! DB::table('produk')->where('id_produk', $idProduk)->exists()) {
            return $this->fail('Produk tidak ditemukan');
        }

        if (! DB::table('lokasi')->where('id_lokasi', $idLokasi)->exists()) {
            return $this->fail('Lokasi tidak ditemukan');
        }

        $lines = $request->input('lines', $request->input('layout_config', []));
        if (is_string($lines)) {
            $lines = json_decode($lines, true);
        }
        $lines = is_array($lines) ? $lines : [];

        if (empty($lines)) {
            return $this->fail('lines/layout_config wajib berisi minimal 1 line');
        }

        $normalized = [];

        foreach ($lines as $item) {
            if (! is_array($item)) {
                continue;
            }

            $nomor = (int) ($item['line'] ?? $item['nomor_line'] ?? 0);
            if ($nomor <= 0) {
                return $this->fail('Setiap line wajib memiliki nomor_line > 0');
            }

            $levels = $item['levels'] ?? [];
            if (empty($levels)) {
                return $this->fail("Line $nomor wajib memiliki minimal 1 level");
            }

            $cleanLevels = [];
            foreach ($levels as $lv) {
                $level = (int) ($lv['level'] ?? 0);
                $jumlahDeep = (int) ($lv['jumlah_deep'] ?? 0);
                $kapasitas = (int) ($lv['kapasitas'] ?? 0);

                if ($level <= 0 || $jumlahDeep <= 0 || $kapasitas <= 0) {
                    return $this->fail("Line $nomor: setiap level wajib level/jumlah_deep/kapasitas > 0");
                }

                $cleanLevels[] = ['level' => $level, 'jumlah_deep' => $jumlahDeep, 'kapasitas' => $kapasitas];
            }

            $normalized[] = ['nomor_line' => $nomor, 'levels' => $cleanLevels];
        }

        if (empty($normalized)) {
            return $this->fail('Tidak ada line valid untuk disimpan');
        }

        try {
            return DB::transaction(function () use ($idPenggunaLokasi, $idLokasi, $idProduk, $kodeBlock, $normalized) {
                $existingBlock = DB::table('block')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_lokasi', $idLokasi)
                    ->whereRaw('UPPER(kode_block) = ?', [$kodeBlock])
                    ->first();

                if ($existingBlock) {
                    $idBlock = (int) $existingBlock->id_block;
                    $lineDiminta = array_column($normalized, 'nomor_line');
                    $lineTerpakai = DB::table('line')
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->where('id_block', $idBlock)
                        ->pluck('nomor_line')
                        ->map(fn ($n) => (int) $n)
                        ->all();

                    $bentrok = array_values(array_intersect($lineDiminta, $lineTerpakai));
                    if (! empty($bentrok)) {
                        throw new \RuntimeException('Line '.implode(', ', $bentrok).' sudah terpakai. Silakan pakai line lain.');
                    }
                } else {
                    $idBlock = DB::table('block')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_lokasi' => $idLokasi,
                        'kode_block' => $kodeBlock,
                        'created_at' => now(),
                    ]);
                }

                $idLineByNomor = [];
                foreach ($normalized as $ln) {
                    $idLine = DB::table('line')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_block' => $idBlock,
                        'nomor_line' => $ln['nomor_line'],
                        'created_at' => now(),
                    ]);

                    foreach ($ln['levels'] as $lv) {
                        $idLevel = DB::table('level')->insertGetId([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_line' => $idLine,
                            'level' => $lv['level'],
                            'created_at' => now(),
                        ]);

                        $deeps = [];
                        for ($i = 1; $i <= $lv['jumlah_deep']; $i++) {
                            $deeps[] = [
                                'id_pengguna_lokasi' => $idPenggunaLokasi,
                                'id_level' => $idLevel,
                                'deep' => $i,
                                'kapasitas' => $lv['kapasitas'],
                                'created_at' => now(),
                            ];
                        }
                        DB::table('deep')->insert($deeps);
                    }

                    DB::table('prioritas_lokasi_produk')->insert([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_produk' => $idProduk,
                        'id_lokasi' => $idLokasi,
                        'id_block' => $idBlock,
                        'id_line' => $idLine,
                        'id_level' => null,
                        'id_deep' => null,
                        'created_at' => now(),
                    ]);

                    $idLineByNomor[$ln['nomor_line']] = $idLine;
                }

                return $this->okMessage('Layout gudang berhasil disimpan', [
                    'id_block' => $idBlock,
                    'kode_block' => $kodeBlock,
                    'id_lokasi' => $idLokasi,
                    'id_produk' => $idProduk,
                    'id_line_by_nomor' => $idLineByNomor,
                    'jumlah_line' => count($normalized),
                ]);
            });
        } catch (\Throwable $e) {
            return $this->fail($e instanceof \RuntimeException ? $e->getMessage() : 'Gagal menyimpan layout: '.$e->getMessage(), $e instanceof \RuntimeException ? 400 : 500);
        }
    }

    public function ubahBbJumlahLine(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));
        $idStok = (int) $request->input('id_stok', 0);
        $idLine = (int) $request->input('id_line', 0);
        $namaPengguna = trim((string) $request->input('nama_pengguna'));
        $qtyBaru = -1;
        if (($request->input('qty_baru') ?? '') !== '') {
            $qtyBaru = (int) $request->input('qty_baru');
        }
        $bestBeforeBaru = trim((string) $request->input('best_before_baru'));
        $catatanPerubahan = trim((string) $request->input('catatan_perubahan'));

        if ($idPenggunaLokasi === '' || $idStok <= 0 || $idLine <= 0) {
            return $this->fail('Parameter tidak lengkap');
        }

        if ($qtyBaru < 0 && $bestBeforeBaru === '' && $catatanPerubahan === '') {
            return $this->fail('Tidak ada perubahan yang dikirim');
        }

        try {
            return DB::transaction(function () use ($idPenggunaLokasi, $idStok, $idLine, $namaPengguna, $qtyBaru, $bestBeforeBaru, $catatanPerubahan) {
                $header = DB::table('stok_gudang')
                    ->where('id_stok', $idStok)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->lockForUpdate()
                    ->first();

                if (! $header) {
                    throw new \Exception('Data stok tidak ditemukan');
                }

                $bestBeforeLama = $header->best_before;
                $idProdukHeader = (int) $header->id_produk;
                $lokasiBlockLine = trim((string) ($header->lokasi_block ?? ''));

                $deepLine = [];
                $totalLamaLine = 0;
                $idStokHeadersTerlibat = [];
                $totalPerHeader = [];

                foreach ($this->detailStokLine($idPenggunaLokasi, $idLine, $idProdukHeader, $bestBeforeLama) as $row) {
                    $row['jumlah'] = (int) $row['jumlah'];
                    $idHeaderRow = (int) $row['id_stok_header'];

                    $totalLamaLine += $row['jumlah'];
                    $deepLine[] = $row;
                    $idStokHeadersTerlibat[$idHeaderRow] = true;
                    $totalPerHeader[$idHeaderRow] = ($totalPerHeader[$idHeaderRow] ?? 0) + $row['jumlah'];
                }

                $qtyPrimarySaatIni = (int) ($totalPerHeader[$idStok] ?? 0);
                $totalHeaderLain = $totalLamaLine - $qtyPrimarySaatIni;

                if (empty($deepLine)) {
                    throw new \Exception('Tidak ada stok di line ini untuk batch yang dipilih');
                }

                if ($qtyBaru >= 0) {
                    if ($qtyPrimarySaatIni > 0) {
                        $qtyBaru = $qtyBaru + $totalHeaderLain;
                    }

                    if ($qtyBaru === $totalLamaLine) {
                        // noop
                    } elseif ($qtyBaru < 0) {
                        throw new \Exception('Jumlah baru tidak boleh kurang dari 0');
                    } else {
                        $selisih = $qtyBaru - $totalLamaLine;

                        if ($selisih < 0) {
                            $harusDikurangi = -$selisih;
                            foreach ($deepLine as $deep) {
                                if ($harusDikurangi <= 0) {
                                    break;
                                }

                                $idDetail = (int) $deep['id_detail_stok'];
                                $stokDeep = (int) $deep['jumlah'];
                                if ($stokDeep <= 0) {
                                    continue;
                                }

                                $kurangi = min($stokDeep, $harusDikurangi);

                                DB::table('stok_gudang_deep')
                                    ->where('id_detail_stok', $idDetail)
                                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                                    ->update([
                                        'jumlah' => DB::raw('jumlah - '.$kurangi),
                                        'lokasi_block' => $lokasiBlockLine,
                                    ]);

                                $harusDikurangi -= $kurangi;
                            }

                            if ($harusDikurangi > 0) {
                                throw new \Exception('Stok di line tidak cukup untuk dikurangi');
                            }
                        }

                        if ($selisih > 0) {
                            $harusDitambah = $selisih;
                            $tujuanCap = DB::table('deep as d')
                                ->join('level as lv', fn ($j) => $j
                                    ->on('lv.id_level', '=', 'd.id_level')
                                    ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
                                ->leftJoin('stok_gudang_deep as sgd2', fn ($j) => $j
                                    ->on('sgd2.id_deep', '=', 'd.id_deep')
                                    ->on('sgd2.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
                                ->leftJoin('stok_gudang as sg2', fn ($j) => $j
                                    ->on('sg2.id_stok', '=', 'sgd2.id_stok_header')
                                    ->on('sg2.id_pengguna_lokasi', '=', 'sgd2.id_pengguna_lokasi'))
                                ->where('lv.id_line', $idLine)
                                ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                                ->select('d.id_deep', 'd.deep', 'lv.level', 'd.kapasitas')
                                ->selectRaw('COALESCE(SUM(sgd2.jumlah),0) AS terisi')
                                ->groupBy('d.id_deep', 'd.deep', 'lv.level', 'd.kapasitas')
                                ->orderBy('d.deep')
                                ->orderBy('lv.level')
                                ->get();

                            $tujuanDeep = [];
                            $totalKapasitasTersedia = 0;
                            foreach ($this->capTujuanTersedia($tujuanCap) as $row) {
                                $tujuanDeep[] = $row;
                                $totalKapasitasTersedia += (int) $row['sisa_kapasitas'];
                            }

                            if ($totalKapasitasTersedia < $harusDitambah) {
                                throw new \Exception('Kapasitas di line tidak cukup untuk jumlah baru');
                            }

                            if (empty($tujuanDeep)) {
                                throw new \Exception('Tidak ada deep yang masih memiliki kapasitas di line');
                            }

                            $existingByDeep = [];
                            foreach ($deepLine as $deep) {
                                $existingByDeep[(int) $deep['id_deep']] = [
                                    'id_detail_stok' => (int) $deep['id_detail_stok'],
                                    'jumlah' => (int) $deep['jumlah'],
                                ];
                            }

                            foreach ($tujuanDeep as $tujuan) {
                                if ($harusDitambah <= 0) {
                                    break;
                                }
                                $idDeepTujuan = (int) $tujuan['id_deep'];
                                $kapasitasSisa = (int) $tujuan['sisa_kapasitas'];
                                if ($kapasitasSisa <= 0) {
                                    continue;
                                }
                                $tambah = min($kapasitasSisa, $harusDitambah);
                                if ($tambah <= 0) {
                                    continue;
                                }

                                if (isset($existingByDeep[$idDeepTujuan])) {
                                    DB::table('stok_gudang_deep')
                                        ->where('id_detail_stok', $existingByDeep[$idDeepTujuan]['id_detail_stok'])
                                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                                        ->increment('jumlah', $tambah);
                                } else {
                                    $bbUtkDetail = $bestBeforeBaru !== '' ? $bestBeforeBaru : $bestBeforeLama;
                                    DB::table('stok_gudang_deep')->insert([
                                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                                        'id_stok_header' => $idStok,
                                        'id_deep' => $idDeepTujuan,
                                        'jumlah' => $tambah,
                                        'best_before' => $bbUtkDetail,
                                        'lokasi_block' => $lokasiBlockLine,
                                        'created_at' => now(),
                                    ]);
                                }

                                $harusDitambah -= $tambah;
                            }

                            if ($harusDitambah > 0) {
                                throw new \Exception('Penambahan stok belum terpenuhi sepenuhnya, proses dibatalkan');
                            }
                        }
                    }
                }

                if ($bestBeforeBaru !== '' && $bestBeforeBaru !== $bestBeforeLama) {
                    $dt = \DateTime::createFromFormat('Y-m-d', $bestBeforeBaru);
                    if (! $dt || $dt->format('Y-m-d') !== $bestBeforeBaru) {
                        throw new \Exception('Format tanggal best before tidak valid (gunakan YYYY-MM-DD)');
                    }

                    foreach (array_keys($idStokHeadersTerlibat) as $idStokHeader) {
                        DB::table('stok_gudang')
                            ->where('id_stok', $idStokHeader)
                            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                            ->update(['best_before' => $bestBeforeBaru]);

                        DB::table('stok_gudang_deep')
                            ->where('id_stok_header', $idStokHeader)
                            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                            ->update(['best_before' => $bestBeforeBaru]);
                    }

                    $idStokPertama = array_keys($idStokHeadersTerlibat)[0];
                    $rowGet = DB::table('stok_gudang_deep as sgd')
                        ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sgd.id_stok_header')
                        ->where('sgd.id_stok_header', $idStokPertama)
                        ->where('sgd.jumlah', '>', 0)
                        ->selectRaw('COALESCE(sgd.batch, sg.batch) AS batch')
                        ->first();

                    if ($rowGet && ! empty($rowGet->batch)) {
                        $plantSuffix = substr((string) $rowGet->batch, -4);
                        $batchBaru = $dt->format('ymd').$plantSuffix;

                        foreach (array_keys($idStokHeadersTerlibat) as $idStokH) {
                            DB::table('stok_gudang')
                                ->where('id_stok', $idStokH)
                                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                                ->update(['batch' => $batchBaru]);

                            DB::table('stok_gudang_deep')
                                ->where('id_stok_header', $idStokH)
                                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                                ->update(['batch' => $batchBaru]);
                        }

                        $idBmBatch = (int) $header->id_barang_masuk;
                        DB::table('barang_masuk')
                            ->where('id_barang_masuk', $idBmBatch)
                            ->update(['batch_sekarang' => $batchBaru]);
                    }
                }

                foreach (array_keys($idStokHeadersTerlibat) as $idStokHeader) {
                    $totalBaru = (int) DB::table('stok_gudang_deep')
                        ->where('id_stok_header', $idStokHeader)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->sum('jumlah');

                    DB::table('stok_gudang')
                        ->where('id_stok', $idStokHeader)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->update(['jumlah_sisa' => $totalBaru]);
                }

                if ($catatanPerubahan !== '' || $bestBeforeBaru !== '' || $qtyBaru >= 0) {
                    $auditCatatan = $catatanPerubahan !== '' ? $catatanPerubahan : 'BB/jumlah diubah';
                    $idBm = (int) $header->id_barang_masuk;
                    DB::table('barang_masuk')
                        ->where('id_barang_masuk', $idBm)
                        ->update([
                            'diperbarui_pada' => now(),
                            'diperbarui_oleh' => $namaPengguna !== '' ? $namaPengguna : null,
                            'catatan_perubahan' => $auditCatatan,
                        ]);
                }

                return $this->okMessage('Berhasil mengubah best before / jumlah di line');
            });
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage() ?: 'Terjadi kesalahan');
        }
    }

    private function detailStokLine(string $idPenggunaLokasi, int $idLine, int $idProduk, ?string $bb): array
    {
        $rows = DB::table('stok_gudang_deep as sgd')
            ->join('stok_gudang as sg', fn ($j) => $j
                ->on('sg.id_stok', '=', 'sgd.id_stok_header')
                ->on('sg.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_deep', '=', 'sgd.id_deep')
                ->on('d.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_level', '=', 'd.id_level')
                ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->where('lv.id_line', $idLine)
            ->where('sg.id_produk', $idProduk)
            ->where('sg.best_before', $bb)
            ->where('sg.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sgd.jumlah', '>=', 0)
            ->orderByDesc('d.deep')
            ->orderByDesc('lv.level')
            ->orderBy('sgd.id_detail_stok')
            ->select('sgd.id_detail_stok', 'sgd.id_stok_header', 'sgd.id_deep', 'sgd.jumlah')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->all();

        return $rows;
    }

    private function capTujuanTersedia($rows): array
    {
        $cap = [];
        foreach ($rows as $row) {
            $sisa = (int) $row->kapasitas - (int) $row->terisi;
            if ($sisa > 0) {
                $cap[] = ['id_deep' => (int) $row->id_deep, 'sisa_kapasitas' => $sisa];
            }
        }

        return $cap;
    }

    private function buatBatchDariBbPlant(string $bestBefore, string $idPlant): string
    {
        $bb = trim($bestBefore);
        $plant = trim($idPlant);

        if ($bb === '' || $plant === '') {
            return '';
        }

        $dt = \DateTime::createFromFormat('Y-m-d', $bb);
        if (! $dt) {
            return '';
        }

        return $dt->format('ymd').strtoupper($plant);
    }

    public function transferStokLine(Request $request)
    {
        if ($request->method() !== 'POST') {
            return $this->fail('Metode harus POST');
        }

        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));
        $idStok = (int) $request->input('id_stok', 0);
        $idLineAsal = (int) $request->input('id_line_asal', 0);
        $idLineTujuan = (int) $request->input('id_line_tujuan', 0);
        $qtyPindah = (int) $request->input('qty', 0);
        $idPengguna = (int) $request->input('id_pengguna', 0);
        $catatan = trim((string) $request->input('catatan'));
        $bestBeforeReq = trim((string) $request->input('best_before'));

        if ($idPenggunaLokasi === '' || $idStok <= 0 || $idLineAsal <= 0
            || $idLineTujuan <= 0 || $qtyPindah <= 0 || $idPengguna <= 0) {
            return $this->fail('Parameter transfer belum lengkap');
        }

        if ($idLineAsal === $idLineTujuan) {
            return $this->fail('Line asal dan line tujuan tidak boleh sama');
        }

        $lineAsalInfo = $this->transferLineInfo($idPenggunaLokasi, $idLineAsal);
        $lineTujuanInfo = $this->transferLineInfo($idPenggunaLokasi, $idLineTujuan);

        if (! $lineAsalInfo || ! $lineTujuanInfo) {
            return $this->fail('Line asal atau line tujuan tidak ditemukan');
        }

        $targetText = strtolower(trim(($lineTujuanInfo['kategori'] ?? '').' '.($lineTujuanInfo['kode_block'] ?? '')));
        $isSpecialTarget = strpos($targetText, 'bad') !== false || strpos($targetText, 'reject') !== false;
        $isRejectTarget = strpos($targetText, 'reject') !== false;

        if ($this->isGallonSpsBlocked($lineAsalInfo, $lineTujuanInfo)) {
            return $this->fail('GALLON dan SPS tidak bisa saling transfer.');
        }

        try {
            return DB::transaction(function () use (
                $idPenggunaLokasi, $idStok, $idLineAsal, $idLineTujuan,
                $qtyPindah, $bestBeforeReq, $isRejectTarget, $isSpecialTarget
            ) {
                $stokHeader = DB::table('stok_gudang')
                    ->where('id_stok', $idStok)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->lockForUpdate()
                    ->first();

                if (! $stokHeader) {
                    throw new \Exception('Data stok acuan tidak ditemukan');
                }

                $idProduk = (int) $stokHeader->id_produk;
                $namaProduk = trim((string) ($stokHeader->nama_produk ?? ''));
                $idBarangMasuk = (int) ($stokHeader->id_barang_masuk ?? 0);
                $satuan = $stokHeader->satuan;
                $lokasiBlockAwal = $stokHeader->lokasi_block;
                $batch = $stokHeader->batch;

                $bestBefore = $bestBeforeReq !== ''
                    ? $bestBeforeReq
                    : trim((string) ($stokHeader->best_before ?? ''));

                if ($bestBefore === '') {
                    throw new \Exception('Best before untuk stok yang dipilih tidak ditemukan');
                }

                $isiPerPcs = 1;
                $isi = DB::table('produk')->where('id_produk', $idProduk)->value('isi_per_pcs');
                if ((int) $isi > 0) {
                    $isiPerPcs = (int) $isi;
                }

                // Hanya item non-GALLON yang dikonversi ke PCS saat masuk reject.
                // GALLON tetap dalam satuan asli (GALLON), tidak dipecah ke PCS.
                $isGallon = strtoupper((string) $satuan) === 'GALLON';
                $convertToPcs = $isRejectTarget && ! $isGallon;
                $multiplier = $convertToPcs ? $isiPerPcs : 1;
                $satuanTujuan = $convertToPcs ? 'PCS' : $satuan;

                $lok = DB::table('line as ln')
                    ->join('block as b', fn ($j) => $j
                        ->on('b.id_block', '=', 'ln.id_block')
                        ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
                    ->where('ln.id_line', $idLineTujuan)
                    ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->select('b.kode_block', 'ln.nomor_line')
                    ->first();

                if (! $lok) {
                    throw new \Exception('Line tujuan tidak ditemukan pada lokasi aktif');
                }

                $lokasiBlockTujuan = $lok->kode_block.'-'.(int) $lok->nomor_line;

                $produkAktifTujuan = [];
                foreach ($this->produkAktifLine($idPenggunaLokasi, $idLineTujuan) as $pid => $qty) {
                    $produkAktifTujuan[$pid] = $qty;
                }

                if (! empty($produkAktifTujuan) && ! $isSpecialTarget) {
                    $semuaSama = count(array_diff(array_keys($produkAktifTujuan), [$idProduk])) === 0;
                    if (! $semuaSama) {
                        throw new \Exception('Transfer ditolak karena line tujuan masih berisi produk lain.');
                    }
                }

                if (! $isSpecialTarget) {
                    $bbTertuaTujuan = trim((string) ($this->bbTuaTujuan($idPenggunaLokasi, $idLineTujuan, $idProduk) ?? ''));
                    if ($bbTertuaTujuan !== '' && $bestBefore > $bbTertuaTujuan) {
                        throw new \Exception('Transfer ditolak, BB Hold tidak boleh menimpa BB Release');
                    }
                }

                $headerTujuan = DB::table('stok_gudang')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_produk', $idProduk)
                    ->where('best_before', $bestBefore)
                    ->where('lokasi_block', $lokasiBlockTujuan)
                    ->lockForUpdate()
                    ->first();

                if ($headerTujuan) {
                    $idStokTujuan = (int) $headerTujuan->id_stok;
                } else {
                    $idStokTujuan = DB::table('stok_gudang')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_produk' => $idProduk,
                        'nama_produk' => $namaProduk,
                        'id_barang_masuk' => $idBarangMasuk,
                        'jumlah_sisa' => 0,
                        'satuan' => $satuanTujuan,
                        'best_before' => $bestBefore,
                        'lokasi_block' => $lokasiBlockTujuan,
                        'status' => trim((string) ($stokHeader->status ?? 'normal')) === '' ? 'normal' : $stokHeader->status,
                        'batch' => $batch,
                        'created_at' => now(),
                    ]);
                }

                $sumberDeep = [];
                $totalSumber = 0;
                foreach ($this->sumberDeepLine($idPenggunaLokasi, $idLineAsal, $idProduk, $bestBefore) as $row) {
                    $row['jumlah'] = (int) $row['jumlah'];
                    $row['sisa'] = $row['jumlah'];
                    $row['id_stok_header'] = (int) $row['id_stok_header'];
                    $totalSumber += $row['jumlah'];
                    $sumberDeep[] = $row;
                }

                if ($totalSumber <= 0) {
                    throw new \Exception('Stok dengan best before yang dipilih tidak ditemukan pada line asal');
                }

                if ($qtyPindah > $totalSumber) {
                    throw new \Exception('Jumlah yang ingin dipindah melebihi stok tersedia untuk best before yang dipilih');
                }

                $tujuanDeep = [];
                $totalKapasitasTersediaBox = 0;
                foreach ($this->kapasitasDeepTujuan($idPenggunaLokasi, $idLineTujuan, $bestBefore) as $row) {
                    $kapasitas = (int) $row['kapasitas'];
                    $terisi = (int) $row['terisi'];
                    $terisiBbSama = (int) $row['terisi_bb_sama'];
                    $terisiBbLain = (int) $row['terisi_bb_lain'];
                    $sisa = $kapasitas - $terisi;

                    if ($terisiBbLain > 0 && ! $isSpecialTarget) {
                        continue;
                    }

                    if ($sisa > 0) {
                        $maxBox = (int) floor($sisa / $multiplier);
                        if ($maxBox > 0) {
                            $row['sisa_kapasitas'] = $sisa;
                            $tujuanDeep[] = $row;
                            $totalKapasitasTersediaBox += $maxBox;
                        }
                    }
                }

                if ($totalKapasitasTersediaBox < $qtyPindah) {
                    $msgTbh = $multiplier > 1 ? " (Konversi: 1 BOX = $multiplier PCS)" : '';
                    throw new \Exception("Kapasitas line tujuan tidak mencukupi untuk jumlah yang ingin dipindahkan$msgTbh");
                }

                $qtySisaBox = $qtyPindah;
                $indexSumber = 0;
                $jumlahSumber = count($sumberDeep);

                foreach ($tujuanDeep as $tujuan) {
                    if ($qtySisaBox <= 0) {
                        break;
                    }

                    $idDeepTujuan = (int) $tujuan['id_deep'];
                    $kapasitasSisa = (int) $tujuan['sisa_kapasitas'];

                    while ($kapasitasSisa > 0 && $qtySisaBox > 0 && $indexSumber < $jumlahSumber) {
                        while ($indexSumber < $jumlahSumber && isset($sumberDeep[$indexSumber]) && $sumberDeep[$indexSumber]['sisa'] <= 0) {
                            $indexSumber++;
                        }

                        if ($indexSumber >= $jumlahSumber || ! isset($sumberDeep[$indexSumber])) {
                            break;
                        }

                        $sumber = &$sumberDeep[$indexSumber];

                        $maxBoxKapasitas = (int) floor($kapasitasSisa / $multiplier);
                        $bisaPindahBox = min($sumber['sisa'], $maxBoxKapasitas, $qtySisaBox);

                        if ($bisaPindahBox <= 0) {
                            break;
                        }

                        $bisaPindahTujuan = $bisaPindahBox * $multiplier;

                        $idDetailSumber = (int) $sumber['id_detail_stok'];
                        $idDeepSumber = (int) $sumber['id_deep'];
                        $idStokHeaderSumber = (int) $sumber['id_stok_header'];
                        $jumlahBaruSumber = $sumber['sisa'] - $bisaPindahBox;

                        DB::table('stok_gudang_deep')
                            ->where('id_detail_stok', $idDetailSumber)
                            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                            ->decrement('jumlah', $bisaPindahBox);

                        $sumber['sisa'] = $jumlahBaruSumber;

                        $rowTujuan = DB::table('stok_gudang_deep')
                            ->where('id_stok_header', $idStokTujuan)
                            ->where('id_deep', $idDeepTujuan)
                            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                            ->first();

                        if ($rowTujuan) {
                            DB::table('stok_gudang_deep')
                                ->where('id_detail_stok', $rowTujuan->id_detail_stok)
                                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                                ->update([
                                    'jumlah' => DB::raw('jumlah + '.$bisaPindahTujuan),
                                    'lokasi_block' => $lokasiBlockTujuan,
                                ]);
                        } else {
                            $batchDeep = $sumber['batch'] ?? $batch;
                            DB::table('stok_gudang_deep')->insert([
                                'id_pengguna_lokasi' => $idPenggunaLokasi,
                                'id_stok_header' => $idStokTujuan,
                                'id_deep' => $idDeepTujuan,
                                'jumlah' => $bisaPindahTujuan,
                                'best_before' => $bestBefore,
                                'lokasi_block' => $lokasiBlockTujuan,
                                'batch' => $batchDeep,
                                'created_at' => now(),
                            ]);
                        }

                        $qtySisaBox -= $bisaPindahBox;
                        $kapasitasSisa -= $bisaPindahTujuan;
                    }
                }

                if ($qtySisaBox > 0) {
                    throw new \Exception('Transfer belum terpenuhi sepenuhnya, proses dibatalkan');
                }

                $headerAsalIds = [];
                foreach ($sumberDeep as $src) {
                    $headerAsalIds[(int) $src['id_stok_header']] = (int) $src['id_stok_header'];
                }

                DB::table('stok_gudang_deep')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereIn('id_stok_header', array_keys($headerAsalIds))
                    ->where('jumlah', '<=', 0)
                    ->delete();

                DB::table('stok_gudang_deep')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_stok_header', $idStokTujuan)
                    ->where('jumlah', '<=', 0)
                    ->delete();

                foreach ($headerAsalIds as $idHeaderAsal) {
                    $total = (int) DB::table('stok_gudang_deep')
                        ->where('id_stok_header', $idHeaderAsal)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->sum('jumlah');

                    DB::table('stok_gudang')
                        ->where('id_stok', $idHeaderAsal)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->update(['jumlah_sisa' => $total]);
                }

                $totalTujuan = (int) DB::table('stok_gudang_deep')
                    ->where('id_stok_header', $idStokTujuan)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->sum('jumlah');

                DB::table('stok_gudang')
                    ->where('id_stok', $idStokTujuan)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->update([
                        'jumlah_sisa' => $totalTujuan,
                        'lokasi_block' => $lokasiBlockTujuan,
                        'satuan' => $satuanTujuan,
                    ]);

                return $this->okMessage(
                    'Berhasil transfer stok antar line. '.($multiplier > 1 ? '(Dikonversi otomatis ke PCS)' : '')
                );
            });
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage() ?: 'Terjadi kesalahan');
        }
    }

    private function transferLineInfo(string $idPenggunaLokasi, int $idLine): ?array
    {
        $row = DB::table('line as ln')
            ->join('block as b', fn ($j) => $j
                ->on('b.id_block', '=', 'ln.id_block')
                ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi'))
            ->leftJoin('lokasi as lks', 'lks.id_lokasi', '=', 'b.id_lokasi')
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->select('ln.id_line', 'ln.nomor_line', 'b.id_block', 'b.kode_block', 'b.id_lokasi', 'lks.nama_lokasi', 'lks.kategori')
            ->first();

        return $row ? (array) $row : null;
    }

    private function isGallonSpsBlocked(?array $asal, ?array $tujuan): bool
    {
        $a = $this->normalizeTransferLabel($asal);
        $b = $this->normalizeTransferLabel($tujuan);

        return ($a === 'GALLON' && $b === 'SPS') || ($a === 'SPS' && $b === 'GALLON');
    }

    private function normalizeTransferLabel(?array $row): string
    {
        $label = '';
        if (is_array($row)) {
            $kategori = trim((string) ($row['kategori'] ?? ''));
            $nama = trim((string) ($row['nama_lokasi'] ?? ''));
            $label = $kategori !== '' ? $kategori : $nama;
        }

        $label = strtoupper(trim($label));

        if (strpos($label, 'GALLON') !== false) {
            return 'GALLON';
        }

        if (strpos($label, 'SPS') !== false) {
            return 'SPS';
        }

        return $label;
    }

    private function produkAktifLine(string $idPenggunaLokasi, int $idLine): array
    {
        $rows = DB::table('stok_gudang as sg')
            ->join('stok_gudang_deep as sgd', fn ($j) => $j
                ->on('sgd.id_stok_header', '=', 'sg.id_stok')
                ->on('sgd.id_pengguna_lokasi', '=', 'sg.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_deep', '=', 'sgd.id_deep')
                ->on('d.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_level', '=', 'd.id_level')
                ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->where('lv.id_line', $idLine)
            ->where('sg.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sgd.jumlah', '>', 0)
            ->select('sg.id_produk')
            ->selectRaw('SUM(sgd.jumlah) AS total')
            ->groupBy('sg.id_produk')
            ->get();

        $map = [];
        foreach ($rows as $r) {
            $pid = (int) $r->id_produk;
            $qty = (int) $r->total;
            if ($pid > 0 && $qty > 0) {
                $map[$pid] = $qty;
            }
        }

        return $map;
    }

    private function kapasitasDeepTujuan(string $idPenggunaLokasi, int $idLineTujuan, string $bb): array
    {
        return DB::table('deep as d')
            ->join('level as lv', fn ($j) => $j
                ->on('d.id_level', '=', 'lv.id_level')
                ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang_deep as sgd2', fn ($j) => $j
                ->on('d.id_deep', '=', 'sgd2.id_deep')
                ->on('sgd2.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->leftJoin('stok_gudang as sg2', fn ($j) => $j
                ->on('sg2.id_stok', '=', 'sgd2.id_stok_header')
                ->on('sg2.id_pengguna_lokasi', '=', 'sgd2.id_pengguna_lokasi'))
            ->where('lv.id_line', $idLineTujuan)
            ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
            ->select('d.id_deep', 'd.deep', 'lv.level', 'd.kapasitas')
            ->selectRaw('COALESCE(SUM(sgd2.jumlah),0) AS terisi')
            ->selectRaw('COALESCE(SUM(CASE WHEN sgd2.best_before = ? THEN sgd2.jumlah ELSE 0 END),0) AS terisi_bb_sama', [$bb])
            ->selectRaw('COALESCE(SUM(CASE WHEN sgd2.best_before IS NOT NULL AND sgd2.best_before <> ? THEN sgd2.jumlah ELSE 0 END),0) AS terisi_bb_lain', [$bb])
            ->groupBy('d.id_deep', 'd.deep', 'lv.level', 'd.kapasitas')
            ->orderBy('d.deep')
            ->orderBy('lv.level')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->all();
    }

    private function bbTuaTujuan(string $idPenggunaLokasi, int $idLine, int $idProduk): ?string
    {
        return DB::table('stok_gudang as sg')
            ->join('stok_gudang_deep as sgd', fn ($j) => $j
                ->on('sgd.id_stok_header', '=', 'sg.id_stok')
                ->on('sgd.id_pengguna_lokasi', '=', 'sg.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('d.id_deep', '=', 'sgd.id_deep')
                ->on('d.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('lv.id_level', '=', 'd.id_level')
                ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->where('lv.id_line', $idLine)
            ->where('sg.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sg.id_produk', $idProduk)
            ->where('sgd.jumlah', '>', 0)
            ->whereNotNull('sgd.best_before')
            ->min('sgd.best_before');
    }

    private function sumberDeepLine(string $idPenggunaLokasi, int $idLineAsal, int $idProduk, string $bb): array
    {
        return DB::table('stok_gudang_deep as sgd')
            ->join('stok_gudang as sg', fn ($j) => $j
                ->on('sg.id_stok', '=', 'sgd.id_stok_header')
                ->on('sg.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('deep as d', fn ($j) => $j
                ->on('sgd.id_deep', '=', 'd.id_deep')
                ->on('d.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('d.id_level', '=', 'lv.id_level')
                ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->where('lv.id_line', $idLineAsal)
            ->where('sg.id_produk', $idProduk)
            ->where('sgd.best_before', $bb)
            ->where('sg.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sgd.jumlah', '>', 0)
            ->orderByDesc('d.deep')
            ->orderByDesc('lv.level')
            ->orderBy('sg.created_at')
            ->orderBy('sg.id_stok')
            ->orderBy('sgd.id_detail_stok')
            ->select('sgd.id_detail_stok', 'sgd.id_stok_header', 'sgd.id_deep', 'sgd.jumlah', 'sgd.batch', 'd.deep', 'lv.level')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->all();
    }
    public function downloadTemplate()
    {
        // 1. Ambil data dari database
        $lokasiList = Lokasi::pluck('nama_lokasi')->toArray();
        $produkList = Produk::selectRaw("CONCAT(id_produk, ' - ', nama_produk) as label_produk")->pluck('label_produk')->toArray();

        $spreadsheet = new Spreadsheet();

        // ---------------------------------------------------------
        // SHEET 1: TEMPLATE UTAMA
        // ---------------------------------------------------------
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Template');

        // Set Header
        $headers = ['kode_block', 'nama_lokasi', 'nama_produk', 'nomor_line', 'level', 'jumlah_deep', 'jumlah_kapasitas'];
        $sheet->fromArray($headers, NULL, 'A1');

        // Styling Header (Background Biru Gelap, Teks Putih, Bold)
        $headerStyle = $sheet->getStyle('A1:G1');
        $headerStyle->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
        $headerStyle->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF191970');

        // ---------------------------------------------------------
        // SHEET 2: DATA REFERENSI DROPDOWN (Disembunyikan)
        // ---------------------------------------------------------
        $dataSheet = $spreadsheet->createSheet();
        $dataSheet->setTitle('DataRef');

        // Isi Kolom A dengan Lokasi
        foreach ($lokasiList as $index => $lokasi) {
            $dataSheet->setCellValue('A' . ($index + 1), $lokasi);
        }
        
        // Isi Kolom B dengan Produk
        foreach ($produkList as $index => $produk) {
            $dataSheet->setCellValue('B' . ($index + 1), $produk);
        }

        // Sembunyikan Sheet DataRef agar rapi
        $dataSheet->setSheetState(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet::SHEETSTATE_HIDDEN);

        // ---------------------------------------------------------
        // APLIKASIKAN DROPDOWN (DATA VALIDATION) KE SHEET TEMPLATE
        // ---------------------------------------------------------
        $lokasiRowCount = count($lokasiList);
        $produkRowCount = count($produkList);

        // Pasang dropdown sampai baris ke-500 (bisa disesuaikan)
        for ($row = 2; $row <= 500; $row++) {
            // Dropdown Lokasi (Kolom B)
            if ($lokasiRowCount > 0) {
                $validation = $sheet->getCell('B' . $row)->getDataValidation();
                $validation->setType(DataValidation::TYPE_LIST);
                $validation->setErrorStyle(DataValidation::STYLE_STOP);
                $validation->setAllowBlank(true);
                $validation->setShowDropDown(true);
                $validation->setErrorTitle('Input Error');
                $validation->setError('Lokasi tidak valid. Silakan pilih dari dropdown.');
                // Mengambil referensi range dari Sheet DataRef
                $validation->setFormula1('DataRef!$A$1:$A$' . $lokasiRowCount);
            }

            // Dropdown Produk (Kolom C)
            if ($produkRowCount > 0) {
                $validation = $sheet->getCell('C' . $row)->getDataValidation();
                $validation->setType(DataValidation::TYPE_LIST);
                $validation->setErrorStyle(DataValidation::STYLE_STOP);
                $validation->setAllowBlank(true);
                $validation->setShowDropDown(true);
                $validation->setErrorTitle('Input Error');
                $validation->setError('Produk tidak valid. Silakan pilih dari dropdown.');
                // Mengambil referensi range dari Sheet DataRef
                $validation->setFormula1('DataRef!$B$1:$B$' . $produkRowCount);
            }
        }

        // Auto-size lebar kolom agar rapi
        foreach (range('A', 'G') as $columnID) {
            $sheet->getColumnDimension($columnID)->setAutoSize(true);
        }

        // Aktifkan kembali Sheet 1 saat file dibuka
        $spreadsheet->setActiveSheetIndex(0);

        // ---------------------------------------------------------
        // PROSES DOWNLOAD FILE XLSX
        // ---------------------------------------------------------
        $writer = new Xlsx($spreadsheet);
        $filename = 'template-layout-gudang.xlsx';

        // Bersihkan output buffer untuk mencegah file corrupt
        if (ob_get_length()) {
            ob_end_clean();
        }

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: max-age=0');

        $writer->save('php://output');
        exit;
    }

    public function importLayout(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof \Illuminate\Http\JsonResponse) {
            return $idPenggunaLokasi;
        }

        $file = $request->file('file');

        if (! $file || ! $file->isValid()) {
            return $this->fail('file wajib diisi');
        }

        $lookup = ['kode_block', 'nama_lokasi', 'nama_produk', 'nomor_line', 'level', 'jumlah_deep', 'jumlah_kapasitas'];
        $col = [];
        $parsed = $this->bacaFileSpreadsheet($file->getRealPath(), strtolower($file->getClientOriginalExtension()));

        if (empty($parsed['header'])) {
            return $this->fail('File kosong atau header tidak ditemukan');
        }

        foreach ($parsed['header'] as $i => $h) {
            $name = strtolower(trim((string) $h));
            if (in_array($name, $lookup, true)) {
                $col[$name] = $i;
            }
        }

        $missing = array_values(array_diff($lookup, array_keys($col)));
        if (! empty($missing)) {
            return $this->fail('Kolom wajib tidak ditemukan di file: '.implode(', ', $missing));
        }

        $errors = [];
        $blocks = [];

        foreach ($parsed['rows'] as $idx => $row) {
            $lineNo = $idx + 1;
            $cell = fn ($name) => trim((string) ($row[$col[$name]] ?? ''));

            $kodeBlock = strtoupper($cell('kode_block'));
            $namaLokasi = $cell('nama_lokasi');
            $namaProduk = $cell('nama_produk');
            $nomorLine = (int) $cell('nomor_line');
            $level = (int) $cell('level');
            $jumlahDeep = (int) $cell('jumlah_deep');
            $kapasitas = (int) $cell('jumlah_kapasitas');

            $emptyRow = $kodeBlock === '' && $namaLokasi === '' && $namaProduk === ''
                && $nomorLine <= 0 && $level <= 0 && $jumlahDeep <= 0 && $kapasitas <= 0;
            if ($emptyRow) {
                continue;
            }

            if ($kodeBlock === '') {
                $errors[] = "Baris $lineNo: kode_block wajib";
                continue;
            }
            if ($namaLokasi === '' || $namaProduk === '') {
                $errors[] = "Baris $lineNo: nama_lokasi & nama_produk wajib";
                continue;
            }
            if ($nomorLine <= 0 || $level <= 0 || $jumlahDeep <= 0 || $kapasitas <= 0) {
                $errors[] = "Baris $lineNo: nomor_line / level / jumlah_deep / jumlah_kapasitas harus > 0";
                continue;
            }

            $idLokasi = DB::table('lokasi')->where('nama_lokasi', $namaLokasi)->value('id_lokasi');
            if (! $idLokasi) {
                $errors[] = "Baris $lineNo: lokasi '$namaLokasi' tidak ditemukan";
                continue;
            }

            $idProduk = null;
            if (preg_match('/^\s*(\d+)\s*-/', $namaProduk, $m)) {
                $idProduk = (int) $m[1];
                if (! DB::table('produk')->where('id_produk', $idProduk)->exists()) {
                    $idProduk = null;
                }
            }
            if (! $idProduk) {
                $idProduk = DB::table('produk')->where('nama_produk', $namaProduk)->value('id_produk');
            }
            if (! $idProduk) {
                $errors[] = "Baris $lineNo: produk '$namaProduk' tidak ditemukan";
                continue;
            }

            if (! isset($blocks[$kodeBlock])) {
                $blocks[$kodeBlock] = ['lokasi' => $idLokasi, 'lines' => []];
            }
            $blk = &$blocks[$kodeBlock];

            if ($blk['lokasi'] !== $idLokasi) {
                $errors[] = "Baris $lineNo: block $kodeBlock sudah memakai lokasi lain";
                continue;
            }
            if (isset($blk['lines'][$nomorLine]) && $blk['lines'][$nomorLine]['produk'] !== $idProduk) {
                $errors[] = "Baris $lineNo: block $kodeBlock line $nomorLine sudah memakai produk lain";
                continue;
            }

            $blk['lines'][$nomorLine]['produk'] = $idProduk;
            $blk['lines'][$nomorLine]['levels'][$level] = ['jumlah_deep' => $jumlahDeep, 'kapasitas' => $kapasitas];
        }
        unset($blk);

        if (! empty($errors)) {
            return $this->fail('Terdapat kesalahan di file (tidak ada data yang disimpan):'."\n".implode("\n", array_slice($errors, 0, 20)));
        }

        if (empty($blocks)) {
            return $this->fail('Tidak ada baris data yang valid di file');
        }

        // --- PRECHECK DIUBAH: Hapus logika yang nge-reject kalau line bentrok ---
        $precheck = [];
        foreach ($blocks as $kodeBlock => $blk) {
            $idBlock = DB::table('block')
                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('id_lokasi', $blk['lokasi'])
                ->whereRaw('UPPER(kode_block) = ?', [$kodeBlock])
                ->value('id_block');

            $precheck[$kodeBlock] = $idBlock;
        }

        try {
            $stats = DB::transaction(function () use ($idPenggunaLokasi, $blocks, $precheck) {
                $res = [];
                foreach ($blocks as $kodeBlock => $blk) {
                    $idBlock = $precheck[$kodeBlock];

                    if ($idBlock === null) {
                        $idBlock = DB::table('block')->insertGetId([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_lokasi' => $blk['lokasi'],
                            'kode_block' => $kodeBlock,
                            'created_at' => now(),
                        ]);
                    }

                    ksort($blk['lines']);
                    foreach ($blk['lines'] as $nomorLine => $line) {

                        // --- LOGIKA REPLACE START ---
                        // Cek apakah line ini sudah ada sebelumnya
                        $existingLine = DB::table('line')
                            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                            ->where('id_block', $idBlock)
                            ->where('nomor_line', $nomorLine)
                            ->first();

                        if ($existingLine) {
                            $idLineLama = $existingLine->id_line;

                            $adaStok = DB::table('stok_gudang_deep as sgd')
                                ->join('deep as d', 'd.id_deep', '=', 'sgd.id_deep')
                                ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
                                ->where('lv.id_line', $idLineLama)
                                ->where('sgd.jumlah', '>', 0)
                                ->exists();

                            if ($adaStok) {
                                throw new \Exception("Gagal mereplace: Block $kodeBlock Line $nomorLine masih berisi stok aktif. Kosongkan stok terlebih dahulu.");
                            }

                            // Hapus relasi layout lama secara berurutan
                            DB::table('prioritas_lokasi_produk')->where('id_line', $idLineLama)->delete();

                            $levelIds = DB::table('level')->where('id_line', $idLineLama)->pluck('id_level');
                            if ($levelIds->isNotEmpty()) {
                                DB::table('deep')->whereIn('id_level', $levelIds)->delete();
                            }
                            DB::table('level')->where('id_line', $idLineLama)->delete();
                            DB::table('line')->where('id_line', $idLineLama)->delete();
                        }
                        // --- LOGIKA REPLACE END ---

                        // Insert data line baru
                        $idLine = DB::table('line')->insertGetId([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_block' => $idBlock,
                            'nomor_line' => $nomorLine,
                            'created_at' => now(),
                        ]);

                        ksort($line['levels']);
                        foreach ($line['levels'] as $level => $lv) {
                            $idLevel = DB::table('level')->insertGetId([
                                'id_pengguna_lokasi' => $idPenggunaLokasi,
                                'id_line' => $idLine,
                                'level' => $level,
                                'created_at' => now(),
                            ]);

                            $deeps = [];
                            for ($i = 1; $i <= $lv['jumlah_deep']; $i++) {
                                $deeps[] = [
                                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                                    'id_level' => $idLevel,
                                    'deep' => $i,
                                    'kapasitas' => $lv['kapasitas'],
                                    'created_at' => now(),
                                ];
                            }
                            DB::table('deep')->insert($deeps);
                        }

                        DB::table('prioritas_lokasi_produk')->insert([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_produk' => $line['produk'],
                            'id_lokasi' => $blk['lokasi'],
                            'id_block' => $idBlock,
                            'id_line' => $idLine,
                            'id_level' => null,
                            'id_deep' => null,
                            'created_at' => now(),
                        ]);
                    }

                    $res[] = ['kode_block' => $kodeBlock, 'line' => count($blk['lines'])];
                }
                return $res;
            });

            return $this->okMessage('Layout gudang berhasil diimpor (layout lama telah direplace)', [
                'block' => $stats,
                'jumlah_block' => count($stats),
            ]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal mengimpor layout: '.$e->getMessage(), 500);
        }
    }
}
