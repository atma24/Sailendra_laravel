<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Produk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProdukController extends Controller
{
    use ApiResponse;

    private const SATUAN = ['GALLON', 'BOX', 'MP'];

    public function index(Request $request)
    {
        $keyword = trim((string) ($request->query('cari') ?: $request->query('q')));
        $satuan = trim((string) $request->query('satuan'));
        $hal = max(1, (int) $request->query('hal', 1));
        $limit = max(1, min(100, (int) $request->query('limit', 100)));

        $query = Produk::query()
            ->when($keyword, fn ($q) => $q->where(fn ($qq) => $qq
                ->where('nama_produk', 'like', "%{$keyword}%")
                ->orWhere('id_produk', 'like', "%{$keyword}%")))
            ->when($satuan, fn ($q) => $q->where('satuan', $satuan))
            ->orderBy('id_produk')
            ->offset(($hal - 1) * $limit)
            ->limit($limit);

        return $this->ok($query->get());
    }

    public function store(Request $request)
    {
        $idProduk = (int) ($request->input('id_produk') ?? 0);
        $namaProduk = trim((string) $request->input('nama_produk'));
        $satuan = trim((string) $request->input('satuan'));
        $isiPerPcs = $request->input('isi_per_pcs');

        if ($idProduk <= 0 || $namaProduk === '' || $satuan === '' || $isiPerPcs === null) {
            return $this->fail('Field wajib: id_produk, nama_produk, satuan, isi_per_pcs');
        }

        if (! in_array($satuan, self::SATUAN, true)) {
            return $this->fail('Satuan tidak valid (GALLON/BOX/MP)');
        }

        if ($isiPerPcs <= 0) {
            return $this->fail('Isi per pcs harus lebih dari 0');
        }

        if (Produk::whereKey($idProduk)->exists()) {
            return $this->fail('ID produk sudah digunakan');
        }

        try {
            Produk::create([
                'id_produk' => $idProduk,
                'nama_produk' => $namaProduk,
                'satuan' => $satuan,
                'isi_per_pcs' => $isiPerPcs,
                'created_at' => now(),
            ]);

            return $this->okMessage('Produk ditambahkan', ['id_produk' => $idProduk]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal tambah produk: '.$e->getMessage(), 500);
        }
    }

    public function update(Request $request, int $id)
    {
        $idProduk = (int) ($request->input('id_produk') ?? $id);

        if ($idProduk <= 0) {
            return $this->fail('id_produk wajib');
        }

        $produk = Produk::find($idProduk);
        if (! $produk) {
            return $this->fail('Produk tidak ditemukan', 404);
        }

        if ($request->has('nama_produk')) {
            $namaProduk = trim((string) $request->input('nama_produk'));
            if ($namaProduk === '') {
                return $this->fail('Nama produk wajib diisi');
            }
            $produk->nama_produk = $namaProduk;
        }

        if ($request->has('satuan')) {
            $satuan = trim((string) $request->input('satuan'));
            if (! in_array($satuan, self::SATUAN, true)) {
                return $this->fail('Satuan tidak valid (GALLON/BOX/MP)');
            }
            $produk->satuan = $satuan;
        }

        if ($request->has('isi_per_pcs')) {
            $isiPerPcs = (int) $request->input('isi_per_pcs');
            if ($isiPerPcs <= 0) {
                return $this->fail('Isi per pcs harus lebih dari 0');
            }
            $produk->isi_per_pcs = $isiPerPcs;
        }

        if (! $produk->isDirty()) {
            return $this->fail('Tidak ada perubahan');
        }

        $produk->save();

        return $this->okMessage('Produk diperbarui');
    }

    public function destroy(Request $request, int $id)
    {
        $idProduk = (int) ($request->input('id_produk') ?? $id);

        if ($idProduk <= 0) {
            return $this->fail('id_produk wajib');
        }

        foreach (['barang_masuk', 'barang_keluar', 'stok_gudang', 'prioritas_lokasi_produk', 'mutasi', 'stok_opname'] as $table) {
            if (DB::selectOne("SELECT 1 FROM {$table} WHERE id_produk = ? LIMIT 1", [$idProduk])) {
                return $this->fail('Tidak bisa hapus: produk sudah dipakai');
            }
        }

        $deleted = Produk::destroy($idProduk);

        return $this->okMessage(
            $deleted > 0 ? 'Produk dihapus' : 'Tidak ada data dihapus',
            ['deleted' => $deleted]
        );
    }
}
