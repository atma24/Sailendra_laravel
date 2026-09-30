<?php

namespace App\Support\Dashboard;

/**
 * Konstanta bersama untuk seluruh query dashboard.
 *
 * Dipusatkan agar status/tipe/zona yang "sama" tidak ditulis ulang
 * di banyak tempat (controller, service, dsb).
 */
final class DashboardConstants
{
    /** Status transaksi yang dianggap final/terkonfirmasi. */
    public const CONFIRMED_STATUSES = ['confirmed', 'selesai'];

    /** Status transaksi yang dianggap batal (dikecualikan dari hitungan). */
    public const CANCELED_STATUSES = ['canceled', 'cancelled'];

    /** Daftar zona stok beserta qty default 0. */
    public const ZONA_ORDER = [
        'normal',
        'bad',
        'reject',
        'receh',
        'mobil',
        'festive',
        'transit',
        'hold',
        'qi',
    ];

    /** Kategori lokasi yang termasuk blok khusus (bukan blok regular). */
    public const SPECIAL_KATEGORI = [
        'BAD STOCK',
        'BADSTOCK',
        'REJECT',
        'RECEH',
        'MOBIL',
        'FESTIVE',
        'TRANSIT',
        'HOLD',
    ];

    /** Awalan kode lokasi (block-line) yang menandakan blok khusus per zona. */
    public const SPECIAL_LOKASI_PREFIXES = [
        'BAD STOCK-',
        'BADSTOCK-',
        'BS-',
        'REJECT-',
        'RECEH-',
        'MOBIL-',
        'FESTIVE-',
        'TRANSIT-',
        'HOLD-',
    ];

    /** Ambang hari untuk alert produk mendekati kadaluarsa. */
    public const EXPIRED_ALERT_DAYS = 30;

    private function __construct() {}
}
