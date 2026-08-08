<?php

namespace Database\Seeders;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PenggunaSeeder extends SqlSeederBase
{
    protected array $files = ['pengguna.sql'];

    public function run(): void
    {
        parent::run();

        DB::table('pengguna')->updateOrInsert(
            ['id_pengguna' => 68],
            [
                'id_pengguna_lokasi' => '9061',
                'username' => 'superadmin',
                'password' => Hash::make('danone'),
                'role' => 'SuperAdmin',
                'status' => 'Aktif',
                'created_at' => now(),
            ]
        );
    }
}
