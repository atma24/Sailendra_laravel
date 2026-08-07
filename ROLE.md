# ROLE USER & AKSES — Sailendra WMS

Dokumen ini merangkum hak akses tiap role pengguna di aplikasi WMS.

## Daftar Role

| Role | Deskripsi |
|---|---|
| **SuperAdmin** | Administrator penuh, lintas lokasi, bisa import/upload data. |
| **Supervisor** | Kepala gudang per lokasi; semua operasi + persetujuan + master data. |
| **Support** | Dukungan lintas lokasi; akses lihat master data, inbound, outbound, stock, report. |
| **Checker** | Operator gudang; inbound, outbound, layout (read), stock, stock opname (input). |
| **Forklift** | Operator forklift; inbound, outbound, layout (read), stock. |

> Implementasi: role disimpan pada kolom `pengguna.role`. Menu per role didefinisikan di `get_menus_by_role()` (contoh `application/controllers/Inbound.php`, `Dashboard.php`), dan pengaman aksi di level HTTP/backend.

## Matriks Akses Menu (per Module)

Legend: ✓ = bisa mengakses, ✓(R) = hanya lihat/read-only, ✗ = tidak bisa.

| Menu / Module | SuperAdmin | Supervisor | Support | Checker | Forklift |
|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Master Data** | | | | | |
| &nbsp;&nbsp;Layout Gudang | ✓ | ✓ | ✓ | ✓ (R) | ✓ (R) |
| &nbsp;&nbsp;Form Layout Gudang | ✓ | ✓ | ✗ | ✗ | ✗ |
| &nbsp;&nbsp;History Layout Gudang | ✓ | ✓ | ✓ | ✗ | ✗ |
| &nbsp;&nbsp;List Produk | ✓ | ✓ | ✓ | ✗ | ✗ |
| &nbsp;&nbsp;List Plant | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Inbound** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Outbound** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Traceability** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Mutasi** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Stock** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Stock Opname** (input) | ✓ | ✓ | ✗ | ✓ | ✗ |
| **Stock Opname** (approve) | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Report** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Manajemen Pengguna** | ✓ | ✓ | ✗ | ✗ | ✗ |

## Kemampuan Khusus

| Kemampuan | SuperAdmin | Supervisor | Support | Checker | Forklift |
|---|---|---|---|---|---|
| Akses semua lokasi (pilih lokasi saat login) | ✓ | ✗ | ✓ | ✗ | ✗ |
| Edit/Hapus/Transfer data inbound | ✓ | ✓ | ✗ | ✗ | ✗ |
| CRUD master data (block, line, level, deep, lokasi, produk, plant) | ✓ | ✓ | ✗ | ✗ | ✗ |
| Import data outbound historical | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Upload data layout gudang** *(import master layout via Excel)* | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Upload data stok** *(import/set stok awal via Excel)* | ✓ | ✗ | ✗ | ✗ | ✗ |

## Catatan Enforcements

- **Frontend:** menu disembunyikan sesuai `get_menus_by_role()`.
- **Backend API** (`sailendra_backend/`): aksi tulis master data dicek `role` — hanya `Supervisor` & `SuperAdmin` yang lolos (`Hak akses ditolak`).
- **Controller:** endpoint sensitif menolak role lain via `show_error(403)`.
  - Edit/hapus/transfer inbound → `Supervisor`/`SuperAdmin` (`Inbound.php`).
  - Stock opname approve → `Supervisor`/`SuperAdmin` (`Stock_opname.php:248`).
  - Import outbound historical → `SuperAdmin` saja (`Outbound.php:1600`).
  - Manajemen pengguna → `Supervisor`/`SuperAdmin` (`Dashboard.php:134`).
- **Upload data layout gudang & upload data stok:** fitur tersedia di aplikasi Laravel; **belum** diimplementasikan di arsitektur CodeIgniter ini. Hak aksesnya: **SuperAdmin only**.
