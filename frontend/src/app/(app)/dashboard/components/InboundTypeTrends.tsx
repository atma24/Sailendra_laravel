"use client";

import { useMemo } from "react";
import {
  fmt,
  type SeriesPoint,
  type TypeSeriesRow,
} from "../dashboard";
import ChartCard, { EmptyChart } from "./ChartCard";
import ChartGroup from "./ChartGroup";
import TrendChart, { type TrendDatum } from "./TrendChart";
import { buildTrendData } from "./trend";

type Props = {
  /** Deret per tipe dari backend. */
  seriesByType: TypeSeriesRow[];
  /** Deret total (semua tipe) untuk kartu "Inbound Total". */
  totalPlanned: SeriesPoint[];
  totalActual: SeriesPoint[];
  /** Bila terisi ("1".."6"), mode harian; bila kosong, mode mingguan. */
  minggu: string;
  mulai: string;
  /** Awal bulan (YYYY-MM-DD) — acuan indeks "Minggu N". */
  monthStart?: string;
  bulan?: string;
  tahun?: string;
};

function TrendCard({
  title,
  planned,
  actual,
  mode,
  highlight,
}: {
  title: string;
  planned: SeriesPoint[];
  actual: SeriesPoint[];
  mode: {
    isWeekly: boolean;
    mulai: string;
    monthStart?: string;
    bulan?: string;
    tahun?: string;
  };
  highlight?: boolean;
}) {  const data = useMemo<TrendDatum[]>(
    () =>
      buildTrendData(planned, actual, {
        isWeekly: mode.isWeekly,
        mulai: mode.mulai,
        monthStart: mode.monthStart,
        bulan: mode.bulan,
        tahun: mode.tahun,
      }),
    [planned, actual, mode]
  );

  const sumPlanned = data.reduce((a, d) => a + d.planned, 0);
  const sumActual = data.reduce((a, d) => a + d.actual, 0);

  return (
    <ChartCard
      title={title}
      subtitle={mode.isWeekly ? "Harian (Senin–Minggu)" : "Mingguan"}
      className={highlight ? "border-emerald-200 ring-1 ring-emerald-100" : undefined}
      right={
        <div className="text-right text-[11.5px] leading-tight text-slate-500 tabular-nums">
          <div>
            <span className="font-semibold text-slate-700">
              {fmt(sumPlanned)}
            </span>{" "}
            planned
          </div>
          <div>
            <span className="font-semibold text-emerald-600">
              {fmt(sumActual)}
            </span>{" "}
            terkonfirmasi
          </div>
        </div>
      }
    >
      {data.length === 0 ? (
        <EmptyChart label="Tidak ada data pada periode ini" />
      ) : (
        <TrendChart data={data} />
      )}
    </ChartCard>
  );
}

export default function InboundTypeTrends({
  seriesByType,
  totalPlanned,
  totalActual,
  minggu,
  mulai,
  monthStart,
  bulan,
  tahun,
}: Props) {
  const isWeekly = minggu !== "";
  const mode = { isWeekly, mulai, monthStart, bulan, tahun };

  return (
    <ChartGroup
      title="Grafik Inbound"
      subtitle="Transaksi vs terkonfirmasi per tipe penerimaan"
      tone="inbound"
    >
      <TrendCard
        title="Inbound Total"
        planned={totalPlanned}
        actual={totalActual}
        mode={mode}
        highlight
      />

      {seriesByType.map((row) => (
        <TrendCard
          key={row.tipe}
          title={row.tipe}
          planned={row.series_planned}
          actual={row.series_actual}
          mode={mode}
        />
      ))}

      {seriesByType.length === 0 && (
        <ChartCard title="Per tipe">
          <EmptyChart />
        </ChartCard>
      )}
    </ChartGroup>
  );
}
