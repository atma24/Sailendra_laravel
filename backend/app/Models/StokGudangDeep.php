<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class StokGudangDeep extends Model
{
    protected $table = 'stok_gudang_deep';

    protected $primaryKey = 'id_detail_stok';

    public $timestamps = false;

    protected $fillable = [
        'id_pengguna_lokasi', 'id_stok_header', 'id_deep', 'jumlah',
        'best_before', 'batch', 'lokasi_block', 'created_at',
    ];

    public static function totalStokLine(string $idPenggunaLokasi, int $idLine): int
    {
        return (int) DB::table('stok_gudang_deep as sd')
            ->join('deep as d', fn ($j) => $j
                ->on('sd.id_deep', '=', 'd.id_deep')
                ->on('sd.id_pengguna_lokasi', '=', 'd.id_pengguna_lokasi'))
            ->join('level as lv', fn ($j) => $j
                ->on('d.id_level', '=', 'lv.id_level')
                ->on('d.id_pengguna_lokasi', '=', 'lv.id_pengguna_lokasi'))
            ->where('lv.id_pengguna_lokasi', $idPenggunaLokasi)
            ->where('lv.id_line', $idLine)
            ->sum('sd.jumlah');
    }
}
