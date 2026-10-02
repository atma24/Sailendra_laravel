<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Report historis card "Warehouse Utilization" (snapshot harian per depo).
 *
 * Sumber data: tabel utilisasi_gudang_harian (diisi command
 * snapshot:utilisasi-gudang tiap 23:59 WIB).
 */
class UtilisasiReportController extends Controller
{
    /**
     * GET /api/laporan-utilisasi/daftar
     * Daftar tanggal yang punya snapshot, dalam rentang bulan (YYYY-MM).
     * Dipakai untuk menandai tanggal tersedia pada date picker.
     */
    public function daftar(Request $request)
    {
        $bulan = trim((string) $request->query('bulan', ''));
        $depo = trim((string) $request->query('depo', ''));

        $q = DB::table('utilisasi_gudang_harian')
            ->selectRaw('DATE(tanggal) AS tanggal')
            ->selectRaw('COUNT(*) AS jumlah_depo')
            ->groupBy('tanggal')
            ->orderBy('tanggal');

        if (preg_match('/^\d{4}-\d{2}$/', $bulan)) {
            $q->whereBetween('tanggal', [$bulan.'-01', $bulan.'-31']);
        }
        if ($depo !== '') {
            $q->where('id_pengguna_lokasi', $depo);
        }

        return response()->json([
            'data' => $q->get()->map(fn ($r) => [
                'tanggal' => (string) $r->tanggal,
                'jumlah_depo' => (int) $r->jumlah_depo,
            ])->values(),
        ]);
    }

    /**
     * GET /api/laporan-utilisasi?tanggal=YYYY-MM-DD&depo=...
     * Detail snapshot 1 depo: ringkasan kolom + detail JSON penuh.
     */
    public function show(Request $request)
    {
        $tanggal = trim((string) $request->query('tanggal', ''));
        $depo = trim((string) $request->query('depo', ''));

        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
            return response()->json(['message' => 'Parameter tanggal wajib format YYYY-MM-DD.'], 422);
        }
        if ($depo === '') {
            return response()->json(['message' => 'Parameter depo wajib diisi.'], 422);
        }

        $row = DB::table('utilisasi_gudang_harian')
            ->where('tanggal', $tanggal)
            ->where('id_pengguna_lokasi', $depo)
            ->first();

        if (! $row) {
            return response()->json(['data' => null], 200);
        }

