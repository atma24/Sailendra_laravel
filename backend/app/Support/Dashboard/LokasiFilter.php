<?php

namespace App\Support\Dashboard;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

/**
 * Helper filter lokasi yang dapat dipakai controller maupun service.
 *
 * Trait `FiltersByLokasi` (di Concerns) mendelegasikan ke sini agar
 * service pun bisa memakai logika yang sama tanpa mewarisi controller.
 */
final class LokasiFilter
{
    /**
     * Ambil daftar id lokasi dari request (single atau multi).
     *
     * @return array<int,string>
     */
    public static function idsFromRequest(Request $request): array
    {
        $multi = trim((string) ($request->input('id_pengguna_lokasi_multi')
            ?? $request->query('id_pengguna_lokasi_multi', '')));

        if ($multi !== '') {
            return array_values(array_filter(
                array_map('trim', explode(',', $multi)),
                fn ($id) => $id !== ''
            ));
        }

        $single = trim((string) ($request->input('id_pengguna_lokasi')
            ?? $request->query('id_pengguna_lokasi', '')));

        return $single !== '' ? [$single] : [];
    }

    /**
     * @param  array<int,string>  $ids
     * @return array{0:string,1:array<int,string>}|null
     */
    public static function normalize(array $ids): ?array
    {
        if (empty($ids)) {
            return null;
        }

        return count($ids) === 1 ? ['eq', [$ids[0]]] : ['in', array_values($ids)];
    }

    /**
     * Terapkan filter lokasi ke query builder.
     *
     * @param  Builder|\Illuminate\Database\Eloquent\Builder  $query
     * @return mixed
     */
    public static function apply($query, string $column, ?array $filter)
    {
        if ($filter === null) {
            return $query;
        }

        return $filter[0] === 'eq'
            ? $query->where($column, $filter[1][0])
            : $query->whereIn($column, $filter[1]);
    }
}
