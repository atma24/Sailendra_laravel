<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StokGudangDeep extends Model
{
    protected $table = 'stok_gudang_deep';

    protected $primaryKey = 'id_detail_stok';

    public $timestamps = false;

    protected $fillable = [
        'id_pengguna_lokasi', 'id_stok_header', 'id_deep', 'jumlah',
        'best_before', 'batch', 'lokasi_block', 'created_at',
    ];
}
