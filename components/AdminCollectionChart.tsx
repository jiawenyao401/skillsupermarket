"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DailySkillCollectionPoint {
  date: string;
  newSkills: number;
  collectedSkills: number;
  totalSkills: number;
}

export function AdminCollectionChart({ data }: { data: DailySkillCollectionPoint[] }) {
  return (
    <div className="h-[340px] w-full" role="img" aria-label="最近 30 天 Skill 新增收录、采集覆盖和累计库存趋势">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 18, right: 8, bottom: 2, left: -14 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickFormatter={(value: string) => value.slice(5).replace("-", "/")}
            minTickGap={18}
          />
          <YAxis
            yAxisId="daily"
            axisLine={false}
            allowDecimals={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <YAxis
            yAxisId="total"
            orientation="right"
            axisLine={false}
            allowDecimals={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(label) => `${label}（上海时间）`}
            contentStyle={{
              border: "1px solid hsl(var(--border))",
              borderRadius: 14,
              background: "hsl(var(--card))",
              boxShadow: "0 12px 30px rgb(0 0 0 / 0.08)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ paddingTop: 14, fontSize: 12 }} />
          <Bar yAxisId="daily" dataKey="collectedSkills" name="采集覆盖" fill="hsl(var(--foreground))" radius={[5, 5, 0, 0]} maxBarSize={22} />
          <Bar yAxisId="daily" dataKey="newSkills" name="新增收录" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} maxBarSize={22} />
          <Line yAxisId="total" dataKey="totalSkills" name="累计库存" stroke="#0ea574" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
