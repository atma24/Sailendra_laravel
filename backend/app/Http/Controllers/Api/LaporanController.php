<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LaporanController extends Controller
{
    // =========================================================================
    // 1. LAPORAN BARANG KELUAR (Ref: laporan_barang_keluar.php)
    // =========================================================================
    public function exportBarangKeluar(Request $request)
    {
        if (app()->environment('local')) {
            @file_put_contents(storage_path('logs/laporan_debug.log'), json_encode($request->all()).PHP_EOL, FILE_APPEND);
        }

        $mode = $request->input('mode', 'day');
        $format = $request->input('format', 'xlsx');
        $date = trim((string) $request->input('date', ''));
        $month = $request->input('month');
        $year = $request->input('year');
        $driver = $request->input('driver', '');
        $startDate = trim((string) $request->input('start_date', ''));
        $endDate = trim((string) $request->input('end_date', ''));
        $idPenggunaLokasi = $request->input('id_pengguna_lokasi', '');

        $labelPeriode = $this->resolvePeriodeLabel($mode, $startDate, $endDate, $date, $month, $year);

        $query = DB::table('barang_keluar as bk')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bk.id_pengguna_lokasi')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'bk.id_pengguna')
            ->select(
                'bk.id_pengguna_lokasi', 'pl.nama_pengguna_lokasi', 'u.username AS dibuat_oleh',
                'bk.tanggal_keluar', 'bk.nama_driver', 'bk.no_mobil', 'bk.tipe_pengeluaran',
                'bk.tujuan', 'bk.nama_produk', 'bk.jumlah', 'bk.best_before', 'bk.batch',
                'bk.satuan', 'bk.status', 'bk.diperbarui_oleh',
                DB::raw("DATE_FORMAT(bk.diperbarui_pada, '%Y-%m-%d %H:%i') AS diperbarui_pada"),
                DB::raw("DATE_FORMAT(bk.waktu_mulai_input, '%Y-%m-%d %H:%i:%s') AS waktu_mulai_input"),
                DB::raw('SEC_TO_TIME(bk.durasi_detik) AS durasi_input'),
                'bk.catatan', 'bk.catatan_perubahan'
            );

        $diterapkanFilter = true;
        if ($mode === 'range' && $startDate !== '' && $endDate !== '') {
            $query->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$startDate, $endDate]);
        } elseif ($mode === 'day' && $date !== '') {
            $query->whereDate('bk.tanggal_keluar', $date);
        } elseif ($mode === 'month' && $month && $year) {
            $query->whereYear('bk.tanggal_keluar', $year)->whereMonth('bk.tanggal_keluar', $month);
        } elseif ($mode === 'year' && $year) {
            $query->whereYear('bk.tanggal_keluar', $year);
        } else {
            $diterapkanFilter = false;
        }

        if ($driver !== '') {
            $query->where('bk.nama_driver', 'LIKE', "%{$driver}%");
        }

        $query = $this->filterLokasi($query, 'bk.id_pengguna_lokasi', $idPenggunaLokasi);

        if (! $diterapkanFilter) {
            $query->whereDate('bk.tanggal_keluar', date('Y-m-d'));
        }

        $rows = $query->orderBy('bk.tanggal_keluar', 'ASC')
            ->orderBy('bk.id_pengguna_lokasi', 'ASC')
            ->orderBy('bk.nama_driver', 'ASC')
            ->orderBy('bk.nama_produk', 'ASC')
            ->get();

        if ($format === 'json') {
            return response()->json([
                'success' => true, 'mode' => $mode, 'periode' => $labelPeriode,
                'count' => count($rows), 'items' => $rows,
            ]);
        }

        return $this->renderExcelResponse("Laporan Barang Keluar {$labelPeriode}.xls", function () use ($rows) {
            echo "<table border='1'><tr>
                <th>No</th><th>ID Lokasi</th><th>Nama Lokasi</th><th>Dibuat Oleh</th>
                <th>Tanggal Keluar</th><th>Driver</th><th>No Mobil</th><th>Tipe Pengeluaran</th>
                <th>Tujuan</th><th>Produk</th><th>Jumlah</th><th>Best Before</th><th>Batch</th>
                <th>Satuan</th><th>Status</th><th>Durasi Input</th><th>Catatan</th>
            </tr>";
            $no = 1;
            foreach ($rows as $row) {
                echo '<tr>
                    <td>'.$no++.'</td>
                    <td>'.htmlspecialchars($row->id_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->dibuat_oleh ?? '').'</td>
                    <td>'.htmlspecialchars($row->tanggal_keluar ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_driver ?? '').'</td>
                    <td>'.htmlspecialchars($row->no_mobil ?? '').'</td>
                    <td>'.htmlspecialchars($row->tipe_pengeluaran ?? '').'</td>
                    <td>'.htmlspecialchars($row->tujuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_produk ?? '').'</td>
                    <td>'.htmlspecialchars($row->jumlah ?? '').'</td>
                    <td>'.htmlspecialchars($row->best_before ?? '').'</td>
                    <td>'.htmlspecialchars($row->batch ?? '').'</td>
                    <td>'.htmlspecialchars($row->satuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->status ?? '').'</td>
                    <td>'.htmlspecialchars($row->durasi_input ?? '').'</td>
                    <td>'.htmlspecialchars($row->catatan ?? '').'</td>
                </tr>';
            }
            echo '</table>';
        });
    }

    // =========================================================================
    // 2. LAPORAN BARANG MASUK (Ref: laporan_barang_masuk.php)
    // =========================================================================
    public function exportBarangMasuk(Request $request)
    {
        $mode = $request->input('mode', 'day');
        $format = $request->input('format', 'xlsx');
        $date = trim((string) $request->input('date', ''));
        $month = $request->input('month');
        $year = $request->input('year');
        $startDate = trim((string) $request->input('start_date', ''));
        $endDate = trim((string) $request->input('end_date', ''));
        $idPenggunaLokasi = $request->input('id_pengguna_lokasi', '');

        $labelPeriode = $this->resolvePeriodeLabel($mode, $startDate, $endDate, $date, $month, $year);

        $query = DB::table('barang_masuk as bm')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bm.id_pengguna_lokasi')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'bm.id_pengguna')
            ->select(
                'bm.id_pengguna_lokasi', 'pl.nama_pengguna_lokasi', 'u.username AS dibuat_oleh',
                'bm.tanggal_masuk', 'bm.nama_driver', 'bm.no_mobil', 'bm.no_dn',
                'bm.tipe_penerimaan', 'bm.asal_pabrik', 'bm.nama_produk', 'bm.jumlah',
                'bm.best_before', DB::raw('COALESCE(bm.batch_sekarang, bm.batch) AS batch'),
                'bm.satuan', 'bm.diperbarui_oleh', 'bm.catatan', 'bm.catatan_perubahan',
                DB::raw("DATE_FORMAT(bm.diperbarui_pada, '%Y-%m-%d %H:%i') AS diperbarui_pada"),
                DB::raw("DATE_FORMAT(bm.waktu_mulai_input, '%Y-%m-%d %H:%i:%s') AS waktu_mulai_input"),
                DB::raw('SEC_TO_TIME(bm.durasi_detik) AS durasi_input')
            );

        $diterapkanFilter = true;
        if ($mode === 'range' && $startDate !== '' && $endDate !== '') {
            $query->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$startDate, $endDate]);
        } elseif ($mode === 'day' && $date !== '') {
            $query->whereDate('bm.tanggal_masuk', $date);
        } elseif ($mode === 'month' && $month && $year) {
            $query->whereYear('bm.tanggal_masuk', $year)->whereMonth('bm.tanggal_masuk', $month);
        } elseif ($mode === 'year' && $year) {
            $query->whereYear('bm.tanggal_masuk', $year);
        } else {
            $diterapkanFilter = false;
        }

        $query = $this->filterLokasi($query, 'bm.id_pengguna_lokasi', $idPenggunaLokasi);

        if (! $diterapkanFilter) {
            $query->whereDate('bm.tanggal_masuk', date('Y-m-d'));
        }

        $rows = $query->orderBy('bm.tanggal_masuk', 'ASC')
            ->orderBy('bm.id_pengguna_lokasi', 'ASC')
            ->orderBy('bm.nama_produk', 'ASC')
            ->get();

        if ($format === 'json') {
            return response()->json([
                'success' => true, 'mode' => $mode, 'periode' => $labelPeriode,
                'count' => count($rows), 'items' => $rows,
            ]);
        }

        return $this->renderExcelResponse("Laporan Barang Masuk {$labelPeriode}.xls", function () use ($rows) {
            echo "<table border='1'><tr>
                <th>No</th><th>ID Lokasi</th><th>Nama Lokasi</th><th>Dibuat Oleh</th>
                <th>Tanggal Masuk</th><th>Driver</th><th>No Mobil</th><th>No DN</th>
                <th>Tipe Penerimaan</th><th>Asal Pabrik</th><th>Produk</th><th>Jumlah</th>
                <th>Best Before</th><th>Batch</th><th>Satuan</th><th>Durasi Input</th><th>Catatan</th>
            </tr>";
            $no = 1;
            foreach ($rows as $row) {
                echo '<tr>
                    <td>'.$no++.'</td>
                    <td>'.htmlspecialchars($row->id_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->dibuat_oleh ?? '').'</td>
                    <td>'.htmlspecialchars($row->tanggal_masuk ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_driver ?? '').'</td>
                    <td>'.htmlspecialchars($row->no_mobil ?? '').'</td>
                    <td>'.htmlspecialchars($row->no_dn ?? '').'</td>
                    <td>'.htmlspecialchars($row->tipe_penerimaan ?? '').'</td>
                    <td>'.htmlspecialchars($row->asal_pabrik ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_produk ?? '').'</td>
                    <td>'.htmlspecialchars($row->jumlah ?? '').'</td>
                    <td>'.htmlspecialchars($row->best_before ?? '').'</td>
                    <td>'.htmlspecialchars($row->batch ?? '').'</td>
                    <td>'.htmlspecialchars($row->satuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->durasi_input ?? '').'</td>
                    <td>'.htmlspecialchars($row->catatan ?? '').'</td>
                </tr>';
            }
            echo '</table>';
        });
    }

    // =========================================================================
    // 3. LAPORAN GABUNGAN MASUK & KELUAR (Ref: laporan_gabungan.php)
    // =========================================================================
    public function exportGabungan(Request $request)
    {
        $from = trim((string) $request->input('from', ''));
        $to = trim((string) $request->input('to', ''));
        if ($from === '') {
            $from = trim((string) $request->input('start_date', ''));
        }
        if ($to === '') {
            $to = trim((string) $request->input('end_date', ''));
        }
        if ($from === '' || ! strtotime($from)) {
            $from = date('Y-m-01');
        }
        if ($to === '' || ! strtotime($to)) {
            $to = date('Y-m-d');
        }
        $idPenggunaLokasi = $request->input('id_pengguna_lokasi', '');
        $format = $request->input('format', 'xlsx');

        $queryInbound = DB::table('barang_masuk as bm')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bm.id_pengguna_lokasi')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'bm.id_pengguna')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$from, $to])
            ->select('bm.*', 'pl.nama_pengguna_lokasi', 'u.username AS dibuat_oleh', DB::raw('DATE(bm.tanggal_masuk) AS tanggal_masuk'));
        $queryInbound = $this->filterLokasi($queryInbound, 'bm.id_pengguna_lokasi', $idPenggunaLokasi);
        $resInbound = $queryInbound->orderBy('bm.tanggal_masuk', 'ASC')
            ->orderBy('bm.id_pengguna_lokasi', 'ASC')
            ->orderBy('bm.nama_produk', 'ASC')
            ->get();

        $queryOutbound = DB::table('barang_keluar as bk')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bk.id_pengguna_lokasi')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'bk.id_pengguna')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$from, $to])
            ->select('bk.*', 'pl.nama_pengguna_lokasi', 'u.username AS dibuat_oleh', DB::raw('DATE(bk.tanggal_keluar) AS tanggal_keluar'), DB::raw('SEC_TO_TIME(bk.durasi_detik) AS durasi_input'));
        $queryOutbound = $this->filterLokasi($queryOutbound, 'bk.id_pengguna_lokasi', $idPenggunaLokasi);
        $resOutbound = $queryOutbound->orderBy('bk.tanggal_keluar', 'ASC')
            ->orderBy('bk.id_pengguna_lokasi', 'ASC')
            ->orderBy('bk.nama_driver', 'ASC')
            ->orderBy('bk.nama_produk', 'ASC')
            ->get();

        if ($format === 'json') {
            return response()->json([
                'success' => true, 'is_gabungan' => true,
                'from' => $from, 'to' => $to,
                'inbound' => $resInbound, 'outbound' => $resOutbound,
            ]);
        }

        return $this->renderExcelResponse("Laporan Gabungan {$from} s-d {$to}.xls", function () use ($resInbound, $resOutbound, $from, $to) {
            echo "<table border='1'><tr><th colspan='16'>LAPORAN BARANG MASUK ({$from} s/d {$to})</th></tr>";
            echo '<tr><th>No</th><th>ID Lokasi</th><th>Nama Lokasi</th><th>Dibuat Oleh</th><th>Tanggal Masuk</th><th>Driver</th><th>No Mobil</th><th>No DN</th><th>Tipe Penerimaan</th><th>Asal Pabrik</th><th>Produk</th><th>Jumlah</th><th>Best Before</th><th>Batch</th><th>Satuan</th><th>Catatan</th></tr>';
            $no = 1;
            foreach ($resInbound as $row) {
                echo '<tr>
                    <td>'.$no++.'</td>
                    <td>'.htmlspecialchars($row->id_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->dibuat_oleh ?? '').'</td>
                    <td>'.htmlspecialchars($row->tanggal_masuk ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_driver ?? '').'</td>
                    <td>'.htmlspecialchars($row->no_mobil ?? '').'</td>
                    <td>'.htmlspecialchars($row->no_dn ?? '').'</td>
                    <td>'.htmlspecialchars($row->tipe_penerimaan ?? '').'</td>
                    <td>'.htmlspecialchars($row->asal_pabrik ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_produk ?? '').'</td>
                    <td>'.htmlspecialchars($row->jumlah ?? '').'</td>
                    <td>'.htmlspecialchars($row->best_before ?? '').'</td>
                    <td>'.htmlspecialchars($row->batch ?? '').'</td>
                    <td>'.htmlspecialchars($row->satuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->catatan ?? '').'</td>
                </tr>';
            }
            echo '</table><br><br>';

            echo "<table border='1'><tr><th colspan='17'>LAPORAN BARANG KELUAR ({$from} s/d {$to})</th></tr>";
            echo '<tr><th>No</th><th>ID Lokasi</th><th>Nama Lokasi</th><th>Dibuat Oleh</th><th>Tanggal Keluar</th><th>Driver</th><th>No Mobil</th><th>Tipe Pengeluaran</th><th>Tujuan</th><th>Produk</th><th>Jumlah</th><th>Best Before</th><th>Batch</th><th>Satuan</th><th>Status</th><th>Durasi Input</th><th>Catatan</th></tr>';
            $no = 1;
            foreach ($resOutbound as $row) {
                echo '<tr>
                    <td>'.$no++.'</td>
                    <td>'.htmlspecialchars($row->id_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->dibuat_oleh ?? '').'</td>
                    <td>'.htmlspecialchars($row->tanggal_keluar ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_driver ?? '').'</td>
                    <td>'.htmlspecialchars($row->no_mobil ?? '').'</td>
                    <td>'.htmlspecialchars($row->tipe_pengeluaran ?? '').'</td>
                    <td>'.htmlspecialchars($row->tujuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_produk ?? '').'</td>
                    <td>'.htmlspecialchars($row->jumlah ?? '').'</td>
                    <td>'.htmlspecialchars($row->best_before ?? '').'</td>
                    <td>'.htmlspecialchars($row->batch ?? '').'</td>
                    <td>'.htmlspecialchars($row->satuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->status ?? '').'</td>
                    <td>'.htmlspecialchars($row->durasi_input ?? '').'</td>
                    <td>'.htmlspecialchars($row->catatan ?? '').'</td>
                </tr>';
            }
            echo '</table>';
        });
    }

    // =========================================================================
    // 4. LAPORAN MUTASI (Ref: laporan_mutasi.php)
    // =========================================================================
    public function exportMutasi(Request $request)
    {
        $mode = $request->input('mode', 'day');
        $format = $request->input('format', 'xlsx');
        $date = trim((string) $request->input('date', ''));
        $month = $request->input('month');
        $year = $request->input('year');
        $startDate = trim((string) $request->input('start_date', ''));
        $endDate = trim((string) $request->input('end_date', ''));
        $idPenggunaLokasi = $request->input('id_pengguna_lokasi', '');

        $labelPeriode = $this->resolvePeriodeLabel($mode, $startDate, $endDate, $date, $month, $year);

        $query = DB::table('mutasi as m')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'm.id_pengguna_lokasi')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'm.id_pengguna')
            ->leftJoin('produk as p', 'p.id_produk', '=', 'm.id_produk')
            ->select(
                'm.id_pengguna_lokasi', 'pl.nama_pengguna_lokasi', 'u.username AS dibuat_oleh',
                'm.created_at', 'p.nama_produk', 'm.jumlah', 'm.satuan', 'm.best_before',
                'm.jenis_mutasi', 'm.lokasi_sumber', 'm.lokasi_tujuan', 'm.catatan'
            );

        $diterapkanFilter = true;
        if ($mode !== 'all') {
            if ($mode === 'range' && $startDate !== '' && $endDate !== '') {
                $query->whereBetween(DB::raw('DATE(m.created_at)'), [$startDate, $endDate]);
            } elseif ($mode === 'day' && $date !== '') {
                $query->whereDate('m.created_at', $date);
            } elseif ($mode === 'month' && $month && $year) {
                $query->whereYear('m.created_at', $year)->whereMonth('m.created_at', $month);
            } elseif ($mode === 'year' && $year) {
                $query->whereYear('m.created_at', $year);
            } else {
                $diterapkanFilter = false;
            }

            if (! $diterapkanFilter) {
                $query->whereDate('m.created_at', date('Y-m-d'));
            }
        }

        $query = $this->filterLokasi($query, 'm.id_pengguna_lokasi', $idPenggunaLokasi);

        if ($mode === 'all') {
            $labelPeriode = 'Semua Data';
        }

        $rows = $query->orderBy('m.created_at', 'ASC')->orderBy('m.id_mutasi', 'ASC')->get();

        $status_options = [
            'GS_GS' => 'Goods Stock - Goods Stock',
            'GS_BAD' => 'Goods Stock - Bad Stock',
            'BAD_GS' => 'Bad Stock - Goods Stock',
            'GS_REJ' => 'Goods Stock - Reject',
            'BAD_REJ' => 'Bad Stock - Reject',
            'GS_QI' => 'Goods Stock - QI',
            'QI_GS' => 'QI - Goods Stock',
            'QI_BAD' => 'QI - Bad Stock',
            'BAD_QI' => 'Bad Stock - QI',
        ];

        if ($format === 'json') {
            return response()->json([
                'success' => true, 'mode' => $mode, 'periode' => $labelPeriode,
                'count' => count($rows), 'items' => $rows,
            ]);
        }

        return $this->renderExcelResponse("Laporan Mutasi {$labelPeriode}.xls", function () use ($rows, $status_options) {
            echo "<table border='1'><tr>
                <th>No</th><th>Tanggal</th><th>ID Lokasi</th><th>Nama Lokasi</th><th>Dibuat Oleh</th>
                <th>Produk</th><th>Jumlah</th><th>Satuan</th><th>Best Before</th><th>Jenis Mutasi</th>
                <th>Lokasi Sumber</th><th>Lokasi Tujuan</th><th>Catatan</th>
            </tr>";
            $no = 1;
            foreach ($rows as $row) {
                $jenis = trim((string) ($row->jenis_mutasi ?? ''));
                $label_jenis = $status_options[$jenis] ?? $jenis;
                echo '<tr>
                    <td>'.$no++.'</td>
                    <td>'.htmlspecialchars($row->created_at ?? '').'</td>
                    <td>'.htmlspecialchars($row->id_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->dibuat_oleh ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_produk ?? '').'</td>
                    <td>'.htmlspecialchars($row->jumlah ?? '').'</td>
                    <td>'.htmlspecialchars($row->satuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->best_before ?? '').'</td>
                    <td>'.htmlspecialchars($label_jenis).'</td>
                    <td>'.htmlspecialchars($row->lokasi_sumber ?? '').'</td>
                    <td>'.htmlspecialchars($row->lokasi_tujuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->catatan ?? '').'</td>
                </tr>';
            }
            echo '</table>';
        });
    }

    // =========================================================================
    // 5. LAPORAN STOCK OPNAME (Ref: laporan_stok_opname.php)
    // =========================================================================
    public function exportStockOpname(Request $request)
    {
        $mode = strtolower(trim((string) $request->input('mode', '')));

        if ($mode !== 'export') {
            return response()->json([
                'success' => false,
                'message' => 'File ini khusus export laporan stock opname. Gunakan mode=export.',
                'data' => null,
            ]);
        }

        $id_pengguna_lokasi = $this->resolveLokasiIds($request);
        $tanggal_opname = $request->input('tanggal_opname') ?: date('Y-m-d');
        $created_at = trim((string) $request->input('created_at', ''));

        if (empty($id_pengguna_lokasi)) {
            return response('id_pengguna_lokasi wajib diisi', 400, ['Content-Type' => 'text/plain; charset=utf-8']);
        }

        $query = DB::table('stok_opname')
            ->whereIn('id_pengguna_lokasi', $id_pengguna_lokasi)
            ->where('tanggal_opname', $tanggal_opname);

        if ($created_at !== '') {
            $query->where('created_at', $created_at);
        }

        $rows = $query->orderBy('lokasi_block', 'ASC')
            ->orderBy('nama_produk', 'ASC')
            ->orderBy('best_before', 'ASC')
            ->orderBy('id_opname', 'ASC')
            ->get();

        $namaTanggal = str_replace('-', '', $tanggal_opname);
        $namaJam = $created_at !== '' ? '_'.str_replace(['-', ':', ' '], ['', '', '_'], $created_at) : '';

        // Metadata untuk header profesional Excel
        $jenis_opname = $rows->first()->jenis_opname ?? 'Akurasi';
        $sumber_opname = $rows->first()->sumber_opname ?? 'Checker';
        $firstCreated = $rows->first()->created_at ?? $created_at;
        $waktuFull = $firstCreated ? date('d/m/Y H:i', strtotime($firstCreated)) : '-';
        $sumSistem = 0; $sumFisik = 0; $sumSelisih = 0;
        foreach ($rows as $r) { $sumSistem += intval($r->stok_sistem ?? 0); $sumFisik += intval($r->stok_fisik ?? 0); $sumSelisih += intval($r->selisih ?? 0); }
        $jmlSelisih = 0; foreach ($rows as $r) if (intval($r->selisih ?? 0) !== 0) $jmlSelisih++;

        // Grouped untuk subtotal block
        $groupMap = [];
        foreach ($rows as $r) {
            $loc = trim((string) ($r->lokasi_block ?? ''));
            $block = ($loc === '' || $loc === '-') ? 'Lainnya' : (preg_replace('/\s*-\s*\d+\s*$/', '', $loc) ?: $loc);
            if (!isset($groupMap[$block])) $groupMap[$block] = ['name'=>$block,'rows'=>[],'s'=>0,'f'=>0,'se'=>0];
            $groupMap[$block]['rows'][] = $r;
            $groupMap[$block]['s'] += intval($r->stok_sistem ?? 0);
            $groupMap[$block]['f'] += intval($r->stok_fisik ?? 0);
            $groupMap[$block]['se'] += intval($r->selisih ?? 0);
        }
        ksort($groupMap);
        $grouped = array_values($groupMap);

        return $this->renderExcelResponse("Laporan_Stock_Opname_{$namaTanggal}{$namaJam}.xls", function () use ($rows, $tanggal_opname, $waktuFull, $jenis_opname, $sumber_opname, $sumSistem, $sumFisik, $sumSelisih, $jmlSelisih, $grouped) {
            // Header profesional
            echo "<table border='1'>";
            echo "<tr><td colspan='12' style='background:#191970;color:#ffffff;font-weight:bold;font-size:14px;text-align:center;height:26px;'>LAPORAN DETAIL STOCK OPNAME - SAILENDRA WMS</td></tr>";
            echo "<tr><td colspan='12' style='background:#eef2ff;color:#191970;font-size:10px;text-align:center;'>Tanggal Opname: <b>{$tanggal_opname}</b> &nbsp;|&nbsp; Waktu Simpan: <b>{$waktuFull}</b> &nbsp;|&nbsp; Jenis: <b>{$jenis_opname}</b> &nbsp;|&nbsp; Sumber: <b>{$sumber_opname}</b> &nbsp;|&nbsp; Dicetak: ".date('d/m/Y H:i')."</td></tr>";
            echo "<tr><td colspan='3' style='background:#191970;color:#fff;font-weight:bold;text-align:center;'>Total Item: ".count($rows)."</td><td colspan='3' style='background:#ecfdf5;color:#065f46;font-weight:bold;text-align:center;'>Total Stok Sistem: ".number_format($sumSistem,0,',','.')."</td><td colspan='3' style='background:#fef2f2;color:#991b1b;font-weight:bold;text-align:center;'>Total Stok Fisik: ".number_format($sumFisik,0,',','.')."</td><td colspan='3' style='background:".($sumSelisih==0?'#fffbeb':'#fee2e2').";color:".($sumSelisih==0?'#92400e':'#991b1b').";font-weight:bold;text-align:center;'>Total Selisih: ".($sumSelisih>0?'+':'').number_format($sumSelisih,0,',','.')." (".$jmlSelisih." item)</td></tr>";
            echo "<tr><td colspan='12' style='height:8px; border:none;'></td></tr>";
            // Column header
            echo "<thead><tr>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>No</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;'>Tanggal Opname</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Waktu Simpan</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Lokasi Block</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;'>Produk</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Best Before</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Stok Sistem</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Stok Fisik</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Selisih</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Satuan</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;'>Catatan Wajib</th>
                <th style='background:#191970;color:#ffffff;font-weight:bold;text-align:center;'>Dirubah Oleh</th>
            </tr></thead><tbody>";
            $no = 1;
            foreach ($grouped as $g) {
                foreach ($g['rows'] as $row) {
                    $waktuSimpan = !empty($row->created_at) ? date('H:i', strtotime($row->created_at)) : '-';
                    $selisih = intval($row->selisih ?? 0);
                    $text_selisih = $selisih > 0 ? '+'.$selisih : (string)$selisih;
                    $bgFisik = "background:#f0fdf4;";
                    $colorSelisih = $selisih < 0 ? "color:#dc2626;font-weight:bold;" : ($selisih > 0 ? "color:#16a34a;font-weight:bold;" : "color:#6b7280;");
                    echo '<tr>
                        <td style="text-align:center;">'.$no++.'</td>
                        <td>'.htmlspecialchars($row->tanggal_opname ?? '').'</td>
                        <td style="text-align:center;">'.htmlspecialchars($waktuSimpan).'</td>
                        <td style="text-align:center;font-weight:bold;color:#191970;">'.htmlspecialchars($row->lokasi_block ?? '').'</td>
                        <td>'.htmlspecialchars($row->nama_produk ?? '').'</td>
                        <td style="text-align:center;">'.htmlspecialchars($row->best_before ?? '').'</td>
                        <td style="text-align:right;">'.(int) ($row->stok_sistem ?? 0).'</td>
                        <td style="text-align:right;'.$bgFisik.'font-weight:bold;">'.(int) ($row->stok_fisik ?? 0).'</td>
                        <td style="text-align:right;'.$colorSelisih.'">'.$text_selisih.'</td>
                        <td style="text-align:center;">'.htmlspecialchars($row->satuan ?? '').'</td>
                        <td>'.htmlspecialchars($row->alasan ?? '').'</td>
                        <td style="text-align:center;">'.htmlspecialchars($row->dirubah_oleh ?? '-').'</td>
                    </tr>';
                }
                // Subtotal block
                echo "<tr style='background:#eef2ff;font-weight:bold;color:#191970;'>
                    <td colspan='6' style='text-align:right;background:#eef2ff;'>SUBTOTAL BLOCK {$g['name']} (".count($g['rows'])." item)</td>
                    <td style='text-align:right;background:#eef2ff;'>".number_format($g['s'],0,',','.')."</td>
                    <td style='text-align:right;background:#eef2ff;'>".number_format($g['f'],0,',','.')."</td>
                    <td style='text-align:right;background:#eef2ff;color:".($g['se']<0?'#dc2626':($g['se']>0?'#16a34a':'#6b7280'))."'>".($g['se']>0?'+':'').number_format($g['se'],0,',','.')."</td>
                    <td colspan='3' style='background:#eef2ff;'></td>
                </tr>";
            }
            // Grand total
            echo "<tr style='background:#191970;color:#ffffff;font-weight:bold;'>
                <td colspan='6' style='text-align:right;background:#191970;color:#ffffff;'>TOTAL KESELURUHAN</td>
                <td style='text-align:right;background:#191970;color:#ffffff;'>".number_format($sumSistem,0,',','.')."</td>
                <td style='text-align:right;background:#191970;color:#ffffff;'>".number_format($sumFisik,0,',','.')."</td>
                <td style='text-align:right;background:#191970;color:#ffffff;'>".($sumSelisih>0?'+':'').number_format($sumSelisih,0,',','.')."</td>
                <td colspan='3' style='background:#191970;color:#ffffff;text-align:center;'>".count($rows)." item | ".count($grouped)." block</td>
            </tr>";
            echo '</tbody></table>';
            echo "<br><table><tr><td style='font-size:9px;color:#6b7280;'>Dicetak: ".date('d/m/Y H:i')." WIB &middot; Sailendra WMS &middot; Dokumen detail per sesi opname</td></tr></table>";
        });
    }

    // =========================================================================
    // 5b. LAPORAN STOCK OPNAME DETAIL PDF - Tabel Profesional (Landscape A4)
    // =========================================================================
    public function detailStockOpnamePdf(Request $request)
    {
        $id_pengguna_lokasi = $this->resolveLokasiIds($request);
        $tanggal_opname = trim((string) $request->input('tanggal_opname', ''));
        $created_at = trim((string) $request->input('created_at', ''));

        if (empty($id_pengguna_lokasi)) {
            return response('id_pengguna_lokasi wajib diisi', 400, ['Content-Type' => 'text/plain; charset=utf-8']);
        }
        if ($tanggal_opname === '' && $created_at === '') {
            return response('tanggal_opname atau created_at wajib diisi', 400, ['Content-Type' => 'text/plain; charset=utf-8']);
        }
        // Default tanggal if only created_at given, we still need it for query fallback
        if ($tanggal_opname === '' && $created_at !== '') {
            $tanggal_opname = substr($created_at, 0, 10);
        }

        $query = DB::table('stok_opname')
            ->whereIn('id_pengguna_lokasi', $id_pengguna_lokasi);

        if ($created_at !== '') {
            $query->where('created_at', $created_at);
            // also filter tanggal if provided for extra safety
            if ($tanggal_opname !== '') {
                $query->where('tanggal_opname', $tanggal_opname);
            }
        } else {
            $query->where('tanggal_opname', $tanggal_opname);
        }

        $rows = $query->orderBy('lokasi_block', 'ASC')
            ->orderBy('nama_produk', 'ASC')
            ->orderBy('best_before', 'ASC')
            ->orderBy('id_opname', 'ASC')
            ->get();

        if ($rows->isEmpty()) {
            return response('Data detail stock opname tidak ditemukan untuk sesi tersebut.', 404, ['Content-Type' => 'text/plain; charset=utf-8']);
        }

        // Resolve metadata from first row + additional lookups
        $first = $rows->first();
        $tanggal_opname = $first->tanggal_opname ?? $tanggal_opname;
        $created_at = $first->created_at ?? $created_at;
        $jenis_opname = $first->jenis_opname ?? 'Akurasi';
        $sumber_opname = $first->sumber_opname ?? 'Checker';

        // Petugas (username) via join
        $petugas = '-';
        try {
            $p = DB::selectOne(
                'SELECT p.username FROM stok_opname so JOIN pengguna p ON p.id_pengguna = so.id_pengguna WHERE so.created_at = ? AND so.tanggal_opname = ? LIMIT 1',
                [$created_at, $tanggal_opname]
            );
            if ($p && isset($p->username)) $petugas = trim((string) $p->username);
        } catch (\Throwable $e) {}

        // Lokasi names
        $lokasi_names = [];
        try {
            $lokRows = DB::table('pengguna_lokasi')->whereIn('id_pengguna_lokasi', $id_pengguna_lokasi)->pluck('nama_pengguna_lokasi');
            $lokasi_names = $lokRows->filter(fn($v) => trim((string)$v) !== '')->values()->all();
        } catch (\Throwable $e) {}

        // Summary calculations
        $sum_sistem = 0; $sum_fisik = 0; $sum_selisih = 0;
        $jml_selisih = 0; $jml_minus = 0; $jml_plus = 0;
        $ids = [];
        foreach ($rows as $r) {
            $sum_sistem += intval($r->stok_sistem ?? 0);
            $sum_fisik += intval($r->stok_fisik ?? 0);
            $sel = intval($r->selisih ?? 0);
            $sum_selisih += $sel;
            if ($sel !== 0) $jml_selisih++;
            if ($sel < 0) $jml_minus++;
            if ($sel > 0) $jml_plus++;
            $ids[intval($r->id_produk)] = true;
        }
        $jml_sesuai = count($rows) - $jml_selisih;

        // Grouped by block
        $groupMap = [];
        foreach ($rows as $r) {
            $loc = trim((string) ($r->lokasi_block ?? ''));
            if ($loc === '' || $loc === '-') {
                $block = 'Lainnya';
            } else {
                $block = preg_replace('/\s*-\s*\d+\s*$/', '', $loc);
                if (trim($block) === '') $block = $loc;
            }
            if (!isset($groupMap[$block])) $groupMap[$block] = ['name' => $block, 'rows' => [], 's' => 0, 'f' => 0, 'se' => 0];
            $groupMap[$block]['rows'][] = $r;
            $groupMap[$block]['s'] += intval($r->stok_sistem ?? 0);
            $groupMap[$block]['f'] += intval($r->stok_fisik ?? 0);
            $groupMap[$block]['se'] += intval($r->selisih ?? 0);
        }
        ksort($groupMap);
        $grouped = array_values($groupMap);

        $waktu_simpan = '';
        if (!empty($created_at)) {
            $waktu_simpan = date('d/m/Y H:i', strtotime($created_at));
            try { $waktu_simpan .= ' WIB'; } catch (\Throwable $e) {}
        }
        $printed_at = date('d/m/Y H:i');
        $hari_label = '';
        try {
            $ts = strtotime($tanggal_opname);
            $days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
            $hari_label = $days[date('w', $ts)] . ', ' . date('d F Y', $ts);
            // translate month
            $months = ['January'=>'Januari','February'=>'Februari','March'=>'Maret','April'=>'April','May'=>'Mei','June'=>'Juni','July'=>'Juli','August'=>'Agustus','September'=>'September','October'=>'Oktober','November'=>'November','December'=>'Desember'];
            $hari_label = strtr($hari_label, $months);
        } catch (\Throwable $e) {}

        $html = view('pdf.stok-opname-detail', [
            'tanggal_opname' => $tanggal_opname,
            'created_at' => $created_at,
            'waktu_simpan' => $waktu_simpan,
            'jenis_opname' => $jenis_opname,
            'sumber_opname' => $sumber_opname,
            'petugas' => $petugas,
            'lokasi_names' => $lokasi_names,
            'rows' => $rows,
            'grouped' => $grouped,
            'sum_sistem' => $sum_sistem,
            'sum_fisik' => $sum_fisik,
            'sum_selisih' => $sum_selisih,
            'total_items' => count($rows),
            'total_blocks' => count($grouped),
            'total_produk_unik' => count($ids),
            'jml_selisih' => $jml_selisih,
            'jml_sesuai' => $jml_sesuai,
            'jml_minus' => $jml_minus,
            'jml_plus' => $jml_plus,
            'printed_at' => $printed_at,
            'hari_label' => $hari_label,
        ])->render();

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);
        $pdf->setPaper('A4', 'landscape');

        $namaTanggal = str_replace('-', '', $tanggal_opname);
        $namaJam = $created_at !== '' ? '_'.str_replace(['-', ':', ' '], ['', '', '_'], $created_at) : '';
        $filename = "Laporan_Detail_Stock_Opname_{$namaTanggal}{$namaJam}.pdf";

        return $pdf->download($filename);
    }

    // =========================================================================
    // 6. FORM PRINT STOCK OPNAME (bukan dari referensi, dipakai route tersendiri)
    // =========================================================================
    public function printReadyStockOpname(Request $request)
    {
        $id_pengguna_lokasi = $this->resolveLokasiIds($request);

        if (empty($id_pengguna_lokasi)) {
            return response('id_pengguna_lokasi wajib diisi', 400, ['Content-Type' => 'text/plain; charset=utf-8']);
        }

        $placeholders = implode(',', array_fill(0, count($id_pengguna_lokasi), '?'));

        $rows = DB::select(
            "SELECT p.id_produk, p.nama_produk
             FROM stok_gudang_deep sd
             JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header AND sg.id_pengguna_lokasi = sd.id_pengguna_lokasi
             JOIN produk p ON p.id_produk = sg.id_produk
             WHERE sd.id_pengguna_lokasi IN ($placeholders) AND sd.jumlah > 0
             GROUP BY p.id_produk, p.nama_produk
             ORDER BY p.nama_produk ASC",
            $id_pengguna_lokasi
        );

        $html = view('pdf.stok-opname-form', [
            'tanggal_opname' => $request->input('tanggal_opname') ?: date('Y-m-d'),
            'produk_list' => $rows,
        ])->render();

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);

        return $pdf->download('Form_Stock_Opname_'.str_replace('-', '', date('Y-m-d')).'.pdf');
    }

    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================
    private function resolveLokasiIds(Request $request): array
    {
        $multi = trim((string) $request->input('id_pengguna_lokasi_multi', ''));
        if ($multi !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $multi)), fn ($id) => $id !== ''));
        }

        $single = trim((string) $request->input('id_pengguna_lokasi', ''));

        return $single !== '' ? [$single] : [];
    }

    private function resolvePeriodeLabel($mode, $startDate, $endDate, $date, $month, $year)
    {
        if ($mode === 'range' && $startDate && $endDate) {
            return $startDate.' s-d '.$endDate;
        } elseif ($mode === 'day' && $date) {
            return $date;
        } elseif ($mode === 'month' && $month && $year) {
            return sprintf('%04d-%02d', $year, $month);
        } elseif ($mode === 'year' && $year) {
            return (string) $year;
        }

        return date('Y-m-d');
    }

    private function filterLokasi($query, $column, $idPenggunaLokasi)
    {
        if (! empty($idPenggunaLokasi) && $idPenggunaLokasi !== 'all') {
            if (is_string($idPenggunaLokasi) && strpos($idPenggunaLokasi, ',') !== false) {
                $idPenggunaLokasi = explode(',', $idPenggunaLokasi);
            }

            if (is_array($idPenggunaLokasi)) {
                $filteredIds = array_filter(array_map('trim', $idPenggunaLokasi), fn ($id) => $id !== 'all' && $id !== '');
                if (! empty($filteredIds)) {
                    $query->whereIn($column, $filteredIds);
                }
            } else {
                $query->where($column, trim($idPenggunaLokasi));
            }
        }

        return $query;
    }

    private function renderExcelResponse($filename, $callback)
    {
        return response()->stream(function () use ($callback) {
            $callback();
        }, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'max-age=0',
        ]);
    }
}
