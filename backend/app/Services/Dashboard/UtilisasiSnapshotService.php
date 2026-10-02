<?php

namespace App\Services\Dashboard;

use App\Support\Dashboard\LokasiFilter;
use Illuminate\Support\Facades\DB;

/**
 * Menyusun & menyimpan snapshot harian card "Warehouse Utilization".
 *
 * Memakai ulang method StockService yang sama dengan dashboard sehingga
 * angka snapshot identik dengan yang tampil di card.
 */
class UtilisasiSnapshotService
{
    public function __construct(
        private readonly StockService $stock,
    ) {}

    /**
     * Daftar depo aktif (id_pengguna_lokasi).
     *
     * @return array<int,string>
     */
    public function daftarDepo(): array
    {
        return DB::table('pengguna_lokasi')
            ->orderBy('id_pengguna_lokasi')
            ->pluck('id_pengguna_lokasi')
            ->map(fn ($v) => (string) $v)
            ->toArray();
    }

    /**
     * Susun payload card Warehouse Utilization untuk 1 depo.
     *
     * @return array<string,mixed>
     */
    public function payload(string $idPenggunaLokasi): array
    {
        $lokasiFilter = LokasiFilter::normalize([$idPenggunaLokasi]);

        $regular = $this->stock->storageRegular($lokasiFilter);
        $luar = $this->stock->storageLuar($lokasiFilter);

        return [
            'produk_realtime' => $this->stock->produkRealtime($lokasiFilter),
            'storage_regular' => $regular,
            'storage_luar' => $luar,
            'gallon_breakdown' => $this->stock->gallonBreakdown($lokasiFilter),
            'gallon_zona' => $this->stock->gallonJugByZona($lokasiFilter),
            'produk_per_kategori' => $this->stock->produkPerKategori($lokasiFilter),
        ];
    }

    /**
     * Simpan (upsert) snapshot 1 depo pada tanggal tertentu.
     *
     * @param  array<string,mixed>  $payload
     */
    public function simpan(string $tanggal, string $idPenggunaLokasi, array $payload): void
    {
        $rt = $payload['produk_realtime'] ?? [];
        $reg = $payload['storage_regular'] ?? [];
        $luar = $payload['storage_luar'] ?? [];
        $gb = $payload['gallon_breakdown'] ?? [];

        $baris = [
            'produk_total' => (int) ($rt['total_produk'] ?? 0),
            'produk_qty' => (int) ($rt['total_qty'] ?? 0),
            'dalam_terpakai' => (int) ($reg['terpakai'] ?? 0),
            'dalam_kapasitas' => (int) ($reg['kapasitas'] ?? 0),
            'dalam_persen' => (float) ($reg['persen'] ?? 0),
            'luar_terpakai' => (int) ($luar['terpakai'] ?? 0),
            'luar_kapasitas' => (int) ($luar['kapasitas'] ?? 0),
            'luar_persen' => (float) ($luar['persen'] ?? 0),

            'gallon_vip' => (int) ($gb['gallon']['vip'] ?? 0),
            'gallon_aqua' => (int) ($gb['gallon']['aqua'] ?? 0),
            'gallon_vit' => (int) ($gb['gallon']['vit'] ?? 0),
            'jug_aqua' => (int) ($gb['jug']['aqua'] ?? 0),
            'jug_vit' => (int) ($gb['jug']['vit'] ?? 0),

            'detail' => json_encode([
                'produk_realtime' => $payload['produk_realtime'] ?? null,
                'gallon_breakdown' => $payload['gallon_breakdown'] ?? null,
                'gallon_zona' => $payload['gallon_zona'] ?? null,
                'produk_per_kategori' => $payload['produk_per_kategori'] ?? null,
            ], JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
            'created_at' => now(),
        ];

        // Ringkasan qty & kapasitas per zona dari produk_per_kategori.
        foreach ($this->ringkasZona($payload['produk_per_kategori'] ?? []) as $zona => $nilai) {
            $baris['zona_'.$zona.'_qty'] = $nilai['qty'];
            $baris['zona_'.$zona.'_kapasitas'] = $nilai['kapasitas'];
        }

        DB::table('utilisasi_gudang_harian')->updateOrInsert(
            ['tanggal' => $tanggal, 'id_pengguna_lokasi' => $idPenggunaLokasi],
            $baris
        );
    }

    /**
     * Jumlahkan qty & kapasitas tiap zona dari seluruh produk per kategori.
     *
     * @param  array<string,array{items?:array<int,array{zona?:array<string,array{qty:int,kapasitas:int}>}>}>  $perKategori
     * @return array<string,array{qty:int,kapasitas:int}>
     */
    private function ringkasZona(array $perKategori): array
    {
        $zonaList = ['reguler', 'mobil', 'transit', 'bad_reject'];
        $out = array_fill_keys($zonaList, ['qty' => 0, 'kapasitas' => 0]);

        foreach ($perKategori as $kategori) {
            foreach (($kategori['items'] ?? []) as $item) {
                foreach ($zonaList as $zona) {
                    $z = $item['zona'][$zona] ?? null;
                    if ($z === null) {
                        continue;
                    }
                    $out[$zona]['qty'] += (int) ($z['qty'] ?? 0);
                    $out[$zona]['kapasitas'] += (int) ($z['kapasitas'] ?? 0);
                }
            }
        }

        return $out;
    }

    /**
     * Jalankan snapshot untuk semua depo (atau sebagian) pada tanggal tertentu.
     *
     * @param  array<int,string>|null  $depoFilter
     * @return array{tanggal:string,jumlah:int,depo:array<int,string>}
     */
    public function jalankan(string $tanggal, ?array $depoFilter = null): array
    {
        $depo = $depoFilter ?: $this->daftarDepo();

        foreach ($depo as $id) {
            $this->simpan($tanggal, (string) $id, $this->payload((string) $id));
        }

        return ['tanggal' => $tanggal, 'jumlah' => count($depo), 'depo' => $depo];
    }
}
