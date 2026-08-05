<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lokasi extends Model
{
    protected $table = 'lokasi';

    protected $primaryKey = 'id_lokasi';

    public $timestamps = false;

    protected $fillable = ['id_lokasi', 'nama_lokasi', 'kategori', 'created_at'];
}
