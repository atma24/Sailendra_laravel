<?php

namespace App\Services\Dashboard;

/**
 * Orkestrator seluruh data dashboard summary.
 *
 * Controller hanya menyiapkan periode & filter, lalu service ini
 * merangkai semua bagian (inbound, outbound, stok, alert, dll).
 */
class DashboardSummaryService
{
    public function __construct(
        private readonly InboundService $inbound,
        private readonly OutboundService $outbound,
        private readonly StockService $stock,
        private readonly AlertService $alert,
    ) {}

    /**
     * Bangun payload summary lengkap.
     *
     * @param  array{0:string,1:array<int,string>}|null  $lokasiFilter
     * @param  array<int,string>  $produkFilter
     * @param  array{mulai:string,sampai:string,month_start:string,month_end:string,label:array<string,mixed>}  $periode
     * @param  array<int,string>  $dates
     * @return array<string,mixed>
     */
    public function build(
        ?array $lokasiFilter,
        array $produkFilter,
        array $periode,
        array $dates,
        string $granularity,
        int $top,
        int $mutasiTotal
    ): array {
        $rangeStart = $periode['mulai'];
        $rangeEnd = $periode['sampai'];
        $today = now()->format('Y-m-d');
        $monthStart = $periode['month_start'];
        $monthEnd = $periode['month_end'];

        $inbound = $this->inbound->stats($lokasiFilter, $rangeStart, $rangeEnd, $today, $dates, $produkFilter, $granularity);
        $outbound = $this->outbound->stats($lokasiFilter, $rangeStart, $rangeEnd, $today, $dates, $produkFilter, $granularity);
        $stock = $this->stock->ringkasan($lokasiFilter, $produkFilter);
        $stokList = $this->stock->stokList($lokasiFilter);
        $penjualan = $this->outbound->penjualan($lokasiFilter, $monthStart, $monthEnd);

        $inboundTotals = $this->inbound->totals($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter);
        $outboundTotals = $this->outbound->totals($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter);

        $totals = [
            'shipment' => $inboundTotals['shipment'],
            'so' => $this->outbound->countUniqueSo($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter),
            'gin' => $outboundTotals['gin'],
            'barang_datang' => $inboundTotals['barang_datang'],
            'barang_terkirim' => $outboundTotals['barang_terkirim'],
        ];

        return [
            'periode' => $periode['label'],
            'inbound' => $inbound,
            'outbound' => $outbound,
            'mutasi_total' => $mutasiTotal,
            'stock' => $stock,
            'stok_list' => $stokList,
            'penjualan' => $penjualan,
            'produk_realtime' => $this->stock->produkRealtime($lokasiFilter, $produkFilter),
            'storage_regular' => $this->stock->storageRegular($lokasiFilter, $produkFilter),
            'storage_luar' => $this->stock->storageLuar($lokasiFilter, $produkFilter),
            'gallon_breakdown' => $this->stock->gallonBreakdown($lokasiFilter),
            'gallon_zona' => $this->stock->gallonJugByZona($lokasiFilter),
            'totals' => $totals,
            'inbound_by_type' => $this->inbound->byType($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter),
            'inbound_series_by_type' => $this->inbound->seriesByType($lokasiFilter, $rangeStart, $rangeEnd, $dates, $produkFilter, $granularity),
            'outbound_by_type' => $this->outbound->byType($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter),
            'outbound_series_by_type' => $this->outbound->seriesByType($lokasiFilter, $rangeStart, $rangeEnd, $dates, $produkFilter, $granularity),
            'outbound_per_gin' => $this->outbound->perGin($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter, $top),
            'outbound_per_so' => $this->outbound->perSo($lokasiFilter, $rangeStart, $rangeEnd, $produkFilter, $top),
            'expired_alert' => $this->alert->expired($lokasiFilter, $produkFilter),
        ];
    }
}
