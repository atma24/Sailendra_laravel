<?php

namespace App\Http\Controllers\Api\Concerns;

use Exception;

trait ExcelReader
{
    /**
     * Baca file CSV atau XLSX menjadi [header => [], rows => []].
     * XLSX dibaca via ZipArchive + SimpleXML (native PHP, tanpa library).
     */
    protected function bacaFileSpreadsheet(string $path, string $ext): array
    {
        $header = [];
        $rows = [];

        if ($ext === 'csv') {
            if (($handle = fopen($path, 'r')) !== false) {
                $header = fgetcsv($handle, 10000, ',') ?: [];
                while (($data = fgetcsv($handle, 10000, ',')) !== false) {
                    $rows[] = $data;
                }
                fclose($handle);
            }

            return ['header' => $header, 'rows' => $rows];
        }

        if ($ext === 'xlsx') {
            return $this->bacaXlsx($path);
        }

        throw new Exception('Format file tidak didukung. Gunakan .CSV atau .XLSX.');
    }

    private function bacaXlsx(string $path): array
    {
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            throw new Exception('File XLSX tidak valid.');
        }

        $shared = $zip->getFromName('xl/sharedStrings.xml');
        $sharedStrings = [];
        if ($shared !== false) {
            $sx = simplexml_load_string($shared);
            foreach ($sx->si as $si) {
                $sharedStrings[] = trim((string) ($si->t ?? $si));
            }
        }

        $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($sheet === false) {
            $sheet = $zip->getFromName('xl/worksheets/sheet.xml');
        }
        $zip->close();
        if ($sheet === false) {
            throw new Exception('Sheet tidak ditemukan.');
        }

        $rows = [];
        $header = null;
        $xml = simplexml_load_string($sheet);

        foreach ($xml->sheetData->row as $row) {
            $cells = [];
            foreach ($row->c as $cell) {
                $t = (string) ($cell->attributes()['t'] ?? '');
                $v = (string) ($cell->v ?? '');
                if ($t === 's' && $v !== '') {
                    $val = $sharedStrings[(int) $v] ?? '';
                } else {
                    $val = $v;
                }
                $cells[] = $val;
            }
            if ($header === null) {
                $header = $cells;
            } else {
                $rows[] = $cells;
            }
        }

        return ['header' => $header ?? [], 'rows' => $rows];
    }
}
