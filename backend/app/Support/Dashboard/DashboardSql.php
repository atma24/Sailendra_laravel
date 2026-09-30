<?php

namespace App\Support\Dashboard;

/**
 * Helper expression SQL untuk query dashboard.
 *
 * Menggantikan pengulangan literal SQL (kategori/lokasi/zona) yang
 * sebelumnya tersebar di banyak method controller.
 */
final class DashboardSql
{
    /** Expression kategori lokasi (UPPER dari kategori/nama_lokasi). */
    public static function kategoriExpr(string $lokasiAlias = 'l'): string
    {
        return "UPPER(COALESCE({$lokasiAlias}.kategori, {$lokasiAlias}.nama_lokasi, 'LAINNYA'))";
    }

    /** Expression kode lokasi gabungan block-line (UPPER, trim). */
    public static function lokasiExpr(string $blockAlias = 'b', string $lineAlias = 'ln'): string
    {
        return "UPPER(TRIM(CONCAT({$blockAlias}.kode_block, '-', {$lineAlias}.nomor_line)))";
    }

    /**
     * Kondisi blok khusus (BAD STOCK/REJECT/... dst) dalam bentuk raw boolean
     * expression. Dipakai bersama oleh WHERE regular & kapasitas.
     */
    public static function specialCondition(string $lokasiAlias = 'l', string $blockAlias = 'b', string $lineAlias = 'ln'): string
    {
        $kategoriExpr = self::kategoriExpr($lokasiAlias);
        $lokasiExpr = self::lokasiExpr($blockAlias, $lineAlias);

        $kategoriList = implode(',', array_map(
            fn (string $k) => "'".str_replace("'", "''", $k)."'",
            DashboardConstants::SPECIAL_KATEGORI
        ));

        $parts = [
            "UPPER(COALESCE({$lokasiAlias}.kategori, {$lokasiAlias}.nama_lokasi, '')) IN ({$kategoriList})",
        ];

        foreach (DashboardConstants::SPECIAL_LOKASI_PREFIXES as $prefix) {
            $escaped = str_replace("'", "''", $prefix);
            $parts[] = "{$lokasiExpr} LIKE '{$escaped}%'";
        }

        return '('.implode(' OR ', $parts).')';
    }

    /**
     * Expression CASE untuk mengklasifikasikan stok ke zona.
     */
    public static function zonaExpr(string $stockAlias = 'sg', string $lokasiAlias = 'l', string $blockAlias = 'b', string $lineAlias = 'ln'): string
    {
        $kategoriExpr = self::kategoriExpr($lokasiAlias);
        $lokasiExpr = self::lokasiExpr($blockAlias, $lineAlias);

        $mapping = [
            'bad' => ["{$kategoriExpr} IN ('BAD STOCK','BADSTOCK')"]
                + array_map(fn ($p) => "{$lokasiExpr} LIKE '{$p}%'", ['BAD STOCK-', 'BADSTOCK-', 'BS-']),
            'reject' => ["{$kategoriExpr} = 'REJECT'", "{$lokasiExpr} LIKE 'REJECT-%'"],
            'receh' => ["{$kategoriExpr} = 'RECEH'", "{$lokasiExpr} LIKE 'RECEH-%'"],
            'mobil' => ["{$kategoriExpr} = 'MOBIL'", "{$lokasiExpr} LIKE 'MOBIL-%'"],
            'festive' => ["{$kategoriExpr} = 'FESTIVE'", "{$lokasiExpr} LIKE 'FESTIVE-%'"],
            'transit' => ["{$kategoriExpr} = 'TRANSIT'", "{$lokasiExpr} LIKE 'TRANSIT-%'"],
            'hold' => ["{$kategoriExpr} = 'HOLD'", "{$lokasiExpr} LIKE 'HOLD-%'"],
        ];

        $sql = "CASE\n";
        $sql .= "                WHEN UPPER(COALESCE({$stockAlias}.status, 'normal')) = 'QI' THEN 'qi'\n";
        foreach ($mapping as $zona => $conditions) {
            $sql .= '                WHEN '.implode(' OR ', $conditions)." THEN '{$zona}'\n";
        }
        $sql .= "                ELSE 'normal'\n            END";

        return $sql;
    }

