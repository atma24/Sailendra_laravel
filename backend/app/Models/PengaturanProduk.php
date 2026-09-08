<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class PengaturanProduk extends Model
{
    protected $table = 'pengaturan_produk';

    protected $primaryKey = 'id_pengaturan';

    protected $fillable = ['id_pengguna_lokasi', 'id_produk', 'ikut_fefo', 'urutan_blok'];

    protected $casts = [
        'ikut_fefo' => 'boolean',
        'urutan_blok' => 'array',
    ];

    public const KATEGORI_BLOK = ['MOBIL', 'RECEH', 'TRANSIT', 'REGULER'];

    public const URUTAN_DEFAULT = ['MOBIL', 'RECEH', 'TRANSIT', 'REGULER'];

    /** ID produk tanpa batch versi lama (fallback bila kolom produk.tanpa_batch belum ada). */
    public const LEGACY_TANPA_BATCH = [10516938, 10516939];

    /** Cache per-request agar tidak N+1 saat dipakai di loop alokasi. */
    protected static array $cachePengaturan = [];

    protected static array $cacheTanpaBatch = [];

    /** Hapus cache per-request (dipakai setelah simpan/reset). */
    public static function lupakan(string $idPenggunaLokasi, int $idProduk): void
    {
        unset(static::$cachePengaturan[$idPenggunaLokasi.'|'.$idProduk]);
        unset(static::$cacheTanpaBatch[$idProduk]);
    }

    /**
     * Ambil pengaturan produk per lokasi. Tanpa baris = perilaku lama
     * (urutan global + FEFO aktif). Tidak pernah throw (aman pre-migrasi).
     *
     * @return array{ikut_fefo: bool, urutan_blok: string[], ada_setting: bool}
     */
    public static function untuk(string $idPenggunaLokasi, int $idProduk): array
    {
        $key = $idPenggunaLokasi.'|'.$idProduk;
        if (! array_key_exists($key, static::$cachePengaturan)) {
            $row = null;
            try {
                $row = static::where('id_pengguna_lokasi', $idPenggunaLokasi)
                    ->where('id_produk', $idProduk)
                    ->first();
            } catch (\Throwable $e) {
                $row = null;
            }

            static::$cachePengaturan[$key] = [
                'ikut_fefo' => $row ? (bool) $row->ikut_fefo : true,
                'urutan_blok' => self::normalisasiUrutan($row?->urutan_blok),
                'ada_setting' => $row !== null,
            ];
        }

        return static::$cachePengaturan[$key];
    }

    /**
     * Normalisasi urutan_blok menjadi permutasi lengkap 4 kategori.
     * Entri tak dikenal dibuang, kategori yang hilang ditambahkan di belakang.
     *
     * @return string[]
     */
    public static function normalisasiUrutan(mixed $raw): array
    {
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }
        $list = is_array($raw) ? $raw : [];
        $list = array_values(array_unique(array_map(
            fn ($v) => strtoupper(trim((string) $v)),
            $list
        )));
        $valid = array_values(array_intersect($list, self::KATEGORI_BLOK));
        foreach (self::URUTAN_DEFAULT as $kat) {
            if (! in_array($kat, $valid, true)) {
                $valid[] = $kat;
            }
        }

        return $valid;
    }

    /**
     * CASE ... END untuk ORDER BY berdasarkan urutan blok produk.
     * MOBIL/RECEH/TRANSIT dicocokkan ke kode_block/nama_lokasi/kategori
     * (persis pola lama); REGULER = ELSE (catch-all, termasuk blok di
     * lokasi GALLON/SPS/XWH).
     */
    public static function caseUrutanSql(string $aliasBlock, string $aliasLokasi, array $urutan): string
    {
        $whens = [];
        $bobot = 0;
        foreach ($urutan as $kat) {
            if ($kat === 'REGULER') {
                continue;
            }
            $like = str_replace("'", "''", $kat);
            $whens[] = "WHEN UPPER(REPLACE({$aliasBlock}.kode_block, ' ', '')) LIKE '%{$like}%' "
                ."OR UPPER(REPLACE({$aliasLokasi}.nama_lokasi, ' ', '')) LIKE '%{$like}%' "
                ."OR UPPER(REPLACE(COALESCE({$aliasLokasi}.kategori, ''), ' ', '')) LIKE '%{$like}%' THEN {$bobot}";
            $bobot++;
        }

        return 'CASE '.implode(' ', $whens)." ELSE {$bobot} END ASC";
    }

    /**
     * Apakah produk ini tanpa batch (BB otomatis 9999-12-31, batch '-').
     * Aman pre-migrasi: fallback ke ID legacy bila kolom belum ada.
     */
    public static function isTanpaBatch(int $idProduk): bool
    {
        if (! array_key_exists($idProduk, static::$cacheTanpaBatch)) {
            try {
                $val = DB::table('produk')->where('id_produk', $idProduk)->value('tanpa_batch');
                static::$cacheTanpaBatch[$idProduk] = $val !== null ? (bool) $val : false;
            } catch (\Throwable $e) {
                static::$cacheTanpaBatch[$idProduk] = in_array($idProduk, self::LEGACY_TANPA_BATCH, true);
            }
        }

        return static::$cacheTanpaBatch[$idProduk];
    }
}
