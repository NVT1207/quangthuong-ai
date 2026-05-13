"use client";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";
import { formatUSD, USD_VND_RATE } from "@/lib/format";

export function UsageChart({ data }: { data: { date: string; cost: number; requests: number }[] }) {
  return (
    <div className="card p-5 h-80">
      <p className="text-sm font-medium mb-3">Sử dụng 7 ngày qua</p>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickFormatter={(v) => `$${(v / USD_VND_RATE).toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
            labelStyle={{ color: "#fbbf24" }}
            formatter={(value: number, name: string) =>
              name === "Chi phí (USD)" ? [formatUSD(value), name] : [value, name]
            }
          />
          <Area type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} fill="url(#costGrad)" name="Chi phí (USD)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
