<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

abstract class SqlSeederBase extends Seeder
{
    use WithoutModelEvents;

    /** @var string[] daftar file .sql di database/seeders/sql (urut dependensi) */
    protected array $files = [];

    public function run(): void
    {
        foreach ($this->files as $file) {
            $path = __DIR__.'/sql/'.$file;
            if (is_file($path)) {
                DB::unprepared(file_get_contents($path));
            }
        }
    }
}
