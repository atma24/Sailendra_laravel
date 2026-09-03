<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BarangKeluarController;
use App\Http\Controllers\Api\BarangMasukController;
use App\Http\Controllers\Api\BlockController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeepController;
use App\Http\Controllers\Api\LaporanController;
use App\Http\Controllers\Api\LayoutGudangController;
use App\Http\Controllers\Api\LevelController;
use App\Http\Controllers\Api\LineController;
use App\Http\Controllers\Api\LokasiController;
use App\Http\Controllers\Api\MutasiController;
use App\Http\Controllers\Api\PenggunaController;
use App\Http\Controllers\Api\PenggunaLokasiController;
use App\Http\Controllers\Api\PlantController;
use App\Http\Controllers\Api\ProdukController;
use App\Http\Controllers\Api\StokController;
use App\Http\Controllers\Api\StokOpnameController;
use App\Http\Controllers\Api\TraceabilityController;
use Illuminate\Support\Facades\Route;

// =========================================================================
// PUBLIC ROUTES (Tanpa Token)
// =========================================================================
Route::post('/login', [AuthController::class, 'login']);

// =========================================================================
// PROTECTED ROUTES (Wajib Bawa Bearer Token)
// =========================================================================
Route::middleware('auth:sanctum')->group(function () {

    // Logout endpoint (menghapus token)
    Route::post('/logout', [AuthController::class, 'logout']);

    // Validasi sesi (token masih valid?)
    Route::get('/me', [AuthController::class, 'me']);

    // Reset password akun (semua role)
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    // ---------------------------------------------------------------------
    // RESTRICTED ACCESS (Hanya SuperAdmin & Supervisor)
    // ---------------------------------------------------------------------
    // ---------------------------------------------------------------------
    // RESTRICTED ACCESS (Hanya SuperAdmin)
    // ---------------------------------------------------------------------
    Route::middleware('role:SuperAdmin')->group(function () {
        // Layout Gudang (Import/Download Template)
        Route::get('/layout-gudang/download-template', [LayoutGudangController::class, 'downloadTemplate']);
        Route::post('/layout-gudang/import-layout', [LayoutGudangController::class, 'importLayout']);

        // Stok (Import/Download Template)
        Route::get('/barang-masuk/download-template', [BarangMasukController::class, 'downloadStockTemplate']);
        Route::post('/barang-masuk/import-stock', [BarangMasukController::class, 'importStock']);
    });

    // ---------------------------------------------------------------------
    // RESTRICTED ACCESS (Hanya SuperAdmin & Supervisor)
    // ---------------------------------------------------------------------
    Route::middleware('role:SuperAdmin,Supervisor')->group(function () {
        // Pengguna (User Management)
        Route::get('/pengguna', [PenggunaController::class, 'index']);
        Route::post('/pengguna', [PenggunaController::class, 'store']);
        Route::match(['put', 'patch'], '/pengguna/{id}', [PenggunaController::class, 'update']);
        Route::delete('/pengguna/{id}', [PenggunaController::class, 'destroy']);

        // Lokasi
        Route::post('/lokasi', [LokasiController::class, 'store']);
        Route::match(['put', 'patch'], '/lokasi/{id}', [LokasiController::class, 'update']);
        Route::delete('/lokasi/{id}', [LokasiController::class, 'destroy']);

        // Block
        Route::post('/block', [BlockController::class, 'store']);
        Route::match(['put', 'patch'], '/block/{id}', [BlockController::class, 'update']);
        Route::delete('/block/{id}', [BlockController::class, 'destroy']);

        // Line
        Route::post('/line', [LineController::class, 'store']);
        Route::match(['put', 'patch'], '/line/{id}', [LineController::class, 'update']);
        Route::delete('/line/{id}', [LineController::class, 'destroy']);

        // Level
        Route::post('/level', [LevelController::class, 'store']);
        Route::match(['put', 'patch'], '/level/{id}', [LevelController::class, 'update']);
        Route::delete('/level/{id}', [LevelController::class, 'destroy']);

        // Deep
        Route::post('/deep', [DeepController::class, 'store']);
        Route::match(['put', 'patch'], '/deep/{id}', [DeepController::class, 'update']);
        Route::delete('/deep/{id}', [DeepController::class, 'destroy']);

        // Layout Gudang (Aksi Edit/Ubah)
        Route::post('/layout-gudang/simpan-layout', [LayoutGudangController::class, 'simpanLayout']);
        Route::post('/layout-gudang/salin-block', [LayoutGudangController::class, 'salinBlock']);
        Route::post('/layout-gudang/ubah-plant-line', [LayoutGudangController::class, 'ubahPlantLine']);
        Route::post('/layout-gudang/ubah-bb-jumlah-line', [LayoutGudangController::class, 'ubahBbJumlahLine']);
        Route::post('/layout-gudang/transfer-stok-line', [LayoutGudangController::class, 'transferStokLine']);
        Route::post('/layout-gudang/prioritas-lokasi-produk', [LayoutGudangController::class, 'prioritasLokasiProduk']);
    });

    // ---------------------------------------------------------------------
    // MASTER DATA WRITES (SuperAdmin, Support, Supervisor)
    // ---------------------------------------------------------------------
    Route::middleware('role:SuperAdmin,Support,Supervisor')->group(function () {
        // Produk
        Route::post('/produk', [ProdukController::class, 'store']);
        Route::match(['put', 'patch'], '/produk/{id}', [ProdukController::class, 'update']);
        Route::delete('/produk/{id}', [ProdukController::class, 'destroy']);

        // Plant
        Route::post('/plant', [PlantController::class, 'store']);
        Route::match(['put', 'patch'], '/plant/{id}', [PlantController::class, 'update']);
        Route::delete('/plant/{id}', [PlantController::class, 'destroy']);
    });


    // ---------------------------------------------------------------------
    // GENERAL ACCESS (Bisa diakses Semua Role yang Login)
    // ---------------------------------------------------------------------
    Route::get('/pengguna-lokasi', [PenggunaLokasiController::class, 'index']);
    
    Route::get('/produk', [ProdukController::class, 'index']);
    Route::get('/plant', [PlantController::class, 'index']);
    Route::get('/lokasi', [LokasiController::class, 'index']);
    Route::get('/block', [BlockController::class, 'index']);
    Route::get('/line', [LineController::class, 'index']);
    Route::get('/level', [LevelController::class, 'index']);
    Route::get('/deep', [DeepController::class, 'index']);

    Route::get('/stok', StokController::class);
    Route::get('/stok/export', [StokController::class, 'exportExcel']);
    Route::match(['get', 'post'], '/stok-opname', StokOpnameController::class);

    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

    Route::get('/layout-gudang/ambil-layout', [LayoutGudangController::class, 'ambilLayout']);
    Route::get('/layout-gudang/cek-line-layout', [LayoutGudangController::class, 'cekLineLayout']);
    Route::get('/layout-gudang/ambil-plant-line', [LayoutGudangController::class, 'ambilPlantLine']);
    Route::get('/layout-gudang/ambil-ringkasan-deep', [LayoutGudangController::class, 'ambilRingkasanDeep']);
    Route::get('/layout-gudang/cek-kapasitas-deep', [LayoutGudangController::class, 'cekKapasitasDeep']);

    Route::get('/mutasi', [MutasiController::class, 'history']);
    Route::get('/mutasi/bb-line', [MutasiController::class, 'getBestBefore']);
    Route::match(['get', 'post'], '/mutasi/proses', [MutasiController::class, 'store']);

    Route::get('/traceability', [TraceabilityController::class, 'index']);
    Route::get('/traceability/show', [TraceabilityController::class, 'show']);
    Route::get('/traceability/best-before', [TraceabilityController::class, 'getBestBeforeList']);
    Route::post('/traceability/import', [TraceabilityController::class, 'import']);
    Route::post('/traceability/upload-file', [TraceabilityController::class, 'uploadFile']);
    Route::post('/traceability/backfill', [TraceabilityController::class, 'syncBackfill']);
    Route::post('/traceability/hapus', [TraceabilityController::class, 'destroy']);

    Route::get('/barang-keluar', [BarangKeluarController::class, 'index']);
    Route::get('/barang-keluar/detail', [BarangKeluarController::class, 'show']);
    Route::post('/barang-keluar', [BarangKeluarController::class, 'store']);
    Route::post('/barang-keluar/upload', [BarangKeluarController::class, 'uploadExcel']);
    Route::post('/barang-keluar/upload-file', [BarangKeluarController::class, 'uploadFile']);
    Route::post('/barang-keluar/import-file', [BarangKeluarController::class, 'importFile']);
    Route::post('/barang-keluar/import', [BarangKeluarController::class, 'importHistorical']);
    Route::post('/barang-keluar/update', [BarangKeluarController::class, 'update']);
    Route::post('/barang-keluar/hapus', [BarangKeluarController::class, 'destroy']);

    Route::post('/barang-masuk/upload', [App\Http\Controllers\Api\BarangMasukController::class, 'uploadInboundFile']);
    Route::post('/barang-masuk/submit', [BarangMasukController::class, 'submitDraft']);
    Route::post('/barang-masuk/konfirmasi', [App\Http\Controllers\Api\BarangMasukController::class, 'konfirmasiInbound']);
    Route::post('/barang-masuk/batch', [BarangMasukController::class, 'storeBatch']);
    Route::get('/barang-masuk', [BarangMasukController::class, 'index']);
    Route::post('/barang-masuk', [BarangMasukController::class, 'store']);
    Route::post('/barang-masuk/preview', [BarangMasukController::class, 'preview']);
    Route::post('/barang-masuk/update', [BarangMasukController::class, 'update']);
    Route::post('/barang-masuk/hapus', [BarangMasukController::class, 'destroy']);

    Route::get('/laporan/barang-keluar', [LaporanController::class, 'exportBarangKeluar']);
    Route::get('/laporan/barang-masuk', [LaporanController::class, 'exportBarangMasuk']);
    Route::get('/laporan/gabungan', [LaporanController::class, 'exportGabungan']);
    Route::get('/laporan/mutasi', [LaporanController::class, 'exportMutasi']);
    Route::get('/laporan/stok-opname', [LaporanController::class, 'exportStockOpname']);
    Route::get('/laporan/stok-opname/detail-pdf', [LaporanController::class, 'detailStockOpnamePdf']);
    Route::get('/laporan/stok-opname/print-ready', [LaporanController::class, 'printReadyStockOpname']);
});