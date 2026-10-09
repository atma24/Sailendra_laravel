<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use App\Http\Controllers\Api\Concerns\ExcelReader;
use App\Http\Controllers\Controller;
use App\Models\Plant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class PlantController extends Controller
{
    use ApiResponse;
    use ExcelReader;

    private const KODE_AWAL_KEPALA_7 = 7001;

    public function index(Request $request)
    {
        $q = trim((string) $request->query('q'));
        $idPlant = trim((string) $request->query('id_plant'));

        $query = Plant::query()
            ->when($idPlant !== '', fn ($qq) => $qq->where('id_plant', $idPlant))
            ->when($q !== '', fn ($qq) => $qq->where(fn ($w) => $w
                ->where('id_plant', 'like', "%{$q}%")
                ->orWhere('nama_plant', 'like', "%{$q}%")))
            ->orderBy('id_plant');

        $data = $query->get();

        return $this->ok($data, $data->count() ? 'OK' : 'Tidak ada data plant');
    }

    public function store(Request $request)
    {
        $idPlant = trim((string) $request->input('id_plant'));
        $namaPlant = trim((string) $request->input('nama_plant'));

        if ($idPlant === '' || $namaPlant === '') {
            return $this->fail('Field wajib: id_plant, nama_plant');
        }

        if (Plant::whereKey($idPlant)->exists()) {
            return $this->fail('ID plant sudah digunakan');
        }

        try {
            Plant::create(['id_plant' => $idPlant, 'nama_plant' => $namaPlant, 'created_at' => now()]);

            return $this->okMessage('Plant ditambahkan', ['id_plant' => $idPlant]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal tambah plant: '.$e->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        $idPlant = trim((string) ($request->input('id_plant') ?? $id));
        $namaPlant = trim((string) $request->input('nama_plant'));

        if ($idPlant === '' || $namaPlant === '') {
            return $this->fail('Field wajib: id_plant, nama_plant');
        }

        $plant = Plant::whereKey($idPlant)->first();
        if (! $plant) {
            return $this->fail('Plant tidak ditemukan', 404);
        }

        try {
            $plant->update(['nama_plant' => $namaPlant]);

            return $this->okMessage('Plant diubah', ['id_plant' => $idPlant]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal ubah plant: '.$e->getMessage(), 500);
        }
    }

    public function destroy(Request $request, string $id)
    {
        $idPlant = trim((string) ($request->input('id_plant') ?? $id));

        if ($idPlant === '') {
            return $this->fail('Field wajib: id_plant');
        }

        try {
            $affected = Plant::destroy($idPlant);

            if ($affected <= 0) {
                return $this->fail('Plant tidak ditemukan atau sudah dihapus', 404);
            }

            return $this->okMessage('Plant dihapus', ['id_plant' => $idPlant]);
        } catch (\Throwable $e) {
            return $this->fail('Gagal hapus plant: '.$e->getMessage(), 500);
        }
    }

    public function downloadTemplate()
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Template');

        $sheet->fromArray(['nama_plant'], null, 'A1');
        // Contoh satu baris agar format jelas (boleh dihapus pengisi).
        $sheet->setCellValue('A2', 'CV. MITRA MULIA - JARANAN');

        $headerStyle = $sheet->getStyle('A1');
        $headerStyle->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
        $headerStyle->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF191970');
        $sheet->getColumnDimension('A')->setAutoSize(true);

        $spreadsheet->setActiveSheetIndex(0);

        $writer = new Xlsx($spreadsheet);
        $filename = 'template-plant.xlsx';

        if (ob_get_length()) {
            ob_end_clean();
        }

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="'.$filename.'"');
        header('Cache-Control: max-age=0');

        $writer->save('php://output');
        exit;
    }

    public function import(Request $request)
    {
        $file = $request->file('file');

        if (! $file || ! $file->isValid()) {
            return $this->fail('file wajib diisi');
        }

        $ext = strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, ['xlsx', 'csv'], true)) {
            return $this->fail('Format file tidak didukung. Gunakan .XLSX atau .CSV.');
        }

        try {
            $parsed = $this->bacaFileSpreadsheet($file->getRealPath(), $ext);
        } catch (\Throwable $e) {
            return $this->fail('Gagal membaca file: '.$e->getMessage());
        }

        if (empty($parsed['header'])) {
            return $this->fail('File kosong atau header tidak ditemukan');
        }

        // Header yang diterima: template resmi (nama_plant) + alias file distributor (Dest Name).
        $alias = ['nama_plant', 'nama plant', 'dest name', 'dest_name', 'destname', 'nama_distributor', 'nama distributor', 'nama'];
        $colNama = null;
        foreach ($parsed['header'] as $i => $h) {
            $name = strtolower(trim((string) $h));
            if (in_array($name, $alias, true)) {
                $colNama = $i;
                break;
            }
        }

        if ($colNama === null) {
            return $this->fail('Kolom wajib tidak ditemukan di file: nama_plant (alias yang didukung: Dest Name)');
        }

        $errors = [];
        $names = [];

        foreach ($parsed['rows'] as $idx => $row) {
            $lineNo = $idx + 2; // +1 header, +1 base-1
            // Trim saja (tanpa ubah casing / collapse spasi): skip = exact case-sensitive.
            $nama = trim((string) ($row[$colNama] ?? ''));

            if ($nama === '') {
                continue;
            }

            if (mb_strlen($nama) > 255) {
                $errors[] = "Baris $lineNo: nama_plant maksimal 255 karakter";
                continue;
            }

            $names[] = ['nama' => $nama, 'line_no' => $lineNo];
        }

        if (! empty($errors)) {
            return $this->fail('Terdapat kesalahan di file (tidak ada data yang disimpan):'."\n".implode("\n", array_slice($errors, 0, 20)));
        }

        if (empty($names)) {
            return $this->fail('Tidak ada baris data yang valid di file');
        }

        // Tentukan nomor awal kepala 7: MAX(id kepala 7 numerik) + 1, default 7001.
        try {
            $row = DB::selectOne("SELECT MAX(CAST(id_plant AS UNSIGNED)) AS m FROM plant WHERE id_plant REGEXP '^7[0-9]+$'");
            $next = ($row && isset($row->m) && $row->m !== null) ? ((int) $row->m) + 1 : self::KODE_AWAL_KEPALA_7;
            // Pastikan nomor awal tetap berkepala 7.
            if ($next < self::KODE_AWAL_KEPALA_7) {
                $next = self::KODE_AWAL_KEPALA_7;
            }
        } catch (\Throwable $e) {
            $next = self::KODE_AWAL_KEPALA_7;
        }

        $seenInFile = [];
        $toInsert = [];
        $skippedExisting = [];
        $skippedDuplikatFile = 0;

        foreach ($names as $item) {
            $nama = $item['nama'];

            if (isset($seenInFile[$nama])) {
                $skippedDuplikatFile++;
                continue;
            }
            $seenInFile[$nama] = true;

            // Perbandingan case-sensitive: kolasi default _ci tidak membedakan huruf besar/kecil,
            // sehingga wajib BINARY agar "100% sama" benar-benar exact.
            $exists = DB::selectOne('SELECT 1 AS ada FROM plant WHERE BINARY nama_plant = ? LIMIT 1', [$nama]);
            if ($exists) {
                $skippedExisting[] = $nama;
                continue;
            }

            $toInsert[] = $nama;
        }

        $inserted = [];
        if (! empty($toInsert)) {
            try {
                DB::transaction(function () use ($toInsert, &$inserted, &$next) {
                    $now = now();
                    foreach ($toInsert as $nama) {
                        // Hindari tabrakan dengan id yang sudah ada (dibuat manual / import lain).
                        while (Plant::whereKey((string) $next)->exists()) {
                            $next++;
                        }
                        $idPlant = (string) $next;
                        $next++;

                        Plant::create(['id_plant' => $idPlant, 'nama_plant' => $nama, 'created_at' => $now]);
                        $inserted[] = ['id_plant' => $idPlant, 'nama_plant' => $nama];
                    }
                });
            } catch (\Throwable $e) {
                return $this->fail('Gagal import plant: '.$e->getMessage(), 500);
            }
        }

        $total = count($names);
        $countInserted = count($inserted);
        $countSkippedExisting = count($skippedExisting);
        $countSkipped = $countSkippedExisting + $skippedDuplikatFile;

        return $this->ok([
            'total' => $total,
            'inserted' => $countInserted,
            'skipped' => $countSkipped,
            'skipped_existing' => $countSkippedExisting,
            'skipped_duplikat_file' => $skippedDuplikatFile,
            'detail_skipped' => array_slice($skippedExisting, 0, 50),
            'inserted_ids' => $inserted,
        ], "Import selesai: {$countInserted} baru, {$countSkipped} terskip.");
    }
}
