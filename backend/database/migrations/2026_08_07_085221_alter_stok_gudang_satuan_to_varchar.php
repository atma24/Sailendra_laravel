<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE stok_gudang MODIFY COLUMN satuan VARCHAR(30) NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE stok_gudang DROP COLUMN satuan");
        DB::statement("ALTER TABLE stok_gudang ADD COLUMN satuan ENUM('GALLON','BOX','MP') NULL AFTER id_barang_masuk");
    }
};