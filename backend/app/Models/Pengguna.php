<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Pengguna extends Authenticatable
{
    use Notifiable;

    protected $table = 'pengguna';

    protected $primaryKey = 'id_pengguna';

    public const UPDATED_AT = null;

    protected $fillable = ['id_pengguna_lokasi', 'username', 'password', 'role', 'status', 'created_at'];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    public function penggunaLokasi()
    {
        return $this->belongsTo(PenggunaLokasi::class, 'id_pengguna_lokasi', 'id_pengguna_lokasi');
    }
}
