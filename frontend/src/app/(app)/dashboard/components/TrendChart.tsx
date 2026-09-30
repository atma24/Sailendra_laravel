"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLORS, fmt } from "../dashboard";

export type TrendDatum = {
  /** Kunci unik titik (tanggal ISO atau label minggu). */
  key: string;
  /** Label yang tampil di sumbu X. */
  label: string;
  /** Label lengkap untuk tooltip. */
  full: string;
  planned: number;
  actual: number;
};

type Props = {
  data: TrendDatum[];
  height?: number;
  /** Label sumbu Y menjelaskan satuan (mis. "transaksi"). */
  unitLabel?: string;
};

export default function TrendChart({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -12, right: 8, top: 4 }} barGap={2}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: COLORS.text }}
          axisLine={{ stroke: COLORS.grid }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.text }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => fmt(v)}
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(_, payload) => {
            const p = payload?.[0]?.payload as TrendDatum | undefined;
            return p?.full ?? "";
          }}
          formatter={(v, n) => [
            `${fmt(Number(v) || 0)} transaksi`,
            n === "planned" ? "Planned" : "Terkonfirmasi",
          ]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #eef1f7",
            fontSize: 12,
            boxShadow: "0 10px 30px rgba(15,23,42,.08)",
          }}
        />
        <Legend
          formatter={(v) => (v === "planned" ? "Planned" : "Terkonfirmasi")}
          wrapperStyle={{ fontSize: 11.5 }}
        />
        <Bar dataKey="planned" fill={COLORS.planned} radius={[4, 4, 0, 0]} barSize={16} />
        <Bar dataKey="actual" fill={COLORS.actual} radius={[4, 4, 0, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
