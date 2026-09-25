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
        $nama = $this->normalisasiNama($request->input('nama_lokasi'));
        $kategori = $this->normalisasiKategori($request->input('kategori'));

        if ($nama === '') {
            return $this->fail('nama_lokasi wajib');
        }

        try {
            $lokasi = Lokasi::create([
                'nama_lokasi' => $nama,
                'kategori' => $kategori !== '' ? $kategori : $nama,
                'created_at' => now(),
            ]);

            return $this->okMessage('', ['id_lokasi' => $lokasi->id_lokasi]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal menambah lokasi');
        }
    }

    /** Normalisasi nama lokasi: trim + maksimum 50 karakter. */
    private function normalisasiNama(mixed $value): string
    {
        return mb_substr(trim((string) $value), 0, 50);
    }

    /** Normalisasi kategori: trim + UPPERCASE + maksimum 50 karakter (konsisten dgn grouping uppercased). */
    private function normalisasiKategori(mixed $value): string
    {
        return mb_substr(strtoupper(trim((string) $value)), 0, 50);
    }

    public function update(Request $request, int $id)
    {
        $idLokasi = (int) ($request->input('id_lokasi') ?? $id);

        if ($idLokasi <= 0) {
            return $this->fail('id_lokasi wajib');
        }

        $lokasi = Lokasi::find($idLokasi);
        if (! $lokasi) {
            return $this->fail('id_lokasi tidak ditemukan', 404);
        }

        if ($request->has('nama_lokasi')) {
            $nama = $this->normalisasiNama($request->input('nama_lokasi'));
            if ($nama === '') {
                return $this->fail('nama_lokasi wajib');
            }
            $lokasi->nama_lokasi = $nama;
        }

        if ($request->has('kategori')) {
            $lokasi->kategori = $this->normalisasiKategori($request->input('kategori'));
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
