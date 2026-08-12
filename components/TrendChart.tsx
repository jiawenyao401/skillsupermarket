"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TrendChartProps {
  data: Array<{
    date: string;
    githubStars: number;
    githubStarsDelta: number;
    hotScore: string | number;
  }>;
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    stars: d.githubStars,
    hotScore: Number(d.hotScore),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        />
        <Line
          type="monotone"
          dataKey="stars"
          stroke="hsl(24 95% 53%)"
          strokeWidth={2}
          dot={false}
          name="Stars"
        />
        <Line
          type="monotone"
          dataKey="hotScore"
          stroke="hsl(220 70% 50%)"
          strokeWidth={2}
          dot={false}
          name="热度"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
