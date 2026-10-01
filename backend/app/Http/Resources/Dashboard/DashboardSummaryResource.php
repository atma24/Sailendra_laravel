<?php

namespace App\Http\Resources\Dashboard;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource untuk respons GET /api/dashboard/summary.
 *
 * `$wrap = null` agar bentuk JSON tetap identik dengan implementasi
 * sebelumnya (`success` dan payload berada di level atas, tanpa `data`).
 */
class DashboardSummaryResource extends JsonResource
{
    /** Hilangkan wrapper `data`. */
    public static $wrap = null;

    /**
     * @return array<string,mixed>
     */
    public function toArray(Request $request): array
    {
        $s = $this->resource;

        return [
            'success' => true,
            'periode' => $s['periode'],
            'inbound' => $s['inbound'],
            'outbound' => $s['outbound'],
            'mutasi_total' => $s['mutasi_total'],
            'stock' => $s['stock'],
            'stok_list' => $s['stok_list'],
            'penjualan' => $s['penjualan'],
            'produk_realtime' => $s['produk_realtime'],
            'storage_regular' => $s['storage_regular'],
            'storage_luar' => $s['storage_luar'],
            'gallon_breakdown' => $s['gallon_breakdown'],
            'gallon_zona' => $s['gallon_zona'],
            'gallon_per_kategori' => $s['gallon_per_kategori'],
            'produk_per_kategori' => $s['produk_per_kategori'],
            'totals' => $s['totals'],
            'inbound_by_type' => $s['inbound_by_type'],
            'inbound_series_by_type' => $s['inbound_series_by_type'],
            'outbound_by_type' => $s['outbound_by_type'],
            'outbound_series_by_type' => $s['outbound_series_by_type'],
            'outbound_per_gin' => $s['outbound_per_gin'],
            'outbound_per_so' => $s['outbound_per_so'],
            'expired_alert' => $s['expired_alert'],
        ];
    }
}
