<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\PengaturanProduk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class PengaturanProdukController extends Controller
{
    use ApiResponse;

    /**
     * GET /pengaturan-produk?id_pengguna_lokasi=XX[&cari=..]
     * Daftar produk beserta pengaturannya (tanpa baris = default global).
     */
    public function index(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof \Illuminate\Http\JsonResponse) {
            return $idPenggunaLokasi;
        }

        $cari = trim((string) $request->input('cari', ''));

        $query = DB::table('produk as p')
            ->leftJoin('pengaturan_produk as pp', function ($j) use ($idPenggunaLokasi) {
                $j->on('pp.id_produk', '=', 'p.id_produk')
                    ->where('pp.id_pengguna_lokasi', '=', $idPenggunaLokasi);
            })
            ->select(
                'p.id_produk', 'p.nama_produk', 'p.satuan', 'p.tanpa_batch',
                'pp.id_pengaturan',
                'pp.ikut_fefo',
                'pp.urutan_blok'
            )
            ->orderBy('p.id_produk');

        if ($cari !== '') {
            $query->where(function ($q) use ($cari) {
                $q->where('p.nama_produk', 'LIKE', "%{$cari}%")
                    ->orWhere('p.id_produk', 'LIKE', "%{$cari}%");
            });
        }

        $rows = $query->get()->map(function ($r) {
            $arr = (array) $r;
            $arr['ikut_fefo'] = $arr['id_pengaturan'] === null ? true : (bool) $arr['ikut_fefo'];
            $arr['urutan_blok'] = PengaturanProduk::normalisasiUrutan($arr['urutan_blok']);
            $arr['is_default'] = $arr['id_pengaturan'] === null;

            return $arr;
        })->toArray();

        return $this->ok($rows);
    }

    /**
     * POST /pengaturan-produk
     * Upsert pengaturan per (lokasi, produk). Bila nilai akhir sama dengan
     * default global, baris justru dihapus (= kembali default).
     */
    public function store(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof \Illuminate\Http\JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idProduk = (int) $request->input('id_produk', 0);
        if ($idProduk <= 0) {
            return $this->fail('id_produk wajib');
        }
        if (! DB::table('produk')->where('id_produk', $idProduk)->exists()) {
            return $this->fail('Produk tidak ditemukan', 404);
        }
        if (! DB::table('pengguna_lokasi')->where('id_pengguna_lokasi', $idPenggunaLokasi)->exists()) {
            return $this->fail('Lokasi tidak ditemukan', 404);
        }

        if (! $request->has('ikut_fefo') && ! $request->has('urutan_blok')) {
            return $this->fail('Kirim ikut_fefo dan/atau urutan_blok');
        }

        $existing = DB::table('pengaturan_produk')
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('id_produk', $idProduk)
            ->first();

        $ikutFefo = $request->has('ikut_fefo')
            ? filter_var($request->input('ikut_fefo'), FILTER_VALIDATE_BOOLEAN)
            : ($existing ? (bool) $existing->ikut_fefo : true);

        $urutanFinal = PengaturanProduk::URUTAN_DEFAULT;
        if ($request->has('urutan_blok')) {
            $urutan = $request->input('urutan_blok');
            if (is_string($urutan)) {
                $urutan = json_decode($urutan, true);
            }
            if (! is_array($urutan)) {
                return $this->fail('urutan_blok wajib berupa array');
            }
            $atas = array_values(array_unique(array_map(
                fn ($v) => strtoupper(trim((string) $v)),
                $urutan
            )));
            $wajib = PengaturanProduk::KATEGORI_BLOK;
            sort($atas);
            $tiruan = $wajib;
            sort($tiruan);
            if ($atas !== $tiruan) {
                return $this->fail('urutan_blok harus berisi tepat: '.implode(', ', $wajib));
            }
            $urutanFinal = array_values(array_unique(array_map(
                fn ($v) => strtoupper(trim((string) $v)),
                $urutan
            )));
        } elseif ($existing && $existing->urutan_blok) {
            $urutanFinal = PengaturanProduk::normalisasiUrutan($existing->urutan_blok);
        }

        try {
            if ($ikutFefo === true && $urutanFinal === PengaturanProduk::URUTAN_DEFAULT) {
                DB::table('pengaturan_produk')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_produk', $idProduk)
                    ->delete();
            } elseif ($existing) {
                DB::table('pengaturan_produk')
                    ->where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_produk', $idProduk)
                    ->update([
                        'ikut_fefo' => $ikutFefo,
                        'urutan_blok' => json_encode($urutanFinal),
                        'updated_at' => now(),
                    ]);
            } else {
                DB::table('pengaturan_produk')->insert([
                    'id_pengguna_lokasi' => $idPenggunaLokasi,
                    'id_produk' => $idProduk,
                    'ikut_fefo' => $ikutFefo,
                    'urutan_blok' => json_encode($urutanFinal),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        } catch (Throwable $e) {
            return $this->fail('Gagal menyimpan pengaturan: '.$e->getMessage(), 500);
        }

        PengaturanProduk::lupakan($idPenggunaLokasi, $idProduk);

        return $this->ok(
            PengaturanProduk::untuk($idPenggunaLokasi, $idProduk),
            'Pengaturan produk disimpan'
        );
    }

    /**
     * POST /pengaturan-produk/reset
     * Hapus baris = kembali ke default global.
     */
    public function reset(Request $request)
    {
        $idPenggunaLokasi = $this->requireLok($request);
        if ($idPenggunaLokasi instanceof \Illuminate\Http\JsonResponse) {
            return $idPenggunaLokasi;
        }

        $idProduk = (int) $request->input('id_produk', 0);
        if ($idProduk <= 0) {
            return $this->fail('id_produk wajib');
        }

        DB::table('pengaturan_produk')
            ->where('id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('id_produk', $idProduk)
            ->delete();

        PengaturanProduk::lupakan($idPenggunaLokasi, $idProduk);

        return $this->ok(
            PengaturanProduk::untuk($idPenggunaLokasi, $idProduk),
            'Pengaturan dikembalikan ke default'
        );
    }
}
