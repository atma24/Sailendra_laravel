<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrioritasLokasiProduk extends Model
{
    protected $table = 'prioritas_lokasi_produk';

    protected $primaryKey = 'id_prioritas';

    public $timestamps = false;

    protected $fillable = ['id_pengguna_lokasi', 'id_produk', 'id_lokasi', 'id_block', 'id_line', 'id_level', 'id_deep', 'created_at'];
}