        return response()->json(['data' => $this->formatRow($row)]);
    }

    /**
     * GET /api/laporan-utilisasi/export?tanggal=YYYY-MM-DD&depo=...
     * Export Excel (HTML table) berisi ringkasan snapshot.
     */
    public function export(Request $request)
    {
        $tanggal = trim((string) $request->query('tanggal', ''));
        $depo = trim((string) $request->query('depo', ''));

        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal) || $depo === '') {
            abort(422, 'Parameter tanggal (YYYY-MM-DD) dan depo wajib diisi.');
        }

        $row = DB::table('utilisasi_gudang_harian')
            ->where('tanggal', $tanggal)
            ->where('id_pengguna_lokasi', $depo)
            ->first();

        if (! $row) {
            abort(404, 'Snapshot tidak ditemukan untuk tanggal & depo tersebut.');
        }

        $data = $this->formatRow($row);
        $namaDepo = (string) DB::table('pengguna_lokasi')
            ->where('id_pengguna_lokasi', $depo)
            ->value('nama_pengguna_lokasi');

        $filename = 'warehouse-utilization_'.$tanggal.'_'.$depo.'.xls';

        return response()->stream(function () use ($data, $namaDepo) {
            $d = $data;

            echo '<html><head><meta charset="utf-8"></head><body>';
            echo '<h3>Warehouse Utilization</h3>';
            echo '<p>Depo: '.htmlspecialchars($namaDepo ?: $d['id_pengguna_lokasi']).' &nbsp; | &nbsp; Tanggal: '.$d['tanggal'].'</p>';
            echo '<table border="1" cellpadding="4" cellspacing="0">';
            echo '<tr><th align="left">Item</th><th align="left">Nilai</th></tr>';

            $baris = [
                'Total Produk (SKU)' => $d['produk_total'],
                'Total Qty' => $d['produk_qty'],
                'Storage Dalam - Terpakai' => $d['storage_dalam']['terpakai'],
                'Storage Dalam - Kapasitas' => $d['storage_dalam']['kapasitas'],
                'Storage Dalam - Persen' => $d['storage_dalam']['persen'].'%',
                'Storage Luar - Terpakai' => $d['storage_luar']['terpakai'],
                'Storage Luar - Kapasitas' => $d['storage_luar']['kapasitas'],
                'Storage Luar - Persen' => $d['storage_luar']['persen'].'%',
            ];
            foreach ($baris as $label => $val) {
                echo '<tr><td>'.htmlspecialchars((string) $label).'</td><td>'.htmlspecialchars((string) $val).'</td></tr>';
            }
            echo '</table>';

            // Breakdown gallon/jug.
            $gb = $d['gallon_breakdown'] ?? [];
            echo '<h4>Breakdown Gallon / Jug</h4>';
            echo '<table border="1" cellpadding="4" cellspacing="0">';
            echo '<tr><th align="left">Item</th><th align="left">Qty</th></tr>';
            foreach ([
                'Gallon VIP' => $gb['gallon']['vip'] ?? 0,
                'Gallon Aqua' => $gb['gallon']['aqua'] ?? 0,
                'Gallon Vit' => $gb['gallon']['vit'] ?? 0,
                'Jug Aqua' => $gb['jug']['aqua'] ?? 0,
                'Jug Vit' => $gb['jug']['vit'] ?? 0,
            ] as $label => $val) {
                echo '<tr><td>'.htmlspecialchars($label).'</td><td>'.htmlspecialchars((string) $val).'</td></tr>';
            }
            echo '</table>';

            // Ringkasan per zona.
            $zona = $d['zona'] ?? [];
            echo '<h4>Ringkasan per Zona</h4>';
            echo '<table border="1" cellpadding="4" cellspacing="0">';
            echo '<tr><th align="left">Zona</th><th align="left">Qty</th><th align="left">Kapasitas</th></tr>';
            foreach (['reguler' => 'Reguler', 'mobil' => 'Mobil', 'transit' => 'Transit', 'bad_reject' => 'Bad/Reject'] as $key => $label) {
                $z = $zona[$key] ?? ['qty' => 0, 'kapasitas' => 0];
                echo '<tr><td>'.htmlspecialchars($label).'</td><td>'.htmlspecialchars((string) $z['qty']).'</td><td>'.htmlspecialchars((string) $z['kapasitas']).'</td></tr>';
            }
            echo '</table>';

            // Detail produk per kategori.
            $perKategori = $d['detail']['produk_per_kategori'] ?? [];
            if (! empty($perKategori)) {
                echo '<h4>Detail Produk per Kategori</h4>';
                echo '<table border="1" cellpadding="4" cellspacing="0">';
                echo '<tr><th align="left">Kategori</th><th align="left">Produk</th><th align="left">Satuan</th><th align="left">Qty</th>'
                    .'<th align="left">Reguler</th><th align="left">Mobil</th><th align="left">Transit</th><th align="left">Bad/Reject</th></tr>';
                foreach ($perKategori as $kat => $data) {
                    foreach (($data['items'] ?? []) as $it) {
                        $z = $it['zona'] ?? [];
                        echo '<tr>'
                            .'<td>'.htmlspecialchars((string) $kat).'</td>'
                            .'<td>'.htmlspecialchars((string) ($it['nama'] ?? '')).'</td>'
                            .'<td>'.htmlspecialchars((string) ($it['satuan'] ?? '')).'</td>'
                            .'<td>'.htmlspecialchars((string) ($it['qty'] ?? 0)).'</td>'
                            .'<td>'.htmlspecialchars((string) ($z['reguler']['qty'] ?? 0)).'</td>'
                            .'<td>'.htmlspecialchars((string) ($z['mobil']['qty'] ?? 0)).'</td>'
                            .'<td>'.htmlspecialchars((string) ($z['transit']['qty'] ?? 0)).'</td>'
                            .'<td>'.htmlspecialchars((string) ($z['bad_reject']['qty'] ?? 0)).'</td>'
                            .'</tr>';
                    }
                }
                echo '</table>';
            }

            echo '</body></html>';
        }, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    /**
     * @param  object  $row
     * @return array<string,mixed>
     */
    private function formatRow(object $row): array
    {
        $detail = json_decode((string) $row->detail, true);

        return [
            'tanggal' => (string) $row->tanggal,
            'id_pengguna_lokasi' => (string) $row->id_pengguna_lokasi,
            'produk_total' => (int) $row->produk_total,
            'produk_qty' => (int) $row->produk_qty,
            'storage_dalam' => [
                'terpakai' => (int) $row->dalam_terpakai,
                'kapasitas' => (int) $row->dalam_kapasitas,
                'persen' => (float) $row->dalam_persen,
            ],
            'storage_luar' => [
                'terpakai' => (int) $row->luar_terpakai,
                'kapasitas' => (int) $row->luar_kapasitas,
                'persen' => (float) $row->luar_persen,
            ],
            'gallon_breakdown' => [
                'gallon' => [
                    'vip' => (int) $row->gallon_vip,
                    'aqua' => (int) $row->gallon_aqua,
                    'vit' => (int) $row->gallon_vit,
                ],
                'jug' => [
                    'aqua' => (int) $row->jug_aqua,
                    'vit' => (int) $row->jug_vit,
                ],
            ],
            'zona' => [
                'reguler' => [
                    'qty' => (int) $row->zona_reguler_qty,
                    'kapasitas' => (int) $row->zona_reguler_kapasitas,
                ],
                'mobil' => [
                    'qty' => (int) $row->zona_mobil_qty,
                    'kapasitas' => (int) $row->zona_mobil_kapasitas,
                ],
                'transit' => [
                    'qty' => (int) $row->zona_transit_qty,
                    'kapasitas' => (int) $row->zona_transit_kapasitas,
                ],
                'bad_reject' => [
                    'qty' => (int) $row->zona_bad_reject_qty,
                    'kapasitas' => (int) $row->zona_bad_reject_kapasitas,
                ],
            ],
            'detail' => is_array($detail) ? $detail : null,
            'created_at' => (string) $row->created_at,
        ];
    }
}
