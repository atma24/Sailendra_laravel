<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LaporanController extends Controller
{
    // =========================================================================
    // 1. LAPORAN BARANG KELUAR (Ref: source 7)
    // =========================================================================
    public function exportBarangKeluar(Request $request)
    {
        $mode = $request->input('mode', 'day');
        $format = $request->input('format', 'xlsx');
        $date = $request->input('date');
        $month = $request->input('month');
        $year = $request->input('year');
        $driver = $request->input('driver', '');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
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

        // Filter Mode Tanggal
        if ($mode === 'range' && $startDate && $endDate) {
            $query->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$startDate, $endDate]);
        } elseif ($mode === 'day' && $date) {
            $query->whereDate('bk.tanggal_keluar', $date);
        } elseif ($mode === 'month' && $month && $year) {
            $query->whereYear('bk.tanggal_keluar', $year)->whereMonth('bk.tanggal_keluar', $month);
        } elseif ($mode === 'year' && $year) {
            $query->whereYear('bk.tanggal_keluar', $year);
        } else {
            $query->whereDate('bk.tanggal_keluar', date('Y-m-d'));
        }

        if ($driver !== '') {
            $query->where('bk.nama_driver', 'LIKE', "%{$driver}%");
        }

        $query = $this->filterLokasi($query, 'bk.id_pengguna_lokasi', $idPenggunaLokasi);
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
    // 2. LAPORAN BARANG MASUK (Ref: source 8)
    // =========================================================================
    public function exportBarangMasuk(Request $request)
    {
        $mode = $request->input('mode', 'day');
        $format = $request->input('format', 'xlsx');
        $date = $request->input('date');
        $month = $request->input('month');
        $year = $request->input('year');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
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
                'bm.satuan', 'bm.catatan',
                DB::raw('SEC_TO_TIME(bm.durasi_detik) AS durasi_input')
            );

        if ($mode === 'range' && $startDate && $endDate) {
            $query->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$startDate, $endDate]);
        } elseif ($mode === 'day' && $date) {
            $query->whereDate('bm.tanggal_masuk', $date);
        } elseif ($mode === 'month' && $month && $year) {
            $query->whereYear('bm.tanggal_masuk', $year)->whereMonth('bm.tanggal_masuk', $month);
        } elseif ($mode === 'year' && $year) {
            $query->whereYear('bm.tanggal_masuk', $year);
        } else {
            $query->whereDate('bm.tanggal_masuk', date('Y-m-d'));
        }

        $query = $this->filterLokasi($query, 'bm.id_pengguna_lokasi', $idPenggunaLokasi);
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
    // 3. LAPORAN GABUNGAN MASUK & KELUAR (Ref: source 9)
    // =========================================================================
    public function exportGabungan(Request $request)
    {
        $from = $request->input('from', date('Y-m-01'));
        $to = $request->input('to', date('Y-m-d'));
        $idPenggunaLokasi = $request->input('id_pengguna_lokasi', '');

        $queryInbound = DB::table('barang_masuk as bm')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bm.id_pengguna_lokasi')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'bm.id_pengguna')
            ->whereBetween(DB::raw('DATE(bm.tanggal_masuk)'), [$from, $to])
            ->select('bm.*', 'pl.nama_pengguna_lokasi', 'u.username AS dibuat_oleh', DB::raw('DATE(bm.tanggal_masuk) AS tgl_masuk'));
        $queryInbound = $this->filterLokasi($queryInbound, 'bm.id_pengguna_lokasi', $idPenggunaLokasi);
        $resInbound = $queryInbound->orderBy('bm.tanggal_masuk', 'ASC')->get();

        $queryOutbound = DB::table('barang_keluar as bk')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bk.id_pengguna_lokasi')
            ->leftJoin('pengguna as u', 'u.id_pengguna', '=', 'bk.id_pengguna')
            ->whereBetween(DB::raw('DATE(bk.tanggal_keluar)'), [$from, $to])
            ->select('bk.*', 'pl.nama_pengguna_lokasi', 'u.username AS dibuat_oleh', DB::raw('DATE(bk.tanggal_keluar) AS tgl_keluar'), DB::raw('SEC_TO_TIME(bk.durasi_detik) AS durasi_input'));
        $queryOutbound = $this->filterLokasi($queryOutbound, 'bk.id_pengguna_lokasi', $idPenggunaLokasi);
        $resOutbound = $queryOutbound->orderBy('bk.tanggal_keluar', 'ASC')->get();

        return $this->renderExcelResponse("Laporan Gabungan {$from} s-d {$to}.xls", function () use ($resInbound, $resOutbound, $from, $to) {
            // Tabel Inbound
            echo "<table border='1'><tr><th colspan='16'>LAPORAN BARANG MASUK ({$from} s/d {$to})</th></tr>";
            echo '<tr><th>No</th><th>ID Lokasi</th><th>Nama Lokasi</th><th>Dibuat Oleh</th><th>Tanggal Masuk</th><th>Driver</th><th>No Mobil</th><th>No DN</th><th>Tipe Penerimaan</th><th>Asal Pabrik</th><th>Produk</th><th>Jumlah</th><th>Best Before</th><th>Batch</th><th>Satuan</th><th>Catatan</th></tr>';
            $no = 1;
            foreach ($resInbound as $row) {
                echo '<tr>
                    <td>'.$no++.'</td>
                    <td>'.htmlspecialchars($row->id_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->dibuat_oleh ?? '').'</td>
                    <td>'.htmlspecialchars($row->tgl_masuk ?? '').'</td>
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

            // Tabel Outbound
            echo "<table border='1'><tr><th colspan='17'>LAPORAN BARANG KELUAR ({$from} s/d {$to})</th></tr>";
            echo '<tr><th>No</th><th>ID Lokasi</th><th>Nama Lokasi</th><th>Dibuat Oleh</th><th>Tanggal Keluar</th><th>Driver</th><th>No Mobil</th><th>Tipe Pengeluaran</th><th>Tujuan</th><th>Produk</th><th>Jumlah</th><th>Best Before</th><th>Batch</th><th>Satuan</th><th>Status</th><th>Durasi Input</th><th>Catatan</th></tr>';
            $no = 1;
            foreach ($resOutbound as $row) {
                echo '<tr>
                    <td>'.$no++.'</td>
                    <td>'.htmlspecialchars($row->id_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_pengguna_lokasi ?? '').'</td>
                    <td>'.htmlspecialchars($row->dibuat_oleh ?? '').'</td>
                    <td>'.htmlspecialchars($row->tgl_keluar ?? '').'</td>
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
    // 4. LAPORAN MUTASI (Ref: source 10)
    // =========================================================================
    public function exportMutasi(Request $request)
    {
        $mode = $request->input('mode', 'day');
        $format = $request->input('format', 'xlsx');
        $date = $request->input('date');
        $month = $request->input('month');
        $year = $request->input('year');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
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

        if ($mode !== 'all') {
            if ($mode === 'range' && $startDate && $endDate) {
                $query->whereBetween(DB::raw('DATE(m.created_at)'), [$startDate, $endDate]);
            } elseif ($mode === 'day' && $date) {
                $query->whereDate('m.created_at', $date);
            } elseif ($mode === 'month' && $month && $year) {
                $query->whereYear('m.created_at', $year)->whereMonth('m.created_at', $month);
            } elseif ($mode === 'year' && $year) {
                $query->whereYear('m.created_at', $year);
            } else {
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
    // 5. LAPORAN STOCK OPNAME (Ref: source 11)
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

        $id_pengguna_lokasi = trim((string) $request->input('id_pengguna_lokasi', ''));
        $tanggal_opname = $request->input('tanggal_opname') ?: date('Y-m-d');
        $created_at = trim((string) $request->input('created_at', ''));

        if ($id_pengguna_lokasi === '') {
            return response('id_pengguna_lokasi wajib diisi', 400, ['Content-Type' => 'text/plain; charset=utf-8']);
        }

        $query = DB::table('stok_opname')
            ->where('id_pengguna_lokasi', $id_pengguna_lokasi)
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

        return $this->renderExcelResponse("Laporan_Stock_Opname_{$namaTanggal}{$namaJam}.xls", function () use ($rows) {
            echo "<table border='1'><thead><tr>
                <th>Tanggal Opname</th><th>Waktu Simpan</th><th>Lokasi Block</th><th>Produk</th>
                <th>Best Before</th><th>Stok Fisik</th><th>Stok Sistem</th><th>Selisih</th>
                <th>Satuan</th><th>Catatan Wajib</th><th>Stok Sebelumnya</th><th>Dirubah Oleh</th>
            </tr></thead><tbody>";

            foreach ($rows as $row) {
                $waktuSimpan = ! empty($row->created_at) ? date('H:i', strtotime($row->created_at)) : '';
                $selisih = (int) ($row->selisih ?? 0);
                $text_selisih = $selisih > 0 ? '+'.$selisih : $selisih;
                $stok_sebelumnya = isset($row->stok_sebelumnya) ? (int) $row->stok_sebelumnya : '-';

                echo '<tr>
                    <td>'.htmlspecialchars($row->tanggal_opname ?? '').'</td>
                    <td>'.htmlspecialchars($waktuSimpan).'</td>
                    <td>'.htmlspecialchars($row->lokasi_block ?? '').'</td>
                    <td>'.htmlspecialchars($row->nama_produk ?? '').'</td>
                    <td>'.htmlspecialchars($row->best_before ?? '').'</td>
                    <td>'.(int) ($row->stok_fisik ?? 0).'</td>
                    <td>'.(int) ($row->stok_sistem ?? 0).'</td>
                    <td>'.$text_selisih.'</td>
                    <td>'.htmlspecialchars($row->satuan ?? '').'</td>
                    <td>'.htmlspecialchars($row->alasan ?? '').'</td>
                    <td>'.$stok_sebelumnya.'</td>
                    <td>'.htmlspecialchars($row->dirubah_oleh ?? '-').'</td>
                </tr>';
            }
            echo '</tbody></table>';
        });
    }

    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================
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
