<?php

namespace App\Services\PendingKedaluarsa;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Sweep Pending kedaluwarsa -> Draft (inbound + outbound).
 *
 * Latar: booking stok (rencana_keluar_deep / rencana_masuk_deep) menahan
 * stok selama status Pending. Tumpukan Pending yang tidak dikonfirmasi
 * (mis. deep 12277 di 9021 ketahan 974 oleh puluhan GIN Pending) membuat
 * release terlihat ada di layout (fisik) tapi tidak tersedia (tersedia =
 * fisik - booking). Aturan: Pending yang umurnya > batas menit sejak
 * tombol submit ditekan otomatis kembali ke Draft + booking dilepas.
 *
 * Jangkar umur = COALESCE(diperbarui_pada, created_at) dibanding jam DB
 * (NOW()). Path submit (outbound simpanOutbound/submit_draft, inbound
 * submitDraft) wajib mengisi diperbarui_pada = NOW() saat masuk Pending,
 * jadi untuk data baru ini tepat = saat submit. Data lama yang
 * diperbarui_pada-nya null jatuh ke created_at (saat baris dibuat).
 */
class PendingKedaluarsaService
{
    public const BATAS_MENIT_DEFAULT = 15;

    /**
     * Sweep global (dipakai scheduler + lazy sweep per lokasi).
     *
     * @return array{outbound_grup:int,outbound_baris:int,inbound_grup:int,inbound_baris:int,outbound_ids:int[],inbound_ids:int[]}
     */
    public function sweep(?string $lok, int $batasMenit = self::BATAS_MENIT_DEFAULT, int $limit = 500): array
    {
        $batasMenit = max(1, $batasMenit);
        $limit = max(1, min(5000, $limit));
        $out = $this->sweepOutbound($lok, $batasMenit, $limit);
        $masuk = $this->sweepInbound($lok, $batasMenit, $limit);

        return [
            'outbound_grup' => $out['grup'],
            'outbound_baris' => $out['baris'],
            'inbound_grup' => $masuk['grup'],
            'inbound_baris' => $masuk['baris'],
            'outbound_ids' => $out['ids'],
            'inbound_ids' => $masuk['ids'],
        ];
    }

    // =====================================================================
    // OUTBOUND
    // =====================================================================
    public function sweepOutbound(?string $lok, int $batasMenit = self::BATAS_MENIT_DEFAULT, int $limit = 500): array
    {
        $batasMenit = max(1, $batasMenit);
        $limit = max(1, min(5000, $limit));

        $calon = DB::table('barang_keluar as bk')
            ->when($lok !== null && $lok !== '', fn ($q) => $q->where('bk.id_pengguna_lokasi', $lok))
            ->whereRaw("LOWER(TRIM(bk.status)) = 'pending'")
            ->whereRaw('COALESCE(bk.diperbarui_pada, bk.created_at) < DATE_SUB(NOW(), INTERVAL '.(int) $batasMenit.' MINUTE)')
            ->orderByRaw('COALESCE(bk.diperbarui_pada, bk.created_at) ASC')
            ->limit($limit)
            ->select('bk.id_barang_keluar', 'bk.id_pengguna_lokasi', 'bk.tanggal_keluar', 'bk.tipe_pengeluaran', 'bk.gin_no', 'bk.nama_driver', 'bk.no_mobil', 'bk.tujuan')
            ->get();

        if ($calon->isEmpty()) {
            return ['grup' => 0, 'baris' => 0, 'ids' => []];
        }

        $idSet = $calon->map(fn ($r) => (int) $r->id_barang_keluar)->all();
        $grup = [];
        foreach ($calon as $r) {
            $grup[$this->kunciGrupOutbound($r)][] = (int) $r->id_barang_keluar;
        }

        $totalGrup = 0;
        $totalBaris = 0;
        $semuaId = [];
        foreach ($grup as $anggota) {
            $ref = DB::table('barang_keluar')->where('id_barang_keluar', $anggota[0])->first();
            if (! $ref) {
                continue;
            }
            $hasil = $this->revertGrupOutbound($ref, $idSet, $batasMenit);
            if ($hasil['baris'] > 0) {
                $totalGrup++;
                $totalBaris += $hasil['baris'];
                $semuaId = array_merge($semuaId, $hasil['ids']);
            }
        }

        if ($totalBaris > 0) {
            Log::info('Sweep outbound Pending kedaluwarsa -> Draft.', [
                'lok' => $lok, 'batas_menit' => $batasMenit,
                'grup' => $totalGrup, 'baris' => $totalBaris,
            ]);
        }

        return ['grup' => $totalGrup, 'baris' => $totalBaris, 'ids' => $semuaId];
    }

