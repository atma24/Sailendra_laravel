<?php

namespace App\Http\Requests\Dashboard;

use App\Support\Dashboard\LokasiFilter;
use App\Support\Dashboard\ProdukFilter;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Request dashboard summary.
 *
 * Tidak melakukan validasi ketat (agar perilaku API tetap sama seperti
 * sebelumnya — semua parameter opsional); kelas ini menyediakan aksesor
 * terketik untuk dipakai controller/service.
 */
class DashboardSummaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string,mixed>
     */
    public function rules(): array
    {
        return [];
    }

    public function top(): int
    {
        $top = (int) $this->query('top');

        return $top > 0 ? min($top, 50) : 10;
    }

    /**
     * @return array<int,string>
     */
    public function produkFilter(): array
    {
        return ProdukFilter::fromRequest($this);
    }

    /**
     * @return array<int,string>
     */
    public function lokasiIds(): array
    {
        return LokasiFilter::idsFromRequest($this);
    }

    /**
     * @return array{0:string,1:array<int,string>}|null
     */
    public function lokasiFilter(): ?array
    {
        return LokasiFilter::normalize($this->lokasiIds());
    }

    public function mingguLabel(): string
    {
        $minggu = $this->query('minggu');

        return $minggu === null ? '' : trim((string) $minggu);
    }

    /**
     * Mode filter card aging produk: 'all' (semua) atau 'h30' (default).
     */
    public function expiredMode(): string
    {
        return strtolower(trim((string) $this->query('expired_mode', 'h30'))) === 'all'
            ? 'all'
            : 'h30';
    }

    public function isWeekly(): bool
    {
        $label = $this->mingguLabel();

        return $label !== '' && strtolower($label) !== 'all';
    }
}
