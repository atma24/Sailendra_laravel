import * as XLSX from "xlsx";

/**
 * Membaca file Excel (.xlsx / .xls) dan memecah data berdasarkan batas GIN NO (atau entitas dokumen),
 * sehingga seluruh baris item milik 1 GIN NO dipastikan SELALU berada dalam 1 file batch chunk yang sama.
 *
 * @param file File excel asli dari pengguna
 * @param targetGroupSize Target perkiraan jumlah GIN NO per file batch (default 25 GIN per batch)
 */
export async function chunkExcelFile(file: File, targetGroupSize = 25): Promise<File[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Ambil semua data sebagai 2D array
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

  if (rows.length <= 1) {
    return [file]; // Tidak ada data atau hanya header
  }

  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  // Cari kolom kunci pemecahan (GIN NO / Picking_List_No / NO GIN / DMS NO)
  let keyColIdx = -1;
  if (Array.isArray(headerRow)) {
    headerRow.forEach((h: any, i: number) => {
      if (h) {
        const str = String(h).trim().toUpperCase();
        if (
          str.includes("PICKING_LIST_NO") ||
          str.includes("GIN") ||
          str.includes("NO GIN") ||
          str.includes("GIN NO") ||
          str.includes("ORDERNO_DMS") ||
          str.includes("NO OTM")
        ) {
          if (keyColIdx === -1) keyColIdx = i;
        }
      }
    });
  }

  // Jika kolom GIN tidak ditemukan, gunakan fallback chunking per 50 baris biasa
  if (keyColIdx === -1) {
    keyColIdx = 0;
  }

  // Kelompokkan baris-baris data secara utuh berdasarkan GIN NO
  const ginGroups: { key: string; rows: any[] }[] = [];
  let currentKey = "";
  let currentRows: any[] = [];

  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const rawVal = row[keyColIdx] !== undefined && row[keyColIdx] !== null ? String(row[keyColIdx]).trim() : "";

    if (rawVal !== "" && rawVal !== currentKey) {
      if (currentRows.length > 0) {
        ginGroups.push({ key: currentKey, rows: currentRows });
      }
      currentKey = rawVal;
      currentRows = [row];
    } else {
      currentRows.push(row);
    }
  }
  if (currentRows.length > 0) {
    ginGroups.push({ key: currentKey, rows: currentRows });
  }

  // Jika total GIN <= targetGroupSize, kirim file asli tanpa dipotong
  if (ginGroups.length <= targetGroupSize) {
    return [file];
  }

  // Pecah GIN groups ke dalam beberapa file batch
  const chunkFiles: File[] = [];
  const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
  const ext = file.name.slice(file.name.lastIndexOf("."));

  for (let i = 0; i < ginGroups.length; i += targetGroupSize) {
    const sliceGroups = ginGroups.slice(i, i + targetGroupSize);
    const chunkDataRows: any[] = [];

    for (const group of sliceGroups) {
      chunkDataRows.push(...group.rows);
    }

    const chunkRows = [headerRow, ...chunkDataRows];
    const newWs = XLSX.utils.aoa_to_sheet(chunkRows);
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newWs, firstSheetName || "Sheet1");

    const outBuffer = XLSX.write(newWb, { bookType: "xlsx", type: "array" });
    const partNum = Math.floor(i / targetGroupSize) + 1;
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
