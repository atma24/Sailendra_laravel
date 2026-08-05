<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Block extends Model
{
    protected $table = 'block';

    protected $primaryKey = 'id_block';

    public $timestamps = false;

    protected $fillable = ['id_block', 'id_pengguna_lokasi', 'id_lokasi', 'kode_block', 'created_at'];

    public function lines()
    {
        return $this->hasMany(Line::class, 'id_block', 'id_block');
    }
}
