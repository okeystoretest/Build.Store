"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { formatBRL } from "@/lib/utils/money";

interface RevenueChartProps {
  data: { date: string; revenueCents: number }[];
}

/** Daily revenue area chart in the primary tone. */
export function RevenueChart({ data }: RevenueChartProps) {
  const points = data.map((d) => ({
    label: format(new Date(d.date), "dd/MM"),
    reais: d.revenueCents / 100,
  }));

  if (points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-body-md text-on-surface-variant">
        Sem vendas no período para exibir.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#835051" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#835051" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e8e1e1" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#847373", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e8e1e1" }}
        />
        <YAxis
          tick={{ fill: "#847373", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `R$${v}`}
          width={64}
        />
        <Tooltip
          formatter={(v: number) => [formatBRL(v * 100), "Receita"]}
          contentStyle={{
            borderRadius: 16,
            border: "1px solid #d6c2c1",
            background: "#ffffff",
            fontSize: 13,
          }}
        />
        <Area
          type="monotone"
          dataKey="reais"
          stroke="#835051"
          strokeWidth={2.5}
          fill="url(#rev)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
