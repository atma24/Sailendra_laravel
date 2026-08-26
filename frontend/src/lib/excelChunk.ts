import * as XLSX from "xlsx";

/**
 * Membaca file Excel (.xlsx / .xls) dan memecah baris data (tanpa header) menjadi beberapa file Excel chunk kecil.
 * @param file File excel asli dari pengguna
 * @param chunkSize Jumlah baris per batch file (default 50)
 */
export async function chunkExcelFile(file: File, chunkSize = 50): Promise<File[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Ambil semua data sebagai array of array (2D array)
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

  if (rows.length <= 1) {
    return [file]; // Tidak ada data atau hanya header
  }

  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  // Jika total baris data <= chunkSize, kirim file asli
  if (dataRows.length <= chunkSize) {
    return [file];
  }

  const chunkFiles: File[] = [];
  const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
  const ext = file.name.slice(file.name.lastIndexOf("."));

  for (let i = 0; i < dataRows.length; i += chunkSize) {
    const chunkDataRows = dataRows.slice(i, i + chunkSize);
    const chunkRows = [headerRow, ...chunkDataRows];

    const newWs = XLSX.utils.aoa_to_sheet(chunkRows);
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newWs, firstSheetName || "Sheet1");

    const outBuffer = XLSX.write(newWb, { bookType: "xlsx", type: "array" });
    const partNum = Math.floor(i / chunkSize) + 1;
    const chunkBlob = new Blob([outBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const chunkFile = new File([chunkBlob], `${fileNameWithoutExt}_part${partNum}${ext}`, {
      type: chunkBlob.type,
    });
    chunkFiles.push(chunkFile);
  }

  return chunkFiles;
}
