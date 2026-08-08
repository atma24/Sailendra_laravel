<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\ExcelReader;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class BarangKeluarController extends Controller
{
    use ExcelReader;

    // =========================================================================
    // 1. GET LIST OUTBOUND (Ref: ambil_barang_keluar.php)
    // =========================================================================
    public function index(Request $request)
    {
        $idPenggunaLokasi = trim($request->input('id_pengguna_lokasi', ''));
        $idPenggunaLokasiMulti = trim($request->input('id_pengguna_lokasi_multi', ''));
        $idBarangKeluar = (int) $request->input('id_barang_keluar', 0);
        $cari = trim($request->input('cari', ''));
        $tanggal = trim($request->input('tanggal', ''));
        $status = trim($request->input('status', ''));

        $query = DB::table('barang_keluar as bk')
            ->leftJoin('pengguna as p', 'p.id_pengguna', '=', 'bk.id_pengguna')
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'bk.id_pengguna_lokasi')
            ->select(
                'bk.id_barang_keluar', 'bk.id_pengguna_lokasi', 'bk.gin_no', 'bk.so_number',
                'pl.nama_pengguna_lokasi', 'bk.id_pengguna', 'bk.id_produk', 'bk.nama_produk',
                'bk.tipe_pengeluaran', 'bk.tujuan', 'bk.nama_driver', 'bk.no_mobil', 'bk.jumlah',
                'bk.best_before', 'bk.satuan', 'bk.lokasi_block', 'bk.catatan', 'bk.tanggal_keluar',
                'bk.status', 'p.username AS nama_pengguna'
            );

        if ($idBarangKeluar > 0) {
            $query->where('bk.id_barang_keluar', $idBarangKeluar);
        }

        if ($idPenggunaLokasiMulti !== '') {
            $multiIds = array_filter(array_map('trim', explode(',', $idPenggunaLokasiMulti)));
            if (! empty($multiIds)) {
                $query->whereIn('bk.id_pengguna_lokasi', $multiIds);
            }
        } elseif ($idPenggunaLokasi !== '') {
            $query->where('bk.id_pengguna_lokasi', $idPenggunaLokasi);
        }

        if ($tanggal !== '') {
            $query->where('bk.tanggal_keluar', $tanggal);
        }
        if ($status !== '') {
            $query->where('bk.status', $status);
        }
        if ($cari !== '') {
            $query->where(function ($q) use ($cari) {
                $q->where('bk.nama_driver', 'LIKE', "%{$cari}%")
                    ->orWhere('bk.no_mobil', 'LIKE', "%{$cari}%")
                    ->orWhere('bk.tipe_pengeluaran', 'LIKE', "%{$cari}%")
                    ->orWhere('bk.nama_produk', 'LIKE', "%{$cari}%")
                    ->orWhere('bk.tujuan', 'LIKE', "%{$cari}%")
                    ->orWhere('bk.id_barang_keluar', 'LIKE', "%{$cari}%");
            });
        }

        $rows = $query->orderBy('bk.id_barang_keluar', 'DESC')->get()->map(function ($row) {
            $rowArray = (array) $row;
            $rowArray['status_konfirmasi'] = in_array(strtolower($row->status), ['confirmed', 'selesai']) ? 1 : 0;
            $rowArray['total_jumlah'] = (int) $row->jumlah;
            $rowArray['total_qty'] = (int) $row->jumlah;
            $rowArray['total_baris'] = 1;
            $rowArray['total_jenis'] = 1;
            $rowArray['requester_name'] = $row->nama_pengguna;

            return $rowArray;
        })->toArray();

        if ($idBarangKeluar > 0) {
            return $this->ok(! empty($rows) ? $rows[0] : null);
        }

        return $this->ok($rows);
    }

    // =========================================================================
    // 2. GET DETAIL & ITEMS (Ref: ambil_detail_barang_keluar.php)
    // =========================================================================
    public function show(Request $request)
    {
        $id = (int) $request->input('id_barang_keluar', 0);
        $idPenggunaLokasi = trim($request->input('id_pengguna_lokasi', ''));

        if ($id <= 0) {
            return $this->fail('id_barang_keluar wajib');
        }
        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        try {
$rowHeader = DB::table('barang_keluar as bk')
                ->leftJoin('pengguna as p', 'p.id_pengguna', '=', 'bk.id_pengguna')
                ->leftJoin('pengguna as pu', 'pu.id_pengguna', '=', 'bk.diperbarui_oleh')
                ->where('bk.id_barang_keluar', $id)
                ->where('bk.id_pengguna_lokasi', $idPenggunaLokasi)
                ->select('bk.*', 'p.username AS dibuat_oleh', 'pu.username AS diperbarui_nama')
                ->first();

            if (! $rowHeader) {
                return $this->fail('Data outbound tidak ditemukan', 404);
            }

            $rows = DB::table('barang_keluar as bk')
                ->leftJoin('pengguna as p', 'p.id_pengguna', '=', 'bk.id_pengguna')
                ->leftJoin('pengguna as pu', 'pu.id_pengguna', '=', 'bk.diperbarui_oleh')
                ->where('bk.id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('bk.tanggal_keluar', $rowHeader->tanggal_keluar)
                ->whereRaw("LOWER(TRIM(COALESCE(bk.nama_driver, ''))) = ?", [strtolower(trim($rowHeader->nama_driver))])
                ->whereRaw("LOWER(TRIM(COALESCE(bk.no_mobil, ''))) = ?", [strtolower(trim($rowHeader->no_mobil))])
                ->whereRaw("LOWER(TRIM(COALESCE(bk.tipe_pengeluaran, ''))) = ?", [strtolower(trim($rowHeader->tipe_pengeluaran))])
                ->whereRaw("COALESCE(bk.tujuan, '') = ?", [trim($rowHeader->tujuan ?? '')])
                ->where('bk.id_pengguna', $rowHeader->id_pengguna)
                ->select('bk.*', 'p.username AS dibuat_oleh', 'pu.username AS diperbarui_nama')
                ->orderBy('bk.id_barang_keluar', 'ASC')
                ->get();

            if ($rows->isEmpty()) {
                return $this->fail('Item outbound tidak ditemukan', 404);
            }

            $totalQty = 0;
            $totalJenis = 0;
            $semuaSelesai = true;
            $items = [];

            foreach ($rows as $row) {
                $statusRow = strtolower(trim($row->status));
                if ($statusRow !== 'selesai' && $statusRow !== 'confirmed') {
                    $semuaSelesai = false;
                }

                $totalQty += (int) $row->jumlah;
                $totalJenis++;

                $items[] = [
                    'id_barang_keluar' => $row->id_barang_keluar, 'id_item' => $row->id_barang_keluar,
                    'id_produk' => (int) $row->id_produk, 'nama_produk' => $row->nama_produk ?? '',
                    'jumlah' => (int) $row->jumlah, 'kuantitas' => (int) $row->jumlah,
                    'satuan' => $row->satuan ?? '', 'best_before' => $row->best_before,
'lokasi_block' => $row->lokasi_block, 'catatan' => $row->catatan ?? '',
                    'rencana_deep' => $this->ambilRencanaPerBarangKeluar($row->id_barang_keluar),
                    'diperbarui_oleh' => $row->diperbarui_oleh ?? null, 'diperbarui_nama' => $row->diperbarui_nama ?? null,
                    'catatan_perubahan' => $row->catatan_perubahan ?? '', 'diperbarui_pada' => $row->diperbarui_pada ?? null,
                ];
            }

            $header = (array) $rowHeader;
            $header['jumlah'] = $totalQty;
            $header['status'] = $semuaSelesai ? 'Selesai' : ($rowHeader->status ?? 'Pending');
            $header['status_konfirmasi'] = $semuaSelesai ? 1 : 0;
            $header['total_jenis'] = $totalJenis;
            $header['total_qty'] = $totalQty;

            return $this->ok(['data' => $header, 'items' => $items, 'konfirmasi' => []]);

        } catch (Exception $e) {
            return $this->fail($e->getMessage(), 500);
        }
    }

    // =========================================================================
    // 3. DELETE OUTBOUND (Ref: hapus_barang_keluar.php)
    // =========================================================================
    public function destroy(Request $request)
    {
        $idBarangKeluar = (int) $request->input('id_barang_keluar', 0);
        $idPenggunaLokasi = trim($request->input('id_pengguna_lokasi', ''));

        if ($idBarangKeluar <= 0) {
            return $this->fail('id_barang_keluar wajib');
        }
        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        $row = DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)->first(['status']);

        if (! $row) {
            return $this->fail('Data outbound tidak ditemukan', 404);
        }
        if (in_array(strtolower(trim($row->status)), ['confirmed', 'selesai'])) {
            return $this->fail('Outbound yang sudah selesai tidak dapat dihapus.');
        }

        DB::beginTransaction();
        try {
            DB::table('rencana_keluar_deep')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->delete();
            $deleted = DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->delete();

            if ($deleted === 0) {
                throw new Exception('Data outbound gagal dihapus');
            }
            DB::commit();

            return $this->ok(['id_barang_keluar' => $idBarangKeluar], 'Outbound berhasil dihapus');
        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    // =========================================================================
    // 4. ADD NEW DRAFT/PENDING OUTBOUND (Ref: tambah_barang_keluar.php)
    // =========================================================================
public function store(Request $request)
    {
        try {
            $itemsOut = $this->simpanOutbound($request->all());
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage(), 500);
        }

        return $this->ok(['items' => $itemsOut], 'Submit outbound berhasil.');
    }

    // =========================================================================
    // 4b. UPLOAD EXCEL BATCH (Ref: tambah_barang_keluar_batch.php)
    //     Menerima gin_list, tiap GIN disimpan sebagai Draft via simpanOutbound.
    // =========================================================================
    public function uploadExcel(Request $request)
    {
        $in = $request->all();
        $ginList = $in['gin_list'] ?? null;
        if (! is_array($ginList)) {
            return $this->fail('gin_list wajib berupa array');
        }

        $inserted = 0;
        $updated = 0;
        $skipped = 0;
        $failed = 0;
        $details = [];

        foreach ($ginList as $payload) {
            if (! is_array($payload) || empty($payload['gin_no']) || empty($payload['items'])) {
                $failed++;
                $details[] = 'GIN kosong / tanpa item';
                continue;
            }

            $payload['id_pengguna_lokasi'] = trim($payload['id_pengguna_lokasi'] ?? ($in['id_pengguna_lokasi'] ?? ''));
            $payload['tipe_pengeluaran'] = trim($payload['tipe_pengeluaran'] ?? 'Secondary');
            $payload['status'] = 'Draft';
            $payload['catatan'] = trim($payload['catatan'] ?? 'Upload Excel');

            try {
                $this->simpanOutbound($payload);
                $inserted++;
            } catch (\Throwable $e) {
                $failed++;
                $details[] = trim($payload['gin_no'] ?? '') . ': ' . $e->getMessage();
            }
        }

        $msg = "Upload batch selesai! $inserted GIN berhasil ditambahkan.";
        if ($updated > 0) {
            $msg .= " $updated GIN diperbarui (SO Number).";
        }
        if ($skipped > 0) {
            $msg .= " $skipped GIN dilewati (sudah Selesai/Pending).";
        }
        if ($failed > 0) {
            $msg .= " $failed GIN gagal: " . implode('; ', $details);
        }

        return $this->ok(['inserted' => $inserted, 'updated' => $updated, 'skipped' => $skipped, 'failed' => $failed, 'details' => $details], $msg);
    }

    // =========================================================================
    // 4c. UPLOAD FILE EXCEL/CSV (Ref: Outbound::upload_excel)
    //     Parse file di server, grouping per GIN, simpan sebagai Draft.
    // =========================================================================
    public function uploadFile(Request $request)
    {
        set_time_limit(0);
        $idPenggunaLokasi = trim((string) $request->input('upload_lokasi', ''));
        $idPengguna = (int) $request->input('id_pengguna', 0);

        if ($idPenggunaLokasi === '') {
            return $this->fail('upload_lokasi wajib');
        }
        if ($idPengguna <= 0) {
            return $this->fail('id_pengguna wajib');
        }

        $file = $request->file('file_excel');
        if (! $file || ! $file->isValid()) {
            return $this->fail('Harap pilih file Excel atau CSV yang valid.');
        }

        $ext = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        try {
            $parsed = $this->bacaFileSpreadsheet($path, $ext);
            $headerRow = $parsed['header'];
            $rowsData = $parsed['rows'];
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage());
        }

        if (empty($rowsData)) {
            return $this->fail('File Excel kosong atau tidak memiliki data yang bisa dibaca.');
        }

        $colMap = [];
        foreach ($headerRow as $index => $colName) {
            $clean = trim((string) $colName);
            if ($clean !== '') {
                $colMap[$clean] = $index;
            }
        }

        $idxGin = $colMap['Picking_List_No'] ?? 0;
        $idxMobil = $colMap['No_Truck'] ?? 1;
        $idxDriver = $colMap['Driver'] ?? 2;
        $idxRitase = $colMap['Trip'] ?? 4;
        $idxDate = $colMap['Delivery_Date'] ?? 6;
        $idxSap = $colMap['OrderNo_SAP'] ?? 8;
        $idxDn = $colMap['DN_No'] ?? 10;
        $idxProduk = $colMap['Material_Desc'] ?? 13;
        $idxJumlah = $colMap['Quantity_Order_LoadedToTruck'] ?? 14;

        $produkList = DB::table('produk')->get(['id_produk', 'nama_produk', 'satuan']);
        $mapProduk = [];
        foreach ($produkList as $p) {
            $mapProduk[strtoupper(trim((string) $p->nama_produk))] = $p;
        }

        $grouped = [];
        $countUnmapped = 0;
        foreach ($rowsData as $data) {
            $ginNo = trim((string) ($data[$idxGin] ?? ''));
            if ($ginNo === '') {
                continue;
            }

            $noMobil = trim((string) ($data[$idxMobil] ?? ''));
            $namaDriverAsli = trim((string) ($data[$idxDriver] ?? ''));
            $namaDriver = $namaDriverAsli !== '' ? $namaDriverAsli.' - '.$ginNo : $ginNo;
            $ritase = trim((string) ($data[$idxRitase] ?? ''));

            $rawDate = trim((string) ($data[$idxDate] ?? ''));
            $tanggalKeluar = date('Y-m-d');
            if ($rawDate !== '') {
                $parsed = date('Y-m-d', strtotime(str_replace('/', '-', substr($rawDate, 0, 10))));
                if ($parsed !== '1970-01-01' && $parsed !== false) {
                    $tanggalKeluar = $parsed;
                }
            }

            $noDn = trim((string) ($data[$idxDn] ?? ''));
            $soNumber = trim((string) ($data[$idxSap] ?? ''));
            $namaProdukExcel = strtoupper(trim((string) ($data[$idxProduk] ?? '')));
            $jumlah = (int) ($data[$idxJumlah] ?? 0);

            if ($jumlah <= 0) {
                continue;
            }
            if (! isset($mapProduk[$namaProdukExcel])) {
                $countUnmapped++;
                continue;
            }
            $produk = $mapProduk[$namaProdukExcel];

            if (! isset($grouped[$ginNo])) {
                $grouped[$ginNo] = [
                    'gin_no' => $ginNo,
                    'id_pengguna' => $idPengguna,
                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                    'tipe_pengeluaran' => 'Secondary',
                    'tujuan' => '',
                    'no_mobil' => $noMobil,
                    'nama_driver' => $namaDriver,
                    'tanggal_keluar' => $tanggalKeluar,
                    'tanggal_pengiriman' => $tanggalKeluar,
                    'no_dn' => $noDn,
                    'ritase' => $ritase !== '' ? $ritase : 1,
                    'catatan' => 'Upload Excel FEFO',
                    'status' => 'Draft',
                    'items' => [],
                    '_seen' => [],
                ];
            }

            $dedupKey = (int) $produk->id_produk.'|'.$jumlah;
            if (isset($grouped[$ginNo]['_seen'][$dedupKey])) {
                $idxItem = $grouped[$ginNo]['_seen'][$dedupKey];
                $existingSo = trim((string) ($grouped[$ginNo]['items'][$idxItem]['so_number'] ?? ''));
                if ($soNumber !== '') {
                    $arrSo = array_map('trim', explode(',', $existingSo));
                    if (! in_array(trim($soNumber), $arrSo)) {
                        $grouped[$ginNo]['items'][$idxItem]['so_number'] = ($existingSo === '' ? '' : $existingSo.', ').trim($soNumber);
                    }
                }
                continue;
            }

            $grouped[$ginNo]['_seen'][$dedupKey] = count($grouped[$ginNo]['items']);
            $grouped[$ginNo]['items'][] = [
                'id_produk' => (int) $produk->id_produk,
                'jumlah' => $jumlah,
                'satuan' => trim((string) ($produk->satuan ?? 'PCS')) ?: 'PCS',
                'so_number' => $soNumber,
            ];
        }

        if (empty($grouped)) {
            $msg = 'Gagal memproses file. ';
            if ($countUnmapped > 0) {
                $msg .= "Ada $countUnmapped item produk yang namanya tidak sesuai dengan database (Master Data).";
            } else {
                $msg .= 'Pastikan file Excel tidak kosong, format sesuai, dan kuantitas barang wajib > 0.';
            }

            return $this->fail($msg);
        }

        $inserted = 0;
        $updated = 0;
        $skipped = 0;
        $failed = 0;
        $details = [];
        foreach ($grouped as $payload) {
            unset($payload['_seen']);
            try {
                $this->simpanOutbound($payload);
                $inserted++;
            } catch (\Throwable $e) {
                $failed++;
                $details[] = trim($payload['gin_no'] ?? '').': '.$e->getMessage();
            }
        }

        $msg = "Upload selesai! $inserted GIN ditambahkan.";
        if ($updated > 0) {
            $msg .= " $updated GIN diperbarui (SO Number).";
        }
        if ($skipped > 0) {
            $msg .= " $skipped GIN dilewati (sudah Selesai/Pending).";
        }
        if ($failed > 0) {
            $msg .= " $failed GIN gagal: ".implode('; ', $details);
        }
        if ($countUnmapped > 0) {
            $msg .= " Peringatan: $countUnmapped baris diabaikan (produk tak dikenal).";
        }

        return $this->ok(['inserted' => $inserted, 'updated' => $updated, 'skipped' => $skipped, 'failed' => $failed, 'details' => $details], $msg);
    }

    // =========================================================================
    // 4d. IMPORT HISTORICAL VIA FILE (Ref: Outbound::import_historical)
    //     Parse file (dengan kolom Batch_No), status Selesai, stok tidak dikurangi.
    // =========================================================================
    public function importFile(Request $request)
    {
        set_time_limit(0);
        $idPenggunaLokasi = trim((string) $request->input('upload_lokasi', ''));
        $idPengguna = (int) $request->input('id_pengguna', 0);

        if ($idPenggunaLokasi === '') {
            return $this->fail('upload_lokasi wajib');
        }
        if ($idPengguna <= 0) {
            return $this->fail('id_pengguna wajib');
        }

        $file = $request->file('file_excel');
        if (! $file || ! $file->isValid()) {
            return $this->fail('Harap pilih file Excel atau CSV yang valid.');
        }

        $ext = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        try {
            $parsed = $this->bacaFileSpreadsheet($path, $ext);
            $headerRow = $parsed['header'];
            $rowsData = $parsed['rows'];
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage());
        }

        if (empty($rowsData)) {
            return $this->fail('File Excel kosong atau tidak memiliki data yang bisa dibaca.');
        }

        $colMap = [];
        foreach ($headerRow as $index => $colName) {
            $clean = trim((string) $colName);
            if ($clean !== '') {
                $colMap[$clean] = $index;
            }
        }

        $idxGin = $colMap['Picking_List_No'] ?? 0;
        $idxMobil = $colMap['No_Truck'] ?? 1;
        $idxDriver = $colMap['Driver'] ?? 2;
        $idxRitase = $colMap['Trip'] ?? 4;
        $idxDate = $colMap['Delivery_Date'] ?? 6;
        $idxSap = $colMap['OrderNo_SAP'] ?? 8;
        $idxDn = $colMap['DN_No'] ?? 10;
        $idxBatch = $colMap['Batch_No'] ?? 12;
        $idxProduk = $colMap['Material_Desc'] ?? 13;
        $idxJumlah = $colMap['Quantity_Order_LoadedToTruck'] ?? 14;

        $produkList = DB::table('produk')->get(['id_produk', 'nama_produk', 'satuan']);
        $mapProduk = [];
        foreach ($produkList as $p) {
            $mapProduk[strtoupper(trim((string) $p->nama_produk))] = $p;
        }

        $grouped = [];
        $countUnmapped = 0;
        foreach ($rowsData as $data) {
            $ginNo = trim((string) ($data[$idxGin] ?? ''));
            if ($ginNo === '') {
                continue;
            }

            $noMobil = trim((string) ($data[$idxMobil] ?? ''));
            $namaDriverAsli = trim((string) ($data[$idxDriver] ?? ''));
            $namaDriver = $namaDriverAsli !== '' ? $namaDriverAsli.' - '.$ginNo : $ginNo;
            $ritase = trim((string) ($data[$idxRitase] ?? ''));

            $rawDate = trim((string) ($data[$idxDate] ?? ''));
            $tanggalKeluar = date('Y-m-d');
            if ($rawDate !== '') {
                $parsed = date('Y-m-d', strtotime(str_replace('/', '-', substr($rawDate, 0, 10))));
                if ($parsed !== '1970-01-01' && $parsed !== false) {
                    $tanggalKeluar = $parsed;
                }
            }

            $noDn = trim((string) ($data[$idxDn] ?? ''));
            $soNumber = trim((string) ($data[$idxSap] ?? ''));
            $batch = trim((string) ($data[$idxBatch] ?? ''));
            $namaProdukExcel = strtoupper(trim((string) ($data[$idxProduk] ?? '')));
            $jumlah = (int) ($data[$idxJumlah] ?? 0);

            if ($jumlah <= 0) {
                continue;
            }
            if (! isset($mapProduk[$namaProdukExcel])) {
                $countUnmapped++;
                continue;
            }
            $produk = $mapProduk[$namaProdukExcel];

            $bestBefore = null;
            if (strlen($batch) >= 6 && is_numeric(substr($batch, 0, 6))) {
                $yy = (int) substr($batch, 0, 2);
                $mm = (int) substr($batch, 2, 2);
                $dd = (int) substr($batch, 4, 2);
                $year = $yy > 50 ? 1900 + $yy : 2000 + $yy;
                if (checkdate($mm, $dd, $year)) {
                    $bestBefore = sprintf('%04d-%02d-%02d', $year, $mm, $dd);
                }
            }

            $grouped[$ginNo][] = [
                'gin_no' => $ginNo,
                'nama_driver' => $namaDriver,
                'no_mobil' => $noMobil,
                'tanggal_keluar' => $tanggalKeluar,
                'tipe_pengeluaran' => 'Secondary',
                'tujuan' => '',
                'so_number' => $soNumber,
                'no_dn' => $noDn,
                'id_produk' => (int) $produk->id_produk,
                'nama_produk' => trim((string) $produk->nama_produk),
                'jumlah' => $jumlah,
                'satuan' => trim((string) ($produk->satuan ?? 'PCS')) ?: 'PCS',
                'batch' => $batch,
                'best_before' => $bestBefore,
                'ritase' => $ritase !== '' ? $ritase : 1,
            ];
        }

        if (empty($grouped)) {
            $msg = 'Gagal memproses file import historical. ';
            if ($countUnmapped > 0) {
                $msg .= "Ada $countUnmapped item produk yang namanya tidak sesuai dengan database (Master Data).";
            } else {
                $msg .= 'Pastikan file Excel tidak kosong, format sesuai, dan kuantitas barang wajib > 0.';
            }

            return $this->fail($msg);
        }

        // Build items for importHistorical; meniru payload asli per-GIN
        $items = [];
        foreach ($grouped as $ginNo => $list) {
            foreach ($list as $row) {
                $items[] = $row;
            }
        }

        $request->merge([
            'id_pengguna_lokasi' => $idPenggunaLokasi,
            'id_pengguna' => $idPengguna,
            'items' => $items,
        ]);

        return $this->importHistorical($request);
    }

    private function simpanOutbound(array $in): array
    {
        $idPenggunaLokasi = trim($in['id_pengguna_lokasi'] ?? '');
        $idPengguna = (int) ($in['id_pengguna'] ?? 0);
        $tipePengeluaran = in_array(trim($in['tipe_pengeluaran'] ?? ''), ['Primary', 'Secondary', 'Pemusnahan']) ? trim($in['tipe_pengeluaran']) : 'Primary';
        $tujuan = trim($in['tujuan'] ?? '');
        $namaDriver = trim($in['nama_driver'] ?? '');
        $noMobil = trim($in['no_mobil'] ?? '');
        $catatan = trim($in['catatan'] ?? '');
        $tanggalKeluar = ! empty($in['tanggal_keluar']) ? trim($in['tanggal_keluar']) : date('Y-m-d');
        $tanggalPengiriman = ! empty($in['tanggal_pengiriman']) ? trim($in['tanggal_pengiriman']) : $tanggalKeluar;
        $ritase = ! empty($in['ritase']) ? trim($in['ritase']) : 1;
        $ginNo = trim($in['gin_no'] ?? '');
        $noDn = trim($in['no_dn'] ?? '');
        $statusInput = in_array(trim($in['status'] ?? ''), ['Draft', 'Pending']) ? trim($in['status']) : 'Pending';
        $waktuMulaiInput = ! empty($in['waktu_mulai_input']) ? trim($in['waktu_mulai_input']) : null;
        $durasiDetik = ! empty($in['durasi_detik']) ? (int) $in['durasi_detik'] : null;

        if ($idPenggunaLokasi === '') {
            throw new Exception('id_pengguna_lokasi wajib');
        }
        if ($idPengguna <= 0) {
            throw new Exception('id_pengguna wajib');
        }
        if ($namaDriver === '' || $noMobil === '') {
            throw new Exception('nama_driver dan no_mobil wajib');
        }
        if ($tipePengeluaran === 'Primary' && $tujuan === '') {
            throw new Exception('Tujuan wajib diisi untuk Primary');
        }
        if ($tipePengeluaran !== 'Primary') {
            $tujuan = null;
        }

        $items = $in['items'] ?? [];
        if (empty($items) && isset($in['id_produk'])) {
            $items = [[
                'id_produk' => (int) $in['id_produk'], 'jumlah' => (int) $in['jumlah'], 'satuan' => $in['satuan'] ?? '',
                'id_line' => (int) ($in['id_line'] ?? 0), 'batch' => $in['batch'] ?? '', 'best_before' => $in['best_before'] ?? '',
            ]];
        }
        if (empty($items)) {
            throw new Exception('items wajib diisi');
        }

        DB::beginTransaction();
        try {
            // Bersihkan data lama jika sama (Sesuai source 17)
            DB::table('rencana_keluar_deep as r')
                ->join('barang_keluar as bk', 'bk.id_barang_keluar', '=', 'r.id_barang_keluar')
                ->where('bk.id_pengguna_lokasi', $idPenggunaLokasi)->where('bk.tanggal_keluar', $tanggalKeluar)
                ->whereRaw('LOWER(TRIM(bk.nama_driver)) = LOWER(TRIM(?))', [$namaDriver])
                ->whereRaw('LOWER(TRIM(bk.no_mobil)) = LOWER(TRIM(?))', [$noMobil])
                ->whereIn('bk.status', ['Pending', 'Draft'])->delete();

            DB::table('barang_keluar')
                ->where('id_pengguna_lokasi', $idPenggunaLokasi)->where('tanggal_keluar', $tanggalKeluar)
                ->whereRaw('LOWER(TRIM(nama_driver)) = LOWER(TRIM(?))', [$namaDriver])
                ->whereRaw('LOWER(TRIM(no_mobil)) = LOWER(TRIM(?))', [$noMobil])
                ->whereIn('status', ['Pending', 'Draft'])->delete();

            $itemsOut = [];
            foreach ($items as $it) {
                $idProduk = (int) $it['id_produk'];
                $jumlah = (int) $it['jumlah'];
                $satuan = trim($it['satuan'] ?? 'PCS');
                if ($idProduk <= 0 || $jumlah <= 0) {
                    continue;
                }

                $namaProduk = DB::table('produk')->where('id_produk', $idProduk)->value('nama_produk');
                if (! $namaProduk) {
                    throw new Exception("Produk ID {$idProduk} tidak ditemukan");
                }

                $idLineManual = (int) ($it['id_line'] ?? 0);
                $batchManual = trim($it['batch'] ?? '');
                $bestBeforeManual = trim($it['best_before'] ?? '');
                $pakaiManual = ($idLineManual > 0 && $batchManual !== '');

                $rencana = [];
                if ($pakaiManual) {
                    $rencana = $this->buatRencanaManualBatchPerProduk($idPenggunaLokasi, $idProduk, $jumlah, $idLineManual, $batchManual, $bestBeforeManual, $tipePengeluaran);
                } elseif ($statusInput !== 'Draft') {
                    $rencana = $this->buatRencanaFefoPerProduk($idPenggunaLokasi, $idProduk, $jumlah, $tipePengeluaran);
                }

                if (empty($rencana) && $statusInput !== 'Draft') {
                    throw new Exception("Rencana lokasi tidak ditemukan untuk produk ID {$idProduk}");
                }

                $bestBeforeItem = $rencana[0]['best_before'] ?? null;
                $batchItem = $rencana[0]['batch'] ?? null;
                $blockAwal = trim($rencana[0]['block'] ?? '');
                $lineAwal = trim($rencana[0]['line'] ?? '');
                $lokasiBlockItem = ($blockAwal !== '' && $lineAwal !== '') ? "{$blockAwal}-{$lineAwal}" : ($blockAwal ?: null);

                $idBarangKeluar = DB::table('barang_keluar')->insertGetId([
                    'gin_no' => $ginNo, 'id_pengguna_lokasi' => $idPenggunaLokasi, 'id_pengguna' => $idPengguna,
                    'id_produk' => $idProduk, 'nama_produk' => $namaProduk, 'tipe_pengeluaran' => $tipePengeluaran,
                    'tujuan' => $tujuan, 'nama_driver' => $namaDriver, 'no_mobil' => $noMobil, 'jumlah' => $jumlah,
                    'best_before' => $bestBeforeItem, 'batch' => $batchItem, 'satuan' => $satuan, 'lokasi_block' => $lokasiBlockItem,
                    'catatan' => $catatan, 'tanggal_keluar' => $tanggalKeluar, 'tanggal_pengiriman' => $tanggalPengiriman,
                    'no_dn' => $noDn, 'so_number' => $it['so_number'] ?? null, 'ritase' => $ritase, 'status' => $statusInput,
                    'waktu_mulai_input' => $waktuMulaiInput, 'durasi_detik' => $durasiDetik,
                ]);

                if (! empty($rencana)) {
                    $this->simpanRencanaPerBarangKeluar($idPenggunaLokasi, $idBarangKeluar, $rencana);
                }

                $itemsOut[] = [
                    'id_barang_keluar' => $idBarangKeluar, 'id_produk' => $idProduk, 'jumlah' => $jumlah,
                    'rencana_deep' => $this->formatRencanaUntukResponse($rencana),
                ];
            }

            DB::commit();

            return $itemsOut;
        } catch (Exception $e) {
            DB::rollBack();

            throw $e;
        }
    }

    // =========================================================================
    // 5. IMPORT HISTORICAL (Ref: import_outbound.php)
    // =========================================================================
    public function importHistorical(Request $request)
    {
        $in = $request->all();
        $idPenggunaLokasi = trim($in['id_pengguna_lokasi'] ?? '');
        $idPengguna = (int) ($in['id_pengguna'] ?? 0);
        $items = $in['items'] ?? [];

        if ($idPenggunaLokasi === '' || $idPengguna <= 0 || empty($items)) {
            return $this->fail('Data mandatory tidak lengkap');
        }

        DB::beginTransaction();
        try {
            $headers = [];
            foreach ($items as $it) {
                $ginNo = trim(preg_replace('/[^a-zA-Z0-9_-]/', '', $it['gin_no'] ?? ''));
                if (strlen($ginNo) < 3 || in_array(strtolower($ginNo), ['null', 'undefined', 'nan'])) {
                    continue;
                }

                if (! isset($headers[$ginNo])) {
                    $headers[$ginNo] = ['nama_driver' => '', 'no_mobil' => '', 'tanggal_keluar' => '', 'tipe_pengeluaran' => '', 'tujuan' => '', 'so_list' => [], 'dn_list' => [], 'items' => []];
                }

                if (empty($headers[$ginNo]['nama_driver']) && ! empty(trim($it['nama_driver'] ?? ''))) {
                    $headers[$ginNo]['nama_driver'] = trim($it['nama_driver']);
                }
                if (empty($headers[$ginNo]['no_mobil']) && ! empty(trim($it['no_mobil'] ?? ''))) {
                    $headers[$ginNo]['no_mobil'] = trim($it['no_mobil']);
                }
                if (empty($headers[$ginNo]['tanggal_keluar']) && ! empty(trim($it['tanggal_keluar'] ?? ''))) {
                    $headers[$ginNo]['tanggal_keluar'] = trim($it['tanggal_keluar']);
                }
                if (empty($headers[$ginNo]['tipe_pengeluaran']) && ! empty(trim($it['tipe_pengeluaran'] ?? ''))) {
                    $headers[$ginNo]['tipe_pengeluaran'] = trim($it['tipe_pengeluaran']);
                }
                if (empty($headers[$ginNo]['tujuan']) && ! empty(trim($it['tujuan'] ?? ''))) {
                    $headers[$ginNo]['tujuan'] = trim($it['tujuan']);
                }

                $so = trim($it['so_number'] ?? '');
                if ($so !== '' && strtolower($so) !== 'nan') {
                    foreach (explode(',', $so) as $s) {
                        $s = trim($s);
                        if ($s !== '') {
                            if (strlen($s) < 10 && is_numeric($s)) {
                                $s = str_pad($s, 10, '0', STR_PAD_LEFT);
                            }
                            if (! in_array($s, $headers[$ginNo]['so_list'])) {
                                $headers[$ginNo]['so_list'][] = $s;
                            }
                        }
                    }
                }

                $dn = trim($it['no_dn'] ?? '');
                if ($dn !== '' && strtolower($dn) !== 'nan') {
                    foreach (explode(',', $dn) as $d) {
                        $d = trim($d);
                        if ($d !== '' && ! in_array($d, $headers[$ginNo]['dn_list'])) {
                            $headers[$ginNo]['dn_list'][] = $d;
                        }
                    }
                }

                $headers[$ginNo]['items'][] = $it;
            }

            if (empty($headers)) {
                throw new Exception('Tidak ada data valid untuk diproses.');
            }

            $inserted = 0;
            $skipped = 0;
            foreach ($headers as $ginNo => $head) {
                $existing = DB::table('barang_keluar')->where('gin_no', $ginNo)->where('id_pengguna_lokasi', $idPenggunaLokasi)->first(['status']);
                if ($existing) {
                    if (strtolower($existing->status) === 'selesai') {
                        $skipped += count($head['items']);

                        continue;
                    } else {
                        DB::table('barang_keluar')->where('gin_no', $ginNo)->where('id_pengguna_lokasi', $idPenggunaLokasi)->whereIn('status', ['Draft', 'Pending'])->delete();
                    }
                }

                foreach ($head['items'] as $it) {
                    if (empty($it['id_produk']) || empty($it['jumlah'])) {
                        continue;
                    }
                    $batch = trim($it['batch'] ?? '');
                    $bestBefore = ! empty($it['best_before']) ? trim($it['best_before']) : null;

                    if ($bestBefore === null && strlen($batch) >= 6 && is_numeric(substr($batch, 0, 6))) {
                        $yy = substr($batch, 0, 2);
                        $mm = substr($batch, 2, 2);
                        $dd = substr($batch, 4, 2);
                        $year = ((int) $yy > 50) ? 1900 + (int) $yy : 2000 + (int) $yy;
                        if (checkdate((int) $mm, (int) $dd, $year)) {
                            $bestBefore = sprintf('%04d-%02d-%02d', $year, (int) $mm, (int) $dd);
                        }
                    }

                    DB::table('barang_keluar')->insert([
                        'gin_no' => $ginNo, 'id_pengguna_lokasi' => $idPenggunaLokasi, 'id_pengguna' => $idPengguna,
                        'id_produk' => (int) $it['id_produk'], 'nama_produk' => trim($it['nama_produk'] ?? ''),
                        'tipe_pengeluaran' => $head['tipe_pengeluaran'] ?: 'Secondary', 'tujuan' => $head['tujuan'],
                        'nama_driver' => $head['nama_driver'] ?: '-', 'no_mobil' => $head['no_mobil'] ?: '-',
                        'jumlah' => (int) $it['jumlah'], 'best_before' => $bestBefore, 'batch' => $batch,
                        'satuan' => trim($it['satuan'] ?? 'PCS') ?: 'PCS', 'lokasi_block' => trim($it['lokasi_block'] ?? '') ?: null,
                        'catatan' => 'Upload Historical Outbound', 'tanggal_keluar' => $head['tanggal_keluar'],
                        'tanggal_pengiriman' => $head['tanggal_keluar'], 'no_dn' => trim($it['no_dn'] ?? '') ?: null,
                        'so_number' => trim($it['so_number'] ?? '') ?: null, 'ritase' => trim($it['ritase'] ?? 1), 'status' => 'Selesai',
                    ]);
                    $inserted++;
                }
            }
            DB::commit();

            return $this->ok(['inserted' => $inserted, 'skipped' => $skipped], "Berhasil! {$inserted} baris masuk.");
        } catch (Throwable $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    // =========================================================================
    // 6. MULTI-PURPOSE UPDATE (Ref: ubah_barang_keluar.php)
    // =========================================================================
    public function update(Request $request)
    {
$in = $request->all();
        $idBarangKeluar = (int) ($in['id_barang_keluar'] ?? 0);
        $idPenggunaLokasi = trim($in['id_pengguna_lokasi'] ?? '');
        $aksi = strtolower(trim($in['aksi'] ?? ''));
        $modeTambahItemSelesai = ($aksi === 'tambah_item_selesai');

        if (! $modeTambahItemSelesai && $idBarangKeluar <= 0) {
            return $this->fail('id_barang_keluar wajib');
        }
        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        $status = strtolower(trim($in['status'] ?? ''));

        // 6a. REVERT TO DRAFT
        if ($aksi === 'revert_to_draft' || ($aksi === 'revert' && $status === 'draft')) {
            DB::beginTransaction();
            try {
                $ref = DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->first();
                if (! $ref) {
                    throw new Exception('Data tidak ditemukan');
                }

                $affected = DB::table('barang_keluar')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)->where('tanggal_keluar', $ref->tanggal_keluar)
                    ->whereRaw('LOWER(TRIM(nama_driver)) = ?', [strtolower(trim($ref->nama_driver))])
                    ->whereRaw('LOWER(TRIM(no_mobil)) = ?', [strtolower(trim($ref->no_mobil))])
                    ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                    ->update(['status' => 'Draft', 'best_before' => null, 'batch' => null, 'lokasi_block' => null]);

                DB::table('rencana_keluar_deep as r')
                    ->join('barang_keluar as bk', 'bk.id_barang_keluar', '=', 'r.id_barang_keluar')
                    ->where('bk.id_pengguna_lokasi', $idPenggunaLokasi)->where('bk.tanggal_keluar', $ref->tanggal_keluar)
                    ->whereRaw('LOWER(TRIM(bk.nama_driver)) = ?', [strtolower(trim($ref->nama_driver))])
                    ->whereRaw('LOWER(TRIM(bk.no_mobil)) = ?', [strtolower(trim($ref->no_mobil))])
                    ->where('bk.status', 'Draft')->delete();

                DB::commit();

                return $this->ok(['affected' => $affected], 'Status dikembalikan ke Draft.');
            } catch (Exception $e) {
                DB::rollBack();

                return $this->fail($e->getMessage());
            }
        }

        // 6b. SUBMIT TO PENDING (RE-GENERATE FEFO)
        if ($aksi === 'submit_draft' || $status === 'pending') {
            DB::beginTransaction();
            try {
                $ref = DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->first();
                if (! $ref) {
                    throw new Exception('Data tidak ditemukan');
                }

                $waktuMulai = ! empty($in['waktu_mulai_input']) ? $in['waktu_mulai_input'] : DB::raw('waktu_mulai_input');

                $affected = DB::table('barang_keluar')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)->where('tanggal_keluar', $ref->tanggal_keluar)
                    ->whereRaw('LOWER(TRIM(nama_driver)) = ?', [strtolower(trim($ref->nama_driver))])
                    ->whereRaw('LOWER(TRIM(no_mobil)) = ?', [strtolower(trim($ref->no_mobil))])
                    ->where('status', 'Draft')
                    ->update(['status' => 'Pending', 'waktu_mulai_input' => $waktuMulai]);

                $items = DB::table('barang_keluar')->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('tanggal_keluar', $ref->tanggal_keluar)
                    ->whereRaw('LOWER(TRIM(nama_driver)) = ?', [strtolower(trim($ref->nama_driver))])
                    ->whereRaw('LOWER(TRIM(no_mobil)) = ?', [strtolower(trim($ref->no_mobil))])
                    ->where('status', 'Pending')->orderBy('id_barang_keluar', 'ASC')->get();

                $stokBookingSementara = [];
                foreach ($items as $item) {
                    DB::table('rencana_keluar_deep')->where('id_barang_keluar', $item->id_barang_keluar)->delete();
                    $rencana = $this->buatRencanaFefoEditSelesai($idPenggunaLokasi, $item->id_produk, $item->jumlah, $stokBookingSementara, $item->tipe_pengeluaran ?? 'Primary');
                    $this->simpanRencanaPerBarangKeluar($idPenggunaLokasi, $item->id_barang_keluar, $rencana);

                    foreach ($rencana as $r) {
                        $idDetail = (int) $r['id_detail_stok'];
                        $stokBookingSementara[$idDetail] = ($stokBookingSementara[$idDetail] ?? 0) + $r['jumlah_rencana'];
                    }

                    $block = trim($rencana[0]['block'] ?? '');
                    $line = trim($rencana[0]['line'] ?? '');
                    DB::table('barang_keluar')->where('id_barang_keluar', $item->id_barang_keluar)->update([
                        'best_before' => $rencana[0]['best_before'] ?? null, 'batch' => $rencana[0]['batch'] ?? null,
                        'lokasi_block' => ($block !== '' && $line !== '') ? "{$block}-{$line}" : ($block ?: null),
                    ]);
                    $this->syncTraceFromBarangKeluar($item->id_barang_keluar);
                }

                DB::commit();

                return $this->ok(['affected' => $affected], 'Status diubah ke Pending.');
            } catch (Exception $e) {
                DB::rollBack();

                return $this->fail($e->getMessage());
            }
        }

// 6c. KONFIRMASI (POTONG STOK BENERAN)
        if ($aksi === 'konfirmasi' || in_array($status, ['confirmed', 'confirm', 'selesai'])) {
            return $this->konfirmasiOutbound($idBarangKeluar, $idPenggunaLokasi, $in['waktu_mulai_input'] ?? null, $in['durasi_detik'] ?? null);
        }

        // 6c1. TAMBAH ITEM PRODUK BARU (STATUS DRAFT)
        if ($aksi === 'tambah_item_draft') {
            return $this->tambahItemBaruDraft($idBarangKeluar, $idPenggunaLokasi, (int) ($in['id_pengguna'] ?? 0), (int) ($in['id_produk'] ?? 0), (int) ($in['jumlah'] ?? 0), trim($in['satuan'] ?? ''), trim($in['so_number'] ?? ''));
        }

        // 6c1. TAMBAH ITEM PRODUK BARU (STATUS SELESAI)
        if ($modeTambahItemSelesai) {
            $idRef = (int) ($in['id_barang_keluar_ref'] ?? 0);
            $idPenggunaAksi = (int) ($in['id_pengguna'] ?? 0);
            $namaPenggunaAksi = trim($in['diperbarui_oleh'] ?? '');
            $idProdukBaru = (int) ($in['id_produk'] ?? 0);
            $jumlahBaru = (int) ($in['jumlah'] ?? 0);
            $satuanBaru = trim($in['satuan'] ?? '');
            $soNumberBaru = trim($in['so_number'] ?? '');
            $catatanPerubahan = trim($in['catatan_perubahan'] ?? '');

            if ($idRef <= 0 || $idProdukBaru <= 0 || $jumlahBaru <= 0) {
                return $this->fail('Data penambahan produk baru tidak lengkap.');
            }

            return $this->tambahItemBaruSelesai($idRef, $idPenggunaLokasi, $idPenggunaAksi, $namaPenggunaAksi, $idProdukBaru, $jumlahBaru, $satuanBaru, $soNumberBaru, $catatanPerubahan);
        }

        // 6c2. UBAH JUMLAH ITEM (STATUS SELESAI, AUDIT TRAIL)
        if ($aksi === 'ubah_item_selesai' || $aksi === 'edit_item_selesai' || $aksi === 'ubah_outbound_selesai') {
            $jumlahBaru = (int) ($in['jumlah_item'] ?? $in['jumlah'] ?? 0);
            $catatan = trim($in['catatan_perubahan'] ?? '');
            $namaPenggunaAksi = trim($in['diperbarui_oleh'] ?? '');

            return $this->ubahItemOutboundSelesai($idBarangKeluar, $idPenggunaLokasi, $jumlahBaru, $catatan, $namaPenggunaAksi);
        }

        // 6d. UBAH JUMLAH (Hanya untuk Draft/Pending)
        if ($aksi === 'ubah_item_jumlah' || $aksi === 'edit_item_jumlah' || ($aksi === '' && array_key_exists('jumlah_item', $in))) {
            return $this->ubahJumlahItemOutbound($idBarangKeluar, $idPenggunaLokasi, (int) ($in['jumlah_item'] ?? $in['jumlah'] ?? 0), trim($in['mode_lokasi'] ?? 'fefo'), (int) ($in['id_line'] ?? 0), trim($in['batch'] ?? ''), trim($in['best_before'] ?? ''), (int) ($in['id_produk_baru'] ?? 0));
        }

        // 6e. UBAH HEADER STANDARD
        $updateData = [];
        if (array_key_exists('tipe_pengeluaran', $in)) {
            $updateData['tipe_pengeluaran'] = trim($in['tipe_pengeluaran']);
        }
        if (array_key_exists('tujuan', $in)) {
            $updateData['tujuan'] = trim($in['tujuan']) ?: null;
        }
        if (array_key_exists('nama_driver', $in)) {
            $updateData['nama_driver'] = trim($in['nama_driver']);
        }
        if (array_key_exists('no_mobil', $in)) {
            $updateData['no_mobil'] = trim($in['no_mobil']);
        }
        if (array_key_exists('catatan', $in)) {
            $updateData['catatan'] = trim($in['catatan']) ?: null;
        }
        if (array_key_exists('tanggal_keluar', $in)) {
            $updateData['tanggal_keluar'] = trim($in['tanggal_keluar']);
        }
        if (array_key_exists('so_number', $in)) {
            $updateData['so_number'] = trim($in['so_number']);
        }
        if (array_key_exists('no_dn', $in)) {
            $updateData['no_dn'] = trim($in['no_dn']);
        }

        if (empty($updateData)) {
            return $this->fail('Tidak ada field yang diubah');
        }

        DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->update($updateData);

        return $this->ok(['id_barang_keluar' => $idBarangKeluar], 'Outbound berhasil diperbarui');
    }

    // =========================================================================
    // PRIVATE METHODS & CORE LOGICS
    // =========================================================================

    private function konfirmasiOutbound($idBarangKeluar, $idPenggunaLokasi, $waktuMulai = null, $durasi = null)
    {
        $header = DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->first();
        if (! $header) {
            return $this->fail('Data outbound tidak ditemukan', 404);
        }

        $idsProses = DB::table('barang_keluar')
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)->where('tanggal_keluar', $header->tanggal_keluar)
            ->whereRaw("LOWER(TRIM(COALESCE(nama_driver, ''))) = ?", [strtolower(trim($header->nama_driver))])
            ->whereRaw("LOWER(TRIM(COALESCE(no_mobil, ''))) = ?", [strtolower(trim($header->no_mobil))])
            ->whereRaw("LOWER(TRIM(COALESCE(tipe_pengeluaran, ''))) = ?", [strtolower(trim($header->tipe_pengeluaran))])
            ->whereRaw("COALESCE(tujuan, '') = ?", [trim($header->tujuan ?? '')])
            ->where('id_pengguna', $header->id_pengguna)
            ->whereNotIn(DB::raw('LOWER(TRIM(status))'), ['confirmed', 'selesai'])
            ->pluck('id_barang_keluar')->toArray();

        if (empty($idsProses)) {
            return $this->ok(['id_barang_keluar' => $idBarangKeluar], 'Outbound sudah pernah dikonfirmasi');
        }

        $rows = DB::table('rencana_keluar_deep as r')
            ->join('stok_gudang_deep as sgd', 'sgd.id_detail_stok', '=', 'r.id_detail_stok')
            ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sgd.id_stok_header')
            ->where('r.id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereIn('r.id_barang_keluar', $idsProses)
            ->where('sgd.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('sg.id_pengguna_lokasi', $idPenggunaLokasi)
            ->select('r.id_rencana', 'r.id_detail_stok', 'r.jumlah_rencana', 'sgd.jumlah AS stok_deep', 'sgd.id_stok_header', 'sg.jumlah_sisa AS stok_header')
            ->get();

        if ($rows->isEmpty()) {
            return $this->fail('Rencana pengambilan tidak ditemukan.', 400);
        }

        DB::beginTransaction();
        try {
            foreach ($rows as $row) {
                if ($row->stok_deep < $row->jumlah_rencana || $row->stok_header < $row->jumlah_rencana) {
                    throw new Exception('Stok tidak cukup');
                }
                DB::table('stok_gudang_deep')->where('id_detail_stok', $row->id_detail_stok)->decrement('jumlah', $row->jumlah_rencana);
                DB::table('stok_gudang')->where('id_stok', $row->id_stok_header)->decrement('jumlah_sisa', $row->jumlah_rencana);
            }

            $updateData = ['status' => 'Selesai'];
            if ($waktuMulai !== null) {
                $updateData['waktu_mulai_input'] = DB::raw("COALESCE(waktu_mulai_input, '{$waktuMulai}')");
            }
            if ($durasi !== null) {
                $updateData['durasi_detik'] = $durasi;
            }

            DB::table('barang_keluar')->where('id_pengguna_lokasi', $idPenggunaLokasi)->whereIn('id_barang_keluar', $idsProses)->update($updateData);

            // Sync Traceability via Query Raw to allow complex JOIN UPDATE
            $placeholders = implode(',', array_fill(0, count($idsProses), '?'));
            $paramsSync = array_merge([$idPenggunaLokasi], $idsProses);
            DB::statement("
                UPDATE traceability t
                INNER JOIN barang_keluar bk ON bk.so_number LIKE CONCAT('%', t.so_number, '%') AND bk.id_produk = t.id_produk AND bk.id_pengguna_lokasi = t.id_pengguna_lokasi
                SET t.id_barang_keluar = bk.id_barang_keluar, t.best_before = bk.best_before, t.batch_number = bk.batch
                WHERE bk.id_pengguna_lokasi = ? AND bk.id_barang_keluar IN ($placeholders)
            ", $paramsSync);

            DB::commit();

            return $this->ok(['ids_dikonfirmasi' => $idsProses], 'Konfirmasi outbound berhasil.');
        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    private function ubahJumlahItemOutbound($idBarangKeluar, $idPenggunaLokasi, $jumlahBaru, $modeLokasi, $idLineManual, $batchManual, $bestBeforeManual, $idProdukBaru)
    {
        if ($jumlahBaru <= 0) {
            return $this->fail('Jumlah tidak valid');
        }
        $row = DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->first();
        if (! $row) {
            return $this->fail('Data tidak ditemukan', 404);
        }
        if (in_array(strtolower($row->status), ['selesai', 'confirmed'])) {
            return $this->fail('Outbound sudah selesai');
        }

        $idProdukFinal = ($idProdukBaru > 0 && $idProdukBaru !== $row->id_produk) ? $idProdukBaru : $row->id_produk;
        $pakaiManual = ($modeLokasi === 'manual' && $idLineManual > 0 && $batchManual !== '');

        DB::beginTransaction();
        try {
            $rencanaBaru = [];
            if ($pakaiManual) {
                $rencanaBaru = $this->buatRencanaManualBatchPerProduk($idPenggunaLokasi, $idProdukFinal, $jumlahBaru, $idLineManual, $batchManual, $bestBeforeManual, $row->tipe_pengeluaran ?? 'Primary');
            } elseif (strtolower($row->status) !== 'draft') {
                $b = ($idProdukBaru > 0) ? '' : ($row->batch ?? '');
                $bb = ($idProdukBaru > 0) ? '' : ($row->best_before ?? '');
                $rencanaBaru = $this->buatRencanaEditJumlahOutbound($idPenggunaLokasi, $idProdukFinal, $jumlahBaru, $b, $bb, $row->lokasi_block ?? '', $row->tipe_pengeluaran ?? 'Primary');
            }

            DB::table('rencana_keluar_deep')->where('id_barang_keluar', $idBarangKeluar)->where('id_pengguna_lokasi', $idPenggunaLokasi)->delete();

            $updateData = ['jumlah' => $jumlahBaru, 'best_before' => $rencanaBaru[0]['best_before'] ?? null, 'batch' => $rencanaBaru[0]['batch'] ?? null];
            $bl = trim($rencanaBaru[0]['block'] ?? '');
            $ln = trim($rencanaBaru[0]['line'] ?? '');
            $updateData['lokasi_block'] = ($bl !== '' && $ln !== '') ? "{$bl}-{$ln}" : ($bl ?: null);

            if ($idProdukBaru > 0 && $idProdukBaru !== $row->id_produk) {
                $updateData['id_produk'] = $idProdukFinal;
                $updateData['nama_produk'] = DB::table('produk')->where('id_produk', $idProdukFinal)->value('nama_produk');
            }
            DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluar)->update($updateData);

            if (! empty($rencanaBaru)) {
                $this->simpanRencanaPerBarangKeluar($idPenggunaLokasi, $idBarangKeluar, $rencanaBaru);
            }

            DB::commit();

            return $this->ok(['id_barang_keluar' => $idBarangKeluar], 'Jumlah item berhasil diperbarui');
        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    private function buatRencanaFefoPerProduk($idPenggunaLokasi, $idProduk, $jumlahButuh, $tipePengeluaran = 'Primary')
    {
        return $this->eksekusiRencanaFefoQuery($idPenggunaLokasi, $idProduk, $jumlahButuh, [], $tipePengeluaran);
    }

    private function buatRencanaFefoEditSelesai($idPenggunaLokasi, $idProduk, $jumlahButuh, $stokBookingSementara = [], $tipePengeluaran = 'Primary')
    {
        return $this->eksekusiRencanaFefoQuery($idPenggunaLokasi, $idProduk, $jumlahButuh, $stokBookingSementara, $tipePengeluaran);
    }

    private function buatRencanaEditJumlahOutbound($idPenggunaLokasi, $idProduk, $jumlahButuh, $batch = '', $bestBefore = '', $lokasiBlock = '', $tipePengeluaran = 'Primary')
    {
        $filterKhusus = ($tipePengeluaran === 'Pemusnahan') ? $this->filterLokasiOutboundPemusnahan('bl', 'lk') : $this->filterLokasiOutboundNormal('bl', 'lk');
        $whereExtra = '';
        $params = [$idPenggunaLokasi, $idPenggunaLokasi, $idProduk];
        if ($batch !== '') {
            $whereExtra .= ' AND (sg.batch = ? OR COALESCE(sgd.batch, sg.batch) = ?) ';
            $params[] = $batch;
            $params[] = $batch;
        }
        if ($bestBefore !== '' && $bestBefore !== '0000-00-00') {
            $whereExtra .= ' AND sgd.best_before = ? ';
            $params[] = $bestBefore;
        }

        $sql = "
            SELECT sgd.id_detail_stok, sgd.id_stok_header, sgd.id_deep, sgd.jumlah, sgd.best_before, COALESCE(sgd.batch, sg.batch) AS batch, dp.deep, 
            (SELECT MAX(CAST(d2.deep AS UNSIGNED)) FROM deep d2 INNER JOIN level lv2 ON lv2.id_level = d2.id_level WHERE lv2.id_line = ln.id_line AND d2.id_pengguna_lokasi = sgd.id_pengguna_lokasi) AS max_deep_line, 
            lv.level, ln.nomor_line, bl.kode_block, lk.nama_lokasi,
            COALESCE((SELECT SUM(rkd.jumlah_rencana) FROM rencana_keluar_deep rkd INNER JOIN barang_keluar bk ON bk.id_barang_keluar = rkd.id_barang_keluar WHERE rkd.id_detail_stok = sgd.id_detail_stok AND rkd.id_pengguna_lokasi = sgd.id_pengguna_lokasi AND bk.id_pengguna_lokasi = sgd.id_pengguna_lokasi AND LOWER(TRIM(bk.status)) NOT IN ('selesai', 'confirmed')), 0) AS jumlah_booking
            FROM stok_gudang_deep sgd INNER JOIN stok_gudang sg ON sg.id_stok = sgd.id_stok_header INNER JOIN deep dp ON dp.id_deep = sgd.id_deep INNER JOIN level lv ON lv.id_level = dp.id_level INNER JOIN line ln ON ln.id_line = lv.id_line INNER JOIN block bl ON bl.id_block = ln.id_block INNER JOIN lokasi lk ON lk.id_lokasi = bl.id_lokasi
WHERE sg.id_pengguna_lokasi = ? AND sgd.id_pengguna_lokasi = ? AND sg.id_produk = ? AND sgd.jumlah > 0 $filterKhusus AND NOT (UPPER(bl.kode_block) LIKE '%HOLD%' OR UPPER(lk.nama_lokasi) LIKE '%HOLD%' OR UPPER(COALESCE(lk.kategori, '')) = 'HOLD') $whereExtra
            ORDER BY {$this->prioritasBlokFefoSql('bl', 'lk')}, sgd.best_before IS NULL, sgd.best_before ASC, lk.nama_lokasi ASC, bl.kode_block ASC, CAST(ln.nomor_line AS UNSIGNED) ASC, CAST(dp.deep AS UNSIGNED) DESC, CAST(REPLACE(UPPER(lv.level), 'L', '') AS UNSIGNED) DESC, sgd.id_detail_stok ASC
        ";

        return $this->prosesRencanaDariQuery($sql, $params, $jumlahButuh, []);
    }

    private function buatRencanaManualBatchPerProduk($idPenggunaLokasi, $idProduk, $jumlahButuh, $idLine, $batch, $bestBeforeManual = '', $tipePengeluaran = 'Primary')
    {
        $filterKhusus = ($tipePengeluaran === 'Pemusnahan') ? $this->filterLokasiOutboundPemusnahan('bl', 'lk') : $this->filterLokasiOutboundNormal('bl', 'lk');
        $sql = "
            SELECT sgd.id_detail_stok, sgd.id_stok_header, sgd.id_deep, sgd.jumlah, sgd.best_before, COALESCE(sgd.batch, sg.batch) AS batch, dp.deep, 
            (SELECT MAX(CAST(d2.deep AS UNSIGNED)) FROM deep d2 INNER JOIN level lv2 ON lv2.id_level = d2.id_level WHERE lv2.id_line = ln.id_line AND d2.id_pengguna_lokasi = sgd.id_pengguna_lokasi) AS max_deep_line, lv.level, ln.nomor_line, bl.kode_block, lk.nama_lokasi
            FROM stok_gudang_deep sgd INNER JOIN stok_gudang sg ON sg.id_stok = sgd.id_stok_header INNER JOIN deep dp ON dp.id_deep = sgd.id_deep INNER JOIN level lv ON lv.id_level = dp.id_level INNER JOIN line ln ON ln.id_line = lv.id_line INNER JOIN block bl ON bl.id_block = ln.id_block INNER JOIN lokasi lk ON lk.id_lokasi = bl.id_lokasi
            WHERE sg.id_pengguna_lokasi = ? AND sgd.id_pengguna_lokasi = ? AND sg.id_produk = ? AND ln.id_line = ? AND (sg.batch = ? OR COALESCE(sgd.batch, sg.batch) = ?) AND (? = '' OR sgd.best_before = ?) AND sgd.jumlah > 0 $filterKhusus AND NOT (UPPER(bl.kode_block) LIKE '%HOLD%' OR UPPER(lk.nama_lokasi) LIKE '%HOLD%' OR UPPER(COALESCE(lk.kategori, '')) = 'HOLD')
            ORDER BY {$this->prioritasBlokFefoSql('bl', 'lk')}, sgd.best_before IS NULL, sgd.best_before ASC, lk.nama_lokasi ASC, bl.kode_block ASC, CAST(ln.nomor_line AS UNSIGNED) ASC, CAST(dp.deep AS UNSIGNED) DESC, CAST(REPLACE(UPPER(lv.level), 'L', '') AS UNSIGNED) DESC, sgd.id_detail_stok ASC
        ";

        return $this->prosesRencanaDariQuery($sql, [$idPenggunaLokasi, $idPenggunaLokasi, $idProduk, $idLine, $batch, $batch, $bestBeforeManual, $bestBeforeManual], $jumlahButuh, []);
    }

    private function eksekusiRencanaFefoQuery($idPenggunaLokasi, $idProduk, $jumlahButuh, $stokBookingSementara, $tipePengeluaran)
    {
        $filterKhusus = ($tipePengeluaran === 'Pemusnahan') ? $this->filterLokasiOutboundPemusnahan('bl', 'lk') : $this->filterLokasiOutboundNormal('bl', 'lk');
        $sql = "
            SELECT sgd.id_detail_stok, sgd.id_stok_header, sgd.id_deep, sgd.jumlah, sgd.best_before, COALESCE(sgd.batch, sg.batch) AS batch, dp.deep, 
            (SELECT MAX(CAST(d2.deep AS UNSIGNED)) FROM deep d2 INNER JOIN level lv2 ON lv2.id_level = d2.id_level WHERE lv2.id_line = ln.id_line AND d2.id_pengguna_lokasi = sgd.id_pengguna_lokasi) AS max_deep_line, lv.level, ln.nomor_line, bl.kode_block, lk.nama_lokasi,
            COALESCE((SELECT SUM(rkd.jumlah_rencana) FROM rencana_keluar_deep rkd INNER JOIN barang_keluar bk ON bk.id_barang_keluar = rkd.id_barang_keluar WHERE rkd.id_detail_stok = sgd.id_detail_stok AND rkd.id_pengguna_lokasi = sgd.id_pengguna_lokasi AND bk.id_pengguna_lokasi = sgd.id_pengguna_lokasi AND LOWER(TRIM(bk.status)) NOT IN ('selesai', 'confirmed')), 0) AS jumlah_booking
            FROM stok_gudang_deep sgd INNER JOIN stok_gudang sg ON sg.id_stok = sgd.id_stok_header INNER JOIN deep dp ON dp.id_deep = sgd.id_deep INNER JOIN level lv ON lv.id_level = dp.id_level INNER JOIN line ln ON ln.id_line = lv.id_line INNER JOIN block bl ON bl.id_block = ln.id_block INNER JOIN lokasi lk ON lk.id_lokasi = bl.id_lokasi
WHERE sg.id_pengguna_lokasi = ? AND sgd.id_pengguna_lokasi = ? AND sg.id_produk = ? AND sgd.jumlah > 0 $filterKhusus AND NOT (UPPER(bl.kode_block) LIKE '%HOLD%' OR UPPER(lk.nama_lokasi) LIKE '%HOLD%' OR UPPER(COALESCE(lk.kategori, '')) = 'HOLD')
            ORDER BY {$this->prioritasBlokFefoSql('bl', 'lk')}, sgd.best_before IS NULL, sgd.best_before ASC, lk.nama_lokasi ASC, bl.kode_block ASC, CAST(ln.nomor_line AS UNSIGNED) ASC, CAST(dp.deep AS UNSIGNED) DESC, CAST(REPLACE(UPPER(lv.level), 'L', '') AS UNSIGNED) DESC, sgd.id_detail_stok ASC
        ";

        return $this->prosesRencanaDariQuery($sql, [$idPenggunaLokasi, $idPenggunaLokasi, $idProduk], $jumlahButuh, $stokBookingSementara);
    }

    private function prosesRencanaDariQuery($sql, $params, $jumlahButuh, $stokBookingSementara)
    {
        $rows = DB::select($sql, $params);
        $stokRows = [];
        $total = 0;

        foreach ($rows as $row) {
            $idDetail = (int) $row->id_detail_stok;
            $stokTersedia = (int) $row->jumlah - (int) ($row->jumlah_booking ?? 0);
            if (isset($stokBookingSementara[$idDetail])) {
                $stokTersedia -= $stokBookingSementara[$idDetail];
            }

            if ($stokTersedia > 0) {
                $rowArray = (array) $row;
                $rowArray['jumlah'] = $stokTersedia;
                $stokRows[] = $rowArray;
                $total += $stokTersedia;
            }
        }

        if ($total < $jumlahButuh) {
            throw new Exception("Stok tidak mencukupi, hanya tersedia {$total}");
        }

        $out = [];
        $sisa = $jumlahButuh;
        foreach ($stokRows as $stok) {
            if ($sisa <= 0) {
                break;
            }
            $ambil = min($sisa, $stok['jumlah']);
            $deepAsli = (int) $stok['deep'];
            $maxDeepLine = (int) ($stok['max_deep_line'] ?? 0);
            $deepTampil = $maxDeepLine > 0 ? (($maxDeepLine - $deepAsli) + 1) : $deepAsli;

            $out[] = [
                'id_detail_stok' => $stok['id_detail_stok'], 'id_stok_header' => $stok['id_stok_header'], 'id_deep' => $stok['id_deep'],
                'jumlah_rencana' => $ambil, 'best_before' => $stok['best_before'], 'batch' => $stok['batch'] ?? null,
                'block' => $stok['kode_block'], 'line' => $stok['nomor_line'], 'level' => $stok['level'],
                'deep' => $deepTampil, 'deep_asli' => $deepAsli, 'lokasi' => $stok['nama_lokasi'],
            ];
            $sisa -= $ambil;
        }

        return $out;
    }

    private function simpanRencanaPerBarangKeluar($idPenggunaLokasi, $idBarangKeluar, $rencana)
    {
        $inserts = array_map(fn ($r) => [
            'id_pengguna_lokasi' => $idPenggunaLokasi, 'id_barang_keluar' => $idBarangKeluar,
            'id_detail_stok' => $r['id_detail_stok'], 'id_deep' => $r['id_deep'],
            'jumlah_rencana' => $r['jumlah_rencana'], 'best_before' => $r['best_before'], 'batch' => $r['batch'] ?? null,
        ], $rencana);
        DB::table('rencana_keluar_deep')->insert($inserts);
    }

    private function formatRencanaUntukResponse($rencana)
    {
        if (empty($rencana)) {
            return [['label_lokasi' => 'Menunggu Konfirmasi']];
        }

        return array_map(fn ($r) => array_merge($r, ['label_lokasi' => "Block {$r['block']} - Line {$r['line']} - {$r['level']} - Deep {$r['deep']} = {$r['jumlah_rencana']}"]), $rencana);
    }

    private function syncTraceFromBarangKeluar($idBarangKeluar)
    {
        DB::statement("
            UPDATE traceability t
            INNER JOIN barang_keluar bk ON bk.so_number LIKE CONCAT('%', t.so_number, '%') AND bk.id_produk = t.id_produk AND bk.id_pengguna_lokasi = t.id_pengguna_lokasi
            SET t.id_barang_keluar = bk.id_barang_keluar, t.best_before = bk.best_before, t.batch_number = bk.batch
            WHERE bk.id_barang_keluar = ?
        ", [$idBarangKeluar]);
    }

    private function ubahItemOutboundSelesai($idBarangKeluarLama, $idPenggunaLokasi, $jumlahBaru, $catatanPerubahan, $namaPengguna)
    {
        if ($jumlahBaru < 0) {
            return $this->fail('Jumlah baru tidak boleh kurang dari 0.');
        }
        if ($namaPengguna === '') {
            return $this->fail('Nama pengguna tidak valid. Sesi mungkin telah habis.');
        }

        $old = DB::table('barang_keluar')->where('id_barang_keluar', $idBarangKeluarLama)->where('id_pengguna_lokasi', $idPenggunaLokasi)->first();
        if (! $old) {
            return $this->fail('Data outbound asli tidak ditemukan.');
        }
        if (! in_array(strtolower(trim($old->status)), ['selesai', 'confirmed'])) {
            return $this->fail('Outbound ini belum selesai. Gunakan fitur edit jumlah biasa.');
        }

        $jumlahLama = (int) $old->jumlah;
        if ($jumlahBaru === $jumlahLama) {
            return $this->ok([], 'Tidak ada perubahan jumlah yang perlu diproses.');
        }

        $selisih = $jumlahBaru - $jumlahLama;

        DB::beginTransaction();
        try {
            $catatanHistory = $selisih > 0 ? '[PENAMBAHAN ITEM] '.$catatanPerubahan : '[PENGEMBALIAN STOK] '.$catatanPerubahan;

            $idBarangKeluarBaru = DB::table('barang_keluar')->insertGetId([
                'gin_no' => $old->gin_no, 'id_pengguna_lokasi' => $idPenggunaLokasi, 'id_pengguna' => $old->id_pengguna,
                'id_produk' => $old->id_produk, 'nama_produk' => $old->nama_produk,
                'tipe_pengeluaran' => $old->tipe_pengeluaran, 'tujuan' => $old->tujuan, 'nama_driver' => $old->nama_driver,
                'no_mobil' => $old->no_mobil, 'jumlah' => $selisih,
                'best_before' => $old->best_before, 'batch' => $old->batch, 'satuan' => $old->satuan,
                'lokasi_block' => $old->lokasi_block, 'catatan' => $catatanHistory,
                'tanggal_keluar' => $old->tanggal_keluar, 'tanggal_pengiriman' => $old->tanggal_pengiriman,
                'no_dn' => $old->no_dn, 'so_number' => $old->so_number, 'ritase' => $old->ritase,
                'status' => 'Selesai', 'diperbarui_oleh' => $namaPengguna, 'catatan_perubahan' => $catatanPerubahan,
            ]);

            if ($selisih > 0) {
                $rencanaTambah = $this->buatRencanaFefoEditSelesai($idPenggunaLokasi, (int) $old->id_produk, $selisih, [], trim($old->tipe_pengeluaran ?? 'Primary'));

                foreach ($rencanaTambah as $r) {
                    $jum = (int) $r['jumlah_rencana'];
                    $idDS = (int) $r['id_detail_stok'];
                    $idSH = (int) $r['id_stok_header'];

                    $cekStok = DB::selectOne('SELECT sgd.jumlah AS s_deep, sg.jumlah_sisa AS s_head FROM stok_gudang_deep sgd JOIN stok_gudang sg ON sg.id_stok = sgd.id_stok_header WHERE sgd.id_detail_stok = ?', [$idDS]);
                    if (! $cekStok || (int) $cekStok->s_deep < $jum || (int) $cekStok->s_head < $jum) {
                        throw new Exception('Stok fisik di gudang tidak mencukupi untuk melakukan penambahan ini.');
                    }

                    DB::table('stok_gudang_deep')->where('id_detail_stok', $idDS)->decrement('jumlah', $jum);
                    DB::table('stok_gudang')->where('id_stok', $idSH)->decrement('jumlah_sisa', $jum);
                }
                $this->simpanRencanaPerBarangKeluar($idPenggunaLokasi, $idBarangKeluarBaru, $rencanaTambah);
            } else {
                $jumlahKurang = abs($selisih);

                $rowsLama = DB::table('rencana_keluar_deep as r')
                    ->join('stok_gudang_deep as sgd', 'sgd.id_detail_stok', '=', 'r.id_detail_stok')
                    ->where('r.id_barang_keluar', $idBarangKeluarLama)
                    ->where('r.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->select('r.id_rencana', 'r.id_detail_stok', 'r.id_deep', 'r.jumlah_rencana', 'r.best_before', 'r.batch', 'sgd.id_stok_header')
                    ->orderBy('r.id_rencana', 'DESC')
                    ->get();

                $rencanaKembali = [];
                $sisaKembali = $jumlahKurang;
                foreach ($rowsLama as $rowLama) {
                    if ($sisaKembali <= 0) {
                        break;
                    }
                    $kembali = min($sisaKembali, (int) $rowLama->jumlah_rencana);

                    $idDS = (int) $rowLama->id_detail_stok;
                    $idSH = (int) $rowLama->id_stok_header;

                    DB::table('stok_gudang_deep')->where('id_detail_stok', $idDS)->increment('jumlah', $kembali);
                    DB::table('stok_gudang')->where('id_stok', $idSH)->increment('jumlah_sisa', $kembali);

                    $rencanaKembali[] = [
                        'id_detail_stok' => $idDS,
                        'id_deep' => (int) $rowLama->id_deep,
                        'jumlah_rencana' => -$kembali,
                        'best_before' => $rowLama->best_before,
                        'batch' => $rowLama->batch,
                    ];
                    $sisaKembali -= $kembali;
                }

                if ($sisaKembali > 0) {
                    throw new Exception("Gagal mengembalikan stok. Histori lokasi pada card lama tidak mencukupi untuk mengembalikan sejumlah {$jumlahKurang}.");
                }

                $this->simpanRencanaPerBarangKeluar($idPenggunaLokasi, $idBarangKeluarBaru, $rencanaKembali);
            }

            $this->syncTraceFromBarangKeluar($idBarangKeluarBaru);

            DB::commit();

            $msg = $selisih > 0
                ? "Berhasil menambahkan {$selisih} item. Stok telah dipotong dari gudang."
                : 'Berhasil mengurangi '.abs($selisih).' item. Stok telah dikembalikan ke blok asal.';

            return $this->ok(['id_barang_keluar_baru' => $idBarangKeluarBaru, 'selisih' => $selisih], $msg);
        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    private function tambahItemBaruDraft($idRef, $idLokasi, $idPengguna, $idProduk, $jumlah, $satuan, $soNumber)
    {
        $old = DB::table('barang_keluar')->where('id_barang_keluar', $idRef)->where('id_pengguna_lokasi', $idLokasi)->first();
        if (! $old) {
            return $this->fail('Referensi outbound tidak ditemukan.');
        }
        $namaProduk = DB::table('produk')->where('id_produk', $idProduk)->value('nama_produk');
        if (! $namaProduk) {
            return $this->fail('Produk tidak ditemukan di database.');
        }

        DB::beginTransaction();
        try {
            $idBaru = DB::table('barang_keluar')->insertGetId([
                'gin_no' => $old->gin_no, 'id_pengguna_lokasi' => $idLokasi, 'id_pengguna' => $idPengguna,
                'id_produk' => $idProduk, 'nama_produk' => $namaProduk,
                'tipe_pengeluaran' => $old->tipe_pengeluaran, 'tujuan' => $old->tujuan, 'nama_driver' => $old->nama_driver,
                'no_mobil' => $old->no_mobil, 'jumlah' => $jumlah,
                'satuan' => $satuan,
                'tanggal_keluar' => $old->tanggal_keluar, 'tanggal_pengiriman' => $old->tanggal_pengiriman,
                'no_dn' => $old->no_dn, 'so_number' => $soNumber ?: null, 'ritase' => $old->ritase,
                'status' => 'Draft',
            ]);

            DB::commit();

            return $this->ok(['id_barang_keluar' => $idBaru], 'Item draft berhasil ditambahkan.');
        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    private function tambahItemBaruSelesai($idRef, $idLokasi, $idPengguna, $namaPengguna, $idProduk, $jumlah, $satuan, $soNumber, $catatanPerubahan)
    {
        $old = DB::table('barang_keluar')->where('id_barang_keluar', $idRef)->where('id_pengguna_lokasi', $idLokasi)->first();
        if (! $old) {
            return $this->fail('Referensi outbound tidak ditemukan.');
        }
        $namaProduk = DB::table('produk')->where('id_produk', $idProduk)->value('nama_produk');
        if (! $namaProduk) {
            return $this->fail('Produk tidak ditemukan di database.');
        }

        DB::beginTransaction();
        try {
            $rencana = $this->buatRencanaFefoEditSelesai($idLokasi, $idProduk, $jumlah, [], trim($old->tipe_pengeluaran ?? 'Primary'));

            $bestBefore = $rencana[0]['best_before'] ?? null;
            $batch = $rencana[0]['batch'] ?? null;
            $bl = trim($rencana[0]['block'] ?? '');
            $ln = trim($rencana[0]['line'] ?? '');
            $lokasiBlock = ($bl !== '' && $ln !== '') ? $bl.'-'.$ln : ($bl !== '' ? $bl : null);

            $catatanHistory = '[PRODUK BARU] '.$catatanPerubahan;

            $idBaru = DB::table('barang_keluar')->insertGetId([
                'gin_no' => $old->gin_no, 'id_pengguna_lokasi' => $idLokasi, 'id_pengguna' => $idPengguna,
                'id_produk' => $idProduk, 'nama_produk' => $namaProduk,
                'tipe_pengeluaran' => $old->tipe_pengeluaran, 'tujuan' => $old->tujuan, 'nama_driver' => $old->nama_driver,
                'no_mobil' => $old->no_mobil, 'jumlah' => $jumlah,
                'best_before' => $bestBefore, 'batch' => $batch, 'satuan' => $satuan,
                'lokasi_block' => $lokasiBlock, 'catatan' => $catatanHistory,
                'tanggal_keluar' => $old->tanggal_keluar, 'tanggal_pengiriman' => $old->tanggal_pengiriman,
                'no_dn' => $old->no_dn, 'so_number' => $soNumber, 'ritase' => $old->ritase,
                'status' => 'Selesai', 'diperbarui_oleh' => $namaPengguna, 'catatan_perubahan' => $catatanPerubahan,
            ]);

            foreach ($rencana as $r) {
                $jum = (int) $r['jumlah_rencana'];
                $idDS = (int) $r['id_detail_stok'];
                $idSH = (int) $r['id_stok_header'];

                $cekStok = DB::selectOne('SELECT sgd.jumlah AS s_deep, sg.jumlah_sisa AS s_head FROM stok_gudang_deep sgd JOIN stok_gudang sg ON sg.id_stok = sgd.id_stok_header WHERE sgd.id_detail_stok = ?', [$idDS]);
                if (! $cekStok || (int) $cekStok->s_deep < $jum || (int) $cekStok->s_head < $jum) {
                    throw new Exception('Stok fisik di gudang tidak mencukupi untuk melakukan penambahan produk ini.');
                }

                DB::table('stok_gudang_deep')->where('id_detail_stok', $idDS)->decrement('jumlah', $jum);
                DB::table('stok_gudang')->where('id_stok', $idSH)->decrement('jumlah_sisa', $jum);
            }

            $this->simpanRencanaPerBarangKeluar($idLokasi, $idBaru, $rencana);
            $this->syncTraceFromBarangKeluar($idBaru);

            DB::commit();

            return $this->ok(['id_barang_keluar' => $idBaru], 'Berhasil menambahkan produk baru. Stok telah dipotong.');
        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    private function prioritasBlokFefoSql($aliasBlock = 'bl', $aliasLokasi = 'lk')
    {
        return "
            CASE
                WHEN UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) LIKE '%MOBIL%'
                  OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) LIKE '%MOBIL%'
                  OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) LIKE '%MOBIL%' THEN 0
                WHEN UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) LIKE '%RECEH%'
                  OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) LIKE '%RECEH%'
                  OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) LIKE '%RECEH%' THEN 1
                WHEN UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) LIKE '%TRANSIT%'
                  OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) LIKE '%TRANSIT%'
                  OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) LIKE '%TRANSIT%' THEN 2
                ELSE 3
            END ASC
        ";
    }

    private function filterLokasiOutboundNormal($aliasBlock = 'bl', $aliasLokasi = 'lk')
    {
        return " AND NOT (UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) LIKE '%BADSTOCK%' OR UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) LIKE '%REJECT%' OR UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) = 'BS' OR UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) = 'BAD' OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) LIKE '%BADSTOCK%' OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) LIKE '%REJECT%' OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) = 'BS' OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) = 'BAD' OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) LIKE '%BADSTOCK%' OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) LIKE '%REJECT%' OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) = 'BS' OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) = 'BAD') ";
    }

    private function filterLokasiOutboundPemusnahan($aliasBlock = 'bl', $aliasLokasi = 'lk')
    {
        return " AND (UPPER(REPLACE($aliasBlock.kode_block, ' ', '')) LIKE '%REJECT%' OR UPPER(REPLACE($aliasLokasi.nama_lokasi, ' ', '')) LIKE '%REJECT%' OR UPPER(REPLACE(COALESCE($aliasLokasi.kategori, ''), ' ', '')) LIKE '%REJECT%') ";
    }

    private function ambilRencanaPerBarangKeluar($idBarangKeluar)
    {
        $rows = DB::select("
            SELECT r.id_rencana, r.id_detail_stok, r.id_deep, r.jumlah_rencana, r.best_before, COALESCE(r.batch, sgd.batch, sg.batch) AS batch, dp.deep, 
            (SELECT MAX(CAST(d2.deep AS UNSIGNED)) FROM deep d2 INNER JOIN level lv2 ON lv2.id_level = d2.id_level WHERE lv2.id_line = ln.id_line AND d2.id_pengguna_lokasi = dp.id_pengguna_lokasi) AS max_deep_line, lv.level AS level, ln.nomor_line AS line, bl.kode_block AS block, lk.nama_lokasi
            FROM rencana_keluar_deep r LEFT JOIN stok_gudang_deep sgd ON sgd.id_detail_stok = r.id_detail_stok LEFT JOIN stok_gudang sg ON sg.id_stok = sgd.id_stok_header
            INNER JOIN deep dp ON dp.id_deep = r.id_deep INNER JOIN level lv ON lv.id_level = dp.id_level INNER JOIN line ln ON ln.id_line = lv.id_line INNER JOIN block bl ON bl.id_block = ln.id_block INNER JOIN lokasi lk ON lk.id_lokasi = bl.id_lokasi
            WHERE r.id_barang_keluar = ?
            ORDER BY r.best_before IS NULL, r.best_before ASC, lk.nama_lokasi ASC, bl.kode_block ASC, CAST(ln.nomor_line AS UNSIGNED) ASC, CAST(dp.deep AS UNSIGNED) DESC, CAST(REPLACE(UPPER(lv.level), 'L', '') AS UNSIGNED) DESC, r.id_rencana ASC
        ", [$idBarangKeluar]);

        return $this->formatRencanaUntukResponse(array_map(fn ($r) => (array) $r, $rows));
    }

    private function ok($data = [], $message = 'OK')
    {
        return response()->json(['success' => true, 'sukses' => true, 'pesan' => $message, 'message' => $message, 'data' => $data]);
    }

    private function fail($message, $code = 400)
    {
        return response()->json(['success' => false, 'sukses' => false, 'pesan' => $message, 'message' => $message], $code);
    }
}
