<?php

namespace App\Http\Controllers\Api\Concerns;

/**
 * Parsing nilai SO (nomor SO) yang dapat berisi banyak nomor dipisah koma.
 *
 * Contoh: "3043565151,3043565152,..." => ["3043565151","3043565152"].
 */
trait ParsesSo
{
    /**
     * Pecah nilai so_number menjadi daftar SO unik per baris.
     *
     * @return array<int,string>
     */
    protected function splitSo(?string $raw): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }

        return array_values(array_unique(array_filter(
            array_map('trim', explode(',', $raw)),
            fn ($so) => $so !== ''
        )));
    }
}
