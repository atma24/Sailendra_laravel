ALTER TABLE `barang_masuk`
    ADD COLUMN `tanggal_produksi` DATE NULL AFTER `tanggal_masuk`;

UPDATE `barang_masuk`
SET `tanggal_produksi` = DATE_SUB(`best_before`, INTERVAL 2 YEAR)
WHERE `tanggal_produksi` IS NULL
  AND `best_before` IS NOT NULL
  AND TRIM(`best_before`) <> ''
  AND `best_before` < '9999-01-01'
  AND STR_TO_DATE(`best_before`, '%Y-%m-%d') IS NOT NULL
  AND STR_TO_DATE(`best_before`, '%Y-%m-%d') = `best_before`;
