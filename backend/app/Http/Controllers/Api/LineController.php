<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Block;
use App\Models\Deep;
use App\Models\Level;
use App\Models\Line;
use App\Models\PrioritasLokasiProduk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LineController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $idBlock = (int) $request->query('id_block', 0);
        $idPenggunaLokasi = trim((string) $request->query('id_pengguna_lokasi'));

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        if ($idBlock <= 0) {
            return $this->fail('id_block wajib');
        }

        $data = Line::where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('id_block', $idBlock)
            ->orderBy('nomor_line')
            ->get(['id_line', 'id_block', 'nomor_line']);

        return $this->ok($data);
    }

    public function store(Request $request)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idBlock = (int) $request->input('id_block', 0);
        $nomorTunggal = (int) $request->input('nomor_line', 0);
        $lineStr = trim((string) $request->input('line'));
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));

        if ($idPenggunaLokasi === '' || $idBlock <= 0) {
            return $this->fail('id_pengguna_lokasi & id_block wajib');
        }

        if ($nomorTunggal <= 0 && $lineStr === '') {
            return $this->fail('Isi nomor_line (angka) atau line (range/daftar)');
        }

        $targets = [];
        if ($nomorTunggal > 0) {
            $targets[] = $nomorTunggal;
        }
        if ($lineStr !== '') {
            $targets = array_merge($targets, $this->parseNumbers($lineStr));
        }
        $targets = array_values(array_unique($targets));

        if (empty($targets)) {
            return $this->fail('Daftar line kosong');
        }

        try {
            return DB::transaction(function () use ($idPenggunaLokasi, $idBlock, $targets) {
                if (! Block::where('id_pengguna_lokasi', $idPenggunaLokasi)->whereKey($idBlock)->exists()) {
                    throw new \Exception('id_block tidak ditemukan');
                }

                $made = [];
                foreach ($targets as $n) {
                    $line = Line::create([
                        'id_pengguna_lokasi' => $idPenggunaLokasi,
                        'id_block' => $idBlock,
                        'nomor_line' => $n,
                        'created_at' => now(),
                    ]);
                    $made[] = ['nomor_line' => $n, 'id_line' => $line->id_line];
                }

                return $this->okMessage('', ['line_dibuat' => $made]);
            });
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage() ?: 'Gagal menyimpan line');
        }
    }

    public function update(Request $request, int $id)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idLine = (int) ($request->input('id_line') ?? $id);
        $nomor = $request->has('nomor_line') ? (int) $request->input('nomor_line') : null;

        if ($idLine <= 0 || $nomor === null) {
            return $this->fail('id_line & nomor_line wajib');
        }

        $line = Line::find($idLine);
        if (! $line) {
            return $this->fail('Line tidak ditemukan', 404);
        }

        $line->nomor_line = $nomor;
        if (! $line->save()) {
            return $this->fail('Gagal mengubah line');
        }

        return $this->okMessage('');
    }

    public function destroy(Request $request, int $id)
    {
        if (! $this->isSupervisor($request->all())) {
            return $this->fail('Hak akses ditolak');
        }

        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi'));
        $idLine = (int) ($request->input('id_line') ?? $id);

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        if ($idLine <= 0) {
            return $this->fail('id_line wajib');
        }

        try {
            return DB::transaction(function () use ($idPenggunaLokasi, $idLine) {
                $line = Line::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereKey($idLine)
                    ->lockForUpdate()
                    ->first();

                if (! $line) {
                    return $this->fail('Line tidak ditemukan pada lokasi aktif');
                }

                $totalSisa = (int) DB::table('stok_gudang_deep as sgd')
                    ->join('deep as d', fn ($j) => $j
                        ->on('sgd.id_deep', '=', 'd.id_deep')
                        ->on('sgd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
                    ->join('level', fn ($j) => $j
                        ->on('d.id_level', '=', 'level.id_level')
                        ->on('d.id_pengguna_lokasi', '=', 'level.id_pengguna_lokasi'))
                    ->where('level.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('level.id_line', $idLine)
                    ->sum('sgd.jumlah');

                if ($totalSisa > 0) {
                    return $this->fail('Tidak bisa hapus: masih ada stok di line ini');
                }

                $levelIds = Level::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_line', $idLine)
                    ->pluck('id_level');

                DB::table('rencana_keluar_deep as rk')
                    ->join('deep as d', fn ($j) => $j
                        ->on('d.id_deep', '=', 'rk.id_deep')
                        ->on('d.id_pengguna_lokasi', '=', 'rk.id_pengguna_lokasi'))
                    ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereIn('d.id_level', $levelIds)
                    ->delete();

                DB::table('stok_gudang_deep as sgd')
                    ->join('deep as d', fn ($j) => $j
                        ->on('d.id_deep', '=', 'sgd.id_deep')
                        ->on('d.id_pengguna_lokasi', '=', 'sgd.id_pengguna_lokasi'))
                    ->where('d.id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereIn('d.id_level', $levelIds)
                    ->delete();

                PrioritasLokasiProduk::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_line', $idLine)
                    ->delete();

                Deep::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->whereIn('id_level', $levelIds)
                    ->delete();

                Level::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_line', $idLine)
                    ->delete();

                if ($line->delete()) {
                    return $this->okMessage('Line berhasil dihapus');
                }

                throw new \Exception('Gagal menghapus line');
            });
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage() ?: 'Gagal menghapus line');
        }
    }

    private function parseNumbers(string $raw): array
    {
        $raw = strtoupper(str_replace(' ', '', $raw));
        if ($raw === '') {
            return [];
        }

        $ret = [];
        foreach (explode(',', $raw) as $p) {
            if ($p === '') {
                continue;
            }

            if (strpos($p, '-') !== false) {
                [$a, $b] = explode('-', $p, 2);
                $a = (int) $a;
                $b = (int) $b;

                if ($a > $b) {
                    $t = $a;
                    $a = $b;
                    $b = $t;
                }

                for ($i = $a; $i <= $b; $i++) {
                    $ret[] = $i;
                }
            } else {
                $ret[] = (int) $p;
            }
        }

        return array_values(array_unique(array_filter($ret, fn ($x) => $x > 0)));
    }
}
