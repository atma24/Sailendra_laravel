<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Pengguna;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    use ApiResponse;

    public function login(Request $request)
    {
        $username = trim((string) $request->input('username'));
        $pass = (string) $request->input('password');

        if ($username === '' || $pass === '') {
            return $this->fail('username dan password wajib diisi');
        }

        $rows = Pengguna::query()
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'pengguna.id_pengguna_lokasi')
            ->select(
                'pengguna.id_pengguna',
                'pengguna.id_pengguna_lokasi',
                'pengguna.username',
                'pengguna.password',
                'pengguna.role',
                'pengguna.status',
                'pengguna.created_at',
                'pl.nama_pengguna_lokasi'
            )
            ->where('pengguna.username', $username)
            ->get();

        $akunValid = [];
        $adaUserNonaktif = false;

        foreach ($rows as $row) {
            $valid = Hash::check($pass, $row->password) || hash_equals($row->password, $pass);

            if (! $valid) {
                continue;
            }

            if ($row->status !== 'Aktif') {
                $adaUserNonaktif = true;
                continue;
            }

            $akunValid[] = [
                'id_pengguna' => $row->id_pengguna,
                'id_pengguna_lokasi' => $row->id_pengguna_lokasi,
                'username' => $row->username,
                'role' => $row->role,
                'status' => $row->status,
                'created_at' => $row->created_at,
                'nama_pengguna_lokasi' => $row->nama_pengguna_lokasi,
            ];
        }

        if (empty($akunValid)) {
            return $adaUserNonaktif
                ? $this->fail('Akun tidak aktif, Hubungi Supervisor.', 403)
                : $this->fail('Username atau password salah.', 401);
        }

        $row = $akunValid[0];
        $role = trim((string) ($row['role'] ?? ''));
        $row['perlu_pilih_lokasi'] = (strcasecmp($role, 'Support') === 0 || strcasecmp($role, 'SuperAdmin') === 0);
        $row['akun_lokasi'] = $akunValid;

        // --- GENERATE TOKEN SANCTUM ---
        $user = Pengguna::find($row['id_pengguna']);
        
        // Hapus token lama agar 1 user tidak menumpuk token di database (opsional)
        $user->tokens()->delete();

        $token = $user->createToken('auth_token')->plainTextToken;
        
        // Masukkan token ke response JSON
        $row['token'] = $token;

        return $this->ok($row, 'Login berhasil');
    }

    public function logout(Request $request)
    {
        // Menghapus token yang sedang digunakan
        $request->user()->currentAccessToken()->delete();
        
        return $this->okMessage('Logout berhasil');
    }

    public function me(Request $request)
    {
        $user = $request->user();

        $row = Pengguna::query()
            ->leftJoin('pengguna_lokasi as pl', 'pl.id_pengguna_lokasi', '=', 'pengguna.id_pengguna_lokasi')
            ->select(
                'pengguna.id_pengguna',
                'pengguna.id_pengguna_lokasi',
                'pengguna.username',
                'pengguna.role',
                'pengguna.status',
                'pengguna.created_at',
                'pl.nama_pengguna_lokasi'
            )
            ->where('pengguna.id_pengguna', $user->id_pengguna)
            ->first();

        if (! $row || $row->status !== 'Aktif') {
            return $this->fail('Sesi tidak valid.', 401);
        }

        return $this->ok($row->toArray(), 'Sesi valid');
    }
}