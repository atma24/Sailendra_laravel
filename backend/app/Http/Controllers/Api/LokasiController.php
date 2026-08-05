<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Block;
use App\Models\Lokasi;
use Illuminate\Http\Request;

class LokasiController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $q = trim((string) $request->query('q'));

        $query = Lokasi::query()
            ->when($q !== '', fn ($qq) => $qq->where(fn ($w) => $w
                ->where('nama_lokasi', 'like', "%{$q}%")
                ->orWhere('kategori', 'like', "%{$q}%")))
            ->orderBy('nama_lokasi');

        return $this->ok($query->get());
    }

    public function store(Request $request)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $nama = trim((string) $request->input('nama_lokasi'));
        $kategori = trim((string) $request->input('kategori'));

        if ($nama === '') {
            return $this->fail('nama_lokasi wajib');
        }

        try {
            $lokasi = Lokasi::create([
                'nama_lokasi' => $nama,
                'kategori' => $kategori,
                'created_at' => now(),
            ]);

            return $this->okMessage('', ['id_lokasi' => $lokasi->id_lokasi]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal menambah lokasi');
        }
    }

    public function update(Request $request, int $id)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idLokasi = (int) ($request->input('id_lokasi') ?? $id);

        if ($idLokasi <= 0) {
            return $this->fail('id_lokasi wajib');
        }

        $lokasi = Lokasi::find($idLokasi);
        if (! $lokasi) {
            return $this->fail('id_lokasi tidak ditemukan', 404);
        }

        if ($request->has('nama_lokasi')) {
            $lokasi->nama_lokasi = $request->input('nama_lokasi');
        }

        if ($request->has('kategori')) {
            $lokasi->kategori = $request->input('kategori');
        }

        if (! $lokasi->isDirty()) {
            return $this->fail('Tidak ada data diubah');
        }

        if (! $lokasi->save()) {
            return $this->fail('Gagal mengubah lokasi');
        }

        return $this->okMessage('');
    }

    public function destroy(Request $request, int $id)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idLokasi = (int) ($request->input('id_lokasi') ?? $id);

        if ($idLokasi <= 0) {
            return $this->fail('id_lokasi wajib');
        }

        if (Block::where('id_lokasi', $idLokasi)->exists()) {
            return $this->fail('Tidak bisa hapus: masih ada block di lokasi ini');
        }

        $ok = Lokasi::destroy($idLokasi);

        return $this->okMessage($ok ? '' : 'Gagal menghapus lokasi');
    }
}
