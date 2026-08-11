<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Deep;
use App\Models\Level;
use App\Models\Line;
use App\Models\StokGudangDeep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LevelController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $idLine = (int) ($request->input('id_line', $request->query('id_line', 0)));

        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof JsonResponse) {
            return $idPenggunaLokasi;
        }

        if ($idLine <= 0) {
            return $this->fail('id_line wajib');
        }

        $data = Level::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('id_line', $idLine)
            ->orderBy('level')
            ->get(['id_level', 'id_line', 'level']);

        return $this->ok($data);
    }

    public function store(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idLine = (int) $request->input('id_line', 0);

        $levelRaw = trim((string) ($request->input('level') ?? $request->input('label_level') ?? $request->input('label')));
        $levelRaw = preg_replace('/[^0-9]/', '', $levelRaw);
        $levelInt = (int) $levelRaw;

        if ($idLine <= 0 || $levelInt <= 0) {
            return $this->fail('id_line, dan level wajib');
        }

        if (! Line::where('id_pengguna_lokasi', $idPenggunaLokasi)->whereKey($idLine)->exists()) {
            return $this->fail('id_line tidak ditemukan pada lokasi aktif');
        }

        $totalStok = StokGudangDeep::totalStokLine($idPenggunaLokasi, $idLine);

        if ($totalStok > 0) {
            return $this->fail('Line masih memiliki stok, kosongkan stok terlebih dahulu sebelum menambah level.');
        }

        try {
            $level = Level::create([
                'id_pengguna_lokasi' => $idPenggunaLokasi,
                'id_line' => $idLine,
                'level' => $levelInt,
                'created_at' => now(),
            ]);

            return $this->okMessage('Level berhasil dibuat', ['id_level' => $level->id_level]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal menambah/mendapatkan level');
        }
    }

    public function update(Request $request, int $id)
    {
        $idLevel = (int) ($request->input('id_level') ?? $id);
        $targetLevel = $request->has('level') ? (int) $request->input('level') : null;
        $targetLine = $request->has('id_line') ? (int) $request->input('id_line') : null;

        if ($idLevel <= 0) {
            return $this->fail('id_level wajib');
        }

        if ($targetLevel !== null && $targetLevel <= 0) {
            return $this->fail('level tidak boleh kosong');
        }

        if ($targetLevel === null && $targetLine === null) {
            return $this->fail('Tidak ada perubahan (isi level atau id_line)');
        }

        $level = Level::find($idLevel);

        if (! $level) {
            return $this->fail('id_level tidak ditemukan');
        }

        $idLineLama = (int) $level->id_line;
        $levelLama = (int) $level->level;

        $targetLine = $targetLine ?? $idLineLama;
        $targetLevel = $targetLevel ?? $levelLama;

        if ($targetLine !== $idLineLama && ! Line::whereKey($targetLine)->exists()) {
            return $this->fail('id_line tujuan tidak ditemukan');
        }

        $dup = Level::where('id_line', $targetLine)
            ->where('level', $targetLevel)
            ->whereKeyNot($idLevel)
            ->exists();

        if ($dup) {
            return $this->fail('Level sudah ada pada line ini');
        }

        if ($targetLine === $idLineLama && $targetLevel === $levelLama) {
            return $this->okMessage('', [
                'id_level' => $idLevel,
                'id_line' => $idLineLama,
                'level' => $levelLama,
                'note' => 'Tidak ada perubahan',
            ]);
        }

        $level->update(['id_line' => $targetLine, 'level' => $targetLevel]);

        return $this->okMessage('', [
            'id_level' => $idLevel,
            'id_line' => $targetLine,
            'level' => $targetLevel,
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idLevel = (int) ($request->input('id_level') ?? $id);

        if ($idLevel <= 0) {
            return $this->fail('id_level wajib');
        }

        $level = Level::where('id_pengguna_lokasi', $idPenggunaLokasi)->whereKey($idLevel)->first();

        if (! $level) {
            return $this->fail('id_level tidak ditemukan pada lokasi aktif');
        }

        $totalStok = StokGudangDeep::totalStokLine($idPenggunaLokasi, (int) $level->id_line);

        if ($totalStok > 0) {
            return $this->fail('Line masih memiliki stok, kosongkan stok terlebih dahulu sebelum menghapus level.');
        }

        try {
            DB::transaction(function () use ($idPenggunaLokasi, $idLevel) {
                DB::table('rencana_keluar_deep as rk')
                    ->join('deep as d', fn ($j) => $j
                        ->on('d.id_deep', '=', 'rk.id_deep')
                        ->on('d.id_pengguna_lokasi', '=', 'rk.id_pengguna_lokasi'))
                    ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('d.id_level', $idLevel)
                    ->delete();

                DB::table('stok_gudang_deep as sgd')
                    ->join('deep as d', fn ($j) => $j
                        ->on('d.id_deep', '=', 'sgd.id_deep')
                        ->on('d.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
                    ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('d.id_level', $idLevel)
                    ->delete();

                Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_level', $idLevel)
                    ->delete();

                if (Level::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereKey($idLevel)
                    ->delete() <= 0) {
                    throw new \Exception('Gagal menghapus level');
                }
            });

            return $this->okMessage('Level berhasil dihapus');
        } catch (\Throwable $e) {
            return $this->fail('Gagal menghapus level');
        }
    }
}
