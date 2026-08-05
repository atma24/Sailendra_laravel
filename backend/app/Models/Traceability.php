<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Traceability extends Model
{
    protected $table = 'traceability';

    protected $primaryKey = 'id_traceability';

    public $timestamps = false;

    protected $fillable = [
        'id_pengguna_lokasi',
        'id_produk',
        'so_number',
        'id_barang_keluar',
        'best_before',
        'batch_number',
        'id_route',
        'nama_driver',
        'id_customer',
        'nama_customer',
        'sales_group',
        'no_dn',
        'nama_produk',
        'tanggal_pengiriman',
        'jumlah',
        'status_delivery',
        'created_at',
    ];
}
