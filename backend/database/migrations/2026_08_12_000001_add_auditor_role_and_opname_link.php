<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE pengguna MODIFY COLUMN role ENUM('Supervisor','Checker','Support','Forklift','SuperAdmin','Auditor') NOT NULL");

        DB::statement("ALTER TABLE stok_opname ADD COLUMN sumber_opname VARCHAR(20) NOT NULL DEFAULT 'Checker' AFTER jenis_opname");
        DB::statement("ALTER TABLE stok_opname ADD COLUMN checker_created_at DATETIME NULL AFTER created_at");
        DB::statement("ALTER TABLE stok_opname ADD KEY idx_opname_sumber_tanggal (id_pengguna_lokasi, tanggal_opname, sumber_opname, created_at)");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE stok_opname DROP KEY idx_opname_sumber_tanggal");
        DB::statement("ALTER TABLE stok_opname DROP COLUMN checker_created_at");
        DB::statement("ALTER TABLE stok_opname DROP COLUMN sumber_opname");

        DB::statement("ALTER TABLE pengguna MODIFY COLUMN role ENUM('Supervisor','Checker','Support','Forklift','SuperAdmin') NOT NULL");
    }
};
