<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mutasi extends Model
{
    protected $table = 'mutasi';

    protected $primaryKey = 'id_mutasi';

    public $timestamps = false;

    protected $fillable = [
        'id_pengguna_lokasi', 'id_pengguna', 'id_produk', 'lokasi_sumber',
        'lokasi_tujuan', 'jumlah', 'best_before', 'jenis_mutasi', 'satuan',
        'catatan', 'created_at'
    ];
}