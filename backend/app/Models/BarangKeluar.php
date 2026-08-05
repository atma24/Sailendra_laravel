<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BarangKeluar extends Model
{
    protected $table = 'barang_keluar';

    protected $primaryKey = 'id_barang_keluar';

    public $timestamps = false; // Karena menggunakan tanggal_keluar secara manual

    protected $fillable = [
        'gin_no',
        'id_pengguna_lokasi',
        'id_pengguna',
        'id_produk',
        'nama_produk',
        'tipe_pengeluaran',
        'tujuan',
        'nama_driver',
        'no_mobil',
        'jumlah',
        'best_before',
        'batch',
        'satuan',
        'lokasi_block',
        'catatan',
        'catatan_perubahan',
        'tanggal_keluar',
        'tanggal_pengiriman',
        'no_dn',
        'so_number',
        'ritase',
        'status',
        'waktu_mulai_input',
        'durasi_detik',
        'diperbarui_oleh',
        'diperbarui_pada'
    ];
}