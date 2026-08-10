<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Mutasi;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MutasiController extends Controller
{
    use ApiResponse;
    public function getBestBefore(Request $request)
    {
        $id_pengguna_lokasi = trim($request->input('id_pengguna_lokasi', ''));
        $id_line = (int) $request->input('id_line', 0);
        $id_produk = (int) $request->input('id_produk', 0);

        if ($id_pengguna_lokasi === '' || $id_line <= 0 || $id_produk <= 0) {
            return $this->fail('Field wajib: id_pengguna_lokasi, id_line, id_produk');
        }

        $rows = DB::table('stok_gudang as sg')
            ->join('stok_gudang_deep as sd', function ($join) {
                $join->on('sd.id_stok_header', '=', 'sg.id_stok')
                    ->on('sd.id_pengguna_lokasi', '=', 'sg.id_pengguna_lokasi');
            })
            ->join('deep as d', function ($join) {
                $join->on('d.id_deep', '=', 'sd.id_deep')
                    ->on('d.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->join('level as lv', function ($join) {
                $join->on('lv.id_level', '=', 'd.id_level')
                    ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->join('line as ln', function ($join) {
                $join->on('ln.id_line', '=', 'lv.id_line')
                    ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->where('sg.id_pengguna_lokasi', $id_pengguna_lokasi)
            ->where('ln.id_line', $id_line)
            ->where('sg.id_produk', $id_produk)
            ->where('sg.jumlah_sisa', '>', 0)
            ->where('sd.jumlah', '>', 0)
            ->select('sg.best_before')
            ->distinct()
            ->orderBy('sg.best_before', 'ASC')
            ->pluck('best_before');

        return $this->ok(['bb_list' => $rows]);
    }

    // =========================================================================
    // 2. AMBIL HISTORY MUTASI (Ref: ambil_mutasi.php)
    // =========================================================================
    public function history(Request $request)
    {
        $id_pengguna_lokasi = trim($request->query('id_pengguna_lokasi', ''));
        $id_pengguna_lokasi_multi = trim($request->query('id_pengguna_lokasi_multi', ''));
        $tanggal = trim($request->query('tanggal', ''));

        if ($id_pengguna_lokasi === '' && $id_pengguna_lokasi_multi === '') {
            return response()->json(['success' => false, 'message' => 'Lokasi wajib diisi']);
        }

        $query = DB::table('mutasi as m')
            ->leftJoin('produk as p', 'p.id_produk', '=', 'm.id_produk')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'm.id_pengguna')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'm.id_pengguna_lokasi')
            ->select('m.*', 'p.nama_produk', 'u.username AS nama_pengguna', 'pl.nama_pengguna_lokasi');

        if ($id_pengguna_lokasi_multi !== '') {
            $lokasiArray = array_map('trim', explode(',', $id_pengguna_lokasi_multi));
            $query->whereIn('m.id_pengguna_lokasi', $lokasiArray);
        } else {
            $query->where('m.id_pengguna_lokasi', $id_pengguna_lokasi);
        }

        if ($tanggal !== '') {
            $query->whereDate('m.created_at', $tanggal);
        }

        $items = $query->orderBy('m.created_at', 'DESC')->get();

        return response()->json([
            'success' => true,
            'data' => $items,
            'mutasi' => $items,
        ]);
    }

    // =========================================================================
    // 3. PROSES SIMPAN MUTASI (Ref: mutasi.php)
    // =========================================================================
    public function store(Request $request)
    {
        $mode = strtolower(trim((string) $request->input('mode', '')));

        $id_pengguna_lokasi = trim($request->input('id_pengguna_lokasi', ''));
        $id_pengguna = (int) $request->input('id_pengguna', 0);
        $id_produk = (int) $request->input('id_produk', 0);
        $jumlah_sumber = (int) $request->input('jumlah', 0);
        $satuan_sumber = trim($request->input('satuan', ''));
        $jenis_mutasi = strtoupper(trim($request->input('jenis_mutasi', '')));
        $best_before = trim($request->input('best_before', ''));
        $lokasi_sumber = $this->normalize_line_label($request->input('lokasi_sumber', ''));
        $lokasi_tujuan = $this->normalize_line_label($request->input('lokasi_tujuan', ''));
        $id_line_sumber = (int) $request->input('id_line_sumber', 0);
        $id_line_tujuan = (int) $request->input('id_line_tujuan', 0);
        $catatan = trim($request->input('catatan', ''));

        if ($catatan === '') {
            return $this->fail('Field wajib: catatan');
        }
        if ($id_pengguna_lokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        if ($id_produk <= 0 || $jumlah_sumber <= 0 || $jenis_mutasi === '' || $best_before === '') {
            return $this->fail('Field wajib: id_produk, jumlah, jenis_mutasi, best_before');
        }

        if ($id_line_sumber <= 0 || $id_line_tujuan <= 0) {
            if ($lokasi_sumber === '' || $lokasi_tujuan === '') {
                return $this->fail('Field wajib: lokasi_sumber & lokasi_tujuan (atau id_line_sumber & id_line_tujuan)');
            }
        }

        if ($mode !== 'preview') {
            if ($id_pengguna <= 0 || $satuan_sumber === '') {
                return $this->fail('Field wajib: id_pengguna dan satuan');
            }
        }

        if ($id_line_sumber > 0 && $id_line_tujuan > 0) {
            if ($id_line_sumber === $id_line_tujuan) {
                return $this->fail('Lokasi sumber dan lokasi tujuan tidak boleh sama.');
            }
        } else {
            if ($lokasi_sumber === $lokasi_tujuan) {
                return $this->fail('Lokasi sumber dan lokasi tujuan tidak boleh sama.');
            }
        }

        // Ambil isi_per_pcs
        $isi_per_pcs = 1;
        if ($id_produk > 0) {
            $isi = DB::table('produk')->where('id_produk', $id_produk)->value('isi_per_pcs');
            if ($isi > 0) {
                $isi_per_pcs = $isi;
            }
        }

        $jumlah_tujuan = $jumlah_sumber;
        $satuan_tujuan = $satuan_sumber;

        // Convert ke PCS jika arah mutasi reject
        if (in_array($jenis_mutasi, ['GS_REJ', 'BAD_REJ'])) {
            $jumlah_tujuan = $jumlah_sumber * $isi_per_pcs;
            $satuan_tujuan = 'PCS';
        }

        $rule = $this->get_mutation_rule($jenis_mutasi);
        if (! $rule) {
            return $this->fail('Jenis mutasi tidak valid.');
        }

        $lineSumber = $id_line_sumber > 0
            ? $this->get_line_info_by_id($id_pengguna_lokasi, $id_line_sumber)
            : $this->get_line_info($id_pengguna_lokasi, $lokasi_sumber);

        $lineTujuan = $id_line_tujuan > 0
            ? $this->get_line_info_by_id($id_pengguna_lokasi, $id_line_tujuan)
            : $this->get_line_info($id_pengguna_lokasi, $lokasi_tujuan);

        if (! $lineSumber) {
            return $this->fail('Lokasi sumber tidak ditemukan.');
        }
        if (! $lineTujuan) {
            return $this->fail('Lokasi tujuan tidak ditemukan.');
        }

        $lokasi_sumber = $this->normalize_line_label($lineSumber['label']);
        $lokasi_tujuan = $this->normalize_line_label($lineTujuan['label']);

        if ($this->is_gallon_sps_transfer_blocked($lineSumber, $lineTujuan)) {
            return $this->fail('GALLON dan SPS tidak bisa saling transfer.', 422);
        }

        if (($lineSumber['mode'] ?? '') !== $rule['source_mode']) {
            return $this->fail('Lokasi sumber tidak sesuai dengan jenis mutasi.');
        }
        if (($lineTujuan['mode'] ?? '') !== $rule['target_mode']) {
            return $this->fail('Lokasi tujuan tidak sesuai dengan jenis mutasi.');
        }

        // Stok Sumber
        $sourceRows = $this->get_source_rows($id_pengguna_lokasi, $lineSumber['id_line'], $id_produk, $best_before);
        if (empty($sourceRows)) {
            return $this->fail('Data stok sumber tidak ditemukan, silakan periksa produk, Best Before, dan lokasi sumber.', 422);
        }

        $totalSumber = array_sum(array_column($sourceRows, 'jumlah_deep'));
        if ($totalSumber < $jumlah_sumber) {
            return $this->fail('Jumlah mutasi melebihi stok sumber yang tersedia.', 422);
        }

        // Stok Tujuan
        $targetState = $this->get_target_state($id_pengguna_lokasi, $lineTujuan['id_line'], $id_produk, $best_before);
        if (! $targetState['ok']) {
            if ($targetState['status'] === 'other_product') {
                return $this->fail('Line tujuan sudah terisi produk lain.', 422);
            }
            if ($targetState['status'] === 'bb_hold_menimpa_release') {
                return $this->fail('Transfer ditolak, BB Hold tidak boleh menimpa BB Release', 422);
            }

            return $this->fail('Line tujuan tidak valid.', 422);
        }

        $targetDeeps = $this->get_target_deeps($id_pengguna_lokasi, $lineTujuan['id_line'], $id_produk, $best_before);
        if (empty($targetDeeps)) {
            return $this->fail('Line tujuan tidak memiliki deep kosong atau kapasitas tersedia.', 422);
        }

        $alokasiTujuan = $this->build_target_allocation($targetDeeps, $jumlah_tujuan);
        if (empty($alokasiTujuan)) {
            return $this->fail('Kapasitas line tujuan tidak mencukupi untuk jumlah mutasi setelah dikonversi ke PCS.', 422);
        }

        if ($mode === 'preview') {
            return $this->ok([
                'lokasi_sumber' => $lokasi_sumber,
                'lokasi_tujuan' => $lokasi_tujuan,
                'best_before' => $best_before,
                'jumlah' => $jumlah_sumber,
                'jumlah_tujuan' => $jumlah_tujuan,
                'satuan_tujuan' => $satuan_tujuan,
                'alokasi_tujuan' => $alokasiTujuan,
            ], 'Preview tujuan mutasi berhasil.');
        }

        $pengambilanSumber = $this->consume_source_rows($sourceRows, $jumlah_sumber);
        if (empty($pengambilanSumber)) {
            return $this->fail('Gagal membentuk alokasi pengambilan dari sumber.', 422);
        }

        // ==========================================
        // TRANSACTION DB
        // ==========================================
        DB::beginTransaction();

        try {
            // 1. Kurangi / Hapus Stok Sumber
            foreach ($pengambilanSumber as $src) {
                $ambil = (int) $src['ambil'];
                if ($ambil <= 0) {
                    continue;
                }

                if ($ambil < $src['jumlah_deep']) {
                    DB::table('stok_gudang_deep')
                        ->where('id_detail_stok', $src['id_detail_stok'])
                        ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
                        ->decrement('jumlah', $ambil);
                } else {
                    DB::table('stok_gudang_deep')
                        ->where('id_detail_stok', $src['id_detail_stok'])
                        ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
                        ->delete();
                }

                DB::table('stok_gudang')
                    ->where('id_stok', $src['id_stok'])
                    ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
                    ->decrement('jumlah_sisa', $ambil);
            }

            // 2. Tambah Stok Tujuan Header
            $id_barang_masuk_ref = (int) $pengambilanSumber[0]['id_barang_masuk'];
            $nama_produk_ref = $pengambilanSumber[0]['nama_produk'];
            $batch_ref = trim((string) ($pengambilanSumber[0]['batch_deep'] ?? $pengambilanSumber[0]['batch_header'] ?? ''));

            $id_stok_tujuan = DB::table('stok_gudang')
                ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
                ->where('id_produk', $id_produk)
                ->where('lokasi_block', $lokasi_tujuan)
                ->where('best_before', $best_before)
                ->orderBy('id_stok', 'ASC')
                ->value('id_stok');

            if ($id_stok_tujuan) {
                DB::table('stok_gudang')
                    ->where('id_stok', $id_stok_tujuan)
                    ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
                    ->update([
                        'jumlah_sisa' => DB::raw("jumlah_sisa + $jumlah_tujuan"),
                        'satuan' => $satuan_tujuan,
                    ]);
            } else {
                $id_stok_tujuan = DB::table('stok_gudang')->insertGetId([
                    'id_pengguna_lokasi' => $id_pengguna_lokasi,
                    'id_produk' => $id_produk,
                    'nama_produk' => $nama_produk_ref,
                    'id_barang_masuk' => $id_barang_masuk_ref,
                    'jumlah_sisa' => $jumlah_tujuan,
                    'best_before' => $best_before,
                    'satuan' => $satuan_tujuan,
                    'lokasi_block' => $lokasi_tujuan,
                    'batch' => $batch_ref,
                    'created_at' => now(),
                ]);
            }

            // 3. Alokasi Stok Tujuan Deep
            foreach ($alokasiTujuan as $al) {
                $id_deep_tujuan = (int) $al['id_deep'];
                $qty_tujuan = (int) $al['jumlah'];

                $detail = DB::table('stok_gudang_deep')
                    ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
                    ->where('id_stok_header', $id_stok_tujuan)
                    ->where('id_deep', $id_deep_tujuan)
                    ->where('best_before', $best_before)
                    ->first();

                if ($detail) {
                    DB::table('stok_gudang_deep')
                        ->where('id_detail_stok', $detail->id_detail_stok)
                        ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
                        ->update([
                            'jumlah' => DB::raw("jumlah + $qty_tujuan"),
                            'lokasi_block' => $lokasi_tujuan,
                        ]);
                } else {
                    DB::table('stok_gudang_deep')->insert([
                        'id_pengguna_lokasi' => $id_pengguna_lokasi,
                        'id_stok_header' => $id_stok_tujuan,
                        'id_deep' => $id_deep_tujuan,
                        'jumlah' => $qty_tujuan,
                        'best_before' => $best_before,
                        'lokasi_block' => $lokasi_tujuan,
                        'batch' => $batch_ref,
                    ]);
                }
            }

            // 4. Catat Riwayat Mutasi (Tetap pake Qty Box Sumber)
            Mutasi::create([
                'id_pengguna_lokasi' => $id_pengguna_lokasi,
                'id_pengguna' => $id_pengguna,
                'id_produk' => $id_produk,
                'lokasi_sumber' => $lokasi_sumber,
                'lokasi_tujuan' => $lokasi_tujuan,
                'jumlah' => $jumlah_sumber,
                'best_before' => $best_before,
                'jenis_mutasi' => $jenis_mutasi,
                'satuan' => $satuan_sumber,
                'catatan' => $catatan,
                'created_at' => now(),
            ]);

            DB::commit();

            return $this->ok([
                'lokasi_sumber' => $lokasi_sumber,
                'lokasi_tujuan' => $lokasi_tujuan,
                'best_before' => $best_before,
                'jumlah' => $jumlah_sumber,
                'jumlah_tujuan' => $jumlah_tujuan,
                'alokasi_tujuan' => $alokasiTujuan,
            ], 'Mutasi stok berhasil disimpan dan dikonversi ke PCS.');

        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail('Mutasi gagal disimpan: '.$e->getMessage(), 500);
        }
    }

    // =========================================================================
    // PRIVATE HELPER FUNCTIONS
    // =========================================================================

    private function normalize_line_label($label)
    {
        $label = trim((string) $label);
        $label = preg_replace('/\s+/', ' ', $label);
        $label = preg_replace('/\s*-\s*/', '-', $label);
        if (preg_match('/^(.+)-(\d+)$/', $label, $m)) {
            return trim($m[1]).'-'.(int) $m[2];
        }

        return $label;
    }

    private function kategori_mode($kategori, $kodeBlock = '')
    {
        $text = strtolower(trim("$kategori $kodeBlock"));
        if (strpos($text, 'bad') !== false) {
            return 'bad';
        }
        if (strpos($text, 'reject') !== false) {
            return 'reject';
        }
        if (strpos($text, 'receh') !== false) {
            return 'goods';
        }
        if (strpos($text, 'festive') !== false) {
            return 'goods';
        }
        if (strpos($text, 'transit') !== false) {
            return 'goods';
        }
        if (strpos($text, 'hold') !== false) {
            return 'goods';
        }

        return 'goods';
    }

    private function get_mutation_rule($jenisMutasi)
    {
        $rules = [
            'GS_GS' => ['source_mode' => 'goods', 'target_mode' => 'goods'],
            'GS_BAD' => ['source_mode' => 'goods', 'target_mode' => 'bad'],
            'BAD_GS' => ['source_mode' => 'bad',   'target_mode' => 'goods'],
            'GS_REJ' => ['source_mode' => 'goods', 'target_mode' => 'reject'],
            'BAD_REJ' => ['source_mode' => 'bad',   'target_mode' => 'reject'],
        ];

        return $rules[strtoupper(trim($jenisMutasi))] ?? null;
    }

    private function get_line_info($idPenggunaLokasi, $label)
    {
        if (! preg_match('/^(.+)-(\d+)$/', $label, $m)) {
            return null;
        }

        $row = DB::table('block as b')
            ->join('line as ln', function ($j) {
                $j->on('ln.id_block', '=', 'b.id_block')
                    ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi');
            })
            ->leftJoin('lokasi as lks', 'lks.id_lokasi', '=', 'b.id_lokasi')
            ->where('b.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('b.kode_block', trim($m[1]))
            ->where('ln.nomor_line', (int) $m[2])
            ->select('b.id_block', 'b.kode_block', 'b.id_lokasi', 'lks.nama_lokasi', 'lks.kategori', 'ln.id_line', 'ln.nomor_line')
            ->first();

        if (! $row) {
            return null;
        }

        $row = (array) $row;
        $row['label'] = $row['kode_block'].'-'.$row['nomor_line'];
        $row['mode'] = $this->kategori_mode($row['kategori'], $row['kode_block']);

        return $row;
    }

    private function get_line_info_by_id($idPenggunaLokasi, $idLine)
    {
        $row = DB::table('line as ln')
            ->join('block as b', function ($j) {
                $j->on('b.id_block', '=', 'ln.id_block')
                    ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->leftJoin('lokasi as lks', 'lks.id_lokasi', '=', 'b.id_lokasi')
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->select('b.id_block', 'b.kode_block', 'b.id_lokasi', 'lks.nama_lokasi', 'lks.kategori', 'ln.id_line', 'ln.nomor_line')
            ->first();

        if (! $row) {
            return null;
        }

        $row = (array) $row;
        $row['label'] = $row['kode_block'].'-'.$row['nomor_line'];
        $row['mode'] = $this->kategori_mode($row['kategori'], $row['kode_block']);

        return $row;
    }

    private function is_gallon_sps_transfer_blocked($lineSumber, $lineTujuan)
    {
        $sumber = strtoupper(trim($lineSumber['kategori'] ?? $lineSumber['nama_lokasi'] ?? ''));
        $tujuan = strtoupper(trim($lineTujuan['kategori'] ?? $lineTujuan['nama_lokasi'] ?? ''));

        if (strpos($sumber, 'GALLON') !== false) {
            $sumber = 'GALLON';
        }
        if (strpos($sumber, 'SPS') !== false) {
            $sumber = 'SPS';
        }
        if (strpos($tujuan, 'GALLON') !== false) {
            $tujuan = 'GALLON';
        }
        if (strpos($tujuan, 'SPS') !== false) {
            $tujuan = 'SPS';
        }

        return ($sumber === 'GALLON' && $tujuan === 'SPS') || ($sumber === 'SPS' && $tujuan === 'GALLON');
    }

    private function get_source_rows($idPenggunaLokasi, $idLine, $idProduk, $bestBefore)
    {
        return DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', function ($j) {
                $j->on('sg.id_stok', '=', 'sd.id_stok_header')
                    ->on('sg.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->join('deep as d', function ($j) {
                $j->on('d.id_deep', '=', 'sd.id_deep')
                    ->on('d.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->join('level as lv', function ($j) {
                $j->on('lv.id_level', '=', 'd.id_level')
                    ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->join('line as ln', function ($j) {
                $j->on('ln.id_line', '=', 'lv.id_line')
                    ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->where('sg.id_produk', $idProduk)
            ->where('sg.best_before', $bestBefore)
            ->where('sg.jumlah_sisa', '>', 0)
            ->where('sd.jumlah', '>', 0)
            ->select(
                'sg.id_stok', 'sg.nama_produk', 'sg.id_barang_masuk', 'sg.jumlah_sisa',
                'sg.satuan', 'sg.best_before', 'sg.batch as batch_header',
                DB::raw('COALESCE(sd.batch, sg.batch) as batch_deep'),
                'sd.id_detail_stok', 'sd.id_deep', 'sd.jumlah as jumlah_deep', 'd.deep', 'lv.level'
            )
            ->orderByDesc('d.deep')
            ->orderByDesc('lv.level')
            ->orderBy('sg.id_stok', 'ASC')
            ->orderBy('sd.id_detail_stok', 'ASC')
            ->get()
            ->map(function ($item) {
                return (array) $item;
            })
            ->toArray();
    }

    private function consume_source_rows($rows, $jumlah)
    {
        $need = (int) $jumlah;
        $out = [];

        foreach ($rows as $r) {
            if ($need <= 0) {
                break;
            }
            $available = (int) $r['jumlah_deep'];
            if ($available <= 0) {
                continue;
            }

            $take = min($available, $need);
            $r['ambil'] = $take;
            $out[] = $r;
            $need -= $take;
        }

        if ($need > 0) {
            return [];
        }

        return $out;
    }

    private function get_target_state($idPenggunaLokasi, $idLine, $idProduk, $bestBefore)
    {
        $block = DB::table('block as b')
            ->join('line as ln', function ($j) {
                $j->on('ln.id_block', '=', 'b.id_block')
                    ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi');
            })
            ->where('ln.id_line', $idLine)
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->value('kode_block');

        $kodeBlockTarget = strtoupper(trim($block ?? ''));
        if (in_array($kodeBlockTarget, ['BS', 'BAD', 'BADSTOCK', 'REJECT'], true)) {
            return ['status' => 'special_block', 'ok' => true];
        }

        $rows = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as sg', function ($j) {
                $j->on('sg.id_stok', '=', 'sd.id_stok_header')
                    ->on('sg.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->join('deep as d', function ($j) {
                $j->on('d.id_deep', '=', 'sd.id_deep')
                    ->on('d.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->join('level as lv', function ($j) {
                $j->on('lv.id_level', '=', 'd.id_level')
                    ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->join('line as ln', function ($j) {
                $j->on('ln.id_line', '=', 'lv.id_line')
                    ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->where('sd.jumlah', '>', 0)
            ->groupBy('sg.id_produk', 'sg.best_before')
            ->select('sg.id_produk', 'sg.best_before', DB::raw('SUM(sd.jumlah) as total_qty'))
            ->get();

        if ($rows->isEmpty()) {
            return ['status' => 'empty', 'ok' => true];
        }

        foreach ($rows as $r) {
            if ((int) $r->id_produk !== (int) $idProduk) {
                return ['status' => 'other_product', 'ok' => false];
            }
        }

        $bbTertuaTujuan = null;
        foreach ($rows as $r) {
            $bbRow = trim((string) ($r->best_before ?? ''));
            if ($bbRow === '') {
                continue;
            }
            if ($bbTertuaTujuan === null || $bbRow < $bbTertuaTujuan) {
                $bbTertuaTujuan = $bbRow;
            }
        }

        if ($bbTertuaTujuan !== null && (string) $bestBefore > (string) $bbTertuaTujuan) {
            return ['status' => 'bb_hold_menimpa_release', 'ok' => false];
        }

        return ['status' => 'same_product_allowed_bb', 'ok' => true];
    }

    private function get_target_deeps($idPenggunaLokasi, $idLine, $idProduk, $bestBefore)
    {
        $block = DB::table('block as b')
            ->join('line as ln', function ($j) {
                $j->on('ln.id_block', '=', 'b.id_block')
                    ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi');
            })
            ->where('ln.id_line', $idLine)
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->value('kode_block');

        $kodeBlockTarget = strtoupper(trim($block ?? ''));
        $isSpecialBlock = in_array($kodeBlockTarget, ['BS', 'BAD', 'BADSTOCK', 'REJECT'], true);

        // Menyiapkan Query Raw untuk menghitung Qty Lain dengan aman (SQL Binding)
        $qtyLainRaw = 'COALESCE(SUM(CASE WHEN sg.id_produk IS NOT NULL AND NOT (sg.id_produk = ? AND sg.best_before = ?) THEN sd.jumlah ELSE 0 END), 0) as qty_lain';

        $rows = DB::table('deep as d')
            ->join('level as lv', function ($j) {
                $j->on('lv.id_level', '=', 'd.id_level')
                    ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->join('line as ln', function ($j) {
                $j->on('ln.id_line', '=', 'lv.id_line')
                    ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang_deep as sd', function ($j) {
                $j->on('sd.id_deep', '=', 'd.id_deep')
                    ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang as sg', function ($j) {
                $j->on('sg.id_stok', '=', 'sd.id_stok_header')
                    ->on('sg.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->groupBy('d.id_deep', 'd.deep', 'd.kapasitas', 'lv.level')
            ->select(
                'd.id_deep', 'd.deep', 'd.kapasitas',
                DB::raw('COALESCE(SUM(sd.jumlah), 0) as terisi'),
                DB::raw($qtyLainRaw)
            )
            ->addBinding([$idProduk, $bestBefore], 'select') // Mengikat param untuk raw query (Anti SQL-Injection)
            ->orderBy('d.deep', 'ASC')
            ->orderBy('lv.level', 'ASC')
            ->orderBy('d.id_deep', 'ASC')
            ->get();

        $deeps = [];
        foreach ($rows as $r) {
            $kapasitas = (int) $r->kapasitas;
            $terisi = (int) $r->terisi;
            $qtyLain = (int) $r->qty_lain;
            $free = $kapasitas - $terisi;

            if (! $isSpecialBlock && $qtyLain > 0) {
                continue;
            }
            if ($free <= 0) {
                continue;
            }

            $deeps[] = [
                'id_deep' => (int) $r->id_deep,
                'free' => $free,
            ];
        }

        return $deeps;
    }

    private function build_target_allocation($deeps, $jumlah)
    {
        $need = (int) $jumlah;
        $out = [];

        foreach ($deeps as $d) {
            if ($need <= 0) {
                break;
            }
            $free = (int) $d['free'];
            if ($free <= 0) {
                continue;
            }

            $take = min($free, $need);
            $out[] = [
                'id_deep' => (int) $d['id_deep'],
                'jumlah' => (int) $take,
            ];
            $need -= $take;
        }

        if ($need > 0) {
            return [];
        }

        return $out;
    }
}