    /**
     * Kunci grup 1 shipment = 1 GIN. Cerminan
     * BarangKeluarController::terapkanFilterGrupOutbound (id_pengguna tidak
     * dipakai; gin kosong fallback driver+mobil+tujuan).
     */
    private function kunciGrupOutbound(object $r): string
    {
        $tipe = strtolower(trim((string) ($r->tipe_pengeluaran ?? '')));
        $gin = strtolower(trim((string) ($r->gin_no ?? '')));
        $base = $r->id_pengguna_lokasi.'|'.$r->tanggal_keluar.'|'.$tipe.'|';
        if ($gin !== '') {
            return $base.'gin:'.$gin;
        }

        return $base.'drm:'.strtolower(trim((string) ($r->nama_driver ?? '')))
            .'|'.strtolower(trim((string) ($r->no_mobil ?? '')))
            .'|'.strtolower(trim((string) ($r->tujuan ?? '')));
    }

    private function queryGrupOutbound(object $ref)
    {
        $q = DB::table('barang_keluar')
            ->where('id_pengguna_lokasi', $ref->id_pengguna_lokasi)
            ->where('tanggal_keluar', $ref->tanggal_keluar)
            ->whereRaw('LOWER(TRIM(COALESCE(tipe_pengeluaran, \'\'))) = ?', [strtolower(trim((string) ($ref->tipe_pengeluaran ?? '')))]);
        $gin = strtolower(trim((string) ($ref->gin_no ?? '')));
        if ($gin !== '') {
            $q->whereRaw('LOWER(TRIM(COALESCE(gin_no, \'\'))) = ?', [$gin]);
        } else {
            $q->whereRaw('LOWER(TRIM(COALESCE(nama_driver, \'\'))) = ?', [strtolower(trim((string) ($ref->nama_driver ?? '')))])
                ->whereRaw('LOWER(TRIM(COALESCE(no_mobil, \'\'))) = ?', [strtolower(trim((string) ($ref->no_mobil ?? '')))])
                ->whereRaw('LOWER(TRIM(COALESCE(tujuan, \'\'))) = ?', [strtolower(trim((string) ($ref->tujuan ?? '')))]);
        }

        return $q;
    }

    /**
     * Revert 1 grup: kalau SEMUA Pending di grup sudah kedaluwarsa revert
     * semuanya (shipment utuh); kalau sebagian masih segar, revert hanya
     * yang kedaluwarsa agar tidak membunuh pekerjaan yang sedang jalan.
     */
    private function revertGrupOutbound(object $ref, array $idKedaluarsa, int $batasMenit): array
    {
        return DB::transaction(function () use ($ref, $idKedaluarsa, $batasMenit) {
            $pendingIds = $this->queryGrupOutbound($ref)
                ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                ->lockForUpdate()
                ->pluck('id_barang_keluar')
                ->map(fn ($v) => (int) $v)
                ->all();

            if (empty($pendingIds)) {
                return ['baris' => 0, 'ids' => []];
            }

            $setKedaluarsa = array_flip($idKedaluarsa);
            $target = array_values(array_filter(
                $pendingIds,
                fn ($id) => isset($setKedaluarsa[$id])
                    || DB::table('barang_keluar')->where('id_barang_keluar', $id)
                        ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                        ->whereRaw('COALESCE(diperbarui_pada, created_at) < DATE_SUB(NOW(), INTERVAL '.(int) $batasMenit.' MINUTE)')
                        ->exists()
            ));

            if (empty($target)) {
                return ['baris' => 0, 'ids' => []];
            }

            DB::table('rencana_keluar_deep')
                ->whereIn('id_barang_keluar', $target)
                ->delete();

            DB::table('barang_keluar')
                ->whereIn('id_barang_keluar', $target)
                ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                ->update([
                    'status' => 'Draft',
                    'best_before' => null,
                    'batch' => null,
                    'lokasi_block' => null,
                    'diperbarui_pada' => DB::raw('NOW()'),
                ]);

            return ['baris' => count($target), 'ids' => $target];
        });
    }

