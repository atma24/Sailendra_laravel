<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Api\Concerns\ExcelReader;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TraceabilityController extends Controller
{
    use ApiResponse;
    use ExcelReader;

    // =========================================================================
    // 1. GET BEST BEFORE LIST (Ref: source 20)
    // =========================================================================
    public function getBestBeforeList(Request $request)
    {
        $idPenggunaLokasi = trim($request->input('id_pengguna_lokasi', ''));

        $query = DB::table('traceability')
            ->whereNotNull('best_before')
            ->where('best_before', '!=', '');

        if ($idPenggunaLokasi !== '') {
            $query->where('id_pengguna_lokasi', $idPenggunaLokasi);
        }

        $dates = $query->distinct()
            ->orderBy('best_before', 'DESC')
            ->pluck('best_before')
            ->toArray();

        return $this->ok($dates);
    }

    // =========================================================================
    // 2. GET LIST TRACEABILITY & SEARCHING (Ref: source 21)
    // =========================================================================
    public function index(Request $request)
    {
        $idPenggunaLokasi = trim($request->input('id_pengguna_lokasi', ''));
        $q = trim($request->input('q', ''));

        $idTraceability = (int) $request->input('id_traceability', 0);

        $bestBefore = $request->input('best_before', []);
        if (! is_array($bestBefore)) {
            $bestBefore = [$bestBefore];
        }
        $bestBefore = array_values(array_filter($bestBefore, fn ($v) => trim($v) !== ''));

        $idProdukFilter = $request->input('id_produk', []);
        if (! is_array($idProdukFilter)) {
            $idProdukFilter = [$idProdukFilter];
        }
        $idProdukFilter = array_values(array_filter(array_map('intval', $idProdukFilter), fn ($v) => $v > 0));

        $page = max(1, (int) $request->input('page', 1));
        $limit = max(1, (int) $request->input('limit', 100));
        $offset = ($page - 1) * $limit;

        $query = DB::table('traceability as t')
            ->leftJoin('barang_keluar as bk', 'bk.id_barang_keluar', '=', 't.id_barang_keluar')
            ->leftJoin('plant as p', DB::raw('UPPER(RIGHT(t.batch_number, 4))'), '=', DB::raw('UPPER(p.id_plant)'))
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 't.id_pengguna_lokasi');

        if ($idPenggunaLokasi !== '') {
            $query->where('t.id_pengguna_lokasi', $idPenggunaLokasi);
        }

        if ($idTraceability > 0) {
            $query->where('t.id_traceability', $idTraceability);
        }

        if (! empty($bestBefore)) {
            $query->whereIn('t.best_before', $bestBefore);
        }

        if (! empty($idProdukFilter)) {
            $query->whereIn('t.id_produk', $idProdukFilter);
        }

        // Ekspansi Pencarian (18 Kondisi)
        if ($q !== '') {
            $keyword = '%'.strtolower($q).'%';
            $query->where(function ($sub) use ($keyword) {
                $sub->whereRaw("LOWER(COALESCE(t.so_number, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.nama_produk, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.batch_number, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.nama_customer, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.sales_group, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(bk.gin_no, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(p.nama_plant, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(pl.nama_pengguna_lokasi, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.nama_driver, bk.nama_driver, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(bk.no_mobil, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.no_dn, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.id_customer, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.id_route, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.best_before, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(bk.lokasi_block, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(bk.status, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.status_delivery, '')) LIKE ?", [$keyword])
                    ->orWhereRaw("LOWER(COALESCE(t.jumlah, '')) LIKE ?", [$keyword]);
            });
        }

        $total = $query->count();
        $pages = (int) ceil($total / $limit);

        $data = $query->select(
            't.*',
            'bk.gin_no',
            'bk.lokasi_block',
            'bk.status AS status_barang_keluar',
            'bk.tanggal_keluar AS aktual_kirim_gudang',
            'bk.nama_driver AS driver_gudang',
            'bk.no_mobil',
            'p.nama_plant',
            'pl.nama_pengguna_lokasi AS nama_depo'
        )
            ->orderBy('t.id_traceability', 'DESC')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true, 'message' => '', 'data' => $data,
            'total' => $total, 'page' => $page, 'limit' => $limit, 'pages' => $pages,
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    // =========================================================================
    // 2b. GET DETAIL SATU TRACEABILITY
    // =========================================================================
    public function show(Request $request)
    {
        $id = (int) $request->input('id_traceability', 0);
        if ($id <= 0) {
            return $this->fail('id_traceability wajib');
        }

        $row = DB::table('traceability as t')
            ->leftJoin('barang_keluar as bk', 'bk.id_barang_keluar', '=', 't.id_barang_keluar')
            ->leftJoin('plant as p', DB::raw('UPPER(RIGHT(t.batch_number, 4))'), '=', DB::raw('UPPER(p.id_plant)'))
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 't.id_pengguna_lokasi')
            ->where('t.id_traceability', $id)
            ->select(
                't.*',
                'bk.gin_no',
                'bk.lokasi_block',
                'bk.status AS status_barang_keluar',
                'bk.tanggal_keluar AS aktual_kirim_gudang',
                'bk.nama_driver AS driver_gudang',
                'bk.no_mobil',
                'p.nama_plant',
                'pl.nama_pengguna_lokasi AS nama_depo'
            )
            ->first();

        if (! $row) {
            return $this->fail('Data traceability tidak ditemukan', 404);
        }

        return $this->ok((array) $row);
    }

    // =========================================================================
    // 3. BACKFILL DATA TRACEABILITY (Ref: source 22)
    // =========================================================================
    public function syncBackfill(Request $request)
    {
        // Pass 1: Backfill NULL id_barang_keluar
        $affectedFk = DB::update("
            UPDATE traceability t
            INNER JOIN barang_keluar bk 
                ON bk.so_number LIKE CONCAT('%', t.so_number, '%')
                AND bk.id_produk = t.id_produk
                AND bk.id_pengguna_lokasi = t.id_pengguna_lokasi
            SET t.id_barang_keluar = bk.id_barang_keluar
            WHERE t.id_barang_keluar IS NULL
              AND LOWER(bk.status) IN ('selesai', 'confirmed')
        ");

        // Pass 2: Update batch & best_before
        $affectedBb = DB::update("
            UPDATE traceability t
            INNER JOIN barang_keluar bk ON bk.id_barang_keluar = t.id_barang_keluar
            SET t.best_before = bk.best_before, t.batch_number = bk.batch
            WHERE LOWER(bk.status) IN ('selesai', 'confirmed')
              AND bk.best_before IS NOT NULL
              AND (t.best_before IS NULL OR t.batch_number IS NULL)
        ");

        $msg = "Backfill selesai. {$affectedFk} FK traceability diperbarui. {$affectedBb} batch/best_before diperbarui.";

        return response()->json([
            'success' => true, 'message' => $msg,
            'affected_rows' => $affectedFk + $affectedBb, 'fk_fixed' => $affectedFk, 'bb_fixed' => $affectedBb,
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    // =========================================================================
    // 4. DELETE DATA TRACEABILITY (Ref: source 23)
    // =========================================================================
    public function destroy(Request $request)
    {
        $idTraceability = (int) $request->input('id_traceability', 0);

        if ($idTraceability <= 0) {
            return $this->fail('ID Traceability tidak valid');
        }

        $deleted = DB::table('traceability')->where('id_traceability', $idTraceability)->delete();

        if ($deleted > 0) {
            return $this->ok(['id_traceability' => $idTraceability], 'Data traceability berhasil dihapus.');
        }

        return $this->fail('Data tidak ditemukan atau sudah terhapus.', 404);
    }

    // =========================================================================
    // 5. IMPORT TRACEABILITY (Ref: source 24)
    // =========================================================================
    public function import(Request $request)
    {
        $items = $request->input('items', []);
        if (empty($items) || ! is_array($items)) {
            return $this->fail('Data items traceability kosong');
        }

        DB::beginTransaction();
        try {
            // 1. Bulk Pre-fetch Cek Duplikat (Memory Lookup)
            $soList = [];
            foreach ($items as $it) {
                $so = trim($it['so_number'] ?? '');
                if ($so !== '') {
                    $soList[] = $so;
                }
            }
            $soList = array_unique($soList);

            $existingTraceRows = DB::table('traceability')
                ->whereIn('so_number', $soList)
                ->get(['so_number', 'id_produk', 'tanggal_pengiriman']);

            $existingMap = [];
            foreach ($existingTraceRows as $ex) {
                $tgl = $ex->tanggal_pengiriman ? substr($ex->tanggal_pengiriman, 0, 10) : '';
                $key = $ex->so_number.'|'.(int) $ex->id_produk.'|'.$tgl;
                $existingMap[$key] = true;
            }

            // 2. Bulk Pre-fetch FK Barang Keluar (Memory Lookup)
            $bkRows = DB::table('barang_keluar')
                ->where(function ($q) use ($soList) {
                    foreach ($soList as $s) {
                        $q->orWhere('so_number', 'LIKE', '%'.$s.'%');
                    }
                })
                ->orderBy('id_barang_keluar', 'DESC')
                ->get(['id_barang_keluar', 'so_number', 'id_produk', 'id_pengguna_lokasi', 'batch', 'best_before']);

            $bkMapBySoProd = [];
            $bkMapBySoOnly = [];
            foreach ($bkRows as $bk) {
                $arrSo = array_filter(array_map('trim', explode(',', $bk->so_number ?? '')));
                foreach ($arrSo as $sVal) {
                    $keyProd = $sVal.'|'.(int) $bk->id_produk;
                    if (! isset($bkMapBySoProd[$keyProd])) {
                        $bkMapBySoProd[$keyProd] = $bk;
                    }
                    if (! isset($bkMapBySoOnly[$sVal])) {
                        $bkMapBySoOnly[$sVal] = $bk;
                    }
                }
            }

            $inserted = 0;
            $skipped = 0;
            $insertRows = [];

            foreach ($items as $it) {
                $soNumber = trim($it['so_number'] ?? '');
                $idProduk = (int) ($it['id_produk'] ?? 0);
                $idPenggunaLokasi = ! empty($it['id_pengguna_lokasi']) ? trim($it['id_pengguna_lokasi']) : null;
                $tanggalPengiriman = ! empty($it['tanggal_pengiriman']) ? substr($it['tanggal_pengiriman'], 0, 10) : null;

                // Cek Duplikat dari Memory Lookup
                $dupKey = $soNumber.'|'.$idProduk.'|'.($tanggalPengiriman ?? '');
                if ($soNumber !== '' && $idProduk > 0 && $tanggalPengiriman !== null && isset($existingMap[$dupKey])) {
                    $skipped++;
                    continue;
                }

                // Lookup FK Barang Keluar dari Memory
                $idBarangKeluar = null;
                $lokasiDariBk = null;
                $batchNumber = null;
                $bestBefore = null;

                $lookupKeyProd = $soNumber.'|'.$idProduk;
                $lookup1 = $bkMapBySoProd[$lookupKeyProd] ?? null;

                if ($lookup1) {
                    $idBarangKeluar = $lookup1->id_barang_keluar;
                    $lokasiDariBk = $lookup1->id_pengguna_lokasi;
                    $batchNumber = $lookup1->batch;
                    $bestBefore = $lookup1->best_before ?: null;
                } else {
                    $lookup2 = $bkMapBySoOnly[$soNumber] ?? null;
                    if ($lookup2) {
                        $idBarangKeluar = $lookup2->id_barang_keluar;
                        $lokasiDariBk = $lookup2->id_pengguna_lokasi;
                        $batchNumber = $lookup2->batch;
                        $bestBefore = $lookup2->best_before ?: null;
                    }
                }

                if ($lokasiDariBk !== null) {
                    $idPenggunaLokasi = $lokasiDariBk;
                }
                if ($batchNumber === null && ! empty($it['batch_number'])) {
                    $batchNumber = trim($it['batch_number']);
                }

                $insertRows[] = [
                    'id_barang_keluar' => $idBarangKeluar,
                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                    'id_route' => ! empty($it['id_route']) ? trim($it['id_route']) : null,
                    'nama_driver' => ! empty($it['nama_driver']) ? trim($it['nama_driver']) : null,
                    'id_customer' => ! empty($it['id_customer']) ? trim($it['id_customer']) : null,
                    'nama_customer' => ! empty($it['nama_customer']) ? trim($it['nama_customer']) : null,
                    'sales_group' => ! empty($it['sales_group']) ? trim($it['sales_group']) : null,
                    'so_number' => $soNumber,
                    'no_dn' => ! empty($it['no_dn']) ? trim($it['no_dn']) : null,
                    'nama_produk' => ! empty($it['nama_produk']) ? trim($it['nama_produk']) : null,
                    'id_produk' => $idProduk,
                    'tanggal_pengiriman' => $tanggalPengiriman,
                    'jumlah' => (int) ($it['jumlah'] ?? 0),
                    'batch_number' => $batchNumber,
                    'best_before' => $bestBefore,
                    'status_delivery' => ! empty($it['status_delivery']) ? trim($it['status_delivery']) : null,
                ];

                $existingMap[$dupKey] = true;
                $inserted++;
            }

            // Execute Fast Bulk Insert (Chunk per 500 baris)
            if (! empty($insertRows)) {
                foreach (array_chunk($insertRows, 500) as $chunk) {
                    DB::table('traceability')->insert($chunk);
                }
            }

            DB::commit();

            $msg = 'Berhasil memproses data.';
            if ($inserted > 0) {
                $msg .= " {$inserted} data baru tersimpan.";
            }
            if ($skipped > 0) {
                $msg .= " ({$skipped} baris ganda/duplikat dalam file Excel dilewati).";
            }

            return $this->ok(['inserted' => $inserted, 'skipped' => $skipped], $msg);

        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    // =========================================================================
    // 5b. UPLOAD EXCEL TRACEABILITY (Ref: Traceability::upload_excel)
    //     Parse file, bangun items, delegasi ke import().
    // =========================================================================
    public function uploadFile(Request $request)
    {
        $file = $request->file('file_excel');
        if (! $file || ! $file->isValid()) {
            return $this->fail('Harap pilih file Excel atau CSV yang valid.');
        }

        $ext = strtolower($file->getClientOriginalExtension());
        $uploadLokasi = trim((string) $request->input('upload_lokasi', ''));

        $produkList = DB::table('produk')->get(['id_produk', 'nama_produk']);
        $mapProduk = [];
        foreach ($produkList as $p) {
            $mapProduk[strtoupper(trim((string) $p->nama_produk))] = (int) $p->id_produk;
        }

        $parsed = $this->bacaFileSpreadsheet($file->getRealPath(), $ext);
        $headerRow = $parsed['header'];
        $rowsData = $parsed['rows'];

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

        $idxRoute = $colMap['ID_Route'] ?? 1;
        $idxDriver = $colMap['Driver_Name'] ?? 3;
        $idxIdCustomer = $colMap['Cust_ID'] ?? 4;
        $idxNamaCustomer = $colMap['Cust_Name'] ?? 5;
        $idxSalesGroup = $colMap['Sales_Group'] ?? 7;
        $idxSo = $colMap['SO_Number'] ?? 9;
        $idxDn = $colMap['DN_Number'] ?? 10;
        $idxNamaProduk = $colMap['Product_Name'] ?? 11;
        $idxSku = $colMap['SKU'] ?? 12;
        $idxTanggal = $colMap['Actual_Date'] ?? 14;
        $idxJumlah = $colMap['Actual_Qty'] ?? 16;
        $idxStatusDelivery = $colMap['Status_Delivery'] ?? 18;

        $items = [];
        $countUnmapped = 0;
        foreach ($rowsData as $data) {
            $soNumber = trim((string) ($data[$idxSo] ?? ''));
            if ($soNumber === '') {
                continue;
            }
            $namaProdukExcel = strtoupper(trim((string) ($data[$idxNamaProduk] ?? '')));
            $jumlah = (int) ($data[$idxJumlah] ?? 0);
            if ($namaProdukExcel === '' || $jumlah <= 0) {
                continue;
            }

            $idProduk = $mapProduk[$namaProdukExcel] ?? 0;
            if ($idProduk <= 0) {
                $countUnmapped++;
            }

            $rawDate = trim((string) ($data[$idxTanggal] ?? ''));
            $tanggalPengiriman = null;
            if ($rawDate !== '') {
                $parsedDate = date('Y-m-d', strtotime(str_replace('/', '-', $rawDate)));
                if ($parsedDate !== '1970-01-01' && $parsedDate !== false) {
                    $tanggalPengiriman = $parsedDate;
                }
            }

            $items[] = [
                'id_route' => trim((string) ($data[$idxRoute] ?? '')),
                'nama_driver' => trim((string) ($data[$idxDriver] ?? '')),
                'id_customer' => trim((string) ($data[$idxIdCustomer] ?? '')),
                'nama_customer' => trim((string) ($data[$idxNamaCustomer] ?? '')),
                'sales_group' => trim((string) ($data[$idxSalesGroup] ?? '')),
                'so_number' => $soNumber,
                'no_dn' => trim((string) ($data[$idxDn] ?? '')),
                'nama_produk' => trim((string) ($data[$idxNamaProduk] ?? '')),
                'id_produk' => $idProduk,
                'id_pengguna_lokasi' => $uploadLokasi,
                'tanggal_pengiriman' => $tanggalPengiriman,
                'jumlah' => $jumlah,
                'status_delivery' => trim((string) ($data[$idxStatusDelivery] ?? '')),
            ];
        }

        if (empty($items)) {
            $msg = 'Gagal memproses file. Data tidak sesuai format.';
            if ($countUnmapped > 0) {
                $msg .= " Ada $countUnmapped produk tidak dikenal.";
            }

            return $this->fail($msg);
        }

        $request->merge(['items' => $items]);
        $resp = $this->import($request);

        $data = json_decode($resp->getContent(), true);
        $data['unmapped'] = $countUnmapped;
        $response = response()->json($data);

        return $response;
    }
}
