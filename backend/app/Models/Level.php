<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Level extends Model
{
    protected $table = 'level';

    protected $primaryKey = 'id_level';

    public $timestamps = false;

    protected $fillable = ['id_level', 'id_pengguna_lokasi', 'id_line', 'level', 'created_at'];
}
