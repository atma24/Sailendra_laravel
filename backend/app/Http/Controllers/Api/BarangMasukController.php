<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Api\Concerns\ExcelReader;
use DateTime;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Throwable;

class BarangMasukController extends Controller
{
    use ApiResponse;
    use ExcelReader;

    private const PRODUK_TANPA_BATCH = [10516938, 10516939];

    private const BLOCK_KHUSUS = ['BS', 'BAD', 'BADSTOCK', 'BAD STOCK', 'REJECT', 'FESTIVE', 'HOLD'];

    // =========================================================================
    // 1. GET LIST INBOUND
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
                'bm.shipment_id', 'bm.catatan', 'bm.lokasi_block', 'bm.created_at', 'bm.status','bm.waktu_mulai_input', 
                'bm.durasi_detik',
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
    // 2. PREVIEW / REKOMENDASI LOKASI
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
    // 3. SIMPAN INBOUND
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
        $shipmentId = trim((string) ($in['shipment_id'] ?? '')); // Penambahan Shipment ID
        $catatan = (isset($in['catatan']) && $in['catatan'] !== '') ? trim((string) $in['catatan']) : null;
        $lokasiBlock = trim((string) ($in['lokasi_block'] ?? ''));
        $lokasiLine = trim((string) ($in['lokasi_line'] ?? ''));
        $durasiDetik = isset($in['durasi_detik']) ? (int) $in['durasi_detik'] : null;
        
        if ($durasiDetik !== null && $durasiDetik < 0) {
            $durasiDetik = null;
        }

        // Pengecekan Duplikat Shipment ID
        if ($shipmentId !== '') {
            $isExist = DB::table('barang_masuk')->where('shipment_id', $shipmentId)->exists();
            if ($isExist) {
                return $this->fail("Gagal menyimpan. Shipment ID {$shipmentId} sudah terdaftar di sistem.");
            }
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

        $penggunaRow = DB::table('pengguna')->where('id_pengguna', $idPengguna)->first();
        if (! $penggunaRow) {
            return $this->fail('Pengguna tidak ditemukan.');
        }
        
        $isMultiLokasi = in_array(strtolower(trim((string) $penggunaRow->role)), ['superadmin', 'support'], true);
        if (! $isMultiLokasi && trim((string) $penggunaRow->id_pengguna_lokasi) !== $idPenggunaLokasi) {
            return $this->fail('Lokasi pengguna tidak sesuai dengan lokasi transaksi.', 403);
        }

        $produkRow = DB::table('produk')->where('id_produk', $idProduk)->first();
        if (! $produkRow) {
            return $this->fail('Produk tidak ditemukan.');
        }
        $namaProduk = trim((string) $produkRow->nama_produk);
        $isiPerPcs = (int) $produkRow->isi_per_pcs > 0 ? (int) $produkRow->isi_per_pcs : 1;

        // Konversi line kosong
        $konversiIds = [];
        if ($tipePenerimaan !== 'REJECT' && ! empty($in['konversi'])) {
            $rawKonv = is_array($in['konversi']) ? $in['konversi'] : explode(',', (string) $in['konversi']);
            foreach ($rawKonv as $kv) {
                $idLineK = (int) (is_array($kv) ? ($kv['id_line'] ?? 0) : $kv);
                if ($idLineK > 0) {
                    $konversiIds[] = $idLineK;
                }
            }
            $konversiIds = array_values(array_unique($konversiIds));
            foreach ($konversiIds as $idLineK) {
                $resKonv = $this->konversiLine($idPenggunaLokasi, $idLineK, $idProduk);
                if (isset($resKonv['error'])) {
                    return $this->fail('Konversi line gagal: '.$resKonv['error'], 422);
                }
            }
        }

        $multiplier = 1;
        if ($tipePenerimaan === 'REJECT' && strtoupper($satuan) !== 'GALLON' && strtoupper($satuan) !== 'PCS') {
            $multiplier = $isiPerPcs;
            $satuan = 'PCS';
        }
        if (in_array($idProduk, self::PRODUK_TANPA_BATCH, true)) {
            $bestBefore = '9999-12-31';
            $asalPabrik = '-';
            $batch = '-';
        }

        if ($tipePenerimaan === 'REJECT') {
            $bestBefore = '9999-12-31';
        }

        // Resolusi alokasi
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
            $auto = $this->rekomendasiAuto($idPenggunaLokasi, $idProduk, $jumlah, $bestBefore, $tipePenerimaan, false);
            if (isset($auto['error'])) {
                return $this->fail($auto['error'], $auto['code'] ?? 422);
            }
            $alokasi = array_map(fn ($r) => ['id_deep' => (int) $r['id_deep'], 'jumlah' => (int) $r['alokasi']], $auto['rekomendasi']);
        }

        // Validasi block tiap deep
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

