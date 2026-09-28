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

export type BarDatum = {
  name: string;
  planned: number;
  actual: number;
};

type Props = {
  data: BarDatum[];
  height?: number;
  horizontal?: boolean;
  unitLabel?: string;
};

export default function PlannedActualBar({
  data,
  height = 240,
  horizontal = false,
}: Props) {
  const common = (
    <>
      <CartesianGrid stroke={COLORS.grid} vertical={!horizontal} horizontal={horizontal} />
      <XAxis
        dataKey={horizontal ? undefined : "name"}
        type={horizontal ? "number" : "category"}
        tick={{ fontSize: 11, fill: COLORS.text }}
        axisLine={{ stroke: COLORS.grid }}
        tickLine={false}
        interval={0}
        angle={!horizontal && data.length > 6 ? -30 : 0}
        textAnchor={!horizontal && data.length > 6 ? "end" : "middle"}
        height={!horizontal && data.length > 6 ? 56 : 30}
      />
      <YAxis
        dataKey={horizontal ? "name" : undefined}
        type={horizontal ? "category" : "number"}
        tick={{ fontSize: 11, fill: COLORS.text }}
        axisLine={false}
        tickLine={false}
        width={horizontal ? 90 : 44}
        tickFormatter={(v) => fmt(v)}
      />
      <Tooltip
        formatter={(v, n) => [fmt(Number(v) || 0), n === "planned" ? "Transaksi" : "Terkonfirmasi"]}
        contentStyle={{
          borderRadius: 12,
          border: "1px solid #eef1f7",
          fontSize: 12,
          boxShadow: "0 10px 30px rgba(15,23,42,.08)",
        }}
      />
      <Legend
        formatter={(v) => (v === "planned" ? "Transaksi" : "Terkonfirmasi")}
        wrapperStyle={{ fontSize: 11.5 }}
      />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {horizontal ? (
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          {common}
          <Bar dataKey="planned" fill={COLORS.planned} radius={[0, 4, 4, 0]} barSize={10} />
          <Bar dataKey="actual" fill={COLORS.actual} radius={[0, 4, 4, 0]} barSize={10} />
        </BarChart>
      ) : (
        <BarChart data={data} margin={{ left: -10, right: 8, top: 4 }}>
          {common}
          <Bar dataKey="planned" fill={COLORS.planned} radius={[4, 4, 0, 0]} barSize={22} />
          <Bar dataKey="actual" fill={COLORS.actual} radius={[4, 4, 0, 0]} barSize={22} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
