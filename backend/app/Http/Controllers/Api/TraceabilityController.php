<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TraceabilityController extends Controller
{
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
            'sukses' => true, 'success' => true, 'data' => $data,
            'total' => $total, 'page' => $page, 'limit' => $limit, 'pages' => $pages,
        ], 200, [], JSON_UNESCAPED_UNICODE);
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
            'sukses' => true, 'success' => true, 'pesan' => $msg,
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
            $inserted = 0;
            $skipped = 0;

            foreach ($items as $it) {
                $soNumber = trim($it['so_number'] ?? '');
                $idProduk = (int) ($it['id_produk'] ?? 0);
                $idPenggunaLokasi = ! empty($it['id_pengguna_lokasi']) ? trim($it['id_pengguna_lokasi']) : null;
                $tanggalPengiriman = ! empty($it['tanggal_pengiriman']) ? substr($it['tanggal_pengiriman'], 0, 10) : null;

                // 1. Cek duplikat data
                $isDuplicate = false;
                if ($soNumber !== '' && $idProduk > 0 && $tanggalPengiriman !== null) {
                    $isDuplicate = DB::table('traceability')
                        ->where('so_number', $soNumber)->where('id_produk', $idProduk)->where('tanggal_pengiriman', $tanggalPengiriman)
                        ->exists();
                }

                if ($isDuplicate) {
                    $skipped++;

                    continue;
                }

                // 2. Pencarian FK Barang Keluar (Berdasarkan SO + Produk)
                $idBarangKeluar = null;
                $lokasiDariBk = null;
                $batchNumber = null;
                $bestBefore = null;

                if ($soNumber !== '' && $idProduk > 0) {
                    $lookup1 = DB::table('barang_keluar')
                        ->where('so_number', 'LIKE', "%{$soNumber}%")->where('id_produk', $idProduk)
                        ->orderBy('id_barang_keluar', 'DESC')->first(['id_barang_keluar', 'id_pengguna_lokasi', 'batch', 'best_before']);

                    if ($lookup1) {
                        $idBarangKeluar = $lookup1->id_barang_keluar;
                        $lokasiDariBk = $lookup1->id_pengguna_lokasi;
                        $batchNumber = $lookup1->batch;
                        $bestBefore = $lookup1->best_before ?: null;
                    }
                }

                // 3. Fallback Pencarian FK (Hanya berdasarkan SO)
                if ($idBarangKeluar === null && $soNumber !== '') {
                    $lookup2 = DB::table('barang_keluar')
                        ->where('so_number', 'LIKE', "%{$soNumber}%")
                        ->orderBy('id_barang_keluar', 'DESC')->first(['id_barang_keluar', 'id_pengguna_lokasi', 'batch', 'best_before']);

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

                // 4. Eksekusi Insert
                DB::table('traceability')->insert([
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
                ]);

                $inserted++;
            }

            DB::commit();

            $msg = 'Berhasil memproses data.';
            if ($inserted > 0) {
                $msg .= " {$inserted} data baru tersimpan.";
            }
            if ($skipped > 0) {
                $msg .= " {$skipped} data dilewati (sudah ada).";
            }

            return $this->ok(['inserted' => $inserted, 'skipped' => $skipped], $msg);

        } catch (Exception $e) {
            DB::rollBack();

            return $this->fail($e->getMessage(), 500);
        }
    }

    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================
    private function ok($data = [], $message = 'OK')
    {
        return response()->json([
            'sukses' => true, 'success' => true, 'pesan' => $message, 'message' => $message, 'data' => $data,
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function fail($message, $code = 400)
    {
        return response()->json([
            'sukses' => false, 'success' => false, 'pesan' => $message, 'message' => $message,
        ], $code, [], JSON_UNESCAPED_UNICODE);
    }
}
