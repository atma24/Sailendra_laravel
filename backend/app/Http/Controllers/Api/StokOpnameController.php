<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StokOpnameController extends Controller
{
    protected function jsonResponse(bool $success, string $message, ?array $data = null): JsonResponse
    {
        return response()->json(['success' => $success, 'message' => $message, 'data' => $data]);
    }

    public function __invoke(Request $request): JsonResponse
    {
        $mode = strtolower(trim((string) $request->input('mode', $request->query('mode', 'save'))));

        try {
            return match ($mode) {
                'preview' => $this->preview($request),
                'save' => $this->save($request),
                'history' => $this->history($request),
                'detail' => $this->detail($request),
                'stok_catalog' => $this->stokCatalog($request),
                'edit_item' => $this->editItem($request),
                default => $this->jsonResponse(false, 'Mode stock opname tidak dikenal.'),
            };
        } catch (\Throwable $e) {
            return $this->jsonResponse(false, 'Terjadi kesalahan: '.$e->getMessage());
        }
    }

    private function getProdukInfo(int $idProduk): ?object
    {
        return DB::selectOne('SELECT nama_produk, satuan FROM produk WHERE id_produk = ? LIMIT 1', [$idProduk]);
    }

    private function getStokSistemBatch(string $lok, int $idProduk, string $lokasiBlock, string $bestBefore): int
    {
        $row = DB::selectOne(
            'SELECT COALESCE(SUM(sd.jumlah), 0) AS total
             FROM stok_gudang_deep sd
             JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header AND sg.id_pengguna_lokasi = sd.id_pengguna_lokasi
             JOIN deep d ON d.id_deep = sd.id_deep AND d.id_pengguna_lokasi = sd.id_pengguna_lokasi
             JOIN level lv ON lv.id_level = d.id_level AND lv.id_pengguna_lokasi = d.id_pengguna_lokasi
             JOIN line ln ON ln.id_line = lv.id_line AND ln.id_pengguna_lokasi = lv.id_pengguna_lokasi
             JOIN block b ON b.id_block = ln.id_block AND b.id_pengguna_lokasi = ln.id_pengguna_lokasi
             WHERE sd.id_pengguna_lokasi = ? AND sg.id_produk = ? AND REPLACE(CONCAT(b.kode_block, \'-\', ln.nomor_line), \' \', \'\') = ? AND sd.best_before = ? AND sd.jumlah > 0',
            [$lok, $idProduk, $lokasiBlock, $bestBefore]
        );

        return $row ? (int) $row->total : 0;
    }

    private function cekBatchAdaDiLine(string $lok, int $idProduk, string $lokasiBlock, string $bestBefore): bool
    {
        $row = DB::selectOne(
            'SELECT COUNT(*) AS total
             FROM stok_gudang_deep sd
             JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header AND sg.id_pengguna_lokasi = sd.id_pengguna_lokasi
             JOIN deep d ON d.id_deep = sd.id_deep AND d.id_pengguna_lokasi = sd.id_pengguna_lokasi
             JOIN level lv ON lv.id_level = d.id_level AND lv.id_pengguna_lokasi = d.id_pengguna_lokasi
             JOIN line ln ON ln.id_line = lv.id_line AND ln.id_pengguna_lokasi = lv.id_pengguna_lokasi
             JOIN block b ON b.id_block = ln.id_block AND b.id_pengguna_lokasi = ln.id_pengguna_lokasi
             WHERE sd.id_pengguna_lokasi = ? AND sg.id_produk = ? AND REPLACE(CONCAT(b.kode_block, \'-\', ln.nomor_line), \' \', \'\') = ? AND sd.best_before = ? AND sd.jumlah > 0 LIMIT 1',
            [$lok, $idProduk, $lokasiBlock, $bestBefore]
        );

        return (int) ($row->total ?? 0) > 0;
    }

    private function buildPreviewRows(string $lok, array $items, string $jenisOpname): array
    {
        $rows = [];

        foreach ($items as $index => $item) {
            if (! is_array($item)) {
                continue;
            }

            $idProduk = (int) ($item['id_produk'] ?? 0);
            $lokasiBlock = str_replace(' ', '', strtoupper(trim((string) ($item['lokasi_block'] ?? ''))));
            $bestBefore = trim((string) ($item['best_before'] ?? ''));
            $stokFisik = (int) ($item['stok_fisik'] ?? 0);
            $alasan = trim((string) ($item['alasan'] ?? ''));

            if ($idProduk <= 0) {
                throw new \Exception('ID produk tidak valid pada item ke-'.($index + 1));
            }
            if ($lokasiBlock === '') {
                throw new \Exception('Lokasi block wajib diisi pada item ke-'.($index + 1));
            }
            if ($bestBefore === '') {
                throw new \Exception('Best before wajib diisi pada item ke-'.($index + 1));
            }

            $produk = $this->getProdukInfo($idProduk);
            if (! $produk) {
                throw new \Exception('Produk tidak ditemukan pada item ke-'.($index + 1));
            }

            $namaProduk = isset($item['nama_produk']) && trim((string) $item['nama_produk']) !== ''
                ? trim((string) $item['nama_produk'])
                : (string) $produk->nama_produk;
            $satuan = isset($item['satuan']) && trim((string) $item['satuan']) !== ''
                ? strtoupper(trim((string) $item['satuan']))
                : strtoupper(trim((string) ($produk->satuan ?? '')));

            $batchAda = $this->cekBatchAdaDiLine($lok, $idProduk, $lokasiBlock, $bestBefore);

            if (! $batchAda && $jenisOpname === 'Akurasi') {
                $rows[] = [
                    '_invalid' => true,
                    'id_pengguna_lokasi' => $lok,
                    'id_produk' => $idProduk,
                    'nama_produk' => $namaProduk,
                    'lokasi_block' => $lokasiBlock,
                    'best_before' => $bestBefore,
                    'satuan' => $satuan,
                    'stok_fisik' => $stokFisik,
                    'stok_sistem' => 0,
                    'selisih' => 0,
                    'alasan' => $alasan,
                    'message' => 'BB '.$bestBefore.' tidak terdaftar di line '.$lokasiBlock.' untuk produk '.$namaProduk.'.',
                ];

                continue;
            }

            $stokSistem = $this->getStokSistemBatch($lok, $idProduk, $lokasiBlock, $bestBefore);
            $selisih = $stokFisik - $stokSistem;

            $rows[] = [
                'id_pengguna_lokasi' => $lok,
                'id_produk' => $idProduk,
                'nama_produk' => $namaProduk,
                'lokasi_block' => $lokasiBlock,
                'best_before' => $bestBefore,
                'satuan' => $satuan,
                'stok_fisik' => $stokFisik,
                'stok_sistem' => $stokSistem,
                'selisih' => $selisih,
                'alasan' => $alasan,
            ];
        }

        return $rows;
    }

    private function preview(Request $request): JsonResponse
    {
        $in = $request->all();

        $idPengguna = (int) ($in['id_pengguna'] ?? 0);
        $idPenggunaLokasi = trim((string) ($in['id_pengguna_lokasi'] ?? ''));
        $tanggalOpname = trim((string) ($in['tanggal_opname'] ?? '')) !== '' ? trim((string) $in['tanggal_opname']) : date('Y-m-d');
        $jenisOpname = trim((string) ($in['jenis_opname'] ?? '')) ?: 'Akurasi';
        $items = $this->parseItems($in['items'] ?? []);

        if ($idPengguna <= 0) {
            return $this->jsonResponse(false, 'ID pengguna tidak valid.');
        }
        if ($idPenggunaLokasi === '') {
            return $this->jsonResponse(false, 'id_pengguna_lokasi wajib diisi.');
        }
        if (count($items) === 0) {
            return $this->jsonResponse(false, 'Data detail stok opname kosong.');
        }

        $rows = $this->buildPreviewRows($idPenggunaLokasi, $items, $jenisOpname);

        $validRows = [];
        $errors = [];
        foreach ($rows as $row) {
            if (! empty($row['_invalid'])) {
                $errors[] = $row['message'] ?? 'Ada item tidak valid.';

                continue;
            }
            $validRows[] = $row;
        }

        if (count($validRows) === 0) {
            return $this->jsonResponse(
                false,
                count($errors) > 0 ? implode(' ', $errors) : 'Tidak ada data valid untuk preview.',
                ['errors' => $errors]
            );
        }

        return $this->jsonResponse(
            true,
            count($errors) > 0 ? 'Sebagian item dipreview.' : 'Preview berhasil.',
            ['tanggal_opname' => $tanggalOpname, 'jenis_opname' => $jenisOpname, 'items' => $validRows, 'errors' => $errors]
        );
    }

    private function save(Request $request): JsonResponse
    {
        $in = $request->all();

        $idPengguna = (int) ($in['id_pengguna'] ?? 0);
        $idPenggunaLokasi = trim((string) ($in['id_pengguna_lokasi'] ?? ''));
        $tanggalOpname = trim((string) ($in['tanggal_opname'] ?? '')) !== '' ? trim((string) $in['tanggal_opname']) : date('Y-m-d');
        $jenisOpname = trim((string) ($in['jenis_opname'] ?? '')) ?: 'Akurasi';
        $items = $this->parseItems($in['items'] ?? []);

        if ($idPengguna <= 0) {
            return $this->jsonResponse(false, 'ID pengguna tidak valid.');
        }
        if ($idPenggunaLokasi === '') {
            return $this->jsonResponse(false, 'id_pengguna_lokasi wajib diisi.');
        }
        if (count($items) === 0) {
            return $this->jsonResponse(false, 'Data detail stok opname kosong.');
        }

        $rows = $this->buildPreviewRows($idPenggunaLokasi, $items, $jenisOpname);

        $validRows = [];
        foreach ($rows as $row) {
            if (! empty($row['_invalid'])) {
                continue;
            }
            $validRows[] = $row;
        }

        if (count($validRows) === 0) {
            return $this->jsonResponse(false, 'Tidak ada data valid untuk disimpan.');
        }

        $now = now()->format('Y-m-d H:i:s');

        try {
            DB::transaction(function () use ($validRows, $tanggalOpname, $idPengguna, $jenisOpname, $now) {
                foreach ($validRows as $row) {
                    DB::insert(
                        'INSERT INTO stok_opname (id_pengguna_lokasi, tanggal_opname, id_pengguna, id_produk, nama_produk, lokasi_block, best_before, satuan, stok_fisik, stok_sistem, selisih, alasan, jenis_opname, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            $row['id_pengguna_lokasi'],
                            $tanggalOpname,
                            $idPengguna,
                            $row['id_produk'],
                            $row['nama_produk'],
                            $row['lokasi_block'],
                            $row['best_before'],
                            $row['satuan'],
                            $row['stok_fisik'],
                            $row['stok_sistem'],
                            $row['selisih'],
                            $row['alasan'],
                            $jenisOpname,
                            $now,
                        ]
                    );
                }
            });

            return $this->jsonResponse(
                true,
                'Stock opname berhasil disimpan.',
                ['tanggal_opname' => $tanggalOpname, 'created_at' => $now, 'jumlah_item' => count($validRows)]
            );
        } catch (\Throwable $e) {
            return $this->jsonResponse(false, 'Gagal menyimpan stock opname: '.$e->getMessage());
        }
    }

    private function history(Request $request): JsonResponse
    {
        $lokasiIds = $this->resolveLokasiIds($request);
        $tanggalAwal = trim((string) $request->query('tanggal_awal', ''));
        $tanggalAkhir = trim((string) $request->query('tanggal_akhir', ''));

        if (empty($lokasiIds)) {
            return $this->jsonResponse(false, 'id_pengguna_lokasi wajib diisi.');
        }

        $lokWhere = $this->lokasiWhere('id_pengguna_lokasi', $lokasiIds);

        $sql = "SELECT tanggal_opname, created_at, jenis_opname, COUNT(*) AS jumlah_produk, SUM(CASE WHEN selisih <> 0 THEN 1 ELSE 0 END) AS jumlah_selisih
                FROM stok_opname WHERE {$lokWhere['sql']}";
        $bind = $lokWhere['bind'];

        if ($tanggalAwal !== '' && $tanggalAkhir !== '') {
            $sql .= ' AND tanggal_opname BETWEEN ? AND ?';
            $bind[] = $tanggalAwal;
            $bind[] = $tanggalAkhir;
        }

        $sql .= ' GROUP BY tanggal_opname, created_at, jenis_opname ORDER BY created_at DESC, tanggal_opname DESC';

        $rows = DB::select($sql, $bind);

        $data = [];
        foreach ($rows as $row) {
            $row->jumlah_produk = (int) $row->jumlah_produk;
            $row->jumlah_selisih = (int) $row->jumlah_selisih;
            $row->jenis_opname = $row->jenis_opname ?? 'Akurasi';
            $data[] = (array) $row;
        }

        return $this->jsonResponse(true, 'Histori stock opname berhasil diambil.', $data);
    }

    private function detail(Request $request): JsonResponse
    {
        $lokasiIds = $this->resolveLokasiIds($request);
        $tanggalOpname = trim((string) $request->query('tanggal_opname', ''));
        $createdAt = trim((string) $request->query('created_at', ''));

        if (empty($lokasiIds)) {
            return $this->jsonResponse(false, 'id_pengguna_lokasi wajib diisi.');
        }
        if ($createdAt === '' && $tanggalOpname === '') {
            return $this->jsonResponse(false, 'created_at atau tanggal_opname wajib diisi.');
        }

        $lokWhere = $this->lokasiWhere('id_pengguna_lokasi', $lokasiIds);

        $sql = "SELECT id_opname, id_pengguna_lokasi, tanggal_opname, id_pengguna, id_produk, nama_produk, lokasi_block, best_before, satuan, stok_fisik, stok_sistem, selisih, alasan, jenis_opname, created_at, stok_sebelumnya, dirubah_oleh
                FROM stok_opname WHERE {$lokWhere['sql']}";
        $bind = $lokWhere['bind'];

        if ($createdAt !== '') {
            $sql .= ' AND created_at = ?';
            $bind[] = $createdAt;
        } else {
            $sql .= ' AND tanggal_opname = ?';
            $bind[] = $tanggalOpname;
        }

        $sql .= ' ORDER BY lokasi_block ASC, nama_produk ASC, best_before ASC, id_opname ASC';

        $rows = DB::select($sql, $bind);

        $data = [];
        foreach ($rows as $row) {
            $row->id_opname = (int) $row->id_opname;
            $row->id_produk = (int) $row->id_produk;
            $row->stok_fisik = (int) $row->stok_fisik;
            $row->stok_sistem = (int) $row->stok_sistem;
            $row->selisih = (int) $row->selisih;
            $row->stok_sebelumnya = isset($row->stok_sebelumnya) ? (int) $row->stok_sebelumnya : null;
            $data[] = (array) $row;
        }

        return $this->jsonResponse(true, 'Detail stock opname berhasil diambil.', $data);
    }

    private function stokCatalog(Request $request): JsonResponse
    {
        $lokasiIds = $this->resolveLokasiIds($request);

        if (empty($lokasiIds)) {
            return $this->jsonResponse(false, 'id_pengguna_lokasi wajib diisi.');
        }

        $placeholders = implode(',', array_fill(0, count($lokasiIds), '?'));

        $rows = DB::select(
            "SELECT sg.id_produk, p.nama_produk, UPPER(TRIM(COALESCE(p.satuan, ''))) AS satuan, CONCAT(b.kode_block, '-', ln.nomor_line) AS lokasi_block, sd.best_before, SUM(sd.jumlah) AS stok_sistem
             FROM stok_gudang_deep sd
             JOIN stok_gudang sg ON sg.id_stok = sd.id_stok_header AND sg.id_pengguna_lokasi = sd.id_pengguna_lokasi
             JOIN deep d ON d.id_deep = sd.id_deep AND d.id_pengguna_lokasi = sd.id_pengguna_lokasi
             JOIN level lv ON lv.id_level = d.id_level AND lv.id_pengguna_lokasi = d.id_pengguna_lokasi
             JOIN line ln ON ln.id_line = lv.id_line AND ln.id_pengguna_lokasi = lv.id_pengguna_lokasi
             JOIN block b ON b.id_block = ln.id_block AND b.id_pengguna_lokasi = ln.id_pengguna_lokasi
             JOIN produk p ON p.id_produk = sg.id_produk
             WHERE sd.id_pengguna_lokasi IN ($placeholders) AND sd.jumlah > 0
             GROUP BY sg.id_produk, p.nama_produk, UPPER(TRIM(COALESCE(p.satuan, ''))), CONCAT(b.kode_block, '-', ln.nomor_line), sd.best_before
             ORDER BY lokasi_block ASC, p.nama_produk ASC, sd.best_before ASC",
            $lokasiIds
        );

        $data = [];
        foreach ($rows as $row) {
            $row->id_produk = (int) $row->id_produk;
            $row->stok_sistem = (int) $row->stok_sistem;
            $data[] = (array) $row;
        }

        return $this->jsonResponse(true, 'Data stok berhasil diambil.', $data);
    }

    private function editItem(Request $request): JsonResponse
    {
        $in = $request->all();

        $idOpname = (int) ($in['id_opname'] ?? 0);
        $idPenggunaLokasi = trim((string) ($in['id_pengguna_lokasi'] ?? ''));
        $stokFisikBaru = (int) ($in['stok_fisik'] ?? 0);
        $alasan = trim((string) ($in['alasan'] ?? ''));
        $dirubahOleh = trim((string) ($in['dirubah_oleh'] ?? ''));

        if ($idOpname <= 0 || $idPenggunaLokasi === '') {
            return $this->jsonResponse(false, 'Data tidak lengkap.');
        }

        $row = DB::selectOne(
            'SELECT stok_fisik, stok_sistem, stok_sebelumnya FROM stok_opname WHERE id_opname = ? AND id_pengguna_lokasi = ?',
            [$idOpname, $idPenggunaLokasi]
        );

        if (! $row) {
            return $this->jsonResponse(false, 'Data tidak ditemukan.');
        }

        $stokFisikLama = (int) $row->stok_fisik;
        $stokSistem = (int) $row->stok_sistem;

        if ($stokFisikBaru !== $stokFisikLama && $alasan === '') {
            return $this->jsonResponse(false, 'Catatan wajib diisi jika Stok Real diubah.');
        }

        $stokSebelumnya = $stokFisikLama;
        if ($stokFisikBaru === $stokFisikLama) {
            $stokSebelumnya = $row->stok_sebelumnya;
        }

        $selisihBaru = $stokFisikBaru - $stokSistem;

        $updated = DB::update(
            'UPDATE stok_opname SET stok_fisik = ?, selisih = ?, alasan = ?, stok_sebelumnya = ?, dirubah_oleh = ? WHERE id_opname = ? AND id_pengguna_lokasi = ?',
            [$stokFisikBaru, $selisihBaru, $alasan, $stokSebelumnya, $dirubahOleh, $idOpname, $idPenggunaLokasi]
        );

        if ($updated) {
            return $this->jsonResponse(true, 'Data berhasil diperbarui.');
        }

        return $this->jsonResponse(false, 'Gagal memperbarui data.');
    }

    private function resolveLokasiIds(Request $request): array
    {
        $multi = trim((string) $request->query('id_pengguna_lokasi_multi', ''));
        if ($multi !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $multi)), fn ($id) => $id !== ''));
        }

        $single = trim((string) $request->query('id_pengguna_lokasi', ''));

        return $single !== '' ? [$single] : [];
    }

    private function lokasiWhere(string $column, array $ids): array
    {
        if (count($ids) === 1) {
            return ['sql' => $column.' = ?', 'bind' => [$ids[0]]];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        return ['sql' => $column.' IN ('.$placeholders.')', 'bind' => $ids];
    }

    private function parseItems(mixed $rawItems): array
    {
        if (is_array($rawItems)) {
            return $rawItems;
        }
        if (! is_string($rawItems) || trim($rawItems) === '') {
            return [];
        }
        $items = json_decode($rawItems, true);
        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($items)) {
            return [];
        }

        return $items;
    }
}
