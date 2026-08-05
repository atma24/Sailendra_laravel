<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Plant;
use Illuminate\Http\Request;

class PlantController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $q = trim((string) $request->query('q'));
        $idPlant = trim((string) $request->query('id_plant'));

        $query = Plant::query()
            ->when($idPlant !== '', fn ($qq) => $qq->where('id_plant', $idPlant))
            ->when($q !== '', fn ($qq) => $qq->where(fn ($w) => $w
                ->where('id_plant', 'like', "%{$q}%")
                ->orWhere('nama_plant', 'like', "%{$q}%")))
            ->orderBy('id_plant');

        $data = $query->get();

        return $this->ok($data, $data->count() ? 'OK' : 'Tidak ada data plant');
    }

    public function store(Request $request)
    {
        $idPlant = trim((string) $request->input('id_plant'));
        $namaPlant = trim((string) $request->input('nama_plant'));

        if ($idPlant === '' || $namaPlant === '') {
            return $this->fail('Field wajib: id_plant, nama_plant');
        }

        if (Plant::whereKey($idPlant)->exists()) {
            return $this->fail('ID plant sudah digunakan');
        }

        try {
            Plant::create(['id_plant' => $idPlant, 'nama_plant' => $namaPlant, 'created_at' => now()]);

            return $this->okMessage('Plant ditambahkan', ['id_plant' => $idPlant]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal tambah plant: '.$e->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        $idPlant = trim((string) ($request->input('id_plant') ?? $id));
        $namaPlant = trim((string) $request->input('nama_plant'));

        if ($idPlant === '' || $namaPlant === '') {
            return $this->fail('Field wajib: id_plant, nama_plant');
        }

        $plant = Plant::whereKey($idPlant)->first();
        if (! $plant) {
            return $this->fail('Plant tidak ditemukan', 404);
        }

        try {
            $plant->update(['nama_plant' => $namaPlant]);

            return $this->okMessage('Plant diubah', ['id_plant' => $idPlant]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal ubah plant: '.$e->getMessage(), 500);
        }
    }

    public function destroy(Request $request, string $id)
    {
        $idPlant = trim((string) ($request->input('id_plant') ?? $id));

        if ($idPlant === '') {
            return $this->fail('Field wajib: id_plant');
        }

        try {
            $affected = Plant::destroy($idPlant);

            if ($affected <= 0) {
                return $this->fail('Plant tidak ditemukan atau sudah dihapus', 404);
            }

            return $this->okMessage('Plant dihapus', ['id_plant' => $idPlant]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal hapus plant: '.$e->getMessage(), 500);
        }
    }
}