    /** Ekspresi status terkonfirmasi (untuk SUM CASE). */
    public static function confirmedCase(string $column, string $trueValue, string $falseValue = '0'): string
    {
        $statuses = implode(',', array_map(fn ($s) => "'{$s}'", DashboardConstants::CONFIRMED_STATUSES));

        return "CASE WHEN LOWER(COALESCE({$column},'')) IN ({$statuses}) THEN {$trueValue} ELSE {$falseValue} END";
    }

    /** Expression status lowercase dari sebuah kolom (untuk WHERE/GROUP BY). */
    public static function statusExpr(string $column): string
    {
        return "LOWER(COALESCE({$column},''))";
    }

    /**
     * Kunci identitas SATU transaksi inbound.
     *
     * Satu transaksi = kombinasi `driver + shipment_id` (sesuai halaman Inbound).
     * Bila shipment_id atau driver kosong, dipakai penanda "Tanpa ..." agar
     * tetap konsisten dan tidak menggabung baris yang tak berkaitan.
     *
     * Terbukti cocok dengan hitungan manual (mis. lok 9021 / 15 Sep = 289).
     */
    public static function inboundTxKey(string $alias = 'bm'): string
    {
        return "CONCAT("
            ."COALESCE(NULLIF(TRIM({$alias}.nama_driver),''),'Tanpa nama driver'), '::', "
            ."COALESCE(NULLIF(TRIM({$alias}.shipment_id),''),'Tanpa Shipment')"
            .')';
    }

    /**
     * Kunci identitas SATU transaksi outbound.
     *
     * Satu transaksi = kombinasi `driver + gin_no` (selaras halaman Outbound).
     * Bila salah satu kosong, dipakai penanda "Tanpa ..." agar tetap konsisten
     * dan tidak menggabung baris yang tak berkaitan.
     */
    public static function outboundTxKey(string $alias = 'bk'): string
    {
        return "CONCAT("
            ."COALESCE(NULLIF(TRIM({$alias}.nama_driver),''),'Tanpa nama driver'), '::', "
            ."COALESCE(NULLIF(TRIM({$alias}.gin_no),''),'Tanpa GIN')"
            .')';
    }

    /**
     * Ekspresi COUNT(DISTINCT <kunci>) untuk menghitung jumlah transaksi.
     *
     * @param  string|null  $statusColumn  Bila diisi, hitung hanya status tertentu.
     * @param  string|null  $statusMode    'confirmed' | 'not_canceled' | 'pending' | null (semua).
     */
    public static function countTxExpr(
        string $keyExpr,
        ?string $statusColumn = null,
        ?string $statusMode = null
    ): string {
        if ($statusColumn === null || $statusMode === null) {
            return "COUNT(DISTINCT {$keyExpr})";
        }

        if ($statusMode === 'not_canceled') {
            $canceled = implode(',', array_map(fn ($s) => "'".$s."'", DashboardConstants::CANCELED_STATUSES));

            return "COUNT(DISTINCT CASE WHEN ".self::statusExpr($statusColumn)." NOT IN ({$canceled}) THEN {$keyExpr} END)";
        }

        if ($statusMode === 'pending') {
            $exclude = implode(',', array_map(
                fn ($s) => "'".$s."'",
                array_merge(DashboardConstants::CONFIRMED_STATUSES, DashboardConstants::CANCELED_STATUSES)
            ));

            return "COUNT(DISTINCT CASE WHEN ".self::statusExpr($statusColumn)." NOT IN ({$exclude}) THEN {$keyExpr} END)";
        }

        $list = implode(',', array_map(fn ($s) => "'".$s."'", DashboardConstants::CONFIRMED_STATUSES));

        return "COUNT(DISTINCT CASE WHEN ".self::statusExpr($statusColumn)." IN ({$list}) THEN {$keyExpr} END)";
    }

    /** WHERE: status terkonfirmasi (final). */
    public static function whereConfirmed(\Illuminate\Database\Query\Builder $query, string $column): void
    {
        $list = implode(',', array_map(fn ($s) => "'".$s."'", DashboardConstants::CONFIRMED_STATUSES));
        $query->whereRaw(self::statusExpr($column)." IN ({$list})");
    }

    /** WHERE: status bukan batal (semua kecuali canceled/cancelled). */
    public static function whereNotCanceled(\Illuminate\Database\Query\Builder $query, string $column): void
    {
        $list = implode(',', array_map(fn ($s) => "'".$s."'", DashboardConstants::CANCELED_STATUSES));
        $query->whereRaw(self::statusExpr($column)." NOT IN ({$list})");
    }

    private function __construct() {}
}
