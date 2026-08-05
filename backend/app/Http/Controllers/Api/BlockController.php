<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Block;
use App\Models\Lokasi;
use App\Models\PrioritasLokasiProduk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BlockController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $idLokasi = (int) $request->query('id_lokasi', 0);
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        $query = Block::query()
            ->withCount(['lines' => fn ($q) => $q->where('id_pengguna_lokasi', $idPenggunaLokasi)])
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->when($idLokasi > 0, fn ($q) => $q->where('id_lokasi', $idLokasi))
            ->orderByRaw('CHAR_LENGTH(kode_block) ASC, kode_block ASC');

        $data = $query->get()->map(function ($b) {
            return [
                'id_block' => $b->id_block,
                'id_lokasi' => $b->id_lokasi,
                'kode_block' => $b->kode_block,
                'created_at' => $b->created_at,
                'jumlah_line' => $b->lines_count,
            ];
        });

        return $this->ok($data);
    }

    public function store(Request $request)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idLokasi = (int) $request->input('id_lokasi', 0);
        $kode = trim((string) $request->input('kode_block'));
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));

        if ($idPenggunaLokasi === '' || $idLokasi <= 0 || $kode === '') {
            return $this->fail('id_pengguna_lokasi, id_lokasi & kode_block wajib');
        }

        if (! Lokasi::whereKey($idLokasi)->exists()) {
            return $this->fail('id_lokasi tidak ditemukan');
        }

        try {
            $block = Block::create([
                'id_pengguna_lokasi' => $idPenggunaLokasi,
                'id_lokasi' => $idLokasi,
                'kode_block' => strtoupper($kode),
                'created_at' => now(),
            ]);

            return $this->okMessage('', ['id_block' => $block->id_block]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal menambah/mendapatkan block');
        }
    }

    public function update(Request $request, int $id)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idBlock = (int) ($request->input('id_block') ?? $id);
        $kode = $request->has('kode_block') ? trim((string) $request->input('kode_block')) : null;

        if ($idBlock <= 0 || $kode === null) {
            return $this->fail('id_block & kode_block wajib');
        }

        $block = Block::find($idBlock);
        if (! $block) {
            return $this->fail('Block tidak ditemukan', 404);
        }

        $block->kode_block = $kode;
        if (! $block->save()) {
            return $this->fail('Gagal mengubah block');
        }

        return $this->okMessage('');
    }

    public function destroy(Request $request, int $id)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));
        $idBlock = (int) ($request->input('id_block') ?? $id);

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        if ($idBlock <= 0) {
            return $this->fail('id_block wajib');
        }

        try {
            return DB::transaction(function () use ($idPenggunaLokasi, $idBlock) {
                $block = Block::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereKey($idBlock)
                    ->lockForUpdate()
                    ->first();

                if (! $block) {
                    return $this->fail('Block tidak ditemukan pada lokasi aktif');
                }

                if ((clone $block->lines())->where('id_pengguna_lokasi', $idPenggunaLokasi)->count() > 0) {
                    return $this->fail('Tidak bisa hapus block: masih ada line di dalam block ini');
                }

                PrioritasLokasiProduk::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_block', $idBlock)
                    ->delete();

                if ($block->delete()) {
                    return $this->okMessage('Block berhasil dihapus');
                }

                throw new \Exception('Gagal menghapus block');
            });
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage() ?: 'Gagal menghapus block');
        }
    }
}
