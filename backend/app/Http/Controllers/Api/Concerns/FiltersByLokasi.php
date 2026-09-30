<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Support\Dashboard\LokasiFilter;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

/**
 * Filter lokasi (depo) bersama untuk seluruh endpoint.
 *
 * Mendukung dua mode:
 * - `id_pengguna_lokasi`       => satu lokasi (where =)
 * - `id_pengguna_lokasi_multi` => banyak lokasi dipisah koma (whereIn)
 *
 * Logika inti ada di Support\Dashboard\LokasiFilter agar dapat dipakai
 * ulang oleh service/controller lain. Sebelumnya diduplikasi di
 * Dashboard/Stok/Laporan/Mutasi/BarangMasuk/BarangKeluar/Traceability.
 */
trait FiltersByLokasi
{
    /**
     * @return array<int,string>
     */
    protected function lokasiIds(Request $request): array
    {
        return LokasiFilter::idsFromRequest($request);
    }

    /**
     * @param  array<int,string>  $ids
     * @return array{0:string,1:array<int,string>}|null
     */
    protected function lokasiFilter(array $ids): ?array
    {
        return LokasiFilter::normalize($ids);
    }

    /**
     * @param  Builder|\Illuminate\Database\Eloquent\Builder  $query
     * @return mixed
     */
    protected function withLokasiFilter($query, string $column, ?array $filter)
    {
        return LokasiFilter::apply($query, $column, $filter);
    }

    protected function lokasiFilterFromRequest(Request $request): ?array
    {
        return LokasiFilter::normalize(LokasiFilter::idsFromRequest($request));
    }
}
