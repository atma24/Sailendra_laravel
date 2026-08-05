<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Produk extends Model
{
    protected $table = 'produk';

    protected $primaryKey = 'id_produk';

    public $timestamps = false;

    protected $fillable = ['id_produk', 'nama_produk', 'satuan', 'isi_per_pcs', 'created_at'];
}
