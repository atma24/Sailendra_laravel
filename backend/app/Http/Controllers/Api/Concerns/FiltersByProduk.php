<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Support\Dashboard\ProdukFilter;
use Illuminate\Http\Request;

/**
 * Filter produk bersama untuk seluruh endpoint.
 *
 * Produk dapat dikirim sebagai array (`produk[]=A&produk[]=B`)
 * atau CSV (`produk=A,B`). Logika inti ada di
 * Support\Dashboard\ProdukFilter agar dapat dipakai ulang.
 */
trait FiltersByProduk
{
    /**
     * @return array<int,string>
     */
    protected function produkFilter(Request $request): array
    {
        return ProdukFilter::fromRequest($request);
    }
}
