<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE stok_gudang ADD COLUMN status ENUM('normal','qa') NOT NULL DEFAULT 'normal' AFTER satuan");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE stok_gudang DROP COLUMN status");
    }
};