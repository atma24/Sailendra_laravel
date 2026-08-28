<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Exception;

class ProcessTraceabilityExcel implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, SerializesModels;

    protected $filePath;
    protected $uploadLokasi;
    protected $mapProduk;

    public $timeout = 600;
    public $tries = 1;

    public function __construct(string $filePath, string $uploadLokasi, array $mapProduk)
    {
        $this->filePath = $filePath;
        $this->uploadLokasi = $uploadLokasi;
        $this->mapProduk = $mapProduk;
    }

    public function handle()
    {
        $ext = strtolower(pathinfo($this->filePath, PATHINFO_EXTENSION));
        if ($ext === 'xlsx') {
            $this->processXlsx();
        } elseif ($ext === 'csv') {
            $this->processCsv();
        } else {
            throw new Exception('Format file tidak didukung.');
        }

        @unlink($this->filePath);
    }

    private function processXlsx()
    {
        $zip = new \ZipArchive();
        if ($zip->open($this->filePath) !== true) {
            throw new Exception('File XLSX tidak valid.');
        }

        $sharedXml = $zip->getFromName('xl/sharedStrings.xml');
        $sharedStrings = [];
        if ($sharedXml !== false) {
            $sx = simplexml_load_string($sharedXml);
            foreach ($sx->si as $si) {
                $sharedStrings[] = trim((string) ($si->t ?? $si));
            }
        }

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($sheetXml === false) {
            $sheetXml = $zip->getFromName('xl/worksheets/sheet.xml');
        }
        $zip->close();
        if ($sheetXml === false) {
            throw new Exception('Sheet tidak ditemukan.');
        }

        $reader = new \XMLReader();
        $reader->xml($sheetXml);
        $rowIndex = 0;
        $header = null;
        $colMap = [];
        $chunk = [];
        $chunkSize = 500;

        while ($reader->read()) {
            if ($reader->nodeType == \XMLReader::ELEMENT && $reader->name === 'row') {
                $cells = [];
                $sub = $reader->expand();
                if ($sub instanceof \DOMElement) {
                    foreach ($sub->getElementsByTagName('c') as $cell) {
                        if ($cell instanceof \DOMElement) {
                            $t = $cell->getAttribute('t');
                            $v = '';
                            $children = $cell->getElementsByTagName('v');
                            if ($children->length > 0) {
                                $v = trim($children->item(0)->nodeValue);
                            }
                            if ($t === 's' && $v !== '') {
                                $val = $sharedStrings[(int) $v] ?? '';
                            } else {
                                $val = $v;
                            }
                            $cells[] = $val;
                        }
                    }
                }
                if ($rowIndex === 0) {
                    $header = $cells;
                    foreach ($header as $index => $colName) {
                        $clean = trim((string) $colName);
                        if ($clean !== '') {
                            $colMap[$clean] = $index;
                        }
                    }
                } else {
                    $item = $this->extractItem($cells, $colMap);
                    if ($item) {
                        $chunk[] = $item;
                        if (count($chunk) >= $chunkSize) {
                            $this->processChunk($chunk);
                            $chunk = [];
                        }
                    }
                }
                $rowIndex++;
            }
        }
        $reader->close();

        if (!empty($chunk)) {
            $this->processChunk($chunk);
        }
    }

    private function processCsv()
    {
        if (($handle = fopen($this->filePath, 'r')) === false) {
            throw new Exception('Tidak dapat membaca file CSV.');
        }

        $headerRow = fgetcsv($handle, 10000, ',');
        if ($headerRow === false) {
            fclose($handle);
            throw new Exception('File CSV kosong atau header tidak valid.');
        }

        $colMap = [];
        foreach ($headerRow as $index => $colName) {
            $clean = trim((string) $colName);
            if ($clean !== '') {
                $colMap[$clean] = $index;
            }
        }

        $chunk = [];
        $chunkSize = 500;
        while (($data = fgetcsv($handle, 10000, ',')) !== false) {
            $item = $this->extractItem($data, $colMap);
            if ($item) {
                $chunk[] = $item;
                if (count($chunk) >= $chunkSize) {
                    $this->processChunk($chunk);
                    $chunk = [];
                }
            }
        }
        fclose($handle);

        if (!empty($chunk)) {
            $this->processChunk($chunk);
        }
    }

    private function extractItem(array $data, array $colMap)
    {
        $idxRoute = $colMap['ID_Route'] ?? 1;
        $idxDriver = $colMap['Driver_Name'] ?? 3;
        $idxIdCustomer = $colMap['Cust_ID'] ?? 4;
        $idxNamaCustomer = $colMap['Cust_Name'] ?? 5;
        $idxSalesGroup = $colMap['Sales_Group'] ?? 7;
        $idxSo = $colMap['SO_Number'] ?? 9;
        $idxDn = $colMap['DN_Number'] ?? 10;
        $idxNamaProduk = $colMap['Product_Name'] ?? 11;
        $idxTanggal = $colMap['Actual_Date'] ?? 14;
        $idxJumlah = $colMap['Actual_Qty'] ?? 16;
        $idxStatusDelivery = $colMap['Status_Delivery'] ?? 18;

        $soNumber = trim((string) ($data[$idxSo] ?? ''));
        if ($soNumber === '') {
            return null;
        }
        $namaProdukExcel = strtoupper(trim((string) ($data[$idxNamaProduk] ?? '')));
        $jumlah = (int) ($data[$idxJumlah] ?? 0);
        if ($namaProdukExcel === '' || $jumlah <= 0) {
            return null;
        }

        $idProduk = $this->mapProduk[$namaProdukExcel] ?? 0;

        $rawDate = trim((string) ($data[$idxTanggal] ?? ''));
        $tanggalPengiriman = null;
        if ($rawDate !== '') {
            $parsedDate = date('Y-m-d', strtotime(str_replace('/', '-', $rawDate)));
            if ($parsedDate !== '1970-01-01' && $parsedDate !== false) {
                $tanggalPengiriman = $parsedDate;
            }
        }

        return [
            'id_route' => trim((string) ($data[$idxRoute] ?? '')),
            'nama_driver' => trim((string) ($data[$idxDriver] ?? '')),
            'id_customer' => trim((string) ($data[$idxIdCustomer] ?? '')),
            'nama_customer' => trim((string) ($data[$idxNamaCustomer] ?? '')),
            'sales_group' => trim((string) ($data[$idxSalesGroup] ?? '')),
            'so_number' => $soNumber,
            'no_dn' => trim((string) ($data[$idxDn] ?? '')),
            'nama_produk' => trim((string) ($data[$idxNamaProduk] ?? '')),
            'id_produk' => $idProduk,
            'id_pengguna_lokasi' => $this->uploadLokasi,
            'tanggal_pengiriman' => $tanggalPengiriman,
            'jumlah' => $jumlah,
            'status_delivery' => trim((string) ($data[$idxStatusDelivery] ?? '')),
        ];
    }

    private function processChunk(array $items)
    {
        if (empty($items)) {
            return;
        }

        $soList = [];
        foreach ($items as $it) {
            $so = trim($it['so_number'] ?? '');
            if ($so !== '') {
                $soList[] = $so;
            }
        }
        $soList = array_unique($soList);

        $existingTraceRows = DB::table('traceability')
            ->whereIn('so_number', $soList)
            ->get(['so_number', 'id_produk', 'tanggal_pengiriman']);

        $existingMap = [];
        foreach ($existingTraceRows as $ex) {
            $tgl = $ex->tanggal_pengiriman ? substr($ex->tanggal_pengiriman, 0, 10) : '';
            $key = $ex->so_number.'|'.(int) $ex->id_produk.'|'.$tgl;
            $existingMap[$key] = true;
        }

        $bkRows = DB::table('barang_keluar')
            ->where(function ($q) use ($soList) {
                foreach ($soList as $s) {
                    $q->orWhere('so_number', 'LIKE', '%'.$s.'%');
                }
            })
            ->orderBy('id_barang_keluar', 'DESC')
            ->get(['id_barang_keluar', 'so_number', 'id_produk', 'id_pengguna_lokasi', 'batch', 'best_before']);

        $bkMapBySoProd = [];
        $bkMapBySoOnly = [];
        foreach ($bkRows as $bk) {
            $arrSo = array_filter(array_map('trim', explode(',', $bk->so_number ?? '')));
            foreach ($arrSo as $sVal) {
                $keyProd = $sVal.'|'.(int) $bk->id_produk;
                if (! isset($bkMapBySoProd[$keyProd])) {
                    $bkMapBySoProd[$keyProd] = $bk;
                }
                if (! isset($bkMapBySoOnly[$sVal])) {
                    $bkMapBySoOnly[$sVal] = $bk;
                }
            }
        }

        $insertRows = [];
        foreach ($items as $it) {
            $soNumber = trim($it['so_number'] ?? '');
            $idProduk = (int) ($it['id_produk'] ?? 0);
            $idPenggunaLokasi = ! empty($it['id_pengguna_lokasi']) ? trim($it['id_pengguna_lokasi']) : null;
            $tanggalPengiriman = ! empty($it['tanggal_pengiriman']) ? substr($it['tanggal_pengiriman'], 0, 10) : null;

            $dupKey = $soNumber.'|'.$idProduk.'|'.($tanggalPengiriman ?? '');
            if ($soNumber !== '' && $idProduk > 0 && $tanggalPengiriman !== null && isset($existingMap[$dupKey])) {
                continue;
            }

            $idBarangKeluar = null;
            $lokasiDariBk = null;
            $batchNumber = null;
            $bestBefore = null;

            $lookupKeyProd = $soNumber.'|'.$idProduk;
            $lookup1 = $bkMapBySoProd[$lookupKeyProd] ?? null;
            if ($lookup1) {
                $idBarangKeluar = $lookup1->id_barang_keluar;
                $lokasiDariBk = $lookup1->id_pengguna_lokasi;
                $batchNumber = $lookup1->batch;
                $bestBefore = $lookup1->best_before ?: null;
            } else {
                $lookup2 = $bkMapBySoOnly[$soNumber] ?? null;
                if ($lookup2) {
                    $idBarangKeluar = $lookup2->id_barang_keluar;
                    $lokasiDariBk = $lookup2->id_pengguna_lokasi;
                    $batchNumber = $lookup2->batch;
                    $bestBefore = $lookup2->best_before ?: null;
                }
            }

            if ($lokasiDariBk !== null) {
                $idPenggunaLokasi = $lokasiDariBk;
            }
            if ($batchNumber === null && ! empty($it['batch_number'])) {
                $batchNumber = trim($it['batch_number']);
            }

            $insertRows[] = [
                'id_barang_keluar' => $idBarangKeluar,
                'id_pengguna_lokasi' => $idPenggunaLokasi,
                'id_route' => $it['id_route'] ?? null,
                'nama_driver' => $it['nama_driver'] ?? null,
                'id_customer' => $it['id_customer'] ?? null,
                'nama_customer' => $it['nama_customer'] ?? null,
                'sales_group' => $it['sales_group'] ?? null,
                'so_number' => $soNumber,
                'no_dn' => $it['no_dn'] ?? null,
                'nama_produk' => $it['nama_produk'] ?? null,
                'id_produk' => $idProduk,
                'tanggal_pengiriman' => $tanggalPengiriman,
                'jumlah' => $it['jumlah'] ?? 0,
                'batch_number' => $batchNumber,
                'best_before' => $bestBefore,
                'status_delivery' => $it['status_delivery'] ?? null,
            ];

            $existingMap[$dupKey] = true;
        }

        if (! empty($insertRows)) {
            foreach (array_chunk($insertRows, 500) as $chunk) {
                DB::table('traceability')->insert($chunk);
            }
        }
    }
}