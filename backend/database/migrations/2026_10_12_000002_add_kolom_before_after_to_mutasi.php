<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Audit koreksi GS_GS dari card line: simpan nilai sebelum & sesudah
        // secara eksplisit agar bisa ditampilkan di laporan mutasi.
        // Kolom jumlah/best_before yang sudah ada = nilai SESUDAH.
        DB::statement('ALTER TABLE `mutasi` ADD COLUMN `best_before_lama` DATE NULL AFTER `best_before`');
        DB::statement('ALTER TABLE `mutasi` ADD COLUMN `jumlah_lama` INT NULL AFTER `best_before_lama`');
        DB::statement('ALTER TABLE `mutasi` ADD COLUMN `plant_lama` VARCHAR(10) NULL AFTER `jumlah_lama`');
        DB::statement('ALTER TABLE `mutasi` ADD COLUMN `plant_baru` VARCHAR(10) NULL AFTER `plant_lama`');
        DB::statement('ALTER TABLE `mutasi` ADD COLUMN `batch_lama` VARCHAR(50) NULL AFTER `plant_baru`');
        DB::statement('ALTER TABLE `mutasi` ADD COLUMN `batch_baru` VARCHAR(50) NULL AFTER `batch_lama`');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE `mutasi` DROP COLUMN `batch_baru`');
        DB::statement('ALTER TABLE `mutasi` DROP COLUMN `batch_lama`');
        DB::statement('ALTER TABLE `mutasi` DROP COLUMN `plant_baru`');
        DB::statement('ALTER TABLE `mutasi` DROP COLUMN `plant_lama`');
        DB::statement('ALTER TABLE `mutasi` DROP COLUMN `jumlah_lama`');
        DB::statement('ALTER TABLE `mutasi` DROP COLUMN `best_before_lama`');
    }
};
