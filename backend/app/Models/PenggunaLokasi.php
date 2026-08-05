<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PenggunaLokasi extends Model
{
    protected $table = 'pengguna_lokasi';

    protected $primaryKey = 'id_pengguna_lokasi';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = ['id_pengguna_lokasi', 'nama_pengguna_lokasi', 'created_at'];

    public function penggunas()
    {
        return $this->hasMany(Pengguna::class, 'id_pengguna_lokasi', 'id_pengguna_lokasi');
    }
}
