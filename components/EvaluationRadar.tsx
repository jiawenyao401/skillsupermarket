"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface EvaluationRadarProps {
  evaluation: {
    documentationScore: number;
    securityScore: number;
    popularityScore: number;
    activityScore: number;
    qualityScore: number;
  };
}

export function EvaluationRadar({ evaluation }: EvaluationRadarProps) {
  const data = [
    { dimension: "文档", score: evaluation.documentationScore },
    { dimension: "安全", score: evaluation.securityScore },
    { dimension: "流行", score: evaluation.popularityScore },
    { dimension: "活跃", score: evaluation.activityScore },
    { dimension: "质量", score: evaluation.qualityScore },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="hsl(24 95% 53%)"
          fill="hsl(24 95% 53%)"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
