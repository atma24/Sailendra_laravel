<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Pengguna;
use App\Models\PenggunaLokasi;
use Illuminate\Http\Request;

class PenggunaController extends Controller
{
    use ApiResponse;

    private const ROLE = ['Supervisor', 'Checker', 'Forklift', 'Support', 'SuperAdmin'];

    private const STATUS = ['Aktif', 'Nonaktif'];

    public function index(Request $request)
    {
        $id = (int) $request->query('id_pengguna', 0);
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));
        $role = trim((string) $request->query('role'));
        $status = trim((string) $request->query('status'));
        $q = trim((string) $request->query('q'));

        $query = Pengguna::query()
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'pengguna.id_pengguna_lokasi')
            ->select(
                'pengguna.id_pengguna',
                'pengguna.id_pengguna_lokasi',
                'pl.nama_pengguna_lokasi',
                'pengguna.username',
                'pengguna.role',
                'pengguna.status',
                'pengguna.created_at'
            )
            ->when($id > 0, fn ($qq) => $qq->where('pengguna.id_pengguna', $id))
            ->when($idPenggunaLokasi !== '', fn ($qq) => $qq->where('pengguna.id_pengguna_lokasi', $idPenggunaLokasi))
            ->when($role !== '', fn ($qq) => $qq->whereRaw('LOWER(pengguna.role) = LOWER(?)', [$role]))
            ->when($status !== '', fn ($qq) => $qq->whereRaw('LOWER(pengguna.status) = LOWER(?)', [$status]))
            ->when($q !== '', fn ($qq) => $qq->where(fn ($w) => $w
                ->where('pengguna.username', 'like', "%{$q}%")
                ->orWhere('pl.nama_pengguna_lokasi', 'like', "%{$q}%")))
            ->orderBy('pengguna.username');

        $data = $query->get();

        return $this->ok($data, $data->count() ? 'OK' : ($id > 0 ? 'Data pengguna tidak ditemukan' : 'Tidak ada data pengguna'));
    }

    public function store(Request $request)
    {
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));
        $username = trim((string) $request->input('username'));
        $pass = (string) $request->input('password');
        $role = trim((string) ($request->input('role') ?? 'Supervisor'));
        $status = trim((string) ($request->input('status') ?? 'Aktif'));

        if ($idPenggunaLokasi === '' || $username === '' || $pass === '') {
            return $this->fail('id_pengguna_lokasi, username, dan password wajib diisi');
        }

        if (! in_array($role, self::ROLE, true)) {
            return $this->fail('Role tidak valid (Supervisor/Checker/Forklift/Support/SuperAdmin)');
        }

        if (! in_array($status, self::STATUS, true)) {
            return $this->fail('Status tidak valid (Aktif/Nonaktif)');
        }

        if (! PenggunaLokasi::whereKey($idPenggunaLokasi)->exists()) {
            return $this->fail('id_pengguna_lokasi tidak ditemukan di tabel pengguna_lokasi');
        }

        if (Pengguna::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('username', $username)
            ->exists()) {
            return $this->fail('Username sudah dipakai pada lokasi pengguna ini');
        }

        $pengguna = Pengguna::create([
            'id_pengguna_lokasi' => $idPenggunaLokasi,
            'username' => $username,
            'password' => $pass,
            'role' => $role,
            'status' => $status,
            'created_at' => now(),
        ]);

        return $this->okMessage('Pengguna ditambahkan', [
            'id_pengguna' => $pengguna->id_pengguna,
            'id_pengguna_lokasi' => $idPenggunaLokasi,
            'username' => $username,
            'role' => $role,
            'status' => $status,
        ]);
    }

    public function update(Request $request, int $id)
    {
        $idPengguna = (int) ($request->input('id_pengguna') ?? $id);

        if ($idPengguna <= 0) {
            return $this->fail('id_pengguna wajib');
        }

        $pengguna = Pengguna::find($idPengguna);

        if (! $pengguna) {
            return $this->fail('Pengguna tidak ditemukan', 404);
        }

        $idPenggunaLokasi = $request->has('id_pengguna_lokasi') ? trim((string) $request->input('id_pengguna_lokasi')) : null;
        $username = $request->has('username') ? trim((string) $request->input('username')) : null;
        $pass = $request->has('password') ? (string) $request->input('password') : null;
        $role = $request->has('role') ? trim((string) $request->input('role')) : null;
        $status = $request->has('status') ? trim((string) $request->input('status')) : null;

        if ($role !== null && ! in_array($role, self::ROLE, true)) {
            return $this->fail('Role tidak valid. Gunakan: Supervisor/Checker/Forklift/Support/SuperAdmin');
        }

        if ($status !== null && ! in_array($status, self::STATUS, true)) {
            return $this->fail('Status tidak valid. Gunakan: Aktif/Nonaktif');
        }

        $idPenggunaLokasiFinal = ($idPenggunaLokasi !== null && $idPenggunaLokasi !== '')
            ? $idPenggunaLokasi
            : (string) $pengguna->id_pengguna_lokasi;

        if ($idPenggunaLokasi !== null && $idPenggunaLokasi !== ''
            && ! PenggunaLokasi::whereKey($idPenggunaLokasi)->exists()) {
            return $this->fail('id_pengguna_lokasi tidak ditemukan di tabel pengguna_lokasi');
        }

        if ($username !== null && $username !== ''
            && Pengguna::where('id_pengguna_lokasi', $idPenggunaLokasiFinal)
                ->where('username', $username)
                ->whereKeyNot($idPengguna)
                ->exists()) {
            return $this->fail('Username sudah dipakai pada lokasi pengguna ini');
        }

        $dirty = false;

        if ($idPenggunaLokasi !== null && $idPenggunaLokasi !== '') {
            $pengguna->id_pengguna_lokasi = $idPenggunaLokasi;
            $dirty = true;
        }

        if ($username !== null && $username !== '') {
            $pengguna->username = $username;
            $dirty = true;
        }

        if ($role !== null) {
            $pengguna->role = $role;
            $dirty = true;
        }

        if ($status !== null) {
            $pengguna->status = $status;
            $dirty = true;
        }

        if ($pass !== null && $pass !== '') {
            $pengguna->password = $pass;
            $dirty = true;
        }

        if (! $dirty) {
            return $this->fail('Tidak ada perubahan');
        }

        $pengguna->save();

        return $this->okMessage('Pengguna diperbarui', [
            'affected' => 1,
            'id_pengguna' => $idPengguna,
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $idPengguna = (int) ($request->input('id_pengguna') ?? $id);

        if ($idPengguna <= 0) {
            return $this->fail('id_pengguna wajib');
        }

        if (! Pengguna::whereKey($idPengguna)->exists()) {
            return $this->fail('Pengguna tidak ditemukan', 404);
        }

        $deleted = Pengguna::destroy($idPengguna);

        return $this->okMessage('Pengguna dihapus', [
            'deleted' => $deleted,
            'id_pengguna' => $idPengguna,
        ]);
    }
}
