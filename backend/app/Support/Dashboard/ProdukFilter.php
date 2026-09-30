<?php

namespace App\Support\Dashboard;

use Illuminate\Http\Request;

/**
 * Parser filter produk bersama.
 *
 * Produk dapat dikirim sebagai array (`produk[]=A&produk[]=B`) atau
 * CSV (`produk=A,B`). Logika inti dipusatkan di sini agar dipakai ulang
 * oleh FormRequest maupun trait controller.
 */
final class ProdukFilter
{
    /**
     * @return array<int,string>
     */
    public static function fromRequest(Request $request): array
    {
        $raw = $request->query('produk');

        if (empty($raw)) {
            return [];
        }

        $produks = is_array($raw) ? $raw : explode(',', (string) $raw);

        return array_values(array_filter(array_map('trim', $produks)));
    }

    /**
     * @param  mixed  $raw
     * @return array<int,string>
     */
    public static function parse($raw): array
    {
        if (empty($raw)) {
            return [];
        }

        $produks = is_array($raw) ? $raw : explode(',', (string) $raw);

        return array_values(array_filter(array_map('trim', $produks)));
    }

    private function __construct() {}
}
