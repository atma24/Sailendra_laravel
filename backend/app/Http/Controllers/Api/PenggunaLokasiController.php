<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\PenggunaLokasi;
use Illuminate\Http\Request;

class PenggunaLokasiController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $q = trim((string) $request->query('q'));
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));

        $data = PenggunaLokasi::query()
            ->when($idPenggunaLokasi !== '', fn ($qq) => $qq->where('id_pengguna_lokasi', $idPenggunaLokasi))
            ->when($q !== '', fn ($qq) => $qq->where(fn ($w) => $w
                ->where('id_pengguna_lokasi', 'like', "%{$q}%")
                ->orWhere('nama_pengguna_lokasi', 'like', "%{$q}%")))
            ->orderBy('nama_pengguna_lokasi')
            ->orderBy('id_pengguna_lokasi')
            ->get(['id_pengguna_lokasi', 'nama_pengguna_lokasi']);

        return $this->ok($data);
    }
}
