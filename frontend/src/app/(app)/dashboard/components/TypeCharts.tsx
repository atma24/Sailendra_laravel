"use client";

import { fmt, type TypeRow } from "../dashboard";
import ChartCard, { EmptyChart } from "./ChartCard";
import PlannedActualBar from "./PlannedActualBar";

type Props = {
  title: string;
  subtitle?: string;
  data: TypeRow[];
  overall: TypeRow;
  meta: (r: TypeRow) => string;
};

export default function TypeCharts({ title, subtitle, data, overall, meta }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-extrabold tracking-tight text-slate-800">
          {title}
        </h2>
        {subtitle && (
          <span className="text-[12px] text-slate-400">{subtitle}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Overall"
          subtitle="Total transaksi vs terkonfirmasi"
          className="border-indigo-100 bg-indigo-50/30"
        >
          <PlannedActualBar
            data={[{ name: "Overall", planned: overall.planned, actual: overall.actual }]}
            height={240}
          />
          <div className="mt-1 text-[11.5px] text-slate-400 tabular-nums">
            {fmt(overall.planned_qty)} qty · {fmt(overall.actual_qty)} qty terkonfirmasi
          </div>
        </ChartCard>

        {data.length === 0 && (
          <ChartCard title="Per tipe">
            <EmptyChart />
          </ChartCard>
        )}

        {data.map((row) => (
          <ChartCard key={row.tipe} title={row.tipe} subtitle={meta(row)}>
            <PlannedActualBar
              data={[{ name: row.tipe, planned: row.planned, actual: row.actual }]}
              height={240}
            />
            <div className="mt-1 text-[11.5px] text-slate-400 tabular-nums">
              {fmt(row.planned_qty)} qty · {fmt(row.actual_qty)} qty terkonfirmasi
            </div>
          </ChartCard>
        ))}
      </div>
    </div>
  );
}
