<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Deep extends Model
{
    protected $table = 'deep';

    protected $primaryKey = 'id_deep';

    public $timestamps = false;

    protected $fillable = ['id_deep', 'id_pengguna_lokasi', 'id_level', 'deep', 'kapasitas', 'created_at'];
}
