"use client";

import { fmt, type GroupRow } from "../dashboard";
import ChartCard, { EmptyChart } from "./ChartCard";
import PlannedActualBar from "./PlannedActualBar";

type Props = {
  title: string;
  subtitle?: string;
  rows: GroupRow[];
  height?: number;
};

export default function GroupBarChart({ title, subtitle, rows, height }: Props) {
  const data = rows.map((r) => ({
    name: r.label,
    planned: r.planned,
    actual: r.actual,
  }));

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <>
          <div
            className="overflow-y-auto pr-1"
            style={{ maxHeight: height ?? 360 }}
          >
            <div style={{ height: Math.max(data.length * 42, 160) }}>
              <PlannedActualBar data={data} horizontal height={data.length * 42} />
            </div>
          </div>
          <div className="mt-2 max-h-28 overflow-y-auto rounded-lg border border-slate-100">
            <table className="w-full text-[11.5px]">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pl-2 pr-3 font-medium text-slate-600">
                      {r.label}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">
                      {fmt(r.planned_qty)} qty
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-indigo-900">
                      {fmt(r.actual_qty)} qty
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ChartCard>
  );
}
