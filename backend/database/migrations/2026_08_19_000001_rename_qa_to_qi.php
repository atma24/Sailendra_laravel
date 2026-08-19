<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE stok_gudang MODIFY COLUMN status ENUM('normal','qa','qi') NOT NULL DEFAULT 'normal'");
        DB::statement("UPDATE stok_gudang SET status = 'qi' WHERE status = 'qa'");
        DB::statement("ALTER TABLE stok_gudang MODIFY COLUMN status ENUM('normal','qi') NOT NULL DEFAULT 'normal'");

        DB::statement("UPDATE mutasi SET jenis_mutasi = 'GS_QI' WHERE jenis_mutasi = 'GS_QA'");
        DB::statement("UPDATE mutasi SET jenis_mutasi = 'QI_GS' WHERE jenis_mutasi = 'QA_GS'");
        DB::statement("UPDATE mutasi SET jenis_mutasi = 'QI_BAD' WHERE jenis_mutasi = 'QA_BAD'");
        DB::statement("UPDATE mutasi SET jenis_mutasi = 'BAD_QI' WHERE jenis_mutasi = 'BAD_QA'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE stok_gudang MODIFY COLUMN status ENUM('normal','qa','qi') NOT NULL DEFAULT 'normal'");
        DB::statement("UPDATE stok_gudang SET status = 'qa' WHERE status = 'qi'");
        DB::statement("ALTER TABLE stok_gudang MODIFY COLUMN status ENUM('normal','qa') NOT NULL DEFAULT 'normal'");

        DB::statement("UPDATE mutasi SET jenis_mutasi = 'GS_QA' WHERE jenis_mutasi = 'GS_QI'");
        DB::statement("UPDATE mutasi SET jenis_mutasi = 'QA_GS' WHERE jenis_mutasi = 'QI_GS'");
        DB::statement("UPDATE mutasi SET jenis_mutasi = 'QA_BAD' WHERE jenis_mutasi = 'QI_BAD'");
        DB::statement("UPDATE mutasi SET jenis_mutasi = 'BAD_QA' WHERE jenis_mutasi = 'BAD_QI'");
    }
};
