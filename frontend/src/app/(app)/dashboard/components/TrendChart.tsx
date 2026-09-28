"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLORS, fmt, fmtTanggal, type SeriesPoint } from "../dashboard";

type Props = {
  inbound: SeriesPoint[];
  outbound: SeriesPoint[];
  height?: number;
};

export default function TrendChart({ inbound, outbound, height = 260 }: Props) {
  const map = new Map<string, { tanggal: string; inbound: number; outbound: number }>();
  inbound.forEach((p) =>
    map.set(p.tanggal, { tanggal: p.tanggal, inbound: p.qty, outbound: 0 })
  );
  outbound.forEach((p) => {
    const cur = map.get(p.tanggal) || { tanggal: p.tanggal, inbound: 0, outbound: 0 };
    cur.outbound = p.qty;
    map.set(p.tanggal, cur);
  });
  const data = Array.from(map.values()).sort((a, b) =>
    a.tanggal.localeCompare(b.tanggal)
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="tanggal"
          tickFormatter={fmtTanggal}
          tick={{ fontSize: 10.5, fill: COLORS.text }}
          axisLine={{ stroke: COLORS.grid }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.text }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => fmt(v)}
        />
        <Tooltip
          labelFormatter={(l) => fmtTanggal(String(l))}
          formatter={(v, n) => [
            fmt(Number(v) || 0),
            n === "inbound" ? "Barang Masuk" : "Barang Keluar",
          ]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #eef1f7",
            fontSize: 12,
            boxShadow: "0 10px 30px rgba(15,23,42,.08)",
          }}
        />
        <Legend
          formatter={(v) => (v === "inbound" ? "Barang Masuk" : "Barang Keluar")}
          wrapperStyle={{ fontSize: 11.5 }}
        />
        <Bar dataKey="inbound" fill={COLORS.inbound} radius={[4, 4, 0, 0]} barSize={14} />
        <Bar dataKey="outbound" fill={COLORS.outbound} radius={[4, 4, 0, 0]} barSize={14} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
