<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\ApiResponse;
use DateTime;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class BarangMasukController extends Controller
{
    use ApiResponse;

    private const PRODUK_TANPA_BATCH = [10516938, 10516939];

    private const BLOCK_KHUSUS = ['BS', 'BAD', 'BADSTOCK', 'BAD STOCK', 'REJECT', 'FESTIVE', 'HOLD'];

    // =========================================================================
    // 1. GET LIST INBOUND (Ref: barang_masuk/ambil_barang_masuk.php)
    // =========================================================================
    public function index(Request $request)
    {
        $cari = trim((string) $request->input('cari', ''));
        $tgl = trim((string) $request->input('tanggal', ''));
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi', ''));
        $idPenggunaLokasiMulti = trim((string) $request->input('id_pengguna_lokasi_multi', ''));

        $query = DB::table('barang_masuk as bm')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'bm.id_pengguna')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bm.id_pengguna_lokasi')
            ->leftJoin(DB::raw('(
                SELECT id_pengguna_lokasi, id_produk, id_barang_masuk, lokasi_block, SUM(jumlah_sisa) AS jumlah_sisa
                FROM stok_gudang
                GROUP BY id_pengguna_lokasi, id_produk, id_barang_masuk, lokasi_block
            ) as sg'), function ($j) {
                $j->on('sg.id_pengguna_lokasi', '=', 'bm.id_pengguna_lokasi')
                    ->on('sg.id_produk', '=', 'bm.id_produk')
                    ->on('sg.id_barang_masuk', '=', 'bm.id_barang_masuk')
                    ->on('sg.lokasi_block', '=', 'bm.lokasi_block');
            })
            ->select(
                'bm.id_barang_masuk', 'bm.id_pengguna_lokasi', 'pl.nama_pengguna_lokasi',
                'bm.id_pengguna', 'u.username AS dibuat_oleh', 'bm.id_produk', 'bm.nama_produk',
                'bm.jumlah', 'bm.satuan', 'bm.tanggal_masuk', 'bm.tipe_penerimaan', 'bm.best_before',
                'bm.batch', 'bm.asal_pabrik', 'bm.no_dn', 'bm.nama_driver', 'bm.no_mobil',
                'bm.catatan', 'bm.lokasi_block', 'bm.created_at',
                DB::raw('COALESCE(sg.jumlah_sisa,0) AS stok_sisa')
            );

        if ($idPenggunaLokasiMulti !== '') {
            $multiIds = array_values(array_filter(array_map('trim', explode(',', $idPenggunaLokasiMulti))));
            if (! empty($multiIds)) {
                $query->whereIn('bm.id_pengguna_lokasi', $multiIds);
            }
        } elseif ($idPenggunaLokasi !== '') {
            $query->where('bm.id_pengguna_lokasi', $idPenggunaLokasi);
        }

        if ($cari !== '') {
            $like = '%'.$cari.'%';
            $query->where(function ($q) use ($like) {
                $q->where('bm.nama_produk', 'LIKE', $like)
                    ->orWhere('bm.asal_pabrik', 'LIKE', $like)
                    ->orWhere('bm.batch', 'LIKE', $like)
                    ->orWhere('bm.nama_driver', 'LIKE', $like)
                    ->orWhere('bm.lokasi_block', 'LIKE', $like);
            });
        }

        if ($tgl !== '') {
            $query->where('bm.tanggal_masuk', $tgl);
        }

        $rows = $query->orderBy('bm.id_barang_masuk', 'DESC')->get();

        return $this->ok($rows);
    }

    // =========================================================================
    // 2. PREVIEW / REKOMENDASI LOKASI (Ref: layout_gudang/cari_lokasi_block.php?mode=auto_inbound)
    // =========================================================================
    public function preview(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi', ''));
        $idProduk = (int) $request->input('id_produk', 0);
        $qty = (float) $request->input('qty', 0);
        $bestBefore = trim((string) $request->input('best_before', ''));
        $tipePenerimaan = trim((string) $request->input('tipe_penerimaan', 'Primary'));

        if ($idPenggunaLokasi === '') {
            return $this->fail('Field wajib: id_pengguna_lokasi');
        }
        if ($idProduk <= 0) {
            return $this->fail('Field wajib: id_produk');
        }

        $result = $this->rekomendasiAuto(
            $idPenggunaLokasi,
            $idProduk,
            $qty,
            $bestBefore !== '' ? $bestBefore : null,
            $tipePenerimaan
        );

        if (isset($result['error'])) {
            return $this->fail($result['error'], $result['code'] ?? 422);
        }

        return $this->ok($result);
    }

    // =========================================================================
    // 3. SIMPAN INBOUND (Ref: barang_masuk/tambah_barang_masuk.php)
    // =========================================================================
    public function store(Request $request)
    {
        $in = $request->all();

        $idPengguna = (int) ($in['id_pengguna'] ?? 0);
        $idPenggunaLokasi = trim((string) ($in['id_pengguna_lokasi'] ?? ''));
        $idProduk = (int) ($in['id_produk'] ?? 0);
        $jumlah = (int) ($in['jumlah'] ?? 0);
        $satuan = trim((string) ($in['satuan'] ?? ''));
        $tanggalMasuk = trim((string) ($in['tanggal_masuk'] ?? date('Y-m-d')));
        $bestBefore = isset($in['best_before']) ? trim((string) $in['best_before']) : null;
        $batch = trim((string) ($in['batch'] ?? ''));
        $asalPabrik = isset($in['asal_pabrik']) ? trim((string) $in['asal_pabrik']) : null;
        $namaDriver = isset($in['nama_driver']) ? trim((string) $in['nama_driver']) : null;
        $tipePenerimaan = trim((string) ($in['tipe_penerimaan'] ?? 'Primary'));
        $noDn = trim((string) ($in['no_dn'] ?? ''));
        $noMobil = trim((string) ($in['no_mobil'] ?? ''));
        $catatan = (isset($in['catatan']) && $in['catatan'] !== '') ? trim((string) $in['catatan']) : null;
        $lokasiBlock = trim((string) ($in['lokasi_block'] ?? ''));
        $lokasiLine = trim((string) ($in['lokasi_line'] ?? ''));
        $durasiDetik = isset($in['durasi_detik']) ? (int) $in['durasi_detik'] : null;
        if ($durasiDetik !== null && $durasiDetik < 0) {
            $durasiDetik = null;
        }

        $waktuMulai = null;
        if (isset($in['waktu_mulai_input']) && $in['waktu_mulai_input'] !== '') {
            $dtMulai = DateTime::createFromFormat('Y-m-d H:i:s', (string) $in['waktu_mulai_input']);
            if (! $dtMulai) {
                $dtMulai = DateTime::createFromFormat('Y-m-d\TH:i:s', (string) $in['waktu_mulai_input']);
            }
            $waktuMulai = $dtMulai ? $dtMulai->format('Y-m-d H:i:s') : null;
        }

        if ($idPenggunaLokasi === '') {
            return $this->fail('Field wajib: id_pengguna_lokasi');
        }

        $idPenggunaLokasiUser = DB::table('pengguna')->where('id_pengguna', $idPengguna)->value('id_pengguna_lokasi');
        if ($idPenggunaLokasiUser === null) {
            return $this->fail('Pengguna tidak ditemukan.');
        }
        if (trim((string) $idPenggunaLokasiUser) !== $idPenggunaLokasi) {
            return $this->fail('Lokasi pengguna tidak sesuai dengan lokasi transaksi.', 403);
        }

        $namaProduk = trim((string) DB::table('produk')->where('id_produk', $idProduk)->value('nama_produk'));
        if ($namaProduk === '') {
            return $this->fail('Produk tidak ditemukan.');
        }

        if (in_array($idProduk, self::PRODUK_TANPA_BATCH, true)) {
            $bestBefore = '9999-12-31';
            $asalPabrik = '-';
            $batch = '-';
        }

        if ($tipePenerimaan === 'REJECT') {
            $bestBefore = '9999-12-31';
        }

        // ---- Resolusi alokasi ----
        $alokasi = [];

        if (array_key_exists('alokasi', $in) && $in['alokasi'] !== null) {
            $src = is_string($in['alokasi']) ? json_decode($in['alokasi'], true) : $in['alokasi'];
            if (! is_array($src)) {
                return $this->fail('Format alokasi tidak valid');
            }
            $total = 0;
            foreach ($src as $a) {
                $did = (int) ($a['id_deep'] ?? 0);
                $q = (int) ($a['jumlah'] ?? 0);
                if ($did <= 0 || $q <= 0) {
                    return $this->fail('alokasi: id_deep/jumlah tidak valid');
                }
                $alokasi[] = ['id_deep' => $did, 'jumlah' => $q];
                $total += $q;
            }
            if ($total !== (int) $jumlah) {
                return $this->fail('Jumlah total tidak sama dengan total alokasi');
            }
        } elseif ($lokasiBlock !== '' && preg_match('/^DEEP-(\d+)$/i', $lokasiBlock, $m)) {
            $idDeep = (int) $m[1];
            if ($idDeep <= 0) {
                return $this->fail('DEEP id tidak valid');
            }
            $alokasi[] = ['id_deep' => $idDeep, 'jumlah' => (int) $jumlah];
        } elseif ($lokasiLine !== '') {
            if (! preg_match('/^([A-Z][A-Z0-9]*)-(\d+)$/', strtoupper($lokasiLine), $m)) {
                return $this->fail('Kirim: alokasi=[{id_deep,jumlah},...] ATAU lokasi_block="DEEP-<id_deep>" ATAU lokasi_line="A-<no_line>"');
            }
            $hasil = $this->alokasiDariLine($idPenggunaLokasi, $idProduk, $jumlah, $bestBefore, $tipePenerimaan, strtoupper($m[1]), (int) $m[2]);
            if (isset($hasil['error'])) {
                return $this->fail($hasil['error'], $hasil['code'] ?? 422);
            }
            $alokasi = $hasil['alokasi'];
        } else {
            $auto = $this->rekomendasiAuto($idPenggunaLokasi, $idProduk, $jumlah, $bestBefore, $tipePenerimaan);
            if (isset($auto['error'])) {
                return $this->fail($auto['error'], $auto['code'] ?? 422);
            }
            $alokasi = array_map(fn ($r) => ['id_deep' => (int) $r['id_deep'], 'jumlah' => (int) $r['alokasi']], $auto['rekomendasi']);
        }

        // ---- Validasi block tiap deep ----
        foreach ($alokasi as $a) {
            $idDeepCek = (int) $a['id_deep'];
            if ($idDeepCek <= 0) {
                return $this->fail('Alokasi deep tidak valid');
            }
            $cek = $this->infoBlockDeep($idPenggunaLokasi, $idDeepCek);
            if ($cek === null) {
                return $this->fail('Gagal validasi block inbound');
            }
            $kodeBlockCek = $cek['kode_block'];
            $kodeBlockCompact = preg_replace('/\s+/', '', $kodeBlockCek);
            $namaLokasiCek = $cek['nama_lokasi'];

            if ($tipePenerimaan === 'Primary' && ! in_array($namaLokasiCek, ['GALLON', 'SPS'], true)) {
                return $this->fail('Penerimaan Primary hanya boleh masuk ke lokasi GALLON atau SPS.', 422);
            }
            if ($tipePenerimaan === 'Primary XWH' && $namaLokasiCek !== 'XWH') {
                return $this->fail('Penerimaan Primary XWH hanya boleh masuk ke lokasi XWH.', 422);
            }
            if ($tipePenerimaan !== 'REJECT') {
                $blockKhusus = self::BLOCK_KHUSUS;
                if ($tipePenerimaan === 'Secondary') {
                    $blockKhusus[] = 'MOBIL';
                } else {
                    $blockKhusus[] = 'RECEH';
                    $blockKhusus[] = 'TRANSIT';
                }
                if (in_array($kodeBlockCek, $blockKhusus, true) || in_array($kodeBlockCompact, $blockKhusus, true)) {
                    return $this->fail('Block '.$kodeBlockCek.' hanya boleh digunakan melalui mutasi, bukan inbound langsung.', 422);
                }
            }
        }

        // ---- Validasi field wajib ----
        if ($idPengguna <= 0 || $idProduk <= 0 || $jumlah <= 0 || $satuan === '') {
            return $this->fail('Field wajib: id_pengguna, id_produk, jumlah, satuan');
        }
        if (! in_array($tipePenerimaan, ['Primary', 'Secondary', 'Primary XWH', 'REJECT'], true)) {
            return $this->fail('Field wajib: tipe_penerimaan (Primary / Secondary / Primary XWH / REJECT)');
        }
        if ($asalPabrik === null || $asalPabrik === '') {
            return $this->fail('Field wajib: asal_pabrik');
        }
        if ($tipePenerimaan !== 'Secondary' && $tipePenerimaan !== 'REJECT' && $noDn === '') {
            return $this->fail('Field wajib: no_dn untuk Penerimaan Primary / Primary XWH');
        }
        if ($tipePenerimaan === 'Secondary' || $tipePenerimaan === 'REJECT') {
            $noDn = '';
        }

        // ---- Batch ----
        if ($batch === '') {
            if ($bestBefore === null || $bestBefore === '') {
                return $this->fail('Best Before wajib untuk membuat batch.');
            }
            $dt = DateTime::createFromFormat('Y-m-d', $bestBefore);
            if (! $dt) {
                return $this->fail('Format Best Before tidak valid.');
            }
            $idPlantBatch = strtoupper(trim(explode(' - ', $asalPabrik, 2)[0]));
            if ($idPlantBatch === '' || $idPlantBatch === '-') {
                return $this->fail('ID plant asal pabrik tidak valid untuk membuat batch.');
            }
            $batch = $dt->format('ymd').$idPlantBatch;
            if ($tipePenerimaan === 'REJECT') {
                $batch = '999999'.$idPlantBatch;
            }
        }

        if ($noMobil === '') {
            return $this->fail('Field wajib: no_mobil');
        }

        // ---- Validasi BB line (barang tidak boleh masuk line ber-BB lebih tua) ----
        if ($tipePenerimaan !== 'REJECT' && $bestBefore !== null && $bestBefore !== '' && ! empty($alokasi)) {
            $deepIdsValidasi = array_values(array_unique(array_filter(array_map(fn ($a) => (int) $a['id_deep'], $alokasi), fn ($id) => $id > 0)));
            if (! empty($deepIdsValidasi)) {
                $rowsBb = DB::table('deep as d')
                    ->join('level as lv', function ($j) {
                        $j->on('lv.id_level', '=', 'd.id_level')
                            ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
                    })
                    ->join('line as ln', function ($j) {
                        $j->on('ln.id_line', '=', 'lv.id_line')
                            ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
                    })
                    ->join('block as b', function ($j) {
                        $j->on('b.id_block', '=', 'ln.id_block')
                            ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                    })
                    ->join('stok_gudang as s', function ($j) {
                        $j->on('s.lokasi_block', '=', DB::raw("CONCAT(UPPER(TRIM(b.kode_block)), '-', ln.nomor_line)"))
                            ->on('s.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
                    })
                    ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereIn('d.id_deep', $deepIdsValidasi)
                    ->where('s.id_produk', $idProduk)
                    ->where('s.jumlah_sisa', '>', 0)
                    ->selectRaw("CONCAT(UPPER(TRIM(b.kode_block)), '-', ln.nomor_line) AS line_label, MIN(s.best_before) AS bb_tertua")
                    ->groupBy(DB::raw('line_label'))
                    ->get();

                foreach ($rowsBb as $rowBb) {
                    if ($rowBb->bb_tertua !== null && $bestBefore > $rowBb->bb_tertua) {
                        return $this->fail('Barang tidak bisa disimpan karena line masih berisi BB lebih tua.', 422);
                    }
                }
            }
        }

        // ---- Cek kapasitas tiap deep ----
        foreach ($alokasi as $a) {
            $idd = (int) $a['id_deep'];
            $q = (int) $a['jumlah'];
            $cap = DB::table('deep')->where('id_pengguna_lokasi', $idPenggunaLokasi)->where('id_deep', $idd)->value('kapasitas');
            if ($cap === null) {
                return $this->fail('Deep tidak ditemukan: '.$idd);
            }
            $rowTerisi = DB::table('stok_gudang_deep as sd')
                ->join('stok_gudang as s', function ($j) {
                    $j->on('s.id_stok', '=', 'sd.id_stok_header')
                        ->on('s.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
                })
                ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('sd.id_deep', $idd)
                ->where('s.jumlah_sisa', '>', 0)
                ->selectRaw('COALESCE(SUM(sd.jumlah),0) AS terisi, MIN(s.best_before) AS bb_min, MAX(s.best_before) AS bb_max')
                ->first();

            $terisi = (int) ($rowTerisi->terisi ?? 0);
            $bbMin = $rowTerisi->bb_min ?? null;
            $bbMax = $rowTerisi->bb_max ?? null;

            if ($tipePenerimaan !== 'REJECT' && $terisi > 0 && $bestBefore !== null && $bestBefore !== '' && ($bbMin !== null || $bbMax !== null)) {
                if ($bbMin !== $bestBefore || $bbMax !== $bestBefore) {
                    return $this->fail('Lokasi penyimpanan tidak dapat digunakan karena sudah berisi dengan batch yang berbeda.', 422);
                }
            }

            $sisa = (int) $cap - $terisi;
            if ($sisa < $q) {
                return $this->fail('Tidak dapat menyimpan barang. Kapasitas slot penyimpanan tidak mencukupi.', 422);
            }
        }

        // ---- Group alokasi per line ----
        $deepIds = array_values(array_unique(array_map(fn ($a) => (int) $a['id_deep'], $alokasi)));
        $mapDeepToLine = [];
        if (! empty($deepIds)) {
            $rowsMap = DB::table('deep as d')
                ->join('level as lv', function ($j) {
                    $j->on('lv.id_level', '=', 'd.id_level')
                        ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
                })
                ->join('line as ln', function ($j) {
                    $j->on('ln.id_line', '=', 'lv.id_line')
                        ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
                })
                ->join('block as b', function ($j) {
                    $j->on('b.id_block', '=', 'ln.id_block')
                        ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                })
                ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                ->whereIn('d.id_deep', $deepIds)
                ->selectRaw('d.id_deep, b.kode_block, ln.nomor_line')
                ->get();

            foreach ($rowsMap as $row) {
                $mapDeepToLine[(int) $row->id_deep] = strtoupper($row->kode_block).'-'.((int) $row->nomor_line);
            }
        }

        $alokasiPerLine = [];
        foreach ($alokasi as $a) {
            $lineLabel = $mapDeepToLine[(int) $a['id_deep']] ?? '';
            if ($lineLabel === '') {
                continue;
            }
            $alokasiPerLine[$lineLabel][] = ['id_deep' => (int) $a['id_deep'], 'jumlah' => (int) $a['jumlah']];
        }

        if (empty($alokasiPerLine)) {
            return $this->fail('Alokasi deep kosong / tidak valid');
        }

        // ---- Simpan ----
        $idBarangMasukList = [];
        $idStokList = [];
        $ringkasanList = [];
        $lokasiAkhirStr = '';

        try {
            DB::transaction(function () use (
                $alokasiPerLine, $idPenggunaLokasi, $idPengguna, $idProduk, $namaProduk,
                $satuan, $tanggalMasuk, $tipePenerimaan, $bestBefore, $batch, $asalPabrik,
                $noDn, $namaDriver, $noMobil, $catatan, $waktuMulai, $durasiDetik,
                &$idBarangMasukList, &$idStokList, &$ringkasanList, &$lokasiAkhirStr
            ) {
                $parts = [];
                foreach ($alokasiPerLine as $lineLabel => $details) {
                    $jumlahLine = 0;
                    foreach ($details as $det) {
                        $jumlahLine += $det['jumlah'];
                    }
                    $parts[] = $lineLabel.' ('.$jumlahLine.')';

                    $idBm = DB::table('barang_masuk')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_pengguna' => $idPengguna,
                        'id_produk' => $idProduk,
                        'nama_produk' => $namaProduk,
                        'jumlah' => $jumlahLine,
                        'satuan' => $satuan,
                        'tanggal_masuk' => $tanggalMasuk,
                        'tipe_penerimaan' => $tipePenerimaan,
                        'best_before' => $bestBefore,
                        'batch' => $batch,
                        'batch_sekarang' => $batch,
                        'asal_pabrik' => $asalPabrik,
                        'no_dn' => $noDn,
                        'nama_driver' => $namaDriver,
                        'no_mobil' => $noMobil,
                        'catatan' => $catatan,
                        'lokasi_block' => $lineLabel,
                        'created_at' => DB::raw('NOW()'),
                        'waktu_mulai_input' => $waktuMulai,
                        'durasi_detik' => $durasiDetik,
                    ]);
                    $idBarangMasukList[] = $idBm;

                    $idStok = DB::table('stok_gudang')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_produk' => $idProduk,
                        'nama_produk' => $namaProduk,
                        'id_barang_masuk' => $idBm,
                        'jumlah_sisa' => $jumlahLine,
                        'batch' => $batch,
                        'satuan' => $satuan,
                        'best_before' => $bestBefore,
                        'lokasi_block' => $lineLabel,
                        'created_at' => DB::raw('NOW()'),
                    ]);
                    $idStokList[] = $idStok;

                    foreach ($details as $det) {
                        DB::table('stok_gudang_deep')->insert([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_stok_header' => $idStok,
                            'id_deep' => $det['id_deep'],
                            'jumlah' => $det['jumlah'],
                            'best_before' => $bestBefore,
                            'batch' => $batch,
                            'lokasi_block' => $lineLabel,
                            'created_at' => DB::raw('NOW()'),
                        ]);
                    }

                    $ringkasanList[] = ['line' => $lineLabel, 'qty' => $jumlahLine];
                }
                $lokasiAkhirStr = implode(', ', $parts);
            });
        } catch (Throwable $e) {
            return $this->fail($e->getMessage(), 500);
        }

        return $this->okMessage('Barang masuk ditambahkan', [
            'mode' => count($alokasiPerLine) > 1 ? 'multi' : 'single',
            'id_barang_masuk' => $idBarangMasukList[0] ?? null,
            'id_stok' => $idStokList[0] ?? null,
            'id_barang_masuk_list' => $idBarangMasukList,
            'id_stok_list' => $idStokList,
            'alokasi' => $alokasi,
            'lokasi_akhir' => $ringkasanList,
            'lokasi_akhir_str' => $lokasiAkhirStr,
        ]);
    }

    // =========================================================================
    // 4. UPDATE INBOUND (Ref: barang_masuk/ubah_barang_masuk.php)
    // =========================================================================
    public function update(Request $request)
    {
        $in = $request->all();

        $idBm = (int) ($in['id_barang_masuk'] ?? 0);
        $idProduk = (int) ($in['id_produk'] ?? 0);
        $jumlahBaru = isset($in['jumlah']) ? (int) $in['jumlah'] : null;
        $satuan = isset($in['satuan']) ? trim((string) $in['satuan']) : null;
        $tanggalMasuk = isset($in['tanggal_masuk']) ? trim((string) $in['tanggal_masuk']) : null;
        $bestBefore = isset($in['best_before']) ? trim((string) $in['best_before']) : null;
        $asalPabrik = isset($in['asal_pabrik']) ? trim((string) $in['asal_pabrik']) : null;
        $namaDriver = isset($in['nama_driver']) ? trim((string) $in['nama_driver']) : null;
        $lokasiBaru = isset($in['lokasi_block']) ? trim((string) $in['lokasi_block']) : null;
        $tipePenerimaan = isset($in['tipe_penerimaan']) ? trim((string) $in['tipe_penerimaan']) : null;
        $noDn = isset($in['no_dn']) ? trim((string) $in['no_dn']) : null;
        $noMobil = isset($in['no_mobil']) ? trim((string) $in['no_mobil']) : null;
        $catatan = isset($in['catatan']) ? trim((string) $in['catatan']) : null;
        $idPenggunaLokasi = trim((string) ($in['id_pengguna_lokasi'] ?? ''));
        $namaPengguna = (string) ($in['nama_pengguna'] ?? '');

        if ($noDn === '') {
            $noDn = null;
        }
        if ($noMobil === '') {
            $noMobil = null;
        }
        if ($idBm <= 0) {
            return $this->fail('id_barang_masuk wajib');
        }
        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        try {
            return DB::transaction(function () use (
                $in, $idBm, $idProduk, $jumlahBaru, $satuan, $tanggalMasuk, $bestBefore,
                $asalPabrik, $namaDriver, $lokasiBaru, $tipePenerimaan, $noDn, $noMobil,
                $catatan, $idPenggunaLokasi, $namaPengguna
            ) {
                $lama = DB::table('barang_masuk')
                    ->where('id_barang_masuk', $idBm)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->lockForUpdate()
                    ->first();

                if (! $lama) {
                    throw new Exception('Data tidak ditemukan');
                }

                $batchLama = $lama->batch_sekarang ?? $lama->batch ?? '';
                $idProdukFix = (int) $lama->id_produk;
                $lokasiLama = $lama->lokasi_block;
                $bbLama = $lama->best_before;
                $jmlLama = (int) $lama->jumlah;
                $tipeLama = $lama->tipe_penerimaan;
                $asalLama = $lama->asal_pabrik;

                // ---- Bangun update field ----
                $upd = [];
                if ($jumlahBaru !== null) {
                    $upd['jumlah'] = $jumlahBaru;
                }
                if ($satuan !== null) {
                    $upd['satuan'] = $satuan;
                }
                if ($tanggalMasuk) {
                    $upd['tanggal_masuk'] = $tanggalMasuk;
                }
                if ($bestBefore !== null) {
                    $upd['best_before'] = $bestBefore;
                }
                if ($tipePenerimaan !== null) {
                    if (! in_array($tipePenerimaan, ['Primary', 'Secondary', 'Primary XWH', 'REJECT'], true)) {
                        throw new Exception('tipe_penerimaan harus Primary, Secondary, Primary XWH, atau REJECT');
                    }
                    $upd['tipe_penerimaan'] = $tipePenerimaan;
                } else {
                    $tipePenerimaan = $tipeLama;
                }
                if ($tipePenerimaan === 'REJECT') {
                    $bestBefore = '9999-12-31';
                }

                $forceUpdateAsal = false;
                $asalSave = $asalLama;
                if ($tipePenerimaan === 'Primary') {
                    $asalFinal = ($asalPabrik !== null ? $asalPabrik : $asalLama);
                    if ($asalFinal === null || $asalFinal === '') {
                        throw new Exception('asal_pabrik wajib untuk Penerimaan Primary');
                    }
                    if ($asalPabrik !== null || $tipePenerimaan !== $tipeLama) {
                        $forceUpdateAsal = true;
                        $asalSave = $asalFinal;
                    }
                } elseif ($tipePenerimaan === 'Secondary') {
                    if ($asalPabrik !== null) {
                        $forceUpdateAsal = true;
                        $asalSave = $asalPabrik;
                    } else {
                        $asalSave = $asalLama;
                    }
                } else {
                    if ($asalPabrik !== null) {
                        $forceUpdateAsal = true;
                        $asalSave = $asalPabrik;
                    }
                }
                if ($forceUpdateAsal) {
                    $upd['asal_pabrik'] = $asalSave;
                }
                if ($noDn !== null) {
                    if ($noDn === '') {
                        throw new Exception('no_dn wajib diisi');
                    }
                    $upd['no_dn'] = $noDn;
                }
                if ($noMobil !== null) {
                    if ($noMobil === '') {
                        throw new Exception('no_mobil wajib diisi');
                    }
                    $upd['no_mobil'] = $noMobil;
                }
                if ($namaDriver !== null) {
                    $upd['nama_driver'] = $namaDriver;
                }
                if ($catatan !== null) {
                    $upd['catatan'] = ($catatan === '' ? null : $catatan);
                }
                if ($lokasiBaru !== null) {
                    $upd['lokasi_block'] = $lokasiBaru;
                }

                // ---- Batch baru jika BB/asal berubah ----
                $bbUntukBatch = ($bestBefore !== null && $bestBefore !== '') ? $bestBefore : $bbLama;
                $asalUntukBatch = $asalSave;
                $tipeAktif = $tipePenerimaan ?? $tipeLama;
                $batchBaru = '';

                if (($bestBefore !== null && $bestBefore !== $bbLama) || ($forceUpdateAsal && $asalSave !== $asalLama)) {
                    if ($tipeAktif === 'REJECT') {
                        $idPlant = strtoupper(trim(explode('-', $asalUntukBatch, 2)[0]));
                        if ($idPlant === '') {
                            preg_match('/[A-Za-z0-9]+/', $asalUntukBatch, $mPlant);
                            $idPlant = strtoupper(trim($mPlant[0] ?? ''));
                        }
                        if ($idPlant !== '') {
                            $batchBaru = '999999'.$idPlant;
                        }
                    } else {
                        $batchBaru = $this->buatBatchDariBbAsal($bbUntukBatch, $asalUntukBatch);
                    }

                    if ($batchBaru !== '') {
                        $upd['batch_sekarang'] = $batchBaru;
                        $upd['diperbarui_pada'] = DB::raw('NOW()');
                        $upd['diperbarui_oleh'] = $namaPengguna;
                        $upd['catatan_perubahan'] = "Batch berubah dari {$batchLama} menjadi {$batchBaru}";
                    }
                }

                if (! empty($upd)) {
                    DB::table('barang_masuk')
                        ->where('id_barang_masuk', $idBm)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->update($upd);
                }

                // ---- Sinkronisasi stok ----
                if ($jumlahBaru !== null || $lokasiBaru !== null || ($bestBefore !== null && $bestBefore !== $bbLama)) {
                    $rows = DB::table('stok_gudang')
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->where('id_produk', $idProdukFix)
                        ->where('id_barang_masuk', $idBm)
                        ->lockForUpdate()
                        ->get();

                    if ($rows->isEmpty()) {
                        throw new Exception('Line stok tidak ditemukan (batch)');
                    }

                    $rs = $rows[0];
                    $lokasiLamaDb = $rs->lokasi_block;
                    $sum = (int) $rs->jumlah_sisa;

                    if ($rows->count() > 1) {
                        for ($i = 1; $i < $rows->count(); $i++) {
                            $sum += (int) $rows[$i]->jumlah_sisa;
                            DB::table('stok_gudang')->where('id_stok', $rows[$i]->id_stok)->delete();
                        }
                        DB::table('stok_gudang')->where('id_stok', $rs->id_stok)->update(['jumlah_sisa' => $sum]);
                        $rs->jumlah_sisa = $sum;
                    }

                    // ---- Pindah lokasi ----
                    if ($lokasiBaru !== null && $lokasiBaru !== $lokasiLamaDb) {
                        $idStokHeader = (int) $rs->id_stok;
                        $cur = DB::table('stok_gudang')->where('id_stok', $idStokHeader)->lockForUpdate()->first();

                        $bbNew = ($bestBefore !== null ? $bestBefore : $cur->best_before);
                        $satNew = ($satuan !== null ? $satuan : $cur->satuan);

                        $target = DB::table('stok_gudang')
                            ->where('id_produk', $idProdukFix)
                            ->where('id_barang_masuk', $idBm)
                            ->where('lokasi_block', $lokasiBaru)
                            ->lockForUpdate()
                            ->first();

                        if ($target && (int) $target->id_stok !== $idStokHeader) {
                            $jumlahMerged = (int) $cur->jumlah_sisa + (int) $target->jumlah_sisa;
                            $locUpd = ['lokasi_block' => $lokasiBaru, 'jumlah_sisa' => $jumlahMerged];
                            if ($bbNew !== null) {
                                $locUpd['best_before'] = $bbNew;
                            }
                            if ($satNew !== null) {
                                $locUpd['satuan'] = $satNew;
                            }
                            DB::table('stok_gudang')->where('id_stok', $idStokHeader)->update($locUpd);
                            DB::table('stok_gudang')->where('id_stok', $target->id_stok)->delete();
                        } else {
                            $locUpd = ['lokasi_block' => $lokasiBaru];
                            if ($bbNew !== null) {
                                $locUpd['best_before'] = $bbNew;
                            }
                            if ($satNew !== null) {
                                $locUpd['satuan'] = $satNew;
                            }
                            DB::table('stok_gudang')->where('id_stok', $idStokHeader)->update($locUpd);
                        }

                        // ---- Pindahkan detail deep antar line ----
                        $idLineAsal = 0;
                        $idLineTujuan = 0;

                        if ($lokasiLamaDb !== null && $lokasiLamaDb !== '') {
                            $rowLine1 = DB::table('line as ln')
                                ->join('block as b', function ($j) {
                                    $j->on('ln.id_block', '=', 'b.id_block')
                                        ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                                })
                                ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
                                ->whereRaw("CONCAT(b.kode_block, '-', ln.nomor_line) = ?", [$lokasiLamaDb])
                                ->value('ln.id_line');
                            if ($rowLine1) {
                                $idLineAsal = (int) $rowLine1;
                            }
                        }
                        $rowLine2 = DB::table('line as ln')
                            ->join('block as b', function ($j) {
                                $j->on('ln.id_block', '=', 'b.id_block')
                                    ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                            })
                            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
                            ->whereRaw("CONCAT(b.kode_block, '-', ln.nomor_line) = ?", [$lokasiBaru])
                            ->value('ln.id_line');
                        if ($rowLine2) {
                            $idLineTujuan = (int) $rowLine2;
                        }

                        if ($idLineAsal > 0 && $idLineTujuan > 0 && $idLineAsal !== $idLineTujuan) {
                            $sumberRows = DB::table('stok_gudang_deep as sgd')
                                ->join('deep as d', 'sgd.id_deep', '=', 'd.id_deep')
                                ->join('level as lv', 'd.id_level', '=', 'lv.id_level')
                                ->where('sgd.id_stok_header', $idStokHeader)
                                ->where('lv.id_line', $idLineAsal)
                                ->where('sgd.jumlah', '>', 0)
                                ->selectRaw('sgd.id_detail_stok, sgd.id_deep, sgd.jumlah, d.deep, lv.level')
                                ->orderBy('d.deep', 'DESC')
                                ->orderBy('lv.level', 'DESC')
                                ->orderBy('sgd.id_detail_stok', 'ASC')
                                ->get();

                            $sumberDeeps = [];
                            $totalSumber = 0;
                            foreach ($sumberRows as $row) {
                                $row->sisa = (int) $row->jumlah;
                                $totalSumber += (int) $row->jumlah;
                                $sumberDeeps[] = $row;
                            }

                            if ($totalSumber > 0) {
                                $tujuanRows = DB::table('deep as d')
                                    ->join('level as lv', 'd.id_level', '=', 'lv.id_level')
                                    ->leftJoin('stok_gudang_deep as sgd2', 'd.id_deep', '=', 'sgd2.id_deep')
                                    ->where('lv.id_line', $idLineTujuan)
                                    ->selectRaw('d.id_deep, d.deep, lv.level, d.kapasitas, COALESCE(SUM(sgd2.jumlah),0) AS terisi')
                                    ->groupBy('d.id_deep', 'd.deep', 'lv.level', 'd.kapasitas')
                                    ->orderBy('d.deep', 'ASC')
                                    ->orderBy('lv.level', 'ASC')
                                    ->get();

                                $tujuanDeeps = [];
                                $totalKapasitasTersedia = 0;
                                foreach ($tujuanRows as $row) {
                                    $kapasitas = (int) $row->kapasitas;
                                    $terisi = (int) $row->terisi;
                                    $sisa = $kapasitas - $terisi;
                                    if ($sisa > 0) {
                                        $row->sisa_kapasitas = $sisa;
                                        $tujuanDeeps[] = $row;
                                        $totalKapasitasTersedia += $sisa;
                                    }
                                }

                                if ($totalKapasitasTersedia < $totalSumber) {
                                    throw new Exception('Kapasitas di lokasi tujuan tidak cukup untuk memindahkan stok');
                                }

                                if (! empty($tujuanDeeps)) {
                                    $qtySisa = $totalSumber;
                                    $indexSumber = 0;
                                    $jumlahSumber = count($sumberDeeps);
                                    foreach ($tujuanDeeps as $tj) {
                                        if ($qtySisa <= 0) {
                                            break;
                                        }
                                        $idDeepTujuan = (int) $tj->id_deep;
                                        $kapasitasSisa = (int) $tj->sisa_kapasitas;

                                        while ($kapasitasSisa > 0 && $qtySisa > 0 && $indexSumber < $jumlahSumber) {
                                            while ($indexSumber < $jumlahSumber && $sumberDeeps[$indexSumber]->sisa <= 0) {
                                                $indexSumber++;
                                            }
                                            if ($indexSumber >= $jumlahSumber) {
                                                break;
                                            }
                                            $sumber = $sumberDeeps[$indexSumber];
                                            $bisaPindah = min($sumber->sisa, $kapasitasSisa, $qtySisa);
                                            if ($bisaPindah <= 0) {
                                                break;
                                            }

                                            DB::table('stok_gudang_deep')->where('id_detail_stok', $sumber->id_detail_stok)->decrement('jumlah', $bisaPindah);
                                            $sumber->sisa -= $bisaPindah;

                                            $rowTujuan = DB::table('stok_gudang_deep')
                                                ->where('id_stok_header', $idStokHeader)
                                                ->where('id_deep', $idDeepTujuan)
                                                ->first();

                                            if ($rowTujuan) {
                                                DB::table('stok_gudang_deep')->where('id_detail_stok', $rowTujuan->id_detail_stok)->increment('jumlah', $bisaPindah);
                                            } else {
                                                DB::table('stok_gudang_deep')->insert([
                                                    'id_stok_header' => $idStokHeader,
                                                    'id_deep' => $idDeepTujuan,
                                                    'jumlah' => $bisaPindah,
                                                    'best_before' => $bbNew,
                                                    'created_at' => DB::raw('NOW()'),
                                                ]);
                                            }

                                            $qtySisa -= $bisaPindah;
                                            $kapasitasSisa -= $bisaPindah;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ---- Ubah jumlah ----
                    if ($jumlahBaru !== null && $jumlahBaru >= 0) {
                        $lokasiQty = ($lokasiBaru !== null && $lokasiBaru !== '') ? $lokasiBaru : $lokasiLamaDb;
                        $idLineQty = 0;
                        if ($lokasiQty !== null && $lokasiQty !== '') {
                            $rowLineQty = DB::table('line as ln')
                                ->join('block as b', function ($j) {
                                    $j->on('ln.id_block', '=', 'b.id_block')
                                        ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                                })
                                ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
                                ->whereRaw("CONCAT(b.kode_block, '-', ln.nomor_line) = ?", [$lokasiQty])
                                ->value('ln.id_line');
                            if ($rowLineQty) {
                                $idLineQty = (int) $rowLineQty;
                            }
                        }

                        if ($idLineQty > 0) {
                            $idStokHeader = (int) $rs->id_stok;
                            $deepsLine = DB::table('stok_gudang_deep as sgd')
                                ->join('deep as d', 'sgd.id_deep', '=', 'd.id_deep')
                                ->join('level as lv', 'd.id_level', '=', 'lv.id_level')
                                ->where('sgd.id_stok_header', $idStokHeader)
                                ->where('lv.id_line', $idLineQty)
                                ->selectRaw('sgd.id_detail_stok, sgd.id_deep, sgd.jumlah, d.deep, lv.level, d.kapasitas')
                                ->orderBy('d.deep', 'DESC')
                                ->orderBy('lv.level', 'DESC')
                                ->orderBy('sgd.id_detail_stok', 'ASC')
                                ->get();

                            $totalLamaLine = 0;
                            foreach ($deepsLine as $row) {
                                $row->jumlah = (int) $row->jumlah;
                                $totalLamaLine += $row->jumlah;
                            }

                            if ($deepsLine->isNotEmpty()) {
                                $qtyBaruLine = (int) $jumlahBaru;
                                if ($qtyBaruLine !== $totalLamaLine) {
                                    $selisih = $qtyBaruLine - $totalLamaLine;

                                    if ($selisih < 0) {
                                        $harusDikurangi = -$selisih;
                                        foreach ($deepsLine as $deepRow) {
                                            if ($harusDikurangi <= 0) {
                                                break;
                                            }
                                            $stokDeep = (int) $deepRow->jumlah;
                                            if ($stokDeep <= 0) {
                                                continue;
                                            }
                                            $kurangi = min($stokDeep, $harusDikurangi);
                                            DB::table('stok_gudang_deep')->where('id_detail_stok', $deepRow->id_detail_stok)->decrement('jumlah', $kurangi);
                                            $harusDikurangi -= $kurangi;
                                        }
                                        if ($harusDikurangi > 0) {
                                            throw new Exception('Stok di line ini tidak cukup untuk dikurangi');
                                        }
                                    }

                                    if ($selisih > 0) {
                                        $harusDitambah = $selisih;
                                        $capRows = DB::table('deep as d')
                                            ->join('level as lv', function ($j) {
                                                $j->on('d.id_level', '=', 'lv.id_level')
                                                    ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
                                            })
                                            ->leftJoin('stok_gudang_deep as sgd2', function ($j) {
                                                $j->on('d.id_deep', '=', 'sgd2.id_deep')
                                                    ->on('sgd2.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
                                            })
                                            ->where('lv.id_pengguna_lokasi', $idPenggunaLokasi)
                                            ->where('lv.id_line', $idLineQty)
                                            ->selectRaw('d.id_deep, d.deep, lv.level, d.kapasitas, COALESCE(SUM(sgd2.jumlah),0) AS terisi')
                                            ->groupBy('d.id_deep', 'd.deep', 'lv.level', 'd.kapasitas')
                                            ->orderBy('d.deep', 'ASC')
                                            ->orderBy('lv.level', 'ASC')
                                            ->get();

                                        $tujuanDeeps = [];
                                        $totalKapasitasTersedia = 0;
                                        foreach ($capRows as $row) {
                                            $kapasitas = (int) $row->kapasitas;
                                            $terisi = (int) $row->terisi;
                                            $sisa = $kapasitas - $terisi;
                                            if ($sisa > 0) {
                                                $row->sisa_kapasitas = $sisa;
                                                $tujuanDeeps[] = $row;
                                                $totalKapasitasTersedia += $sisa;
                                            }
                                        }

                                        if ($totalKapasitasTersedia < $harusDitambah) {
                                            throw new Exception('Kapasitas di line ini tidak cukup untuk jumlah baru');
                                        }
                                        if (empty($tujuanDeeps)) {
                                            throw new Exception('Tidak ada deep yang masih memiliki kapasitas di line ini');
                                        }

                                        $existingByDeep = [];
                                        foreach ($deepsLine as $deepRow) {
                                            $existingByDeep[(int) $deepRow->id_deep] = [
                                                'id_detail_stok' => (int) $deepRow->id_detail_stok,
                                                'jumlah' => (int) $deepRow->jumlah,
                                            ];
                                        }
                                        $bbUntukDetail = ($bestBefore !== null && $bestBefore !== '') ? $bestBefore : $rs->best_before;

                                        foreach ($tujuanDeeps as $tujuan) {
                                            if ($harusDitambah <= 0) {
                                                break;
                                            }
                                            $idDeepTujuan = (int) $tujuan->id_deep;
                                            $kapasitasSisa = (int) $tujuan->sisa_kapasitas;
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
                                                    ->update([
                                                        'jumlah' => DB::raw('jumlah + '.(int) $tambah),
                                                        'lokasi_block' => $lokasiQty,
                                                    ]);
                                            } else {
                                                DB::table('stok_gudang_deep')->insert([
                                                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                                                    'id_stok_header' => $idStokHeader,
                                                    'id_deep' => $idDeepTujuan,
                                                    'jumlah' => $tambah,
                                                    'best_before' => $bbUntukDetail,
                                                    'lokasi_block' => $lokasiQty,
                                                    'created_at' => DB::raw('NOW()'),
                                                ]);
                                            }

                                            $harusDitambah -= $tambah;
                                        }

                                        if ($harusDitambah > 0) {
                                            throw new Exception('Penambahan stok belum terpenuhi sepenuhnya, proses dibatalkan');
                                        }
                                    }

                                    $totalHeaderBaru = (int) DB::table('stok_gudang_deep')
                                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                                        ->where('id_stok_header', $idStokHeader)
                                        ->sum('jumlah');

                                    DB::table('stok_gudang')->where('id_stok', $idStokHeader)->update(['jumlah_sisa' => $totalHeaderBaru]);
                                }
                            }
                        }
                    }

                    // ---- Sinkron BB / batch / satuan ----
                    if (($bestBefore !== null && $bestBefore !== $bbLama) || $satuan !== null || $batchBaru !== '') {
                        $lokTuju = ($lokasiBaru !== null ? $lokasiBaru : $lokasiLamaDb);

                        $updStok = [];
                        if ($bestBefore !== null) {
                            $updStok['best_before'] = $bestBefore;
                        }
                        if ($batchBaru !== '') {
                            $updStok['batch'] = $batchBaru;
                        }
                        if ($satuan !== null) {
                            $updStok['satuan'] = $satuan;
                        }
                        if (! empty($updStok)) {
                            DB::table('stok_gudang')
                                ->where('id_produk', $idProdukFix)
                                ->where('id_barang_masuk', $idBm)
                                ->where('lokasi_block', $lokTuju)
                                ->update($updStok);
                        }

                        if (($bestBefore !== null && $bestBefore !== $bbLama) || $batchBaru !== '') {
                            $updDeep = [];
                            if ($bestBefore !== null) {
                                $updDeep['best_before'] = $bestBefore;
                            }
                            if ($batchBaru !== '') {
                                $updDeep['batch'] = $batchBaru;
                            }
                        if (! empty($updDeep)) {
                            $updDeepSgd = [];
                            foreach ($updDeep as $k => $v) {
                                $updDeepSgd['sgd.'.$k] = $v;
                            }
                            DB::table('stok_gudang_deep as sgd')
                                ->join('stok_gudang as sg', function ($j) {
                                    $j->on('sg.id_stok', '=', 'sgd.id_stok_header')
                                        ->on('sg.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi');
                                })
                                ->where('sg.id_produk', $idProdukFix)
                                ->where('sg.id_barang_masuk', $idBm)
                                ->where('sg.lokasi_block', $lokTuju)
                                ->where('sg.id_pengguna_lokasi', $idPenggunaLokasi)
                                ->update($updDeepSgd);
                        }
                        }
                    }
                }

                return $this->okMessage('Barang masuk diubah & stok disinkronkan');
            });
        } catch (Throwable $e) {
            return $this->fail($e->getMessage(), 500);
        }
    }

    // =========================================================================
    // 5. HAPUS INBOUND (Ref: barang_masuk/hapus_barang_masuk.php)
    // =========================================================================
    public function destroy(Request $request)
    {
        $idBm = (int) $request->input('id_barang_masuk', 0);
        if ($idBm <= 0) {
            return $this->fail('id_barang_masuk wajib');
        }

        $deleted = 0;

        try {
            DB::transaction(function () use ($idBm, &$deleted) {
                $dipakai = DB::table('rencana_keluar_deep as r')
                    ->join('stok_gudang_deep as sgd', 'sgd.id_detail_stok', '=', 'r.id_detail_stok')
                    ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sgd.id_stok_header')
                    ->where('sg.id_barang_masuk', $idBm)
                    ->lockForUpdate()
                    ->exists();

                if ($dipakai) {
                    throw new Exception('Tidak bisa hapus: barang masuk sudah dipakai di rencana / outbound');
                }

                $idStokList = DB::table('stok_gudang')
                    ->where('id_barang_masuk', $idBm)
                    ->pluck('id_stok')
                    ->map(fn ($v) => (int) $v)
                    ->all();

                if (! empty($idStokList)) {
                    DB::table('stok_gudang_deep')->whereIn('id_stok_header', $idStokList)->delete();
                }

                DB::table('stok_gudang')->where('id_barang_masuk', $idBm)->delete();

                $deleted = DB::table('barang_masuk')->where('id_barang_masuk', $idBm)->delete();
                if ($deleted <= 0) {
                    throw new Exception('Data tidak ditemukan');
                }
            });
        } catch (Throwable $e) {
            return $this->fail($e->getMessage(), 500);
        }

        return $this->okMessage('Barang masuk & stok terhapus', ['deleted' => $deleted]);
    }

    // =========================================================================
    //  REKOMENDASI AUTO (Ref: cari_lokasi_block.php mode=auto_inbound)
    // =========================================================================
    private function rekomendasiAuto(string $idPenggunaLokasi, int $idProduk, float $qty, ?string $bestBefore, string $tipePenerimaan): array
    {
        $isSecondary = $tipePenerimaan === 'Secondary';
        $previewMode = $qty <= 0;

        $lineProduk = DB::table('prioritas_lokasi_produk')
            ->where('id_produk', $idProduk)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->distinct()->pluck('id_line')->map(fn ($v) => (int) $v)->all();

        $deepProduk = DB::table('prioritas_lokasi_produk')
            ->where('id_produk', $idProduk)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereNotNull('id_deep')->where('id_deep', '>', 0)
            ->distinct()->pluck('id_deep')->map(fn ($v) => (int) $v)->all();
        $levelProduk = DB::table('prioritas_lokasi_produk')
            ->where('id_produk', $idProduk)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereNotNull('id_level')->where('id_level', '>', 0)
            ->distinct()->pluck('id_level')->map(fn ($v) => (int) $v)->all();
        $blockProduk = DB::table('prioritas_lokasi_produk')
            ->where('id_produk', $idProduk)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereNotNull('id_block')->where('id_block', '>', 0)
            ->distinct()->pluck('id_block')->map(fn ($v) => (int) $v)->all();
        $lokasiProduk = DB::table('prioritas_lokasi_produk')
            ->where('id_produk', $idProduk)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereNotNull('id_lokasi')->where('id_lokasi', '>', 0)
            ->distinct()->pluck('id_lokasi')->map(fn ($v) => (int) $v)->all();

        $punyaLayoutPrioritas = ! empty(array_filter([$deepProduk, $levelProduk, $lineProduk, $blockProduk, $lokasiProduk]));

        // Kandidat staging untuk Secondary (block RECEH / TRANSIT)
        $stagingCandidates = [];
        if ($isSecondary) {
            $stagingCandidates = $this->baseDeep($idPenggunaLokasi)
                ->whereRaw("(UPPER(TRIM(b.kode_block)) = 'RECEH' OR UPPER(TRIM(b.kode_block)) = 'TRANSIT')")
                ->orderByRaw("CASE WHEN UPPER(TRIM(b.kode_block)) = 'RECEH' THEN 0 WHEN UPPER(TRIM(b.kode_block)) = 'TRANSIT' THEN 1 ELSE 2 END ASC, b.kode_block ASC, ln.nomor_line ASC, d.deep ASC, CAST(lv.level AS UNSIGNED) ASC")
                ->get()->map(fn ($r) => (array) $r)->all();
        }

        // Kandidat prioritas
        $prior = [];
        if (! empty($deepProduk)) {
            $prior = $this->kandidatPrior($idPenggunaLokasi, $tipePenerimaan, 'd.id_deep', $deepProduk);
        } elseif (! empty($levelProduk)) {
            $prior = $this->kandidatPrior($idPenggunaLokasi, $tipePenerimaan, 'd.id_level', $levelProduk);
        } elseif (! empty($lineProduk)) {
            $prior = $this->kandidatPrior($idPenggunaLokasi, $tipePenerimaan, 'ln.id_line', $lineProduk);
        } elseif (! empty($blockProduk)) {
            $prior = $this->kandidatPrior($idPenggunaLokasi, $tipePenerimaan, 'b.id_block', $blockProduk);
        } elseif (! empty($lokasiProduk)) {
            $prior = $this->kandidatPrior($idPenggunaLokasi, $tipePenerimaan, 'b.id_lokasi', $lokasiProduk);
        }

        if (empty($prior) && ! empty($lineProduk)) {
            $prior = $this->kandidatPrior($idPenggunaLokasi, $tipePenerimaan, 'ln.id_line', $lineProduk);
        }

        $previewEmpty = [
            'id_produk' => $idProduk,
            'qty_diminta' => 0,
            'qty_teralokasi' => 0,
            'qty_sisa' => 0,
            'preview_mode' => true,
            'opsi_block' => [],
            'opsi_line' => [],
            'rekomendasi' => [],
            'ringkasan_line' => [],
        ];

        if ($previewMode && ! $punyaLayoutPrioritas && empty($stagingCandidates)) {
            return array_merge($previewEmpty, [
                'perlu_buat_layout' => true,
                'block_default' => '-',
                'message' => 'Produk belum punya layout line. Silahkan buat layout terlebih dahulu.',
            ]);
        }

        if (empty($prior) && ! $punyaLayoutPrioritas && empty($stagingCandidates)) {
            return ['error' => 'Produk belum punya layout line. Silahkan buat layout terlebih dahulu.', 'code' => 422];
        }

        // Info kapasitas per line
        $lineInfo = [];
        $lineInfoRows = DB::table('line as ln')
            ->join('block as b', function ($j) {
                $j->on('b.id_block', '=', 'ln.id_block')
                    ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->join('level as lv', function ($j) {
                $j->on('lv.id_line', '=', 'ln.id_line')
                    ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->join('deep as d', function ($j) {
                $j->on('d.id_level', '=', 'lv.id_level')
                    ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang_deep as sd', function ($j) {
                $j->on('sd.id_deep', '=', 'd.id_deep')
                    ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang as s', function ($j) {
                $j->on('s.id_stok', '=', 'sd.id_stok_header')
                    ->on('s.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->where($this->whereNormalBlockActive($tipePenerimaan))
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->selectRaw('ln.id_line, l.id_lokasi, l.nama_lokasi, b.id_block, b.kode_block, ln.nomor_line, SUM(d.kapasitas) AS kapasitas_total, COALESCE(SUM(CASE WHEN s.jumlah_sisa > 0 THEN sd.jumlah ELSE 0 END), 0) AS terisi_total')
            ->groupBy('ln.id_line', 'l.id_lokasi', 'l.nama_lokasi', 'b.id_block', 'b.kode_block', 'ln.nomor_line')
            ->orderBy('l.nama_lokasi')
            ->orderBy('b.kode_block')
            ->orderBy('ln.nomor_line')
            ->get();

        foreach ($lineInfoRows as $rowLine) {
            $lineInfo[(int) $rowLine->id_line] = $rowLine;
        }

        // Peta produk per line
        $lineProductMap = [];
        $lineProductRows = DB::table('line as ln')
            ->join('level as lv', function ($j) {
                $j->on('lv.id_line', '=', 'ln.id_line')
                    ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->join('deep as d', function ($j) {
                $j->on('d.id_level', '=', 'lv.id_level')
                    ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->join('stok_gudang_deep as sd', function ($j) {
                $j->on('sd.id_deep', '=', 'd.id_deep')
                    ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->join('stok_gudang as sg', function ($j) {
                $j->on('sg.id_stok', '=', 'sd.id_stok_header')
                    ->on('sg.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->where('sg.jumlah_sisa', '>', 0)
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->selectRaw('ln.id_line, sg.id_produk, SUM(sd.jumlah) AS qty')
            ->groupBy('ln.id_line', 'sg.id_produk')
            ->get();

        foreach ($lineProductRows as $rowLP) {
            $idLine = (int) $rowLP->id_line;
            $idProd = (int) $rowLP->id_produk;
            if (! isset($lineProductMap[$idLine])) {
                $lineProductMap[$idLine] = [];
            }
            $lineProductMap[$idLine][$idProd] = (int) $rowLP->qty;
        }

        // Buang line yang dipakai produk lain
        $priorFiltered = [];
        foreach ($prior as $row) {
            $idLine = (int) $row['id_line'];
            $prodDalamLine = $lineProductMap[$idLine] ?? [];
            $adaProdukSama = false;
            $adaProdukLain = false;
            foreach ($prodDalamLine as $pid => $dummyQty) {
                if ((int) $pid === $idProduk) {
                    $adaProdukSama = true;
                } else {
                    $adaProdukLain = true;
                }
            }
            if ($adaProdukLain && ! $adaProdukSama) {
                continue;
            }
            $priorFiltered[] = $row;
        }
        $prior = $priorFiltered;

        $finalCandidates = array_merge($stagingCandidates, $prior);

        if (empty($finalCandidates)) {
            if ($previewMode) {
                return array_merge($previewEmpty, [
                    'perlu_buat_layout' => true,
                    'block_default' => '-',
                    'message' => 'Line produk tidak tersedia, Silahkan buat layout baru atau tunggu line kembali.',
                ]);
            }
            return ['error' => 'Line produk tidak tersedia, Silahkan buat layout baru atau tunggu line kembali.', 'code' => 422];
        }

        // Filter BB: jangan masukkan ke line yang BB-nya lebih tua
        if (! empty($finalCandidates) && $bestBefore !== null && $bestBefore !== '') {
            $labelLineSet = [];
            foreach ($finalCandidates as $row) {
                if (! isset($row['kode_block']) || ! isset($row['nomor_line'])) {
                    continue;
                }
                $labelLineSet[strtoupper($row['kode_block']).'-'.((int) $row['nomor_line'])] = true;
            }
            $labels = array_keys($labelLineSet);
            $bbMap = [];
            if (! empty($labels)) {
                $bbRows = DB::table('stok_gudang')
                    ->where('id_produk', $idProduk)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('jumlah_sisa', '>', 0)
                    ->whereIn('lokasi_block', $labels)
                    ->selectRaw('lokasi_block, MIN(best_before) AS bb_release')
                    ->groupBy('lokasi_block')
                    ->get();
                foreach ($bbRows as $rowBB) {
                    if (! empty($rowBB->lokasi_block) && ! empty($rowBB->bb_release)) {
                        $bbMap[$rowBB->lokasi_block] = $rowBB->bb_release;
                    }
                }
            }
            $filtered = [];
            foreach ($finalCandidates as $row) {
                $lbl = strtoupper($row['kode_block']).'-'.((int) $row['nomor_line']);
                if (! isset($bbMap[$lbl])) {
                    $filtered[] = $row;
                    continue;
                }
                if ($tipePenerimaan === 'REJECT' || $bestBefore <= $bbMap[$lbl]) {
                    $filtered[] = $row;
                }
            }
            $finalCandidates = $filtered;
        }

        // Kumpulkan id line & lokasi prioritas
        $priorLineSeen = [];
        $priorLineIds = [];
        $priorLokasiIds = [];
        foreach ($lokasiProduk as $idLokProduk) {
            if ($idLokProduk > 0) {
                $priorLokasiIds[$idLokProduk] = true;
            }
        }
        foreach ($finalCandidates as $row) {
            $idLine = (int) ($row['id_line'] ?? 0);
            $idLok = (int) ($row['id_lokasi'] ?? 0);
            if ($idLine > 0 && ! isset($priorLineSeen[$idLine])) {
                $priorLineSeen[$idLine] = true;
                $priorLineIds[] = $idLine;
            }
            if ($idLok > 0) {
                $priorLokasiIds[$idLok] = true;
            }
        }

        // Terisi awal per deep
        $terisiMapAwal = [];
        $terisiAwalRows = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as s', function ($j) {
                $j->on('s.id_stok', '=', 'sd.id_stok_header')
                    ->on('s.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->where('s.jumlah_sisa', '>', 0)
            ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->selectRaw('sd.id_deep, COALESCE(SUM(sd.jumlah),0) AS terisi')
            ->groupBy('sd.id_deep')
            ->get();
        foreach ($terisiAwalRows as $rowTA) {
            $terisiMapAwal[(int) $rowTA->id_deep] = (float) $rowTA->terisi;
        }

        $totalLeftPrior = 0;
        foreach ($finalCandidates as $r) {
            $idDeep = (int) $r['id_deep'];
            $cap = (float) $r['kapasitas'];
            $filled = $terisiMapAwal[$idDeep] ?? 0.0;
            $totalLeftPrior += max(0.0, $cap - $filled);
        }

        // Pinjam line lain kalau kapasitas prioritas kurang
        if ($punyaLayoutPrioritas && $totalLeftPrior < $qty) {
            $borrowLineIds = [];
            foreach ($lineInfo as $idLine => $info) {
                $idLok = (int) $info->id_lokasi;
                if (! $previewMode && ! empty($priorLokasiIds) && ! isset($priorLokasiIds[$idLok])) {
                    continue;
                }
                if (in_array($idLine, $priorLineIds, true)) {
                    continue;
                }
                $kapTotal = (int) $info->kapasitas_total;
                $terisiTotal = (int) $info->terisi_total;
                if ($kapTotal <= 0 || $kapTotal <= $terisiTotal) {
                    continue;
                }
                $prodDalamLine = $lineProductMap[$idLine] ?? [];
                $adaProdukLain = false;
                $adaProdukSama = false;
                foreach ($prodDalamLine as $pid => $dummyQty) {
                    if ((int) $pid === $idProduk) {
                        $adaProdukSama = true;
                    } else {
                        $adaProdukLain = true;
                    }
                }
                if ($adaProdukLain && ! $adaProdukSama) {
                    continue;
                }
                if ($adaProdukSama && $bestBefore !== null && $bestBefore !== '') {
                    $labelLine = strtoupper($info->kode_block).'-'.((int) $info->nomor_line);
                    $bbMinSame = DB::table('stok_gudang')
                        ->where('lokasi_block', $labelLine)
                        ->where('id_produk', $idProduk)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->where('jumlah_sisa', '>', 0)
                        ->min('best_before');
                    if ($tipePenerimaan !== 'REJECT' && $bbMinSame !== null && $bestBefore > $bbMinSame) {
                        continue;
                    }
                }
                $borrowLineIds[] = $idLine;
            }

            if (! empty($borrowLineIds)) {
                $borrowRows = $this->baseDeep($idPenggunaLokasi)
                    ->where($this->whereNormalBlockActive($tipePenerimaan))
                    ->where($this->kategoriLokasi($tipePenerimaan) ?? fn () => true)
                    ->whereIn('ln.id_line', $borrowLineIds)
                    ->orderByRaw('l.nama_lokasi, b.kode_block, ln.nomor_line, d.deep ASC, CAST(lv.level AS UNSIGNED) ASC')
                    ->get()->map(fn ($r) => (array) $r)->all();
                if (! empty($borrowRows)) {
                    $finalCandidates = array_merge($finalCandidates, $borrowRows);
                }
            }
        }

        // Terisi + bb per deep
        $terisiMap = [];
        $bbMinDeepMap = [];
        $bbMaxDeepMap = [];
        $terisiRows = DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as s', function ($j) {
                $j->on('s.id_stok', '=', 'sd.id_stok_header')
                    ->on('s.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->where('s.jumlah_sisa', '>', 0)
            ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->selectRaw('sd.id_deep, COALESCE(SUM(sd.jumlah),0) AS terisi, MIN(s.best_before) AS bb_min, MAX(s.best_before) AS bb_max')
            ->groupBy('sd.id_deep')
            ->get();
        foreach ($terisiRows as $row) {
            $terisiMap[(int) $row->id_deep] = (float) $row->terisi;
            $bbMinDeepMap[(int) $row->id_deep] = $row->bb_min ?? null;
            $bbMaxDeepMap[(int) $row->id_deep] = $row->bb_max ?? null;
        }

        // Mode preview: cukup opsi block & line
        if ($previewMode) {
            $previewBlocks = [];
            $previewLines = [];
            foreach ($finalCandidates as $r) {
                $kodeBlock = strtoupper(trim($r['kode_block']));
                $nomorLine = (int) $r['nomor_line'];
                $idLine = (int) $r['id_line'];
                $idDeep = (int) $r['id_deep'];
                $kapasitas = (float) $r['kapasitas'];
                $terisi = $terisiMapAwal[$idDeep] ?? 0.0;

                if (! isset($previewBlocks[$kodeBlock])) {
                    $previewBlocks[$kodeBlock] = ['kode_block' => $kodeBlock];
                }
                if (! isset($previewLines[$idLine])) {
                    $previewLines[$idLine] = [
                        'id_line' => $idLine,
                        'kode_block' => $kodeBlock,
                        'nomor_line' => $nomorLine,
                        'label_line' => $kodeBlock.'-'.$nomorLine,
                        'kapasitas_total' => 0,
                        'terisi_total' => 0,
                    ];
                }
                $previewLines[$idLine]['kapasitas_total'] += $kapasitas;
                $previewLines[$idLine]['terisi_total'] += $terisi;
            }

            return array_merge($previewEmpty, [
                'opsi_block' => array_values($previewBlocks),
                'opsi_line' => array_values($previewLines),
                'message' => 'Preview block berhasil dibuat.',
            ]);
        }

        // Alokasi
        $need = $qty;
        $alloc = [];
        $ringkasan = [];

        foreach ($finalCandidates as $r) {
            if ($need <= 0) {
                break;
            }
            $idDeep = (int) $r['id_deep'];
            $cap = (float) $r['kapasitas'];
            $filled = $terisiMap[$idDeep] ?? 0.0;
            $left = max(0.0, $cap - $filled);
            if ($left <= 0) {
                continue;
            }
            $bbMinDeep = $bbMinDeepMap[$idDeep] ?? null;
            $bbMaxDeep = $bbMaxDeepMap[$idDeep] ?? null;

            if ($tipePenerimaan !== 'REJECT' && $filled > 0 && $bestBefore !== null && $bestBefore !== ''
                && ($bbMinDeep !== null || $bbMaxDeep !== null)
                && ($bbMinDeep !== $bestBefore || $bbMaxDeep !== $bestBefore)) {
                continue;
            }

            $take = min($left, $need);
            $need -= $take;

            $labelLokasi = $r['kode_block'].'-'.$r['nomor_line']
                .' / Level '.$r['level']
                .' / Deep '.str_pad((string) $r['deep'], 2, '0', STR_PAD_LEFT);

            $alloc[] = [
                'id_deep' => $idDeep,
                'lokasi_block' => 'DEEP-'.$idDeep,
                'kode_block' => $r['kode_block'],
                'nomor_line' => (int) $r['nomor_line'],
                'level' => (int) $r['level'],
                'deep' => (int) $r['deep'],
                'label_line' => $r['kode_block'].'-'.(int) $r['nomor_line'],
                'label_lokasi' => $labelLokasi,
                'kapasitas' => $cap,
                'terisi' => $filled,
                'sisa_kapasitas' => $left,
                'alokasi' => $take,
            ];

            $keyLine = $r['nama_lokasi'].'|'.$r['kode_block'].'|'.$r['nomor_line'];
            if (! isset($ringkasan[$keyLine])) {
                $ringkasan[$keyLine] = ['total_terisi' => 0, 'total_kapasitas' => 0];
            }
            $ringkasan[$keyLine]['total_terisi'] += $filled;
            $ringkasan[$keyLine]['total_kapasitas'] += $cap;
        }

        if ($need > 0) {
            return ['error' => 'Kapasitas line tidak cukup. Silahkan buat layout/line baru untuk menambah kapasitas', 'code' => 422];
        }

        $qtyTeralokasi = $qty - $need;

        return [
            'id_produk' => $idProduk,
            'qty_diminta' => $qty,
            'qty_teralokasi' => $qtyTeralokasi,
            'qty_sisa' => $need,
            'rekomendasi' => $alloc,
            'ringkasan_line' => $ringkasan,
            'lokasi_line' => isset($alloc[0]) ? $alloc[0]['label_line'] : '',
        ];
    }

    // =========================================================================
    //  ALOKASI DARI LINE TERTENTU (Ref: cabang lokasi_line di tambah_barang_masuk.php)
    // =========================================================================
    private function alokasiDariLine(string $idPenggunaLokasi, int $idProduk, int $jumlah, ?string $bestBefore, string $tipePenerimaan, string $kodeBlock, int $noLine): array
    {
        if ($tipePenerimaan !== 'REJECT') {
            $blockKhusus = self::BLOCK_KHUSUS;
            if ($tipePenerimaan === 'Secondary') {
                $blockKhusus[] = 'MOBIL';
            } else {
                $blockKhusus[] = 'RECEH';
                $blockKhusus[] = 'TRANSIT';
            }
            if (in_array($kodeBlock, $blockKhusus, true)) {
                return ['error' => 'Block '.$kodeBlock.' hanya boleh digunakan untuk inbound melalui mutasi, bukan langsung.', 'code' => 422];
            }
        }

        $deepsDefault = $this->deepsLine($idPenggunaLokasi, $kodeBlock, $noLine);
        if (empty($deepsDefault)) {
            return ['error' => 'Line tidak ditemukan: '.$kodeBlock.'-'.$noLine, 'code' => 422];
        }

        $labelDefault = $kodeBlock.'-'.$noLine;

        $lineDipakaiProdukLain = false;
        $adaProdukSamaDiLine = false;
        $produkLine = DB::table('stok_gudang as s')
            ->where('s.lokasi_block', $labelDefault)
            ->where('s.jumlah_sisa', '>', 0)
            ->where('s.id_pengguna_lokasi', $idPenggunaLokasi)
            ->distinct()->pluck('id_produk');
        foreach ($produkLine as $pid) {
            if ((int) $pid === $idProduk) {
                $adaProdukSamaDiLine = true;
            } else {
                $lineDipakaiProdukLain = true;
            }
        }

        $linePunyaStokDefault = false;
        $bbMinLineDefault = null;
        foreach ($deepsDefault as $dp) {
            if ((int) $dp->terisi > 0 && $dp->bb_min !== null) {
                $linePunyaStokDefault = true;
                if ($bbMinLineDefault === null || $dp->bb_min < $bbMinLineDefault) {
                    $bbMinLineDefault = $dp->bb_min;
                }
            }
        }
        $bbMinProduk = DB::table('stok_gudang')
            ->where('lokasi_block', $labelDefault)
            ->where('id_produk', $idProduk)
            ->where('jumlah_sisa', '>', 0)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->min('best_before');
        if ($bbMinProduk !== null) {
            $linePunyaStokDefault = true;
            $bbMinLineDefault = $bbMinProduk;
        }

        $bolehPakaiLineDefault = true;
        if ($lineDipakaiProdukLain && ! $adaProdukSamaDiLine) {
            $bolehPakaiLineDefault = false;
        } elseif ($tipePenerimaan !== 'REJECT' && $linePunyaStokDefault && $bestBefore !== null && $bestBefore !== ''
            && $bbMinLineDefault !== null && $bestBefore > $bbMinLineDefault) {
            $bolehPakaiLineDefault = false;
        }

        $need = $jumlah;
        $alokasi = [];
        $idLokasiDefault = (int) ($deepsDefault[0]->id_lokasi ?? 0);

        if (! empty($deepsDefault) && $bolehPakaiLineDefault) {
            foreach ($deepsDefault as $dp) {
                if ($need <= 0) {
                    break;
                }
                $kapasitas = (int) $dp->kapasitas;
                $terisi = (int) $dp->terisi;
                $bbMin = $dp->bb_min ?? null;
                if ($tipePenerimaan !== 'REJECT' && $terisi > 0 && $bestBefore !== null && $bestBefore !== ''
                    && $bbMin !== null && $bestBefore !== $bbMin) {
                    continue;
                }
                $free = $kapasitas - $terisi;
                if ($free <= 0) {
                    continue;
                }
                $take = min($free, $need);
                $alokasi[] = ['id_deep' => (int) $dp->id_deep, 'jumlah' => $take];
                $need -= $take;
            }
        }

        if ($need > 0) {
            if ($idLokasiDefault <= 0) {
                return ['error' => 'Lokasi block default tidak valid, tidak bisa mencari line numpang', 'code' => 422];
            }

            // Line prioritas produk
            $prioritasLineProduk = [];
            $prioritasRows = DB::table('prioritas_lokasi_produk as p')
                ->join('block as b', function ($j) {
                    $j->on('b.id_block', '=', 'p.id_block')
                        ->on('b.id_pengguna_lokasi', '=', 'p.id_pengguna_lokasi');
                })
                ->join('line as ln', function ($j) {
                    $j->on('ln.id_line', '=', 'p.id_line')
                        ->on('ln.id_pengguna_lokasi', '=', 'p.id_pengguna_lokasi');
                })
                ->where('p.id_produk', $idProduk)
                ->where('b.id_lokasi', $idLokasiDefault)
                ->where('p.id_pengguna_lokasi', $idPenggunaLokasi)
                ->selectRaw('b.kode_block, ln.nomor_line')
                ->get();
            foreach ($prioritasRows as $pl) {
                $prioritasLineProduk[strtoupper($pl->kode_block).'-'.(int) $pl->nomor_line] = true;
            }
            $adaPrioritasLineProduk = ! empty($prioritasLineProduk);

            // Cari line numpang yang ada kapasitas
            $qNumpang = DB::table('block as b')
                ->join('line as ln', function ($j) {
                    $j->on('ln.id_block', '=', 'b.id_block')
                        ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi');
                })
                ->join('level as lv', function ($j) {
                    $j->on('lv.id_line', '=', 'ln.id_line')
                        ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                })
                ->join('deep as d', function ($j) {
                    $j->on('d.id_level', '=', 'lv.id_level')
                        ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
                })
                ->leftJoin('stok_gudang_deep as sd', function ($j) {
                    $j->on('sd.id_deep', '=', 'd.id_deep')
                        ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
                })
                ->leftJoin('stok_gudang as s', function ($j) {
                    $j->on('s.id_stok', '=', 'sd.id_stok_header')
                        ->on('s.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi')
                        ->on('s.jumlah_sisa', '>', DB::raw('0'));
                })
                ->where('b.id_lokasi', $idLokasiDefault)
                ->where('b.id_pengguna_lokasi', $idPenggunaLokasi)
                ->whereRaw('NOT (b.kode_block = ? AND ln.nomor_line = ?)', [$kodeBlock, $noLine])
                ->selectRaw('b.kode_block, ln.nomor_line, SUM(d.kapasitas) AS total_kapasitas, COALESCE(SUM(CASE WHEN s.id_stok IS NOT NULL THEN sd.jumlah ELSE 0 END),0) AS total_terisi')
                ->groupBy('b.kode_block', 'ln.nomor_line')
                ->havingRaw('total_kapasitas > total_terisi AND total_kapasitas > 0')
                ->orderByRaw('(b.kode_block = ?) DESC, b.kode_block ASC, ln.nomor_line ASC', [$kodeBlock]);

            if ($tipePenerimaan === 'Secondary') {
                $qNumpang->whereNotIn('b.kode_block', ['BS', 'BAD', 'BADSTOCK', 'BAD STOCK', 'REJECT', 'FESTIVE', 'HOLD', 'MOBIL']);
            } elseif ($tipePenerimaan !== 'REJECT') {
                $qNumpang->whereNotIn('b.kode_block', ['BS', 'BAD', 'BADSTOCK', 'BAD STOCK', 'REJECT', 'RECEH', 'TRANSIT', 'FESTIVE', 'HOLD']);
            }

            $candidates = $qNumpang->get();

            if ($candidates->isEmpty()) {
                return ['error' => 'Kapasitas line tidak cukup. Silahkan buat layout/line baru untuk menambah kapasitas.', 'code' => 422];
            }

            $daftarLinePrioritas = [];
            $daftarLineNonPrioritas = [];
            foreach ($candidates as $rowLine) {
                $labelLine = strtoupper($rowLine->kode_block).'-'.(int) $rowLine->nomor_line;
                $lineDipakaiProdukLainNumpang = false;
                $adaProdukSamaNumpang = false;
                $produkNumpang = DB::table('stok_gudang as s')
                    ->where('s.lokasi_block', $labelLine)
                    ->where('s.jumlah_sisa', '>', 0)
                    ->where('s.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->distinct()->pluck('id_produk');
                foreach ($produkNumpang as $pid) {
                    if ((int) $pid === $idProduk) {
                        $adaProdukSamaNumpang = true;
                    } else {
                        $lineDipakaiProdukLainNumpang = true;
                    }
                }
                if ($lineDipakaiProdukLainNumpang && ! $adaProdukSamaNumpang) {
                    continue;
                }
                $rowLine->label_line = $labelLine;
                if ($adaPrioritasLineProduk && isset($prioritasLineProduk[$labelLine])) {
                    $daftarLinePrioritas[] = $rowLine;
                } else {
                    $daftarLineNonPrioritas[] = $rowLine;
                }
            }

            $kandidatLine = array_merge($daftarLinePrioritas, $daftarLineNonPrioritas);

            foreach ($kandidatLine as $rowLine) {
                if ($need <= 0) {
                    break;
                }
                $deepsNumpang = $this->deepsLine($idPenggunaLokasi, $rowLine->kode_block, (int) $rowLine->nomor_line);
                if (empty($deepsNumpang)) {
                    continue;
                }

                $linePunyaStokNumpang = false;
                $bbMinLineNumpang = null;
                $totalFreeLine = 0;
                foreach ($deepsNumpang as $dp) {
                    $kapasitasDeep = (int) $dp->kapasitas;
                    $terisiDeep = (int) $dp->terisi;
                    $bbMinDeep = $dp->bb_min ?? null;
                    $freeDeep = $kapasitasDeep - $terisiDeep;
                    if ($freeDeep > 0) {
                        $totalFreeLine += $freeDeep;
                    }
                    if ($terisiDeep > 0 && $bbMinDeep !== null) {
                        $linePunyaStokNumpang = true;
                        if ($bbMinLineNumpang === null || $bbMinDeep < $bbMinLineNumpang) {
                            $bbMinLineNumpang = $bbMinDeep;
                        }
                    }
                }

                if ($totalFreeLine <= 0) {
                    continue;
                }

                $bolehPakaiLineNumpang = true;
                if ($tipePenerimaan !== 'REJECT' && $linePunyaStokNumpang && $bestBefore !== null && $bestBefore !== ''
                    && $bbMinLineNumpang !== null && $bestBefore > $bbMinLineNumpang) {
                    $bolehPakaiLineNumpang = false;
                }
                if (! $bolehPakaiLineNumpang) {
                    continue;
                }

                foreach ($deepsNumpang as $dp) {
                    if ($need <= 0) {
                        break;
                    }
                    $kapasitas = (int) $dp->kapasitas;
                    $terisi = (int) $dp->terisi;
                    $bbMin = $dp->bb_min ?? null;
                    if ($tipePenerimaan !== 'REJECT' && $terisi > 0 && $bestBefore !== null && $bestBefore !== ''
                        && $bbMin !== null && $bestBefore !== $bbMin) {
                        continue;
                    }
                    $free = $kapasitas - $terisi;
                    if ($free <= 0) {
                        continue;
                    }
                    $take = min($free, $need);
                    $alokasi[] = ['id_deep' => (int) $dp->id_deep, 'jumlah' => $take];
                    $need -= $take;
                }
            }

            if ($need > 0) {
                return ['error' => 'Kapasitas line tidak cukup. Silahkan buat layout/line baru untuk menambah kapasitas.', 'code' => 422];
            }
        }

        return ['alokasi' => $alokasi];
    }

    // =========================================================================
    //  HELPERS
    // =========================================================================
    private function kandidatPrior(string $idPenggunaLokasi, string $tipePenerimaan, string $column, array $ids): array
    {
        $query = $this->baseDeep($idPenggunaLokasi)
            ->where($this->whereNormalBlockActive($tipePenerimaan))
            ->whereIn($column, $ids);

        $kategori = $this->kategoriLokasi($tipePenerimaan);
        if ($kategori) {
            $query->where($kategori);
        }

        return $query
            ->orderByRaw('l.nama_lokasi, b.kode_block, ln.nomor_line, d.deep ASC, CAST(lv.level AS UNSIGNED) ASC')
            ->get()->map(fn ($r) => (array) $r)->all();
    }

    private function baseDeep(string $idPenggunaLokasi)
    {
        return DB::table('deep as d')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
            ->join('block as b', 'b.id_block', '=', 'ln.id_block')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->select(
                'd.id_deep', 'd.kapasitas', 'l.id_lokasi', 'l.nama_lokasi',
                'b.id_block', 'b.kode_block', 'ln.id_line', 'ln.nomor_line',
                'lv.level', 'd.deep'
            )
            ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('lv.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('b.id_pengguna_lokasi', $idPenggunaLokasi);
    }

    private function deepsLine(string $idPenggunaLokasi, string $kodeBlock, int $noLine): array
    {
        return DB::table('block as b')
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->join('line as ln', function ($j) {
                $j->on('ln.id_block', '=', 'b.id_block')
                    ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi');
            })
            ->join('level as lv', function ($j) {
                $j->on('lv.id_line', '=', 'ln.id_line')
                    ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->join('deep as d', function ($j) {
                $j->on('d.id_level', '=', 'lv.id_level')
                    ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang_deep as sd', function ($j) {
                $j->on('sd.id_deep', '=', 'd.id_deep')
                    ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang as s', function ($j) {
                $j->on('s.id_stok', '=', 'sd.id_stok_header')
                    ->on('s.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi')
                    ->on('s.jumlah_sisa', '>', DB::raw('0'));
            })
            ->where('b.kode_block', $kodeBlock)
            ->where('ln.nomor_line', $noLine)
            ->where('b.id_pengguna_lokasi', $idPenggunaLokasi)
            ->selectRaw('d.id_deep, d.kapasitas, COALESCE(SUM(CASE WHEN s.id_stok IS NOT NULL THEN sd.jumlah ELSE 0 END),0) AS terisi, b.id_lokasi, MIN(s.best_before) AS bb_min, MAX(s.best_before) AS bb_max')
            ->groupBy('d.id_deep', 'd.kapasitas', 'b.id_lokasi')
            ->orderBy('d.deep', 'ASC')
            ->orderBy('lv.level', 'ASC')
            ->get()->all();
    }

    private function infoBlockDeep(string $idPenggunaLokasi, int $idDeep): ?array
    {
        $row = DB::table('deep as d')
            ->join('level as lv', function ($j) {
                $j->on('lv.id_level', '=', 'd.id_level')
                    ->on('lv.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->join('line as ln', function ($j) {
                $j->on('ln.id_line', '=', 'lv.id_line')
                    ->on('ln.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->join('block as b', function ($j) {
                $j->on('b.id_block', '=', 'ln.id_block')
                    ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->where('d.id_deep', $idDeep)
            ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
            ->selectRaw('UPPER(TRIM(b.kode_block)) AS kode_block, UPPER(TRIM(l.nama_lokasi)) AS nama_lokasi')
            ->first();

        return $row ? ['kode_block' => trim((string) $row->kode_block), 'nama_lokasi' => trim((string) $row->nama_lokasi)] : null;
    }

    private function whereNormalBlockActive(string $tipePenerimaan): \Closure
    {
        return function ($q) use ($tipePenerimaan) {
            if ($tipePenerimaan === 'REJECT') {
                $q->whereRaw("UPPER(TRIM(b.kode_block)) = 'REJECT'");
                return;
            }
            $exclude = ['BS', 'BAD', 'BADSTOCK', 'REJECT', 'RECEH', 'TRANSIT', 'FESTIVE'];
            if ($tipePenerimaan === 'Secondary') {
                $exclude = ['BS', 'BAD', 'BADSTOCK', 'REJECT', 'RECEH', 'TRANSIT', 'FESTIVE', 'HOLD', 'MOBIL'];
            }
            $q->whereRaw("UPPER(TRIM(b.kode_block)) REGEXP '^[A-Z][A-Z0-9]*$'")
                ->whereNotIn(DB::raw('UPPER(TRIM(b.kode_block))'), $exclude);
        };
    }

    private function kategoriLokasi(string $tipePenerimaan): ?\Closure
    {
        if ($tipePenerimaan === 'Primary') {
            return fn ($q) => $q->whereRaw("UPPER(TRIM(l.nama_lokasi)) IN ('GALLON','SPS')");
        }
        if ($tipePenerimaan === 'Primary XWH') {
            return fn ($q) => $q->whereRaw("UPPER(TRIM(l.nama_lokasi)) = 'XWH'");
        }
        return null;
    }

    private function buatBatchDariBbAsal(string $bestBefore, string $asal): string
    {
        $bb = trim($bestBefore);
        $asal = trim($asal);
        if ($bb === '' || $asal === '') {
            return '';
        }
        $dt = DateTime::createFromFormat('Y-m-d', $bb);
        if (! $dt) {
            return '';
        }
        $idPlant = strtoupper(trim(explode('-', $asal, 2)[0]));
        if ($idPlant === '') {
            preg_match('/[A-Za-z0-9]+/', $asal, $m);
            $idPlant = strtoupper(trim($m[0] ?? ''));
        }
        if ($idPlant === '') {
            return '';
        }
        return $dt->format('ymd').$idPlant;
    }
}
