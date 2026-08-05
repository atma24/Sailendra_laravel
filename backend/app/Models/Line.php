<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Line extends Model
{
    protected $table = 'line';

    protected $primaryKey = 'id_line';

    public $timestamps = false;

    protected $fillable = ['id_line', 'id_pengguna_lokasi', 'id_block', 'nomor_line', 'created_at'];
}
