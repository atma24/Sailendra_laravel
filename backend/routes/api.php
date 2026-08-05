<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BarangKeluarController;
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

Route::post('/login', [AuthController::class, 'login']);

Route::get('/produk', [ProdukController::class, 'index']);
Route::post('/produk', [ProdukController::class, 'store']);
Route::match(['put', 'patch'], '/produk/{id}', [ProdukController::class, 'update']);
Route::delete('/produk/{id}', [ProdukController::class, 'destroy']);

Route::get('/plant', [PlantController::class, 'index']);
Route::post('/plant', [PlantController::class, 'store']);
Route::match(['put', 'patch'], '/plant/{id}', [PlantController::class, 'update']);
Route::delete('/plant/{id}', [PlantController::class, 'destroy']);

Route::get('/lokasi', [LokasiController::class, 'index']);
Route::post('/lokasi', [LokasiController::class, 'store']);
Route::match(['put', 'patch'], '/lokasi/{id}', [LokasiController::class, 'update']);
Route::delete('/lokasi/{id}', [LokasiController::class, 'destroy']);

Route::get('/block', [BlockController::class, 'index']);
Route::post('/block', [BlockController::class, 'store']);
Route::match(['put', 'patch'], '/block/{id}', [BlockController::class, 'update']);
Route::delete('/block/{id}', [BlockController::class, 'destroy']);

Route::get('/line', [LineController::class, 'index']);
Route::post('/line', [LineController::class, 'store']);
Route::match(['put', 'patch'], '/line/{id}', [LineController::class, 'update']);
Route::delete('/line/{id}', [LineController::class, 'destroy']);

Route::get('/level', [LevelController::class, 'index']);
Route::post('/level', [LevelController::class, 'store']);
Route::match(['put', 'patch'], '/level/{id}', [LevelController::class, 'update']);
Route::delete('/level/{id}', [LevelController::class, 'destroy']);

Route::get('/stok', StokController::class);

Route::match(['get', 'post'], '/stok-opname', StokOpnameController::class);

Route::get('/deep', [DeepController::class, 'index']);
Route::post('/deep', [DeepController::class, 'store']);
Route::match(['put', 'patch'], '/deep/{id}', [DeepController::class, 'update']);
Route::delete('/deep/{id}', [DeepController::class, 'destroy']);

Route::get('/pengguna', [PenggunaController::class, 'index']);
Route::post('/pengguna', [PenggunaController::class, 'store']);
Route::match(['put', 'patch'], '/pengguna/{id}', [PenggunaController::class, 'update']);
Route::delete('/pengguna/{id}', [PenggunaController::class, 'destroy']);

Route::get('/pengguna-lokasi', [PenggunaLokasiController::class, 'index']);

Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

Route::get('/layout-gudang/ambil-layout', [LayoutGudangController::class, 'ambilLayout']);
Route::get('/layout-gudang/ambil-plant-line', [LayoutGudangController::class, 'ambilPlantLine']);
Route::get('/layout-gudang/ambil-ringkasan-deep', [LayoutGudangController::class, 'ambilRingkasanDeep']);
Route::get('/layout-gudang/cek-kapasitas-deep', [LayoutGudangController::class, 'cekKapasitasDeep']);
Route::post('/layout-gudang/prioritas-lokasi-produk', [LayoutGudangController::class, 'prioritasLokasiProduk']);
Route::post('/layout-gudang/salin-block', [LayoutGudangController::class, 'salinBlock']);
Route::post('/layout-gudang/ubah-plant-line', [LayoutGudangController::class, 'ubahPlantLine']);
Route::post('/layout-gudang/ubah-bb-jumlah-line', [LayoutGudangController::class, 'ubahBbJumlahLine']);
Route::post('/layout-gudang/transfer-stok-line', [LayoutGudangController::class, 'transferStokLine']);

Route::get('/mutasi', [MutasiController::class, 'history']);
Route::get('/mutasi/bb-line', [MutasiController::class, 'getBestBefore']);
Route::match(['get', 'post'], '/mutasi/proses', [MutasiController::class, 'store']);

Route::get('/traceability', [TraceabilityController::class, 'index']);
Route::get('/traceability/best-before', [TraceabilityController::class, 'getBestBeforeList']);
Route::post('/traceability/import', [TraceabilityController::class, 'import']);
Route::post('/traceability/backfill', [TraceabilityController::class, 'syncBackfill']);
Route::post('/traceability/hapus', [TraceabilityController::class, 'destroy']);

Route::get('/barang-keluar', [BarangKeluarController::class, 'index']);
Route::get('/barang-keluar/detail', [BarangKeluarController::class, 'show']);
Route::post('/barang-keluar', [BarangKeluarController::class, 'store']);
Route::post('/barang-keluar/import', [BarangKeluarController::class, 'importHistorical']);
Route::post('/barang-keluar/update', [BarangKeluarController::class, 'update']);
Route::post('/barang-keluar/hapus', [BarangKeluarController::class, 'destroy']);

Route::get('/laporan/barang-keluar', [LaporanController::class, 'exportBarangKeluar']);
Route::get('/laporan/barang-masuk', [LaporanController::class, 'exportBarangMasuk']);
Route::get('/laporan/gabungan', [LaporanController::class, 'exportGabungan']);
Route::get('/laporan/mutasi', [LaporanController::class, 'exportMutasi']);
Route::get('/laporan/stok-opname', [LaporanController::class, 'exportStockOpname']);
