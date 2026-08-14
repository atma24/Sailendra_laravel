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
                'compare' => $this->compare($request),
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

        $sumber = $this->sumberPengguna($idPengguna);
        $now = now()->format('Y-m-d H:i:s');

        $checkerCreatedAt = null;
        if ($sumber === 'Auditor') {
            $checker = DB::selectOne(
                'SELECT created_at FROM stok_opname
                 WHERE id_pengguna_lokasi = ? AND tanggal_opname = ? AND sumber_opname = \'Checker\'
                 ORDER BY created_at DESC LIMIT 1',
                [$idPenggunaLokasi, $tanggalOpname]
            );
            $checkerCreatedAt = $checker ? (string) $checker->created_at : null;
        }

        try {
            DB::transaction(function () use ($validRows, $tanggalOpname, $idPengguna, $jenisOpname, $sumber, $checkerCreatedAt, $now) {
                foreach ($validRows as $row) {
                    DB::insert(
                        'INSERT INTO stok_opname (id_pengguna_lokasi, tanggal_opname, id_pengguna, id_produk, nama_produk, lokasi_block, best_before, satuan, stok_fisik, stok_sistem, selisih, alasan, jenis_opname, sumber_opname, created_at, checker_created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                            $sumber,
                            $now,
                            $checkerCreatedAt,
                        ]
                    );
                }
            });

            return $this->jsonResponse(
                true,
                'Stock opname berhasil disimpan.',
                [
                    'tanggal_opname' => $tanggalOpname,
                    'created_at' => $now,
                    'jumlah_item' => count($validRows),
                    'sumber_opname' => $sumber,
                    'checker_created_at' => $checkerCreatedAt,
                    'linked' => $sumber === 'Auditor' && $checkerCreatedAt !== null,
                ]
            );
        } catch (\Throwable $e) {
            return $this->jsonResponse(false, 'Gagal menyimpan stock opname: '.$e->getMessage());
        }
    }

    private function sumberPengguna(int $idPengguna): string
    {
        $row = DB::selectOne('SELECT role FROM pengguna WHERE id_pengguna = ? LIMIT 1', [$idPengguna]);

        if ($row && strcasecmp((string) $row->role, 'Auditor') === 0) {
            return 'Auditor';
        }

        return 'Checker';
    }

    private function history(Request $request): JsonResponse
    {
        $lokasiIds = $this->resolveLokasiIds($request);
        $tanggalAwal = trim((string) $request->query('tanggal_awal', ''));
        $tanggalAkhir = trim((string) $request->query('tanggal_akhir', ''));
        $sumber = trim((string) $request->query('sumber', ''));

        if (empty($lokasiIds)) {
            return $this->jsonResponse(false, 'id_pengguna_lokasi wajib diisi.');
        }

        $lokWhere = $this->lokasiWhere('so.id_pengguna_lokasi', $lokasiIds);

        $sql = "SELECT so.tanggal_opname, so.created_at, so.jenis_opname, so.sumber_opname, p.username AS petugas, COUNT(*) AS jumlah_produk, SUM(CASE WHEN so.selisih <> 0 THEN 1 ELSE 0 END) AS jumlah_selisih
                FROM stok_opname so
                JOIN pengguna p ON p.id_pengguna = so.id_pengguna
                WHERE {$lokWhere['sql']}";
        $bind = $lokWhere['bind'];

        if ($tanggalAwal !== '' && $tanggalAkhir !== '') {
            $sql .= ' AND so.tanggal_opname BETWEEN ? AND ?';
            $bind[] = $tanggalAwal;
            $bind[] = $tanggalAkhir;
        }

        if ($sumber !== '') {
            $sql .= ' AND so.sumber_opname = ?';
            $bind[] = $sumber;
        }

        $sql .= ' GROUP BY so.tanggal_opname, so.created_at, so.jenis_opname, so.sumber_opname, p.username ORDER BY so.created_at DESC, so.tanggal_opname DESC';

        $rows = DB::select($sql, $bind);

        $data = [];
        foreach ($rows as $row) {
            $row->jumlah_produk = (int) $row->jumlah_produk;
            $row->jumlah_selisih = (int) $row->jumlah_selisih;
            $row->jenis_opname = $row->jenis_opname ?? 'Akurasi';
            $row->sumber_opname = $row->sumber_opname ?? 'Checker';
            $row->petugas = trim((string) ($row->petugas ?? ''));
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

        $sql = "SELECT id_opname, id_pengguna_lokasi, tanggal_opname, id_pengguna, id_produk, nama_produk, lokasi_block, best_before, satuan, stok_fisik, stok_sistem, selisih, alasan, jenis_opname, sumber_opname, created_at, stok_sebelumnya, dirubah_oleh, checker_created_at
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

    private function compare(Request $request): JsonResponse
    {
        $lokasiIds = $this->resolveLokasiIds($request);
        $tanggalAwal = trim((string) $request->query('tanggal_awal', ''));
        $tanggalAkhir = trim((string) $request->query('tanggal_akhir', ''));

        if (empty($lokasiIds)) {
            return $this->jsonResponse(false, 'id_pengguna_lokasi wajib diisi.');
        }

        $lokWhere = $this->lokasiWhere('id_pengguna_lokasi', $lokasiIds);

        $sql = "SELECT tanggal_opname, created_at, checker_created_at
                FROM stok_opname WHERE sumber_opname = 'Auditor' AND {$lokWhere['sql']}";
        $bind = $lokWhere['bind'];

        if ($tanggalAwal !== '' && $tanggalAkhir !== '') {
            $sql .= ' AND tanggal_opname BETWEEN ? AND ?';
            $bind[] = $tanggalAwal;
            $bind[] = $tanggalAkhir;
        }

        $sql .= ' GROUP BY tanggal_opname, created_at, checker_created_at ORDER BY tanggal_opname DESC, created_at DESC';

        $batches = DB::select($sql, $bind);

        $data = [];
        foreach ($batches as $batch) {
            $auditorRows = DB::select(
                'SELECT so.id_produk, so.nama_produk, so.lokasi_block, so.best_before, so.satuan, so.stok_fisik, p.username AS pengguna
                 FROM stok_opname so
                 JOIN pengguna p ON p.id_pengguna = so.id_pengguna
                 WHERE so.id_pengguna_lokasi IN ('.$this->placeholders($lokasiIds).')
                 AND so.tanggal_opname = ? AND so.created_at = ? AND so.sumber_opname = \'Auditor\'
                 ORDER BY so.lokasi_block ASC, so.nama_produk ASC, so.best_before ASC, so.id_opname ASC',
                array_merge($lokasiIds, [(string) $batch->tanggal_opname, (string) $batch->created_at])
            );

            $checkerByKey = [];
            $checkerItems = [];
            $checkerUsername = null;
            if ($batch->checker_created_at !== null) {
                $checkerRows = DB::select(
                    'SELECT so.id_produk, so.nama_produk, so.lokasi_block, so.best_before, so.satuan, so.stok_fisik, p.username AS pengguna
                     FROM stok_opname so
                     JOIN pengguna p ON p.id_pengguna = so.id_pengguna
                     WHERE so.id_pengguna_lokasi IN ('.$this->placeholders($lokasiIds).')
                     AND so.tanggal_opname = ? AND so.created_at = ? AND so.sumber_opname = \'Checker\'
                     ORDER BY so.id_opname ASC',
                    array_merge($lokasiIds, [(string) $batch->tanggal_opname, (string) $batch->checker_created_at])
                );
                foreach ($checkerRows as $cr) {
                    $key = (int) $cr->id_produk.'|'.$cr->lokasi_block.'|'.$cr->best_before;
                    $checkerByKey[$key] = $cr;
                    $checkerItems[$key] = $cr;
                    $checkerUsername = $checkerUsername ?? trim((string) $cr->pengguna);
                }
            }

            $auditorByKey = [];
            foreach ($auditorRows as $ar) {
                $key = (int) $ar->id_produk.'|'.$ar->lokasi_block.'|'.$ar->best_before;
                $auditorByKey[$key] = $ar;
            }

            $keys = array_values(array_unique(array_merge(
                array_keys($checkerByKey),
                array_keys($auditorByKey)
            )));

            usort($keys, function ($a, $b) {
                $aa = explode('|', $a, 3);
                $bb = explode('|', $b, 3);
                return strcmp($aa[1], $bb[1]) ?: strcmp($aa[2], $bb[2]) ?: strcmp($aa[0], $bb[0]);
            });

            $items = [];
            foreach ($keys as $key) {
                $checker = $checkerByKey[$key] ?? null;
                $auditor = $auditorByKey[$key] ?? null;
                $both = $checker !== null && $auditor !== null;
                $src = $checker ?? $auditor;
                $items[] = [
                    'id_produk' => (int) $src->id_produk,
                    'nama_produk' => $src->nama_produk,
                    'lokasi_block' => $src->lokasi_block,
                    'best_before' => $src->best_before,
                    'satuan' => $src->satuan,
                    'checker_fisik' => $checker ? (int) $checker->stok_fisik : null,
                    'auditor_fisik' => $auditor ? (int) $auditor->stok_fisik : null,
                    'selisih' => $both ? (int) $auditor->stok_fisik - (int) $checker->stok_fisik : null,
                    'matched' => $both,
                ];
            }

            $auditorUsername = null;
            foreach ($auditorRows as $ar2) {
                $auditorUsername = $auditorUsername ?? trim((string) $ar2->pengguna);
            }

            $data[] = [
                'tanggal_opname' => $batch->tanggal_opname,
                'created_at' => $batch->created_at,
                'checker_created_at' => $batch->checker_created_at,
                'auditor' => $auditorUsername,
                'checker' => $checkerUsername,
                'linked' => $batch->checker_created_at !== null,
                'jumlah_item' => count($items),
                'items' => $items,
            ];
        }

        return $this->jsonResponse(true, 'Perbandingan Checker vs Auditor berhasil diambil.', $data);
    }

    private function placeholders(array $ids): string
    {
        return implode(',', array_fill(0, count($ids), '?'));
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
