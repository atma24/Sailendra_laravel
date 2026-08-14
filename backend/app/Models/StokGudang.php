<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StokGudang extends Model
{
    protected $table = 'stok_gudang';

    protected $primaryKey = 'id_stok';

    public $timestamps = false;

    protected $fillable = [
        'id_pengguna_lokasi', 'id_produk', 'nama_produk', 'id_barang_masuk',
        'jumlah_sisa', 'batch', 'best_before', 'satuan', 'lokasi_block', 'status', 'created_at',
    ];
}
