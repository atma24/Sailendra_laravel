<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RencanaKeluarDeep extends Model
{
    protected $table = 'rencana_keluar_deep';

    protected $primaryKey = 'id_rencana';

    public $timestamps = false;

    protected $fillable = [
        'id_pengguna_lokasi',
        'id_barang_keluar',
        'id_detail_stok',
        'id_deep',
        'jumlah_rencana',
        'best_before',
        'batch'
    ];
}