    // =====================================================================
    // INBOUND
    // =====================================================================
    public function sweepInbound(?string $lok, int $batasMenit = self::BATAS_MENIT_DEFAULT, int $limit = 500): array
    {
        $batasMenit = max(1, $batasMenit);
        $limit = max(1, min(5000, $limit));

        $calon = DB::table('barang_masuk as bm')
            ->when($lok !== null && $lok !== '', fn ($q) => $q->where('bm.id_pengguna_lokasi', $lok))
            ->whereRaw("LOWER(TRIM(bm.status)) = 'pending'")
            ->whereRaw('COALESCE(bm.diperbarui_pada, bm.created_at) < DATE_SUB(NOW(), INTERVAL '.(int) $batasMenit.' MINUTE)')
            ->orderByRaw('COALESCE(bm.diperbarui_pada, bm.created_at) ASC')
            ->limit($limit)
            ->select('bm.id_barang_masuk', 'bm.id_pengguna_lokasi', 'bm.shipment_id')
            ->get();

        if ($calon->isEmpty()) {
            return ['grup' => 0, 'baris' => 0, 'ids' => []];
        }

        $idSet = $calon->map(fn ($r) => (int) $r->id_barang_masuk)->all();
        $grup = [];
        foreach ($calon as $r) {
            $ship = trim((string) ($r->shipment_id ?? ''));
            $grup[($ship !== '' ? $r->id_pengguna_lokasi.'|'.$ship : 'row:'.$r->id_barang_masuk)][] = (int) $r->id_barang_masuk;
        }

        $totalGrup = 0;
        $totalBaris = 0;
        $semuaId = [];
        foreach ($grup as $anggota) {
            $hasil = $this->revertGrupInbound($anggota[0], $idSet, $batasMenit);
            if ($hasil['baris'] > 0) {
                $totalGrup++;
                $totalBaris += $hasil['baris'];
                $semuaId = array_merge($semuaId, $hasil['ids']);
            }
        }

        if ($totalBaris > 0) {
            Log::info('Sweep inbound Pending kedaluwarsa -> Draft.', [
                'lok' => $lok, 'batas_menit' => $batasMenit,
                'grup' => $totalGrup, 'baris' => $totalBaris,
            ]);
        }

        return ['grup' => $totalGrup, 'baris' => $totalBaris, 'ids' => $semuaId];
    }

    /**
     * Revert 1 grup inbound (shipment utuh bila semua Pending-nya basi,
     * kalau sebagian masih segar revert hanya yang basi). Cerminan langkah
     * BarangMasukController::update(revert_to_draft): hapus stok_gudang
     * + rencana_masuk_deep lalu Draft.
     */
    private function revertGrupInbound(int $idRef, array $idKedaluarsa, int $batasMenit): array
    {
        return DB::transaction(function () use ($idRef, $idKedaluarsa, $batasMenit) {
            $ref = DB::table('barang_masuk')->where('id_barang_masuk', $idRef)->lockForUpdate()->first();
            if (! $ref || strtolower(trim((string) $ref->status)) !== 'pending') {
                return ['baris' => 0, 'ids' => []];
            }

            $lok = $ref->id_pengguna_lokasi;
            $ship = trim((string) ($ref->shipment_id ?? ''));

            if ($ship !== '') {
                $pendingIds = DB::table('barang_masuk')
                    ->where('shipment_id', $ship)
                    ->where('id_pengguna_lokasi', $lok)
                    ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                    ->lockForUpdate()
                    ->pluck('id_barang_masuk')
                    ->map(fn ($v) => (int) $v)
                    ->all();
            } else {
                $pendingIds = [$idRef];
            }

            if (empty($pendingIds)) {
                return ['baris' => 0, 'ids' => []];
            }

            $setKedaluarsa = array_flip($idKedaluarsa);
            $target = array_values(array_filter(
                $pendingIds,
                fn ($id) => isset($setKedaluarsa[$id])
                    || DB::table('barang_masuk')->where('id_barang_masuk', $id)
                        ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                        ->whereRaw('COALESCE(diperbarui_pada, created_at) < DATE_SUB(NOW(), INTERVAL '.(int) $batasMenit.' MINUTE)')
                        ->exists()
            ));

            if (empty($target)) {
                return ['baris' => 0, 'ids' => []];
            }

            $rows = DB::table('barang_masuk')->whereIn('id_barang_masuk', $target)->get(['id_barang_masuk', 'id_pengguna_lokasi', 'id_produk']);
            foreach ($rows as $item) {
                DB::table('stok_gudang')
                    ->where('id_pengguna_lokasi', $item->id_pengguna_lokasi)
                    ->where('id_produk', $item->id_produk)
                    ->where('id_barang_masuk', $item->id_barang_masuk)
                    ->delete();

                DB::table('rencana_masuk_deep')
                    ->where('id_barang_masuk', $item->id_barang_masuk)
                    ->delete();
            }

            DB::table('barang_masuk')
                ->whereIn('id_barang_masuk', $target)
                ->whereRaw("LOWER(TRIM(status)) = 'pending'")
                ->update(['status' => 'Draft', 'diperbarui_pada' => DB::raw('NOW()')]);

            return ['baris' => count($target), 'ids' => $target];
        });
    }
}
