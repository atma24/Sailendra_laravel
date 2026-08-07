<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Form Stock Opname</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #111827; margin: 0; }
        h2 { text-align: center; font-size: 15px; margin: 0 0 4px; }
        .sub { text-align: center; font-size: 11px; color: #4b5563; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #4b5563; padding: 7px 6px; }
        th { background: #eef2f7; text-align: left; font-size: 10px; text-transform: uppercase; }
        td.produk { width: 42%; }
        td.lokasi { width: 24%; }
        td.bb { width: 19%; }
        td.stok { width: 15%; }
        tr.blank td { height: 26px; }
        .footer { margin-top: 14px; font-size: 10px; color: #6b7280; }
        @page { size: A4 portrait; margin: 12mm; }
    </style>
</head>
<body>
    <h2>Form Stock Opname</h2>
    <div class="sub">Tanggal: {{ $tanggal_opname }} &mdash; Lokasi: {{ session('id_pengguna_lokasi', '') }}</div>

    <table>
        <thead>
            <tr>
                <th class="produk">Produk</th>
                <th class="lokasi">Lokasi</th>
                <th class="bb">Best Before</th>
                <th class="stok">Stok Fisik</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($produk_list as $p)
                <tr class="blank">
                    <td class="produk">{{ $p->nama_produk }}</td>
                    <td class="lokasi"></td>
                    <td class="bb"></td>
                    <td class="stok"></td>
                </tr>
            @empty
                <tr class="blank">
                    <td class="produk"></td>
                    <td class="lokasi"></td>
                    <td class="bb"></td>
                    <td class="stok"></td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">Form ini dicetak untuk pengisian opname fisik manual. Isi kolom Lokasi, Best Before, dan Stok Fisik secara manual.</div>
</body>
</html>