        // Validasi BB line
        if ($tipePenerimaan !== 'REJECT' && $bestBefore !== null && $bestBefore !== '' && ! empty($alokasi)) {
            $deepIdsValidasi = array_values(array_unique(array_filter($this->mapDeepIds($alokasi))));
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

        // Cek kapasitas deep
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

        // Group alokasi per line
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

        $idBarangMasukList = [];
        $idStokList = [];
        $ringkasanList = [];
        $lokasiAkhirStr = '';

        try {
            DB::transaction(function () use (
                $alokasiPerLine, $idPenggunaLokasi, $idPengguna, $idProduk, $namaProduk,
                $satuan, $tanggalMasuk, $tipePenerimaan, $bestBefore, $batch, $asalPabrik,
                $noDn, $namaDriver, $noMobil, $catatan, $waktuMulai, $durasiDetik, $multiplier,
                $shipmentId,
                &$idBarangMasukList, &$idStokList, &$ringkasanList, &$lokasiAkhirStr
            ) {
                $parts = [];
                foreach ($alokasiPerLine as $lineLabel => $details) {
                    $jumlahLine = 0;
                    foreach ($details as $det) {
                        $jumlahLine += $det['jumlah'];
                    }
                    
                    $jumlahTersimpan = $jumlahLine * $multiplier;
                    $parts[] = $lineLabel.' ('.$jumlahTersimpan.')';

                    $idBm = DB::table('barang_masuk')->insertGetId([
                        'shipment_id' => $shipmentId, // Penambahan Shipment ID
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_pengguna' => $idPengguna,
                        'id_produk' => $idProduk,
                        'nama_produk' => $namaProduk,
                        'jumlah' => $jumlahTersimpan,
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
                        'jumlah_sisa' => $jumlahTersimpan,
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
                            'jumlah' => $det['jumlah'] * $multiplier,
                            'best_before' => $bestBefore,
                            'batch' => $batch,
                            'lokasi_block' => $lineLabel,
                            'created_at' => DB::raw('NOW()'),
                        ]);
                    }

                    $ringkasanList[] = ['line' => $lineLabel, 'qty' => $jumlahTersimpan];
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
    // 4. UPLOAD OTM EXCEL, SUBMIT DRAFT, & KONFIRMASI INBOUND
    // =========================================================================
    public function uploadInboundFile(Request $request)
    {
        set_time_limit(0);
        $idPenggunaLokasi = trim((string) $request->input('upload_lokasi', ''));
        $idPengguna = (int) $request->input('id_pengguna', 0);

        if ($idPenggunaLokasi === '' || $idPengguna <= 0) {
            return $this->fail('id_pengguna_lokasi dan id_pengguna wajib diisi.');
        }

        $file = $request->file('file_excel');
        if (! $file || ! $file->isValid()) {
            return $this->fail('Harap pilih file Excel yang valid.');
        }

        $ext = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        try {
            $parsed = $this->bacaFileSpreadsheet($path, $ext);
            $rowsData = $parsed['rows'];
        } catch (Throwable $e) {
            return $this->fail($e->getMessage());
        }

        if (empty($rowsData)) {
            return $this->fail('File Excel kosong atau tidak bisa dibaca.');
        }

        $headerRow = [];
        $dataStartIndex = 0;
        foreach ($rowsData as $index => $row) {
            if (in_array('Shipment Id', $row, true)) {
                $headerRow = $row;
                $dataStartIndex = $index + 1;
                break;
            }
        }

        if (empty($headerRow)) {
            return $this->fail('Format tidak dikenali. Kolom "Shipment Id" tidak ditemukan.');
        }

        $colMap = [];
        foreach ($headerRow as $idx => $colName) {
            $clean = trim((string) $colName);
            if ($clean !== '') {
                $colMap[$clean] = $idx;
            }
        }

        $idxShipment = $colMap['Shipment Id'] ?? -1;
        $idxProdukId = $colMap['Material Id'] ?? -1;
        $idxProdukDesc = $colMap['Material Desc'] ?? -1;
        $idxAsalId = $colMap['Source Id'] ?? -1; 
        $idxAsalName = $colMap['Source Name'] ?? -1;
        $idxTransporter = $colMap['Actual Transporter Name'] ?? -1;
        $idxQty = $colMap['Actual Quantity'] ?? -1;
        $idxDate = $colMap['Actual PickUp Date'] ?? -1;
        $idxDn = $colMap['DN number'] ?? -1;
        $idxTruck = $colMap['Truck Type'] ?? -1;

        if ($idxShipment < 0 || $idxProdukDesc < 0 || $idxQty < 0) {
            return $this->fail('Kolom mandatory (Shipment Id, Material Desc, Actual Quantity) tidak lengkap di Excel.');
        }

        $produkList = DB::table('produk')->get(['id_produk', 'nama_produk', 'satuan']);
        $mapProduk = [];
        foreach ($produkList as $p) {
            $mapProduk[strtoupper(trim((string) $p->nama_produk))] = $p;
        }

        $grouped = [];
        $countUnmapped = 0;
        
        for ($i = $dataStartIndex; $i < count($rowsData); $i++) {
            $data = $rowsData[$i];
            
            $shipmentId = trim((string) ($data[$idxShipment] ?? ''));
            if ($shipmentId === '') continue;

            $namaProdukExcel = strtoupper(trim((string) ($data[$idxProdukDesc] ?? '')));
            $jumlah = (int) ($data[$idxQty] ?? 0);

            if ($jumlah <= 0) continue;
            
            if (!isset($mapProduk[$namaProdukExcel])) {
                $idProdNum = (int) ($data[$idxProdukId] ?? 0);
                $found = false;
                foreach ($produkList as $p) {
                    if ($p->id_produk === $idProdNum) {
                        $mapProduk[$namaProdukExcel] = $p;
                        $found = true; break;
                    }
                }
                if (!$found) {
                    $countUnmapped++; 
                    continue; 
                }
            }
            $produk = $mapProduk[$namaProdukExcel];

            $asalId = $idxAsalId >= 0 ? trim((string) ($data[$idxAsalId] ?? '')) : '';
            $asalName = $idxAsalName >= 0 ? trim((string) ($data[$idxAsalName] ?? '')) : 'Pabrik';
            $asalPabrik = ($asalId !== '') ? $asalId . ' - ' . $asalName : $asalName;
            $transporter = $idxTransporter >= 0 ? trim((string) ($data[$idxTransporter] ?? '')) : '-';
            $noDn = $idxDn >= 0 ? trim((string) ($data[$idxDn] ?? '')) : '';
            $truckType = $idxTruck >= 0 ? trim((string) ($data[$idxTruck] ?? '')) : '-';
            
            $rawDate = $idxDate >= 0 ? trim((string) ($data[$idxDate] ?? '')) : '';
            $tanggalMasuk = date('Y-m-d');
            if ($rawDate !== '') {
                $parsed = date('Y-m-d', strtotime(str_replace('/', '-', substr($rawDate, 0, 10))));
                if ($parsed !== '1970-01-01' && $parsed !== false) {
                    $tanggalMasuk = $parsed;
                }
            }

            if (!isset($grouped[$shipmentId])) {
                $grouped[$shipmentId] = [
                    'shipment_id' => $shipmentId,
                    'id_pengguna' => $idPengguna,
                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                    'tanggal_masuk' => $tanggalMasuk,
                    'asal_pabrik' => $asalPabrik,
                    'no_dn' => $noDn,
                    'nama_driver' => $transporter,
                    'no_mobil' => $truckType,
                    'tipe_penerimaan' => 'Primary',
                    'catatan' => 'Upload OTM Inbound',
                    'status' => 'Draft',
                    'items' => []
                ];
            }

            $itemTerisi = false;
            foreach ($grouped[$shipmentId]['items'] as &$existingItem) {
                if ($existingItem['id_produk'] === (int) $produk->id_produk) {
                    $existingItem['jumlah'] += $jumlah;
                    $itemTerisi = true;
                    break;
                }
            }

            if (!$itemTerisi) {
                $grouped[$shipmentId]['items'][] = [
                    'id_produk' => (int) $produk->id_produk,
                    'nama_produk' => $produk->nama_produk,
                    'satuan' => $produk->satuan ?? 'PCS',
                    'jumlah' => $jumlah,
                ];
            }
        }

        if (empty($grouped)) {
            return $this->fail('Gagal memproses file. Pastikan data tidak kosong dan produk terdaftar di Master Data.');
        }

        $inserted = 0;
        $skipped = 0;
        $skippedShipments = []; // Array untuk menampung Shipment ID yang bentrok

        DB::beginTransaction();
        try {
            foreach ($grouped as $shipmentId => $payload) {
                // Pengecekan ketat: Jika shipment_id sudah ada di database (status apapun), langsung skip
                $isExist = DB::table('barang_masuk')
                    ->where('shipment_id', $shipmentId)
                    ->exists();
                    
                if ($isExist) {
                    $skipped++;
                    $skippedShipments[] = $shipmentId;
                    continue; // Skip dan lanjut ke shipment_id berikutnya
                }

                foreach ($payload['items'] as $item) {
                    DB::table('barang_masuk')->insert([
                        'shipment_id' => $payload['shipment_id'],
                        'id_pengguna_lokasi' => $payload['id_pengguna_lokasi'],
                        'id_pengguna' => $payload['id_pengguna'],
                        'id_produk' => $item['id_produk'],
                        'nama_produk' => $item['nama_produk'],
                        'jumlah' => $item['jumlah'],
                        'satuan' => $item['satuan'],
                        'tanggal_masuk' => $payload['tanggal_masuk'],
                        'tipe_penerimaan' => $payload['tipe_penerimaan'],
                        'asal_pabrik' => $payload['asal_pabrik'],
                        'no_dn' => $payload['no_dn'],
                        'nama_driver' => $payload['nama_driver'],
                        'no_mobil' => $payload['no_mobil'],
                        'catatan' => $payload['catatan'],
                        'status' => $payload['status'], 
                        'created_at' => now(),
                    ]);
                }
                $inserted++;
            }
            DB::commit();
            
            $msg = "Upload selesai! $inserted Shipment ID ditambahkan sebagai Draft.";
            if ($skipped > 0) {
                $skippedList = implode(', ', $skippedShipments);
                $msg .= " ($skipped dilewati karena Shipment ID sudah ada: $skippedList).";
            }
            if ($countUnmapped > 0) {
                $msg .= " Peringatan: $countUnmapped baris diabaikan (produk tidak dikenal).";
            }
            return $this->ok(['inserted' => $inserted, 'skipped' => $skipped], $msg);
            
        } catch (Throwable $e) {
            DB::rollBack();
            return $this->fail('Gagal menyimpan ke database: ' . $e->getMessage(), 500);
        }
    }

    public function submitDraft(Request $request)
    {
        $shipmentId = trim((string) $request->input('shipment_id', ''));
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi', ''));
        $itemsReq = $request->input('items', []); 

        $waktuMulaiInput = trim((string) $request->input('waktu_mulai_input', ''));
        $durasiDetik = $request->input('durasi_detik');
        if ($durasiDetik !== null && (int)$durasiDetik < 0) {
            $durasiDetik = null;
        }

        $waktuMulai = null;
        if ($waktuMulaiInput !== '') {
            $dtMulai = DateTime::createFromFormat('Y-m-d H:i:s', $waktuMulaiInput);
            if (!$dtMulai) {
                $dtMulai = DateTime::createFromFormat('Y-m-d\TH:i:s', $waktuMulaiInput);
            }
            $waktuMulai = $dtMulai ? $dtMulai->format('Y-m-d H:i:s') : null;
        }

        if ($shipmentId === '' || $idPenggunaLokasi === '' || empty($itemsReq)) {
            return $this->fail('shipment_id, id_pengguna_lokasi, dan items wajib diisi.');
        }

        DB::beginTransaction();
        try {
            $insertedRencana = 0;
            $processedItems = 0;

            foreach ($itemsReq as $it) {
                $idBm = (int) ($it['id_barang_masuk'] ?? 0);
                $bbReq = trim((string) ($it['best_before'] ?? ''));

                if ($idBm <= 0 || $bbReq === '') {
                    throw new Exception("Ada item yang tidak memiliki best_before atau ID tidak valid.");
                }

                $draft = DB::table('barang_masuk')
                    ->where('id_barang_masuk', $idBm)
                    ->where('shipment_id', $shipmentId)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('status', 'Draft')
                    ->lockForUpdate()
                    ->first();

                if (!$draft) {
                    continue; 
                }

                $idPlant = strtoupper(trim(explode('-', $draft->asal_pabrik, 2)[0]));
                if ($idPlant === '' || $idPlant === 'PABRIK') {
                    $idPlant = 'PABRIK'; 
                }
                
                $dt = DateTime::createFromFormat('Y-m-d', $bbReq);
                if (!$dt) {
                    throw new Exception("Format Best Before tidak valid untuk produk {$draft->nama_produk}");
                }
                $batchBaru = $dt->format('ymd') . $idPlant;

                if (strtoupper($draft->tipe_penerimaan) === 'REJECT') {
                    $batchBaru = '999999' . $idPlant;
                    $bbReq = '9999-12-31';
                }
                if (in_array((int)$draft->id_produk, [10516938, 10516939])) { 
                    $bbReq = '9999-12-31';
                    $batchBaru = '-';
                }

                // Qty 0: skip alokasi, langsung Pending tanpa lokasi
                if ((int) $draft->jumlah <= 0) {
                    $updateData = [
                        'status' => 'Pending',
                        'best_before' => $bbReq,
                        'batch' => $batchBaru,
                        'batch_sekarang' => $batchBaru,
                        'diperbarui_pada' => now()
                    ];
                    if ($waktuMulai !== null) {
                        $updateData['waktu_mulai_input'] = DB::raw("COALESCE(waktu_mulai_input, '{$waktuMulai}')");
                    }
                    if ($durasiDetik !== null) {
                        $updateData['durasi_detik'] = (int)$durasiDetik;
                    }
                    DB::table('barang_masuk')
                        ->where('id_barang_masuk', $draft->id_barang_masuk)
                        ->update($updateData);
                    $processedItems++;
                    continue;
                }

                $auto = $this->rekomendasiAuto(
                    $idPenggunaLokasi, 
                    (int) $draft->id_produk, 
                    (float) $draft->jumlah, 
                    $bbReq, 
                    $draft->tipe_penerimaan, 
                    false
                );

                if (isset($auto['error'])) {
                    throw new Exception("Gagal mencari lokasi untuk {$draft->nama_produk}: " . $auto['error']);
                }

                $alokasi = $auto['rekomendasi'] ?? [];
                if (empty($alokasi)) {
                    throw new Exception("Tidak ada alokasi lokasi kosong untuk {$draft->nama_produk}");
                }

                foreach ($alokasi as $al) {
                    DB::table('rencana_masuk_deep')->insert([
                        'id_barang_masuk' => $draft->id_barang_masuk,
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_deep' => $al['id_deep'],
                        'jumlah_rencana' => $al['alokasi'],
                        'best_before' => $bbReq,
                        'batch' => $batchBaru
                    ]);
                    $insertedRencana++;
                }

                $kumpulanLokasi = [];
                foreach ($alokasi as $al) {
                    $kumpulanLokasi[] = $al['kode_block'] . '-' . $al['nomor_line'];
                }
                $lokasiAkhirStr = implode(', ', array_unique($kumpulanLokasi));

                $updateData = [
                    'status' => 'Pending',
                    'best_before' => $bbReq,
                    'batch' => $batchBaru,
                    'batch_sekarang' => $batchBaru,
                    'lokasi_block' => $lokasiAkhirStr,
                    'diperbarui_pada' => now()
                ];

                if ($waktuMulai !== null) {
                    $updateData['waktu_mulai_input'] = DB::raw("COALESCE(waktu_mulai_input, '{$waktuMulai}')");
                }
                if ($durasiDetik !== null) {
                    $updateData['durasi_detik'] = (int)$durasiDetik;
                }

                DB::table('barang_masuk')
                    ->where('id_barang_masuk', $draft->id_barang_masuk)
                    ->update($updateData);
                $processedItems++;
            }

            if ($processedItems === 0) {
                throw new Exception("Tidak ada data Draft yang valid untuk di-submit.");
            }

            DB::commit();
            return $this->okMessage("Berhasil Submit! Status berubah menjadi Pending.");

        } catch (Throwable $e) {
            DB::rollBack();
            return $this->fail("Gagal Submit: " . $e->getMessage(), 500);
        }
    }

    public function konfirmasiInbound(Request $request)
    {
        $shipmentId = trim((string) $request->input('shipment_id', ''));
        $idBm = (int) $request->input('id_barang_masuk', 0);
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi', ''));

        $waktuMulaiInput = trim((string) $request->input('waktu_mulai_input', ''));
        $durasiDetik = $request->input('durasi_detik');
        if ($durasiDetik !== null && (int)$durasiDetik < 0) {
            $durasiDetik = null;
        }

        $waktuMulai = null;
        if ($waktuMulaiInput !== '') {
            $dtMulai = DateTime::createFromFormat('Y-m-d H:i:s', $waktuMulaiInput);
            if (!$dtMulai) {
                $dtMulai = DateTime::createFromFormat('Y-m-d\TH:i:s', $waktuMulaiInput);
            }
            $waktuMulai = $dtMulai ? $dtMulai->format('Y-m-d H:i:s') : null;
        }

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib diisi.');
        }
        if ($shipmentId === '' && $idBm <= 0) {
            return $this->fail('Pilih shipment_id atau id_barang_masuk yang akan dikonfirmasi.');
        }

        DB::beginTransaction();
        try {
            $query = DB::table('barang_masuk')
                ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('status', 'Pending');

            if ($shipmentId !== '') {
                $query->where('shipment_id', $shipmentId);
            } else {
                $query->where('id_barang_masuk', $idBm);
            }

            $pendingItems = $query->lockForUpdate()->get();

            if ($pendingItems->isEmpty()) {
                throw new Exception('Tidak ada data Inbound berstatus Pending untuk dikonfirmasi.');
            }

            $idsProses = $pendingItems->pluck('id_barang_masuk')->toArray();

            $rencana = DB::table('rencana_masuk_deep as r')
                ->join('deep as d', 'd.id_deep', '=', 'r.id_deep')
                ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
                ->join('line as ln', 'ln.id_line', '=', 'lv.id_line')
                ->join('block as b', 'b.id_block', '=', 'ln.id_block')
                ->whereIn('r.id_barang_masuk', $idsProses)
                ->select('r.*', 'b.kode_block', 'ln.nomor_line')
                ->get();

            foreach ($pendingItems as $item) {
                $itemRencana = $rencana->where('id_barang_masuk', $item->id_barang_masuk);
                
                if ($itemRencana->isEmpty()) {
                    continue; 
                }

                $groupedRencana = [];
                foreach ($itemRencana as $r) {
                    $labelLine = strtoupper(trim($r->kode_block)) . '-' . $r->nomor_line;
                    $groupedRencana[$labelLine][] = $r;
                }

                foreach ($groupedRencana as $labelLine => $details) {
                    $totalQtyLine = 0;
                    foreach ($details as $d) {
                        $totalQtyLine += $d->jumlah_rencana;
                    }

                    $idStok = DB::table('stok_gudang')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_produk' => $item->id_produk,
                        'nama_produk' => $item->nama_produk,
                        'id_barang_masuk' => $item->id_barang_masuk,
                        'jumlah_sisa' => $totalQtyLine,
                        'batch' => $details[0]->batch,
                        'satuan' => $item->satuan,
                        'best_before' => $details[0]->best_before,
                        'lokasi_block' => $labelLine,
                        'created_at' => now(),
                    ]);

                    foreach ($details as $d) {
                        DB::table('stok_gudang_deep')->insert([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_stok_header' => $idStok,
                            'id_deep' => $d->id_deep,
                            'jumlah' => $d->jumlah_rencana,
                            'best_before' => $d->best_before,
                            'batch' => $d->batch,
                            'lokasi_block' => $labelLine,
                            'created_at' => now(),
                        ]);
                    }
                }
            }

            $updateData = [
                'status' => 'Selesai',
                'diperbarui_pada' => now()
            ];

            if ($waktuMulai !== null) {
                $updateData['waktu_mulai_input'] = DB::raw("COALESCE(waktu_mulai_input, '{$waktuMulai}')");
            }
            if ($durasiDetik !== null) {
                $updateData['durasi_detik'] = (int)$durasiDetik;
            }

            DB::table('barang_masuk')
                ->whereIn('id_barang_masuk', $idsProses)
                ->update($updateData);

            DB::table('rencana_masuk_deep')
                ->whereIn('id_barang_masuk', $idsProses)
                ->delete();

            DB::commit();
            return $this->okMessage('Konfirmasi Inbound Berhasil! Stok telah ditambahkan secara fisik ke dalam sistem.');
        } catch (Throwable $e) {
            DB::rollBack();
            return $this->fail('Gagal konfirmasi: ' . $e->getMessage(), 500);
        }
    }

    public function downloadStockTemplate()
    {
        $produkList = DB::table('produk')->selectRaw("CONCAT(id_produk, ' - ', nama_produk) AS label_produk")->pluck('label_produk')->toArray();
        $kategoriList = DB::table('lokasi')->distinct()->orderBy('kategori')->pluck('kategori')->toArray();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Template');

        $headers = ['nama_produk', 'jenis_produk', 'kuantiti', 'lokasi_block', 'lokasi_line', 'batch', 'best_before'];
        $sheet->fromArray($headers, NULL, 'A1');

        $headerStyle = $sheet->getStyle('A1:G1');
        $headerStyle->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
        $headerStyle->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF191970');

        $dataSheet = $spreadsheet->createSheet();
        $dataSheet->setTitle('DataRef');
        foreach ($produkList as $index => $produk) {
            $dataSheet->setCellValue('A'.($index + 1), $produk);
        }
        foreach ($kategoriList as $index => $kategori) {
            $dataSheet->setCellValue('B'.($index + 1), $kategori);
        }
        $dataSheet->setSheetState(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet::SHEETSTATE_HIDDEN);

        $produkRowCount = count($produkList);
        $kategoriRowCount = count($kategoriList);

        for ($row = 2; $row <= 500; $row++) {
            if ($produkRowCount > 0) {
                $validation = $sheet->getCell('A'.$row)->getDataValidation();
                $validation->setType(DataValidation::TYPE_LIST);
                $validation->setErrorStyle(DataValidation::STYLE_STOP);
                $validation->setAllowBlank(true);
                $validation->setShowDropDown(true);
                $validation->setErrorTitle('Input Error');
                $validation->setError('Produk tidak valid. Silakan pilih dari dropdown.');
                $validation->setFormula1('DataRef!$A$1:$A$'.$produkRowCount);
            }
            if ($kategoriRowCount > 0) {
                $validation = $sheet->getCell('B'.$row)->getDataValidation();
                $validation->setType(DataValidation::TYPE_LIST);
                $validation->setErrorStyle(DataValidation::STYLE_STOP);
                $validation->setAllowBlank(true);
                $validation->setShowDropDown(true);
                $validation->setErrorTitle('Input Error');
                $validation->setError('Jenis produk tidak valid. Silakan pilih dari dropdown.');
                $validation->setFormula1('DataRef!$B$1:$B$'.$kategoriRowCount);
            }
        }

        foreach (range('A', 'G') as $columnID) {
            $sheet->getColumnDimension($columnID)->setAutoSize(true);
        }

        $spreadsheet->setActiveSheetIndex(0);

        $writer = new Xlsx($spreadsheet);
        $filename = 'template-stok-gudang.xlsx';

        if (ob_get_length()) {
            ob_end_clean();
        }

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="'.$filename.'"');
        header('Cache-Control: max-age=0');

        $writer->save('php://output');
        exit;
    }

    public function importStock(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));
        $idPengguna = (int) $request->input('id_pengguna', 0);
        $file = $request->file('file');

