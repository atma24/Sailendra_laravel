"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmt, ZONA_LABEL, ZONA_ORDER, zonaColor } from "../dashboard";
import ChartCard, { EmptyChart } from "./ChartCard";

type Props = { zona: Record<string, number> };

export default function ZonaPie({ zona }: Props) {
  const data = ZONA_ORDER.map((k) => ({
    key: k,
    name: ZONA_LABEL[k] || k,
    value: Number(zona?.[k] || 0),
  })).filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title="Distribusi Stok per Zona" subtitle="Berdasarkan qty fisik">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="h-[210px] w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={zonaColor(d.key)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [fmt(Number(v) || 0), "Qty"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #eef1f7",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full space-y-1.5 sm:w-1/2">
            {data.map((d) => (
              <div key={d.key} className="flex items-center gap-2 text-[12px]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: zonaColor(d.key) }}
                />
                <span className="flex-1 text-slate-600">{d.name}</span>
                <span className="tabular-nums font-semibold text-slate-700">
                  {fmt(d.value)}
                </span>
                <span className="w-10 text-right tabular-nums text-slate-400">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
