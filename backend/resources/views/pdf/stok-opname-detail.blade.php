<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Detail Stock Opname - {{ $tanggal_opname }}</title>
    <style>
        @page { size: A4 landscape; margin: 10mm 9mm 12mm 9mm; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; color: #111827; margin: 0; font-size: 8.5px; line-height: 1.35; }
        /* Header */
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .header-left .brand { font-size: 9px; font-weight: 900; letter-spacing: 1.6px; color: #191970; text-transform: uppercase; }
        .header-left .brand-sub { font-size: 7px; color: #6b7280; letter-spacing: .35px; margin-top: 1px; }
        .header-left h1 { margin: 6px 0 3px; font-size: 13.5px; font-weight: 900; color: #111827; letter-spacing: -.3px; }
        .header-left .sub { font-size: 7.5px; color: #4b5563; }
        .header-right { text-align: right; vertical-align: top; }
        .date-badge { display: inline-block; background: #191970; color: #fff; font-size: 8px; font-weight: 800; padding: 5px 10px; border-radius: 5px; letter-spacing: .3px; }
        .time-badge { margin-top: 5px; font-size: 7.5px; color: #374151; font-weight: 700; }
        .time-badge span { color: #6b7280; font-weight: 600; }
        .divider { height: 2px; background: #191970; margin: 0 0 8px; }
        /* Meta grid */
        .meta-wrap { margin-bottom: 8px; }
        .meta-table { width: 100%; border-collapse: collapse; }
        .meta-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 8px; background: #fbfcff; }
        .meta-label { font-size: 6.5px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
        .meta-value { font-size: 8.5px; font-weight: 800; color: #111827; }
        .meta-value.small { font-size: 7.5px; font-weight: 700; color: #374151; }
        /* Summary cards */
        .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 9px; }
        .summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 7px 8px; text-align: center; }
        .summary-card.dark { background: #191970; color: #fff; border-color: #191970; }
        .summary-card.green { background: #ecfdf5; border-color: #a7f3d0; }
        .summary-card.red { background: #fef2f2; border-color: #fecaca; }
        .summary-card.amber { background: #fffbeb; border-color: #fde68a; }
        .summary-label { font-size: 6.2px; font-weight: 800; letter-spacing: .45px; text-transform: uppercase; opacity: .85; }
        .summary-card.dark .summary-label { color: #c7d2fe; }
        .summary-card.green .summary-label { color: #065f46; }
        .summary-card.red .summary-label { color: #991b1b; }
        .summary-card.amber .summary-label { color: #92400e; }
        .summary-num { font-size: 13px; font-weight: 900; margin-top: 2px; line-height: 1; }
        .summary-card.dark .summary-num { color: #fff; }
        .summary-card.green .summary-num { color: #065f46; }
        .summary-card.red .summary-num { color: #dc2626; }
        .summary-card.amber .summary-num { color: #d97706; }
        .summary-sub { font-size: 6.5px; font-weight: 600; margin-top: 2px; }
        .summary-card.dark .summary-sub { color: #c7d2fe; }
        .summary-card.green .summary-sub { color: #047857; }
        .summary-card.red .summary-sub { color: #b91c1c; }
        .summary-card.amber .summary-sub { color: #92400e; }

        /* Table */
        table.main { width: 100%; border-collapse: collapse; font-size: 7.5px; }
        table.main thead th { background: #191970; color: #fff; font-size: 6.6px; font-weight: 800; text-transform: uppercase; letter-spacing: .35px; padding: 6px 5px; text-align: left; border: 1px solid #191970; white-space: nowrap; }
        table.main thead th.center { text-align: center; }
        table.main thead th.right { text-align: right; }
        table.main tbody td { padding: 4.5px 5px; border: 1px solid #e5e7eb; vertical-align: middle; }
        table.main tbody tr.row-alt td { background: #f8f9ff; }
        table.main tbody tr.block-row td { background: #eef2ff; font-weight: 800; color: #191970; font-size: 7.5px; border-color: #c7d2fe; }
        table.main tbody tr.total-row td { background: #191970; color: #fff; font-weight: 800; font-size: 7.8px; border-color: #191970; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .selisih-neg { color: #dc2626; font-weight: 800; }
        .selisih-pos { color: #16a34a; font-weight: 800; }
        .selisih-zero { color: #6b7280; font-weight: 700; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 6.3px; font-weight: 800; letter-spacing: .2px; }
        .badge-ok { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .badge-err { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .badge-warn { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .catatan { color: #374151; max-width: 135px; word-wrap: break-word; }
        .empty { text-align: center; padding: 18px; color: #6b7280; font-weight: 700; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 6px; font-size: 8px; }
        /* Footer */
        .footer { margin-top: 10px; }
        .footer-table { width: 100%; border-collapse: collapse; }
        .sig-box { text-align: center; padding-top: 6px; }
        .sig-title { font-size: 7px; font-weight: 700; color: #374151; margin-bottom: 38px; }
        .sig-line { border-top: 1px solid #111827; margin: 0 18px; padding-top: 4px; font-size: 7.5px; font-weight: 800; color: #111827; }
        .sig-role { font-size: 6.3px; font-weight: 600; color: #6b7280; margin-top: 2px; }
        .doc-footer { margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 6px; display: table; width: 100%; font-size: 6.2px; color: #9ca3af; }
        .doc-footer .left { display: table-cell; text-align: left; }
        .doc-footer .right { display: table-cell; text-align: right; }
        .ket-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 5px; padding: 5px 7px; font-size: 6.7px; color: #92400e; margin-top: 7px; }
        .ket-title { font-weight: 800; margin-bottom: 2px; }
    </style>
</head>
<body>

    {{-- HEADER --}}
    <table class="header-table">
        <tr>
            <td class="header-left" style="width: 68%;">
                <div class="brand">SAILENDRA &mdash; WMS</div>
                <div class="brand-sub">Warehouse Management System &middot; Laporan Stock Opname Detail</div>
                <h1>LAPORAN DETAIL STOCK OPNAME</h1>
                <div class="sub">
                    Jenis Opname: <strong>{{ $jenis_opname ?? '-' }}</strong>
                    &nbsp;&middot;&nbsp; Sumber: <strong>{{ $sumber_opname ?? '-' }}</strong>
                    &nbsp;&middot;&nbsp; Dokumen Detail Per Sesi Opname
                    @if(!empty($lokasi_names))
                        &nbsp;&middot;&nbsp; Lokasi: <strong>{{ implode(', ', $lokasi_names) }}</strong>
                    @endif
                </div>
            </td>
            <td class="header-right" style="width: 32%;">
                <div class="date-badge">{{ $tanggal_opname ?? '-' }}</div>
                <div class="time-badge">
                    Waktu Simpan: <strong>{{ $waktu_simpan ?? '-' }}</strong><br>
                    <span>Dicetak: {{ $printed_at }}</span>
                </div>
            </td>
        </tr>
    </table>
    <div class="divider"></div>

    {{-- META INFO GRID --}}
    <div class="meta-wrap">
        <table class="meta-table" cellpadding="0" cellspacing="0">
            <tr>
                <td style="width: 24%; padding-right: 5px;">
                    <div class="meta-box">
                        <div class="meta-label">Tanggal Opname</div>
                        <div class="meta-value">{{ $tanggal_opname ?? '-' }}</div>
                        <div class="meta-value small" style="margin-top: 1px;">{{ $hari_label ?? '' }}</div>
                    </div>
                </td>
                <td style="width: 24%; padding-right: 5px;">
                    <div class="meta-box">
                        <div class="meta-label">Waktu Simpan (Created At)</div>
                        <div class="meta-value">{{ $waktu_simpan ?? '-' }}</div>
                        <div class="meta-value small" style="margin-top: 1px;">Sesi: {{ $created_at ?? '-' }}</div>
                    </div>
                </td>
                <td style="width: 18%; padding-right: 5px;">
                    <div class="meta-box">
                        <div class="meta-label">Petugas / Sumber</div>
                        <div class="meta-value">{{ $petugas ?? '-' }}</div>
                        <div class="meta-value small" style="margin-top: 1px;">{{ $sumber_opname ?? '' }} &middot; {{ $jenis_opname ?? '' }}</div>
                    </div>
                </td>
                <td style="width: 17%; padding-right: 5px;">
                    <div class="meta-box">
                        <div class="meta-label">Lokasi Gudang</div>
                        <div class="meta-value" style="font-size: 7.5px;">{{ !empty($lokasi_names) ? implode(', ', array_slice($lokasi_names,0,2)) : '-' }}{{ count($lokasi_names ?? []) > 2 ? ' +'.(count($lokasi_names)-2).' lain' : '' }}</div>
                        <div class="meta-value small" style="margin-top: 1px;">{{ count($lokasi_names ?? []) }} lokasi &middot; {{ count($grouped ?? []) }} block</div>
                    </div>
                </td>
                <td style="width: 17%;">
                    <div class="meta-box" style="background: #191970; border-color:#191970;">
                        <div class="meta-label" style="color:#c7d2fe;">Total Item</div>
                        <div class="meta-value" style="color:#fff; font-size: 12px;">{{ number_format($total_items ?? 0, 0, ',', '.') }}</div>
                        <div class="meta-value small" style="color:#c7d2fe;">{{ $total_blocks ?? 0 }} block &middot; {{ $total_produk_unik ?? 0 }} produk unik</div>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    {{-- SUMMARY CARDS --}}
    <table class="summary-table" cellpadding="0" cellspacing="0">
        <tr>
            <td style="width: 25%; padding-right: 5px;">
                <div class="summary-card dark">
                    <div class="summary-label">Total Stok Sistem</div>
                    <div class="summary-num">{{ number_format($sum_sistem ?? 0, 0, ',', '.') }}</div>
                    <div class="summary-sub">Stok tercatat sistem</div>
                </div>
            </td>
            <td style="width: 25%; padding-right: 5px;">
                <div class="summary-card green">
                    <div class="summary-label">Total Stok Fisik</div>
                    <div class="summary-num">{{ number_format($sum_fisik ?? 0, 0, ',', '.') }}</div>
                    <div class="summary-sub">Hasil hitung fisik</div>
                </div>
            </td>
            <td style="width: 25%; padding-right: 5px;">
                <div class="summary-card {{ ($sum_selisih ?? 0) == 0 ? 'amber' : (($sum_selisih ?? 0) < 0 ? 'red' : 'green') }}">
                    <div class="summary-label">Total Selisih</div>
                    <div class="summary-num">{{ ($sum_selisih ?? 0) > 0 ? '+' : '' }}{{ number_format($sum_selisih ?? 0, 0, ',', '.') }}</div>
                    <div class="summary-sub">
                        @if(($sum_selisih ?? 0) == 0) Sesuai / Balance @elseif(($sum_selisih ?? 0) < 0) Minus (kurang) @else Plus (lebih) @endif
                    </div>
                </div>
            </td>
            <td style="width: 25%;">
                <div class="summary-card {{ ($jml_selisih ?? 0) > 0 ? 'red' : 'green' }}">
                    <div class="summary-label">Item Selisih</div>
                    <div class="summary-num">{{ number_format($jml_selisih ?? 0, 0, ',', '.') }} / {{ number_format($total_items ?? 0, 0, ',', '.') }}</div>
                    <div class="summary-sub">{{ $jml_sesuai ?? 0 }} sesuai &middot; {{ $jml_minus ?? 0 }} minus &middot; {{ $jml_plus ?? 0 }} plus</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- MAIN TABLE --}}
    @if(empty($rows) || count($rows) === 0)
        <div class="empty">Tidak ada data detail untuk sesi opname ini.</div>
    @else
        <table class="main">
            <thead>
                <tr>
                    <th class="center" style="width: 28px;">No</th>
                    <th style="width: 19%;">Produk</th>
                    <th class="center" style="width: 8%;">Lokasi</th>
                    <th class="center" style="width: 10%;">Best Before</th>
                    <th class="center" style="width: 7%;">Satuan</th>
                    <th class="right" style="width: 8%;">Stok Sistem</th>
                    <th class="right" style="width: 8%;">Stok Fisik</th>
                    <th class="right" style="width: 8%;">Selisih</th>
                    <th style="width: 14%;">Catatan</th>
                    <th class="center" style="width: 7%;">Stok Sebelum</th>
                    <th class="center" style="width: 8%;">Diubah Oleh</th>
                </tr>
            </thead>
            <tbody>
                @php $no = 1; @endphp
                @foreach($grouped as $g)
                    @foreach($g['rows'] as $idx => $r)
                        @php
                            $isAlt = $idx % 2 === 1;
                            $sel = intval($r->selisih ?? 0);
                            $cls = $sel < 0 ? 'selisih-neg' : ($sel > 0 ? 'selisih-pos' : 'selisih-zero');
                            $plus = $sel > 0 ? '+' : '';
                        @endphp
                        <tr class="{{ $isAlt ? 'row-alt' : '' }}">
                            <td class="text-center" style="color:#6b7280; font-weight: 700;">{{ $no++ }}</td>
                            <td>
                                <div style="font-weight: 800; color:#111827;">{{ $r->nama_produk }}</div>
                                <div style="font-size: 6.2px; color:#6b7280;">ID: {{ $r->id_produk }}</div>
                            </td>
                            <td class="text-center" style="font-weight: 800; color:#191970;">{{ $r->lokasi_block }}</td>
                            <td class="text-center">{{ $r->best_before ?: '-' }}</td>
                            <td class="text-center" style="font-weight: 700;">{{ $r->satuan ?: '-' }}</td>
                            <td class="text-right" style="font-weight: 700;">{{ number_format(intval($r->stok_sistem ?? 0), 0, ',', '.') }}</td>
                            <td class="text-right" style="font-weight: 800; background: #f0fdf4;">{{ number_format(intval($r->stok_fisik ?? 0), 0, ',', '.') }}</td>
                            <td class="text-right {{ $cls }}">{{ $plus }}{{ number_format($sel, 0, ',', '.') }}</td>
                            <td class="catatan">{{ trim((string)($r->alasan ?? '')) !== '' ? $r->alasan : '-' }}</td>
                            <td class="text-center" style="color:#6b7280;">{{ isset($r->stok_sebelumnya) && $r->stok_sebelumnya !== null ? number_format(intval($r->stok_sebelumnya),0,',','.') : '-' }}</td>
                            <td class="text-center" style="font-size: 6.8px;">{{ trim((string)($r->dirubah_oleh ?? '')) !== '' ? $r->dirubah_oleh : '-' }}</td>
                        </tr>
                    @endforeach
                    {{-- Block subtotal --}}
                    <tr class="block-row">
                        <td colspan="5" class="text-right" style="text-align: right;">SUBTOTAL BLOCK {{ $g['name'] }}</td>
                        <td class="text-right">{{ number_format($g['s'],0,',','.') }}</td>
                        <td class="text-right">{{ number_format($g['f'],0,',','.') }}</td>
                        <td class="text-right {{ $g['se'] < 0 ? 'selisih-neg' : ($g['se'] > 0 ? 'selisih-pos' : 'selisih-zero') }}" style="color: {{ $g['se'] < 0 ? '#dc2626' : ($g['se'] > 0 ? '#16a34a' : '#6b7280') }};">{{ $g['se'] > 0 ? '+' : '' }}{{ number_format($g['se'],0,',','.') }}</td>
                        <td colspan="3" style="font-size: 6.5px; font-weight: 600; color:#4b5563;">{{ count($g['rows']) }} item</td>
                    </tr>
                @endforeach
                {{-- Grand total --}}
                <tr class="total-row">
                    <td colspan="5" class="text-right" style="text-align: right; letter-spacing:.3px;">TOTAL KESELURUHAN</td>
                    <td class="text-right">{{ number_format($sum_sistem,0,',','.') }}</td>
                    <td class="text-right">{{ number_format($sum_fisik,0,',','.') }}</td>
                    <td class="text-right">{{ ($sum_selisih > 0 ? '+' : '') . number_format($sum_selisih,0,',','.') }}</td>
                    <td colspan="3" style="font-size: 6.6px; font-weight: 700;">{{ number_format($total_items,0,',','.') }} item &middot; {{ count($grouped) }} block</td>
                </tr>
            </tbody>
        </table>

        @if(($jml_selisih ?? 0) > 0)
            <div class="ket-box">
                <div class="ket-title">Keterangan Selisih:</div>
                Terdapat <strong>{{ $jml_selisih }} item</strong> dengan selisih ({{ $jml_minus }} minus / {{ $jml_plus }} plus). Selisih minus menunjukkan stok fisik kurang dari sistem, plus menunjukkan lebih. Periksa catatan wajib pada kolom Catatan untuk alasan penyesuaian.
            </div>
        @else
            <div class="ket-box" style="background:#ecfdf5; border-color:#a7f3d0; color:#065f46;">
                <div class="ket-title">Status: Sesuai</div>
                Seluruh {{ $total_items }} item pada sesi ini <strong>sesuai</strong> antara stok fisik dan stok sistem (selisih 0).
            </div>
        @endif
    @endif

    {{-- SIGNATURE --}}
    <div class="footer">
        <table class="footer-table">
            <tr>
                <td style="width: 33%;">
                    <div class="sig-box">
                        <div class="sig-title">Dihitung Oleh</div>
                        <div class="sig-line">{{ $petugas ?? 'Checker' }}</div>
                        <div class="sig-role">Checker / Petugas Opname</div>
                    </div>
                </td>
                <td style="width: 34%;">
                    <div class="sig-box">
                        <div class="sig-title">Diverifikasi Oleh</div>
                        <div class="sig-line" style="margin: 0 28px;">&nbsp;</div>
                        <div class="sig-role">Auditor / Supervisor</div>
                    </div>
                </td>
                <td style="width: 33%;">
                    <div class="sig-box">
                        <div class="sig-title">Mengetahui</div>
                        <div class="sig-line" style="margin: 0 18px;">&nbsp;</div>
                        <div class="sig-role">Kepala Gudang</div>
                    </div>
                </td>
            </tr>
        </table>
        <div class="doc-footer">
            <div class="left">
                Dokumen: Detail Stock Opname &middot; {{ $tanggal_opname }} &middot; {{ $created_at ?? $waktu_simpan ?? '' }} &middot; {{ $jenis_opname ?? '' }} &middot; {{ $sumber_opname ?? '' }}
            </div>
            <div class="right">
                Halaman 1 dari 1 &middot; Dicetak {{ $printed_at }} &middot; Sailendra WMS
            </div>
        </div>
    </div>

</body>
</html>
