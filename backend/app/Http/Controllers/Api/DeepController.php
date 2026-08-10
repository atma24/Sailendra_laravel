<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Deep;
use App\Models\Level;
use App\Models\StokGudangDeep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeepController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $idLevel = (int) $request->query('id_level', 0);

        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof JsonResponse) {
            return $idPenggunaLokasi;
        }

        if ($idLevel <= 0) {
            return $this->fail('id_level wajib');
        }

        $data = DB::table('deep as d')
            ->leftJoinSub(
                DB::table('stok_gudang_deep as sd')
                    ->join('stok_gudang as sg', 'sg.id_stok', '=', 'sd.id_stok_header')
                    ->where('sd.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('sg.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('sg.jumlah_sisa', '>', 0)
                    ->select('sd.id_deep', DB::raw('SUM(sd.jumlah) AS terisi'))
                    ->groupBy('sd.id_deep'),
                's',
                's.id_deep',
                '=',
                'd.id_deep'
            )
            ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('d.id_level', $idLevel)
            ->orderBy('d.deep')
            ->orderBy('d.id_deep')
            ->select('d.id_deep', 'd.id_level', 'd.deep', 'd.kapasitas', 'd.created_at')
            ->selectRaw('COALESCE(s.terisi,0) AS terisi, (d.kapasitas - COALESCE(s.terisi,0)) AS sisa')
            ->get();

        return $this->ok($data);
    }

    public function store(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idLevel = (int) $request->input('id_level', 0);
        $jumlahDeep = (int) $request->input('jumlah_deep', 0);
        $kapasitas = (int) $request->input('kapasitas', 0);

        if ($idLevel <= 0 || $jumlahDeep <= 0 || $kapasitas <= 0) {
            return $this->fail('id_level, jumlah_deep, kapasitas wajib > 0');
        }

        $level = Level::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereKey($idLevel)
            ->first(['id_line']);

        if (! $level) {
            return $this->fail('id_level tidak ditemukan pada lokasi aktif');
        }

        if (StokGudangDeep::totalStokLine($idPenggunaLokasi, (int) $level->id_line) > 0) {
            return $this->fail('Line masih memiliki stok, kosongkan stok terlebih dahulu sebelum menambah deep.');
        }

        try {
            $mulai = ((int) Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('id_level', $idLevel)
                ->max('deep')) + 1;

            DB::transaction(function () use ($idPenggunaLokasi, $idLevel, $jumlahDeep, $kapasitas, $mulai) {
                for ($i = 0; $i < $jumlahDeep; $i++) {
                    Deep::create([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_level' => $idLevel,
                        'deep' => $mulai + $i,
                        'kapasitas' => $kapasitas,
                        'created_at' => now(),
                    ]);
                }
            });

            return $this->okMessage('Deep berhasil ditambahkan');
        } catch (\Throwable $e) {
            return $this->fail('Gagal membuat deep');
        }
    }

    public function update(Request $request, int $id)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idDeep = (int) ($request->input('id_deep') ?? $id);

        if ($idDeep <= 0) {
            return $this->fail('id_deep wajib');
        }

        $deep = Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereKey($idDeep)
            ->first();

        if (! $deep) {
            return $this->fail('id_deep tidak ditemukan pada lokasi aktif');
        }

        $deepBaru = $request->has('deep') ? (int) $request->input('deep') : null;
        $kapBaru = $request->has('kapasitas') ? (int) $request->input('kapasitas') : null;

        if ($deepBaru !== null && $deepBaru <= 0) {
            return $this->fail('Deep wajib > 0');
        }

        if ($kapBaru !== null && $kapBaru <= 0) {
            return $this->fail('Kapasitas wajib > 0');
        }

        if ($deepBaru === null && $kapBaru === null) {
            return $this->fail('Tidak ada data diubah');
        }

        $idLine = (int) Level::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereKey($deep->id_level)
            ->value('id_line');

        if (StokGudangDeep::totalStokLine($idPenggunaLokasi, $idLine) > 0) {
            return $this->fail('Line masih memiliki stok. Kosongkan stok terlebih dahulu sebelum mengubah deep atau kapasitas.');
        }

        if ($deepBaru !== null && $deepBaru !== (int) $deep->deep) {
            $dup = Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
                ->where('id_level', $deep->id_level)
                ->where('deep', $deepBaru)
                ->whereKeyNot($idDeep)
                ->exists();

            if ($dup) {
                return $this->fail('Deep sudah ada pada level ini');
            }
        }

        $now = [
            'id_deep' => $idDeep,
            'id_level' => (int) $deep->id_level,
            'deep' => (int) $deep->deep,
            'kapasitas' => (int) $deep->kapasitas,
        ];

        if ($deepBaru !== null) {
            $deep->deep = $deepBaru;
            $now['deep'] = $deepBaru;
        }

        if ($kapBaru !== null) {
            $deep->kapasitas = $kapBaru;
            $now['kapasitas'] = $kapBaru;
        }

        $ok = $deep->save();

        if (! $ok) {
            return $this->fail('Gagal mengubah deep');
        }

        return $this->okMessage('Deep berhasil diubah', $now);
    }

    public function destroy(Request $request, int $id)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idDeep = (int) ($request->input('id_deep') ?? $id);

        if ($idDeep <= 0) {
            return $this->fail('id_deep wajib');
        }

        $deep = Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereKey($idDeep)
            ->first();

        if (! $deep) {
            return $this->fail('id_deep tidak ditemukan pada lokasi aktif');
        }

        $idLine = (int) Level::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->whereKey($deep->id_level)
            ->value('id_line');

        if (StokGudangDeep::totalStokLine($idPenggunaLokasi, $idLine) > 0) {
            return $this->fail('Line masih memiliki stok, kosongkan stok terlebih dahulu sebelum menghapus deep.');
        }

        try {
            DB::transaction(function () use ($idPenggunaLokasi, $idDeep) {
                DB::table('rencana_keluar_deep')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_deep', $idDeep)
                    ->delete();

                if (Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereKey($idDeep)
                    ->delete() <= 0) {
                    throw new \Exception('Gagal menghapus deep');
                }
            });

            return $this->okMessage('Deep berhasil dihapus');
        } catch (\Throwable $e) {
            return $this->fail('Gagal menghapus deep');
        }
    }
}
