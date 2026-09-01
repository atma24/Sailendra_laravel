<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Pengguna extends Authenticatable
{
    use HasApiTokens; // Wajib untuk generate Token Sanctum

    protected $table = 'pengguna';
    
    protected $primaryKey = 'id_pengguna';
    
    public $timestamps = false;

    protected $fillable = [
        'id_pengguna_lokasi',
        'username',
        'password',
        'role',
        'status',
        'created_at',
    ];

    // Sembunyikan password saat data user dipanggil (Best practice keamanan)
    protected $hidden = [
        'password',
    ];
}