        if ($idPenggunaLokasi === '' || $idPengguna <= 0 || ! $file || ! $file->isValid()) {
            return $this->fail('id_pengguna_lokasi, id_pengguna & file wajib diisi');
        }

        $lookup = ['nama_produk', 'jenis_produk', 'kuantiti', 'lokasi_block', 'lokasi_line', 'batch', 'best_before'];
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
        $rows = [];

        foreach ($parsed['rows'] as $idx => $row) {
            $lineNo = $idx + 1;
            $cell = fn ($name) => trim((string) ($row[$col[$name]] ?? ''));

            $namaProduk = $cell('nama_produk');
            $kategori = strtoupper($cell('jenis_produk'));
            $jumlah = (int) $cell('kuantiti');
            $kodeBlock = strtoupper($cell('lokasi_block'));
            $noLine = (int) $cell('lokasi_line');
            $batch = $cell('batch');
            $bestBefore = $cell('best_before');

            $emptyRow = $namaProduk === '' && $kategori === '' && $jumlah <= 0
                && $kodeBlock === '' && $noLine <= 0 && $batch === '' && $bestBefore === '';
            if ($emptyRow) {
                continue;
            }

            if ($namaProduk === '') {
                $errors[] = "Baris $lineNo: nama_produk wajib";
                continue;
            }
            if ($jumlah <= 0) {
                $errors[] = "Baris $lineNo: kuantiti harus > 0";
                continue;
            }
            if ($kodeBlock === '' || $noLine <= 0) {
                $errors[] = "Baris $lineNo: lokasi_block & lokasi_line wajib (contoh: A | 1)";
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

            $rows[] = [
                'id_produk' => $idProduk,
                'kategori' => $kategori,
                'jumlah' => $jumlah,
                'kode_block' => $kodeBlock,
                'no_line' => $noLine,
                'batch' => $batch,
                'best_before' => $bestBefore,
                'line_no' => $lineNo,
            ];
        }

        if (! empty($errors)) {
            return $this->fail('Terdapat kesalahan di file (tidak ada data yang disimpan):'."\n".implode("\n", array_slice($errors, 0, 20)));
        }

        if (empty($rows)) {
            return $this->fail('Tidak ada baris data yang valid di file');
        }

        $final = [];
        foreach ($rows as $r) {
            $namaProdukRow = DB::table('produk')->where('id_produk', $r['id_produk'])->value('nama_produk');
            $satuan = DB::table('produk')->where('id_produk', $r['id_produk'])->value('satuan');

            $bestBefore = $this->normalizeBestBefore($r['best_before']);
            $batch = $r['batch'];

            if (in_array($r['id_produk'], self::PRODUK_TANPA_BATCH, true)) {
                $bestBefore = '9999-12-31';
                $batch = '-';
            }

            $tanggalMasuk = date('Y-m-d');

            if ($bestBefore === '') {
                $errors[] = "Baris {$r['line_no']}: format/isi best_before tidak valid";
                continue;
            }

            $final[] = array_merge($r, [
                'nama_produk' => $namaProdukRow,
                'satuan' => $satuan,
                'best_before' => $bestBefore,
                'batch' => $batch,
                'tanggal_masuk' => $tanggalMasuk,
            ]);
        }

        if (! empty($errors)) {
            return $this->fail('Terdapat kesalahan di file (tidak ada data yang disimpan):'."\n".implode("\n", array_slice($errors, 0, 20)));
        }

        $stat = [];
        try {
            DB::transaction(function () use ($final, $idPenggunaLokasi, $idPengguna, &$stat) {
                foreach ($final as $r) {
                    $bestBefore = $r['best_before'] === '' ? null : $r['best_before'];
                    $lineLabel = $r['kode_block'].'-'.$r['no_line'];

                    $deeps = $this->deepsLine($idPenggunaLokasi, $r['kode_block'], $r['no_line']);
                    if (empty($deeps)) {
                        throw new Exception("Baris {$r['line_no']}: line $lineLabel tidak ditemukan di layout");
                    }

                    $need = $r['jumlah'];
                    $alokasi = [];
                    foreach ($deeps as $dp) {
                        if ($need <= 0) {
                            break;
                        }
                        $free = (int) $dp->kapasitas - (int) $dp->terisi;
                        if ($free <= 0) {
                            continue;
                        }
                        $take = min($free, $need);
                        $alokasi[] = ['id_deep' => (int) $dp->id_deep, 'jumlah' => $take];
                        $need -= $take;
                    }

                    if ($need > 0) {
                        throw new Exception("Baris {$r['line_no']}: kapasitas line $lineLabel tidak cukup (sisa $need)");
                    }

                    $jumlahLine = $r['jumlah'];

                    $idBm = DB::table('barang_masuk')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_pengguna' => $idPengguna,
                        'id_produk' => $r['id_produk'],
                        'nama_produk' => $r['nama_produk'],
                        'jumlah' => $jumlahLine,
                        'satuan' => $r['satuan'],
                        'tanggal_masuk' => $r['tanggal_masuk'],
                        'tipe_penerimaan' => $r['kategori'] === 'XWH' ? 'Primary XWH' : 'Primary',
                        'best_before' => $bestBefore,
                        'batch' => $r['batch'],
                        'batch_sekarang' => $r['batch'],
                        'asal_pabrik' => '-',
                        'no_dn' => '',
                        'nama_driver' => null,
                        'no_mobil' => '-',
                        'catatan' => 'Import template stock',
                        'lokasi_block' => $lineLabel,
                        'created_at' => DB::raw('NOW()'),
                    ]);

                    $idStok = DB::table('stok_gudang')->insertGetId([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_produk' => $r['id_produk'],
                        'nama_produk' => $r['nama_produk'],
                        'id_barang_masuk' => $idBm,
                        'jumlah_sisa' => $jumlahLine,
                        'batch' => $r['batch'],
                        'satuan' => $r['satuan'],
                        'best_before' => $bestBefore,
                        'lokasi_block' => $lineLabel,
                        'created_at' => DB::raw('NOW()'),
                    ]);

                    foreach ($alokasi as $det) {
                        DB::table('stok_gudang_deep')->insert([
                            'id_pengguna_lokasi' => $idPenggunaLokasi,
                            'id_stok_header' => $idStok,
                            'id_deep' => $det['id_deep'],
                            'jumlah' => $det['jumlah'],
                            'best_before' => $bestBefore,
                            'batch' => $r['batch'],
                            'lokasi_block' => $lineLabel,
                            'created_at' => DB::raw('NOW()'),
                        ]);
                    }

                    $stat[] = ['line' => $lineLabel, 'qty' => $jumlahLine];
                }
            });
        } catch (Throwable $e) {
            return $this->fail('Gagal mengimpor stock: '.$e->getMessage(), 500);
        }

        return $this->okMessage('Stock berhasil diimpor ke layout', [
            'detail' => $stat,
            'jumlah_line' => count($stat),
        ]);
    }

    // =========================================================================
    // 5. UPDATE INBOUND
    // =========================================================================
    public function update(Request $request)
    {
        $in = $request->all();
        $aksi = strtolower(trim((string) ($in['aksi'] ?? '')));

        if ($aksi === 'tambah_item') {
            return $this->tambahItemInbound($in);
        }

        // REVERT TO DRAFT: kembalikan semua item Pending -> Draft untuk shipment_id yang sama
        if ($aksi === 'revert_to_draft') {
            $shipmentId = trim((string) ($in['shipment_id'] ?? ''));
            $idPenggunaLokasiRevert = trim((string) ($in['id_pengguna_lokasi'] ?? ''));
            if ($shipmentId === '' || $idPenggunaLokasiRevert === '') {
                return $this->fail('shipment_id dan id_pengguna_lokasi wajib untuk revert_to_draft.');
            }
            try {
                return DB::transaction(function () use ($shipmentId, $idPenggunaLokasiRevert) {
                    $items = DB::table('barang_masuk')
                        ->where('shipment_id', $shipmentId)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasiRevert)
                        ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                        ->lockForUpdate()
                        ->get();

                    if ($items->isEmpty()) {
                        throw new Exception('Tidak ada item Pending untuk shipment ini.');
                    }

                    // Hapus stok_gudang untuk item yang akan di-revert
                    foreach ($items as $item) {
                        DB::table('stok_gudang')
                            ->where('id_pengguna_lokasi', $idPenggunaLokasiRevert)
                            ->where('id_produk', $item->id_produk)
                            ->where('id_barang_masuk', $item->id_barang_masuk)
                            ->delete();

                        // Hapus rencana_masuk_deep jika ada
                        DB::table('rencana_masuk_deep')
                            ->where('id_barang_masuk', $item->id_barang_masuk)
                            ->delete();
                    }

                    // Update status semua item menjadi Draft
                    DB::table('barang_masuk')
                        ->where('shipment_id', $shipmentId)
                        ->where('id_pengguna_lokasi', $idPenggunaLokasiRevert)
                        ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                        ->update(['status' => 'Draft']);

                    DB::commit();

                    return $this->ok(['affected' => $items->count()], 'Berhasil dikembalikan ke Draft.');
                });
            } catch (Exception $e) {
                return $this->fail($e->getMessage());
            }
        }

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
        $shipmentIdBaru = isset($in['shipment_id']) ? trim((string) $in['shipment_id']) : null; // Penambahan

        if ($noDn === '') $noDn = null;
        if ($noMobil === '') $noMobil = null;
        if ($idBm <= 0) return $this->fail('id_barang_masuk wajib');
        if ($idPenggunaLokasi === '') return $this->fail('id_pengguna_lokasi wajib');

        try {
            return DB::transaction(function () use (
                $in, $idBm, $idProduk, $jumlahBaru, $satuan, $tanggalMasuk, $bestBefore,
                $asalPabrik, $namaDriver, $lokasiBaru, $tipePenerimaan, $noDn, $noMobil,
                $catatan, $idPenggunaLokasi, $namaPengguna, $shipmentIdBaru
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

                $upd = [];
                if ($jumlahBaru !== null) $upd['jumlah'] = $jumlahBaru;
                if ($satuan !== null) $upd['satuan'] = $satuan;
                if ($tanggalMasuk) $upd['tanggal_masuk'] = $tanggalMasuk;
                
                // Cek update shipment id
                if ($shipmentIdBaru !== null && $shipmentIdBaru !== ($lama->shipment_id ?? '')) {
                    $isExist = DB::table('barang_masuk')->where('shipment_id', $shipmentIdBaru)->exists();
                    if ($isExist) {
                        throw new Exception("Shipment ID {$shipmentIdBaru} sudah terdaftar, tidak boleh double.");
                    }
                    $upd['shipment_id'] = $shipmentIdBaru;
                }

                if ($bestBefore !== null) $upd['best_before'] = $bestBefore;
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
                if ($forceUpdateAsal) $upd['asal_pabrik'] = $asalSave;
                if ($noDn !== null) {
                    if ($noDn === '') throw new Exception('no_dn wajib diisi');
                    $upd['no_dn'] = $noDn;
                }
                if ($noMobil !== null) {
                    if ($noMobil === '') throw new Exception('no_mobil wajib diisi');
                    $upd['no_mobil'] = $noMobil;
                }
                if ($namaDriver !== null) $upd['nama_driver'] = $namaDriver;
                if ($catatan !== null) $upd['catatan'] = ($catatan === '' ? null : $catatan);
                if ($lokasiBaru !== null) $upd['lokasi_block'] = $lokasiBaru;

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

                // Stock sync hanya untuk item yang SUDAH ada stoknya (Pending/Selesai), skip untuk Draft
                if (strtolower($lama->status) !== 'draft' && ($jumlahBaru !== null || $lokasiBaru !== null || ($bestBefore !== null && $bestBefore !== $bbLama))) {
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
                            if ($bbNew !== null) $locUpd['best_before'] = $bbNew;
                            if ($satNew !== null) $locUpd['satuan'] = $satNew;
                            DB::table('stok_gudang')->where('id_stok', $idStokHeader)->update($locUpd);
                            DB::table('stok_gudang')->where('id_stok', $target->id_stok)->delete();
                        } else {
                            $locUpd = ['lokasi_block' => $lokasiBaru];
                            if ($bbNew !== null) $locUpd['best_before'] = $bbNew;
                            if ($satNew !== null) $locUpd['satuan'] = $satNew;
                            DB::table('stok_gudang')->where('id_stok', $idStokHeader)->update($locUpd);
                        }

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
                            if ($rowLine1) $idLineAsal = (int) $rowLine1;
                        }
                        $rowLine2 = DB::table('line as ln')
                            ->join('block as b', function ($j) {
                                $j->on('ln.id_block', '=', 'b.id_block')
                                    ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                            })
                            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
                            ->whereRaw("CONCAT(b.kode_block, '-', ln.nomor_line) = ?", [$lokasiBaru])
                            ->value('ln.id_line');
                        if ($rowLine2) $idLineTujuan = (int) $rowLine2;

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
                                        if ($qtySisa <= 0) break;
                                        $idDeepTujuan = (int) $tj->id_deep;
                                        $kapasitasSisa = (int) $tj->sisa_kapasitas;

                                        while ($kapasitasSisa > 0 && $qtySisa > 0 && $indexSumber < $jumlahSumber) {
                                            while ($indexSumber < $jumlahSumber && $sumberDeeps[$indexSumber]->sisa <= 0) {
                                                $indexSumber++;
                                            }
                                            if ($indexSumber >= $jumlahSumber) break;
                                            $sumber = $sumberDeeps[$indexSumber];
                                            $bisaPindah = min($sumber->sisa, $kapasitasSisa, $qtySisa);
                                            if ($bisaPindah <= 0) break;

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
                            if ($rowLineQty) $idLineQty = (int) $rowLineQty;
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
                                            if ($harusDikurangi <= 0) break;
                                            $stokDeep = (int) $deepRow->jumlah;
                                            if ($stokDeep <= 0) continue;
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
                                            if ($harusDitambah <= 0) break;
                                            $idDeepTujuan = (int) $tujuan->id_deep;
                                            $kapasitasSisa = (int) $tujuan->sisa_kapasitas;
                                            if ($kapasitasSisa <= 0) continue;
                                            $tambah = min($kapasitasSisa, $harusDitambah);
                                            if ($tambah <= 0) continue;

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

                    if (($bestBefore !== null && $bestBefore !== $bbLama) || $satuan !== null || $batchBaru !== '') {
                        $lokTuju = ($lokasiBaru !== null ? $lokasiBaru : $lokasiLamaDb);

                        $updStok = [];
                        if ($bestBefore !== null) $updStok['best_before'] = $bestBefore;
                        if ($batchBaru !== '') $updStok['batch'] = $batchBaru;
                        if ($satuan !== null) $updStok['satuan'] = $satuan;
                        if (! empty($updStok)) {
                            DB::table('stok_gudang')
                                ->where('id_produk', $idProdukFix)
                                ->where('id_barang_masuk', $idBm)
                                ->where('lokasi_block', $lokTuju)
                                ->update($updStok);
                        }

                        if (($bestBefore !== null && $bestBefore !== $bbLama) || $batchBaru !== '') {
                            $updDeep = [];
                            if ($bestBefore !== null) $updDeep['best_before'] = $bestBefore;
                            if ($batchBaru !== '') $updDeep['batch'] = $batchBaru;
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
    // 6. HAPUS INBOUND
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
    // 7. REKOMENDASI AUTO (CORE ALGORITMA ALOKASI & KONVERSI)
    // =========================================================================
    private function rekomendasiAuto(string $idPenggunaLokasi, int $idProduk, float $qty, ?string $bestBefore, string $tipePenerimaan, bool $libatkanKonversi = true): array
    {
        $isSecondary = $tipePenerimaan === 'Secondary';
        $previewMode = $qty <= 0;

        $lineProduk = DB::table('prioritas_lokasi_produk')
            ->where('id_produk', $idProduk)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->distinct()->pluck('id_line')->map(fn ($v) => (int) $v)->all();

        // 1. Ambil line dari stok aktif
        $lineAktifStok = DB::table('stok_gudang as s')
            ->join('block as b', function ($j) use ($idPenggunaLokasi) {
                $j->on('b.id_pengguna_lokasi', '=', 's.id_pengguna_lokasi');
            })
            ->join('line as ln', function ($j) use ($idPenggunaLokasi) {
                $j->on('ln.id_block', '=', 'b.id_block')
                    ->on('ln.id_pengguna_lokasi', '=', 'b.id_pengguna_lokasi');
            })
            ->where('s.id_produk', $idProduk)
            ->where('s.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('s.jumlah_sisa', '>', 0)
            ->whereRaw("s.lokasi_block = CONCAT(UPPER(TRIM(b.kode_block)), '-', ln.nomor_line)")
            ->distinct()
            ->pluck('ln.id_line')
            ->map(fn ($v) => (int) $v)
            ->all();

        // 2. Ambil line dari transaksi yang sedang Pending
        $linePendingBooking = DB::table('rencana_masuk_deep as r')
            ->join('barang_masuk as bm', 'bm.id_barang_masuk', '=', 'r.id_barang_masuk')
            ->join('deep as d', 'd.id_deep', '=', 'r.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->where('bm.id_produk', $idProduk)
            ->where('r.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('bm.status', 'Pending')
            ->distinct()
            ->pluck('lv.id_line')
            ->map(fn ($v) => (int) $v)
            ->all();

        $semuaLineAktif = array_values(array_unique(array_merge($lineProduk, $lineAktifStok, $linePendingBooking)));
        if (! empty($semuaLineAktif)) {
            $lineProduk = $semuaLineAktif;
        }

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

        $stagingCandidates = [];
        if ($isSecondary || $tipePenerimaan === 'REJECT') {
            $lokasiPrioritasProduk = DB::table('prioritas_lokasi_produk as p')
                ->leftJoin('block as b', 'b.id_block', '=', 'p.id_block')
                ->leftJoin('line as ln', 'ln.id_line', '=', 'p.id_line')
                ->leftJoin('block as b2', 'b2.id_block', '=', 'ln.id_block')
                ->where('p.id_produk', $idProduk)
                ->where('p.id_pengguna_lokasi', $idPenggunaLokasi)
                ->selectRaw('COALESCE(p.id_lokasi, b.id_lokasi, b2.id_lokasi) as id_lokasi')
                ->pluck('id_lokasi')
                ->filter(fn($v) => !is_null($v) && $v > 0)
                ->unique()
                ->toArray();

            $qStaging = $this->baseDeep($idPenggunaLokasi);

            if ($isSecondary) {
                $qStaging->whereRaw("(UPPER(TRIM(b.kode_block)) = 'RECEH' OR UPPER(TRIM(b.kode_block)) = 'TRANSIT')")
                         ->orderByRaw("CASE WHEN UPPER(TRIM(b.kode_block)) = 'RECEH' THEN 0 WHEN UPPER(TRIM(b.kode_block)) = 'TRANSIT' THEN 1 ELSE 2 END ASC, b.kode_block ASC, ln.nomor_line ASC, d.deep ASC, CAST(lv.level AS UNSIGNED) ASC");
            } else {
                $qStaging->whereRaw("UPPER(TRIM(b.kode_block)) LIKE '%REJECT%'")
                         ->orderByRaw("b.kode_block ASC, ln.nomor_line ASC, d.deep ASC, CAST(lv.level AS UNSIGNED) ASC");
            }

            if (!empty($lokasiPrioritasProduk)) {
                $qStaging->whereIn('l.id_lokasi', $lokasiPrioritasProduk);
            }

            $stagingCandidates = $qStaging->get()->map(fn ($r) => (array) $r)->all();
        }

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

        // Filter BB
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

        $priorLokasiIds = [];
        foreach ($lokasiProduk as $idLokProduk) {
            if ($idLokProduk > 0) {
                $priorLokasiIds[$idLokProduk] = true;
            }
        }
        foreach ($finalCandidates as $row) {
            $idLok = (int) ($row['id_lokasi'] ?? 0);
            if ($idLok > 0) {
                $priorLokasiIds[$idLok] = true;
            }
        }

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

        $bookingDetailsRows = DB::table('rencana_masuk_deep as r')
            ->join('barang_masuk as bm', 'bm.id_barang_masuk', '=', 'r.id_barang_masuk')
            ->where('r.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('bm.status', 'Pending')
            ->selectRaw('r.id_deep, COALESCE(SUM(r.jumlah_rencana), 0) AS terisi, MIN(r.best_before) AS bb_min, MAX(r.best_before) AS bb_max')
            ->groupBy('r.id_deep')
            ->get();

        foreach ($bookingDetailsRows as $row) {
            $idD = (int) $row->id_deep;
            if (!isset($terisiMap[$idD])) {
                $terisiMap[$idD] = 0.0;
            }
            $terisiMap[$idD] += (float) $row->terisi;

            if (!isset($bbMinDeepMap[$idD]) || ($row->bb_min !== null && $row->bb_min < $bbMinDeepMap[$idD])) {
                $bbMinDeepMap[$idD] = $row->bb_min;
            }
            if (!isset($bbMaxDeepMap[$idD]) || ($row->bb_max !== null && $row->bb_max > $bbMaxDeepMap[$idD])) {
                $bbMaxDeepMap[$idD] = $row->bb_max;
            }
        }

        $totalLeftPrior = 0;
        foreach ($finalCandidates as $r) {
            $idDeep = (int) $r['id_deep'];
            $cap = (float) $r['kapasitas'];
            $filled = $terisiMap[$idDeep] ?? 0.0;
            $totalLeftPrior += max(0.0, $cap - $filled);
        }

        // KONVERSI LINE KOSONG DI BLOK YANG SAMA DULU SEBELUM NUMPANG
        $konversiList = [];
        if ($libatkanKonversi && $tipePenerimaan !== 'REJECT' && ! $previewMode && $totalLeftPrior < $qty) {
            $shortfall = $qty - $totalLeftPrior;
            $kapasitasTarget = $this->kapasitasRateProduk($idPenggunaLokasi, $idProduk);

            if ($kapasitasTarget > 0) {
                $kLines = $this->cariLineKosongKonversi($idPenggunaLokasi, $idProduk, $tipePenerimaan, array_keys($priorLokasiIds));
                foreach ($kLines as $kl) {
                    if ($shortfall <= 0) break;
                    $deepsKonv = $this->deepsLineByIdLine($idPenggunaLokasi, $kl['id_line']);
                    if (empty($deepsKonv)) continue;

                    $deepsKonv = array_map(function ($dk) use ($kapasitasTarget) {
                        $dk['kapasitas'] = $kapasitasTarget;
                        return $dk;
                    }, $deepsKonv);

                    $finalCandidates = array_merge($finalCandidates, $deepsKonv);
                    $konversiList[] = [
                        'id_line' => $kl['id_line'],
                        'kode_block' => $kl['kode_block'],
                        'nomor_line' => $kl['nomor_line'],
                        'label_line' => $kl['kode_block'].'-'.$kl['nomor_line'],
                        'produk_lama' => $kl['produk_lama'],
                        'levels' => $kl['levels'],
                        'jumlah_deep' => $kl['jumlah_deep'],
                        'kapasitas_baru' => $kapasitasTarget,
                        'kapasitas_total' => $kl['jumlah_deep'] * $kapasitasTarget,
                    ];
                    $shortfall -= $kl['jumlah_deep'] * $kapasitasTarget;
                }
            }
        }

        if ($previewMode) {
            $previewBlocks = [];
            $previewLines = [];
            foreach ($finalCandidates as $r) {
                $kodeBlock = strtoupper(trim($r['kode_block']));
                $nomorLine = (int) $r['nomor_line'];
                $idLine = (int) $r['id_line'];
                $idDeep = (int) $r['id_deep'];
                $kapasitas = (float) $r['kapasitas'];
                $terisi = $terisiMap[$idDeep] ?? 0.0;

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
                'konversi' => $konversiList,
                'message' => 'Preview block berhasil dibuat.',
            ]);
        }

        $need = $qty;
        $alloc = [];
        $ringkasan = [];

        foreach ($finalCandidates as $r) {
            if ($need <= 0) break;
            $idDeep = (int) $r['id_deep'];
            $cap = (float) $r['kapasitas'];
            $filled = $terisiMap[$idDeep] ?? 0.0;
            $left = max(0.0, $cap - $filled);
            if ($left <= 0) continue;

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
            'konversi' => $konversiList,
            'lokasi_line' => isset($alloc[0]) ? $alloc[0]['label_line'] : '',
        ];
    }

    // =========================================================================
    // 8. ALOKASI DARI LINE TERTENTU
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
                if ($need <= 0) break;
                $kapasitas = (int) $dp->kapasitas;
                $terisi = (int) $dp->terisi;
                $bbMin = $dp->bb_min ?? null;
                if ($tipePenerimaan !== 'REJECT' && $terisi > 0 && $bestBefore !== null && $bestBefore !== ''
                    && $bbMin !== null && $bestBefore !== $bbMin) {
                    continue;
                }
                $free = $kapasitas - $terisi;
                if ($free <= 0) continue;
                $take = min($free, $need);
                $alokasi[] = ['id_deep' => (int) $dp->id_deep, 'jumlah' => $take];
                $need -= $take;
            }
        }

        if ($need > 0) {
            if ($idLokasiDefault <= 0) {
                return ['error' => 'Lokasi block default tidak valid, tidak bisa mencari line numpang', 'code' => 422];
            }

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
                ->orderByRaw('(b.kode_block = ?) DESC, ABS(ln.nomor_line - ?) ASC, b.kode_block ASC, ln.nomor_line ASC', [$kodeBlock, $noLine]);

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
                if ($need <= 0) break;
                $deepsNumpang = $this->deepsLine($idPenggunaLokasi, $rowLine->kode_block, (int) $rowLine->nomor_line);
                if (empty($deepsNumpang)) continue;

                $linePunyaStokNumpang = false;
                $bbMinLineNumpang = null;
                $totalFreeLine = 0;
                foreach ($deepsNumpang as $dp) {
                    $kapasitasDeep = (int) $dp->kapasitas;
                    $terisiDeep = (int) $dp->terisi;
                    $bbMinDeep = $dp->bb_min ?? null;
                    $freeDeep = $kapasitasDeep - $terisiDeep;
                    if ($freeDeep > 0) $totalFreeLine += $freeDeep;
                    if ($terisiDeep > 0 && $bbMinDeep !== null) {
                        $linePunyaStokNumpang = true;
                        if ($bbMinLineNumpang === null || $bbMinDeep < $bbMinLineNumpang) {
                            $bbMinLineNumpang = $bbMinDeep;
                        }
                    }
                }

                if ($totalFreeLine <= 0) continue;

                $bolehPakaiLineNumpang = true;
                if ($tipePenerimaan !== 'REJECT' && $linePunyaStokNumpang && $bestBefore !== null && $bestBefore !== ''
                    && $bbMinLineNumpang !== null && $bestBefore > $bbMinLineNumpang) {
                    $bolehPakaiLineNumpang = false;
                }
                if (! $bolehPakaiLineNumpang) continue;

                foreach ($deepsNumpang as $dp) {
                    if ($need <= 0) break;
                    $kapasitas = (int) $dp->kapasitas;
                    $terisi = (int) $dp->terisi;
                    $bbMin = $dp->bb_min ?? null;
                    if ($tipePenerimaan !== 'REJECT' && $terisi > 0 && $bestBefore !== null && $bestBefore !== ''
                        && $bbMin !== null && $bestBefore !== $bbMin) {
                        continue;
                    }
                    $free = $kapasitas - $terisi;
                    if ($free <= 0) continue;
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
    // 9. HELPERS
    // =========================================================================
    private function mapDeepIds(array $alokasi): array
    {
        return array_filter(array_map(fn ($a) => (int) ($a['id_deep'] ?? 0), $alokasi), fn ($id) => $id > 0);
    }

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
        $rows = DB::table('block as b')
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

        if (!empty($rows)) {
            $deepIds = array_map(fn($r) => $r->id_deep, $rows);
            
            $bookings = DB::table('rencana_masuk_deep as r')
                ->join('barang_masuk as bm', 'bm.id_barang_masuk', '=', 'r.id_barang_masuk')
                ->where('r.id_pengguna_lokasi', $idPenggunaLokasi)
                ->whereIn('r.id_deep', $deepIds)
                ->where('bm.status', 'Pending')
                ->selectRaw('r.id_deep, SUM(r.jumlah_rencana) as terisi_booking, MIN(r.best_before) as bb_min, MAX(r.best_before) as bb_max')
                ->groupBy('r.id_deep')
                ->get();
                
            $bookingMap = [];
            foreach ($bookings as $b) {
                $bookingMap[$b->id_deep] = $b;
            }
            
            foreach ($rows as $row) {
                if (isset($bookingMap[$row->id_deep])) {
                    $b = $bookingMap[$row->id_deep];
                    $row->terisi += $b->terisi_booking;
                    if ($b->bb_min !== null && ($row->bb_min === null || $b->bb_min < $row->bb_min)) {
                        $row->bb_min = $b->bb_min;
                    }
                    if ($b->bb_max !== null && ($row->bb_max === null || $b->bb_max > $row->bb_max)) {
                        $row->bb_max = $b->bb_max;
                    }
                }
            }
        }

        return $rows;
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

    private function kapasitasRateProduk(string $idPenggunaLokasi, int $idProduk): ?int
    {
        $rate = DB::table('prioritas_lokasi_produk as p')
            ->join('line as ln', function ($j) use ($idPenggunaLokasi) {
                $j->on('ln.id_line', '=', 'p.id_line')
                    ->on('ln.id_pengguna_lokasi', '=', 'p.id_pengguna_lokasi');
            })
            ->join('level as lv', function ($j) use ($idPenggunaLokasi) {
                $j->on('lv.id_line', '=', 'ln.id_line')
                    ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->join('deep as d', function ($j) use ($idPenggunaLokasi) {
                $j->on('d.id_level', '=', 'lv.id_level')
                    ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->where('p.id_produk', $idProduk)
            ->where('p.id_pengguna_lokasi', $idPenggunaLokasi)
            ->min('d.kapasitas');

        return ($rate !== null && (int) $rate > 0) ? (int) $rate : null;
    }

    private function deepsLineByIdLine(string $idPenggunaLokasi, int $idLine): array
    {
        return $this->baseDeep($idPenggunaLokasi)
            ->where('ln.id_line', $idLine)
            ->orderByRaw('d.deep ASC, CAST(lv.level AS UNSIGNED) ASC')
            ->get()->map(fn ($r) => (array) $r)->all();
    }

    private function cariLineKosongKonversi(string $idPenggunaLokasi, int $idProduk, string $tipePenerimaan, array $priorLokasiIds): array
    {
        $bookedLineIds = DB::table('rencana_masuk_deep as r')
            ->join('barang_masuk as bm', 'bm.id_barang_masuk', '=', 'r.id_barang_masuk')
            ->join('deep as d', 'd.id_deep', '=', 'r.id_deep')
            ->join('level as lv', 'lv.id_level', '=', 'd.id_level')
            ->where('r.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('bm.status', 'Pending')
            ->pluck('lv.id_line')->unique();

        $q = DB::table('line as ln')
            ->join('block as b', function ($j) use ($idPenggunaLokasi) {
                $j->on('b.id_block', '=', 'ln.id_block')
                    ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->join('lokasi as l', 'l.id_lokasi', '=', 'b.id_lokasi')
            ->leftJoin('prioritas_lokasi_produk as p', function ($j) use ($idPenggunaLokasi) {
                $j->on('p.id_line', '=', 'ln.id_line')
                    ->on('p.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->leftJoin('produk as pr', 'pr.id_produk', '=', 'p.id_produk')
            ->leftJoin('level as lv', function ($j) use ($idPenggunaLokasi) {
                $j->on('lv.id_line', '=', 'ln.id_line')
                    ->on('lv.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
            })
            ->leftJoin('deep as d', function ($j) use ($idPenggunaLokasi) {
                $j->on('d.id_level', '=', 'lv.id_level')
                    ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang_deep as sd', function ($j) use ($idPenggunaLokasi) {
                $j->on('sd.id_deep', '=', 'd.id_deep')
                    ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi');
            })
            ->leftJoin('stok_gudang as s', function ($j) use ($idPenggunaLokasi) {
                $j->on('s.id_stok', '=', 'sd.id_stok_header')
                    ->on('s.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi')
                    ->where('s.jumlah_sisa', '>', DB::raw('0'));
            })
            ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where(function ($w) use ($idProduk) {
                $w->whereNull('p.id_produk')
                  ->orWhere('p.id_produk', '<>', $idProduk);
            })
            ->where('b.id_lokasi', '>', 0)
            ->where($this->whereNormalBlockActive($tipePenerimaan));

        if ($bookedLineIds->isNotEmpty()) {
            $q->whereNotIn('ln.id_line', $bookedLineIds);
        }

        $kategori = $this->kategoriLokasi($tipePenerimaan);
        if ($kategori) {
            $q->where($kategori);
        }
        if (! empty($priorLokasiIds)) {
            $q->whereIn('l.id_lokasi', $priorLokasiIds);
        }

        $q->selectRaw("ln.id_line, b.kode_block, ln.nomor_line, 
                COALESCE(pr.nama_produk, 'Line Kosong / Belum Ada Produk') AS produk_lama,
                COALESCE(SUM(CASE WHEN s.id_stok IS NOT NULL THEN sd.jumlah ELSE 0 END),0) AS terisi_line,
                COUNT(d.id_deep) AS jumlah_deep")
            ->groupBy('ln.id_line', 'b.kode_block', 'ln.nomor_line', 'pr.nama_produk')
            ->having('terisi_line', '=', 0)
            ->having('jumlah_deep', '>', 0)
            ->orderBy('l.nama_lokasi')
            ->orderBy('b.kode_block')
            ->orderBy('ln.nomor_line');

        $lines = [];
        foreach ($q->get() as $r) {
            $levelsRaw = DB::table('level as lv')
                ->join('deep as d', function ($j) use ($idPenggunaLokasi) {
                    $j->on('d.id_level', '=', 'lv.id_level')
                        ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
                })
                ->where('lv.id_line', $r->id_line)
                ->where('lv.id_pengguna_lokasi', $idPenggunaLokasi)
                ->selectRaw('lv.level, COUNT(d.id_deep) AS jumlah_deep')
                ->groupBy('lv.level')
                ->orderBy('lv.level')
                ->get();
            $levels = [];
            foreach ($levelsRaw as $lv) {
                $levels[] = ['level' => (int) $lv->level, 'jumlah_deep' => (int) $lv->jumlah_deep];
            }
            $lines[] = [
                'id_line' => (int) $r->id_line,
                'kode_block' => strtoupper(trim((string) $r->kode_block)),
                'nomor_line' => (int) $r->nomor_line,
                'produk_lama' => trim((string) $r->produk_lama),
                'levels' => $levels,
                'jumlah_deep' => (int) $r->jumlah_deep,
            ];
        }

        $blockProduk = [];
        $priorRows = DB::table('prioritas_lokasi_produk as p')
            ->leftJoin('line as ln', function ($j) use ($idPenggunaLokasi) {
                $j->on('ln.id_line', '=', 'p.id_line')
                    ->on('ln.id_pengguna_lokasi', '=', 'p.id_pengguna_lokasi');
            })
            ->leftJoin('block as b', function ($j) use ($idPenggunaLokasi) {
                $j->on('b.id_block', '=', DB::raw('COALESCE(p.id_block, ln.id_block)'))
                    ->on('b.id_pengguna_lokasi', '=', 'p.id_pengguna_lokasi');
            })
            ->where('p.id_produk', $idProduk)
            ->where('p.id_pengguna_lokasi', $idPenggunaLokasi)
            ->selectRaw('b.kode_block, ln.nomor_line')
            ->get();

        foreach ($priorRows as $pl) {
            if ($pl->kode_block) {
                $kode = strtoupper(trim((string) $pl->kode_block));
                if (! isset($blockProduk[$kode])) {
                    $blockProduk[$kode] = [];
                }
                if ($pl->nomor_line) {
                    $blockProduk[$kode][] = (int) $pl->nomor_line;
                }
            }
        }

        $stokAktif = DB::table('stok_gudang')
            ->where('id_produk', $idProduk)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('jumlah_sisa', '>', 0)
            ->pluck('lokasi_block');

        foreach ($stokAktif as $lbl) {
            if (preg_match('/^([A-Z0-9]+)-(\d+)$/i', trim($lbl), $m)) {
                $k = strtoupper($m[1]);
                $l = (int) $m[2];
                if (! isset($blockProduk[$k])) {
                    $blockProduk[$k] = [];
                }
                $blockProduk[$k][] = $l;
            }
        }

        usort($lines, function ($a, $b) use ($blockProduk) {
            $ka = $a['kode_block'];
            $kb = $b['kode_block'];
            $pa = isset($blockProduk[$ka]);
            $pb = isset($blockProduk[$kb]);

            if ($pa !== $pb) {
                return $pa ? -1 : 1;
            }

            if ($pa && $pb) {
                $da = !empty($blockProduk[$ka]) ? min(array_map(fn ($n) => abs($n - $a['nomor_line']), $blockProduk[$ka])) : 0;
                $db = !empty($blockProduk[$kb]) ? min(array_map(fn ($n) => abs($n - $b['nomor_line']), $blockProduk[$kb])) : 0;
                if ($da !== $db) {
                    return $da <=> $db;
                }
            }

            if ($ka !== $kb) {
                return strcmp($ka, $kb);
            }

            return $a['nomor_line'] <=> $b['nomor_line'];
        });

        return $lines;
    }

    private function konversiLine(string $idPenggunaLokasi, int $idLine, int $idProdukTarget): array
    {
        $rate = $this->kapasitasRateProduk($idPenggunaLokasi, $idProdukTarget);
        if ($rate === null) {
            return ['error' => 'Produk tujuan belum punya line, kapasitas tidak bisa disalin'];
        }

        $terisi = (int) DB::table('stok_gudang_deep as sd')
            ->join('stok_gudang as s', function ($j) use ($idPenggunaLokasi) {
                $j->on('s.id_stok', '=', 'sd.id_stok_header')
                    ->on('s.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi')
                    ->where('s.jumlah_sisa', '>', DB::raw('0'));
            })
            ->join('deep as d', function ($j) use ($idPenggunaLokasi) {
                $j->on('d.id_deep', '=', 'sd.id_deep')
                    ->on('d.id_pengguna_lokasi', '=', 'sd.id_pengguna_lokasi');
            })
            ->join('level as lv', function ($j) use ($idPenggunaLokasi) {
                $j->on('lv.id_level', '=', 'd.id_level')
                    ->on('lv.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
            })
            ->where('lv.id_line', $idLine)
            ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->sum('sd.jumlah');
        if ($terisi > 0) {
            return ['error' => 'Line tidak lagi kosong, konversi dibatalkan'];
        }

        try {
            DB::transaction(function () use ($idPenggunaLokasi, $idLine, $idProdukTarget, $rate) {
                $rowPrioritas = DB::table('prioritas_lokasi_produk')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_line', $idLine)
                    ->first();
                if ($rowPrioritas) {
                    DB::table('prioritas_lokasi_produk')
                        ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                        ->where('id_line', $idLine)
                        ->update(['id_produk' => $idProdukTarget]);
                } else {
                    $ln = DB::table('line as ln')
                        ->join('block as b', function ($j) use ($idPenggunaLokasi) {
                            $j->on('b.id_block', '=', 'ln.id_block')
                                ->on('b.id_pengguna_lokasi', '=', 'ln.id_pengguna_lokasi');
                        })
                        ->where('ln.id_line', $idLine)
                        ->where('ln.id_pengguna_lokasi', $idPenggunaLokasi)
                        ->select('b.id_block', 'b.id_lokasi')
                        ->first();
                    if (! $ln) {
                        throw new \RuntimeException('Line tidak ditemukan');
                    }
                    DB::table('prioritas_lokasi_produk')->insert([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_produk' => $idProdukTarget,
                        'id_lokasi' => (int) $ln->id_lokasi,
                        'id_block' => (int) $ln->id_block,
                        'id_line' => $idLine,
                        'id_level' => null,
                        'id_deep' => null,
                        'created_at' => now(),
                    ]);
                }

                $deepIds = DB::table('deep as d')
                    ->join('level as lv', function ($j) use ($idPenggunaLokasi) {
                        $j->on('lv.id_level', '=', 'd.id_level')
                            ->on('lv.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi');
                    })
                    ->where('lv.id_line', $idLine)
                    ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->pluck('d.id_deep');
                DB::table('deep')
                    ->whereIn('id_deep', $deepIds)
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->update(['kapasitas' => $rate]);
            });
        } catch (Throwable $e) {
            return ['error' => $e->getMessage()];
        }

        return ['ok' => true, 'kapasitas' => $rate];
    }

    private function tambahItemInbound(array $in)
    {
        $idPenggunaLokasi = trim((string) ($in['id_pengguna_lokasi'] ?? ''));
        $idPengguna = (int) ($in['id_pengguna'] ?? 0);
        $idProduk = (int) ($in['id_produk'] ?? 0);
        $jumlah = (int) ($in['jumlah'] ?? 0);
        $satuan = trim((string) ($in['satuan'] ?? 'PCS'));
        $shipmentId = trim((string) ($in['shipment_id'] ?? ''));
        $idBmRef = (int) ($in['id_barang_masuk_ref'] ?? 0);

        if ($idPenggunaLokasi === '' || $idProduk <= 0 || $jumlah <= 0) {
            return $this->fail('Data item baru tidak lengkap.');
        }

        $namaProduk = DB::table('produk')->where('id_produk', $idProduk)->value('nama_produk');
        if (!$namaProduk) return $this->fail('Produk tidak ditemukan di database.');

        $query = DB::table('barang_masuk')->where('id_pengguna_lokasi', $idPenggunaLokasi);
        if ($shipmentId !== '') {
            $query->where('shipment_id', $shipmentId);
        } else {
            $query->where('id_barang_masuk', $idBmRef);
        }
        $ref = $query->first();

        if (!$ref) return $this->fail('Referensi Inbound / Truk tidak ditemukan.');

        DB::beginTransaction();
        try {
            $idBaru = DB::table('barang_masuk')->insertGetId([
                'shipment_id' => $ref->shipment_id,
                'id_pengguna_lokasi' => $idPenggunaLokasi,
                'id_pengguna' => $idPengguna,
                'id_produk' => $idProduk,
                'nama_produk' => $namaProduk,
                'jumlah' => $jumlah,
                'satuan' => $satuan,
                'tanggal_masuk' => $ref->tanggal_masuk,
                'tipe_penerimaan' => $ref->tipe_penerimaan,
                'asal_pabrik' => $ref->asal_pabrik,
                'no_dn' => $ref->no_dn,
                'nama_driver' => $ref->nama_driver,
                'no_mobil' => $ref->no_mobil,
                'catatan' => 'Tambah item susulan',
                'status' => 'Draft', 
                'created_at' => now(),
            ]);

            DB::commit();
            return $this->ok(['id_barang_masuk' => $idBaru], 'Item baru berhasil ditambahkan sebagai Draft.');
        } catch (Throwable $e) {
            DB::rollBack();
            return $this->fail($e->getMessage(), 500);
        }
    }

    private function whereNormalBlockActive(string $tipePenerimaan): \Closure
    {
        return function ($q) use ($tipePenerimaan) {
            if ($tipePenerimaan === 'REJECT') {
                $q->whereRaw("UPPER(TRIM(b.kode_block)) LIKE '%REJECT%'");
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
            preg_match('/[A-Za-z0-9]+/', $asal, $mPlant);
            $idPlant = strtoupper(trim($mPlant[0] ?? ''));
        }
        if ($idPlant === '') {
            return '';
        }
        return $dt->format('ymd').$idPlant;
    }

    private function normalizeBestBefore(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return '';
        }

        if (is_numeric($raw)) {
            $days = (int) $raw;
            if ($days <= 0 || $days > 100000) {
                return '';
            }
            return (new DateTime('1899-12-30'))->modify("+{$days} days")->format('Y-m-d');
        }

        $txt = str_replace('/', '-', $raw);
        foreach (['Y-m-d H:i:s', 'Y-m-d', 'd-m-Y H:i:s', 'd-m-Y'] as $fmt) {
            $dt = DateTime::createFromFormat($fmt, $txt);
            if ($dt !== false) {
                $err = DateTime::getLastErrors();
                if (is_array($err) && ($err['warning_count'] ?? 0) === 0 && ($err['error_count'] ?? 0) === 0) {
                    return $dt->format('Y-m-d');
                }
            }
        }

        $ts = strtotime($raw);
        if ($ts === false) {
            return '';
        }

        return date('Y-m-d', $ts);
    }
}