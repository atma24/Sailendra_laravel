<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BarangMasuk extends Model
{
    protected $table = 'barang_masuk';

    protected $primaryKey = 'id_barang_masuk';

    public $timestamps = false; // Karena menggunakan tanggal_masuk secara manual

    protected $fillable = [
        'id_pengguna_lokasi',
        'id_pengguna',
        'id_produk',
        'nama_produk',
        'tanggal_masuk',
        'tipe_penerimaan',
        'asal_pabrik',
        'no_dn',
        'nama_driver',
        'no_mobil',
        'jumlah',
        'best_before',
        'batch',
        'batch_sekarang',
        'catatan',
        'satuan',
        'lokasi_block',
        'diperbarui_pada',
        'diperbarui_oleh',
        'catatan_perubahan',
        'waktu_mulai_input',
        'durasi_detik',
    ];
}