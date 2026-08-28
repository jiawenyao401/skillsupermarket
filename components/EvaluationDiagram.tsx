import type { EvaluationDiagram as EvaluationDiagramType, EvaluationDiagramNode } from "@/lib/types";

const TYPE_LABELS = {
  flow: "流程图",
  sequence: "时序图",
  architecture: "架构图",
} as const;

function nodeLabel(node: EvaluationDiagramNode, x: number, y: number) {
  const characters = Array.from(node.label);
  const lines = characters.length > 12
    ? [characters.slice(0, 12).join(""), characters.slice(12, 24).join("")]
    : [node.label];
  const firstLineY = y - (lines.length - 1) * 9 - (node.role ? 7 : 0);

  return (
    <>
      <text x={x} y={firstLineY} textAnchor="middle" className="fill-foreground text-[13px] font-bold">
        {lines.map((line, index) => <tspan key={line} x={x} dy={index === 0 ? 0 : 18}>{line}</tspan>)}
      </text>
      {node.role ? <text x={x} y={y + 23} textAnchor="middle" className="fill-muted-foreground text-[10px]">{node.role}</text> : null}
    </>
  );
}

function arrowMarker() {
  return (
    <defs>
      <marker id="evaluation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
      </marker>
    </defs>
  );
}

function SequenceDiagram({ diagram }: { diagram: EvaluationDiagramType }) {
  const width = 760;
  const height = Math.max(300, 165 + diagram.edges.length * 56);
  const positions = new Map(diagram.nodes.map((node, index) => [
    node.id,
    diagram.nodes.length === 1 ? width / 2 : 80 + index * (600 / (diagram.nodes.length - 1)),
  ]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${diagram.title}，${TYPE_LABELS.sequence}`} className="h-auto min-w-[680px] w-full">
      <title>{diagram.title}</title>
      <desc>{diagram.rationale}</desc>
      {arrowMarker()}
      {diagram.nodes.map((node) => {
        const x = positions.get(node.id)!;
        return (
          <g key={node.id}>
            <line x1={x} y1="105" x2={x} y2={height - 25} stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="6 7" />
            <rect x={x - 64} y="35" width="128" height="64" rx="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
            {nodeLabel(node, x, 68)}
          </g>
        );
      })}
      {diagram.edges.map((edge, index) => {
        const from = positions.get(edge.from)!;
        const to = positions.get(edge.to)!;
        const y = 145 + index * 56;
        return (
          <g key={`${edge.from}-${edge.to}-${index}`}>
            <line x1={from} y1={y} x2={to} y2={y} stroke="hsl(var(--primary))" strokeWidth="2.5" markerEnd="url(#evaluation-arrow)" />
            <text x={(from + to) / 2} y={y - 9} textAnchor="middle" className="fill-foreground text-[11px] font-semibold" style={{ paintOrder: "stroke", stroke: "hsl(var(--card))", strokeWidth: 6 }}>{edge.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function FlowDiagram({ diagram }: { diagram: EvaluationDiagramType }) {
  const width = 760;
  const height = 105 + diagram.nodes.length * 112;
  const x = width / 2;
  const positions = new Map(diagram.nodes.map((node, index) => [node.id, 72 + index * 112]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${diagram.title}，${TYPE_LABELS.flow}`} className="h-auto min-w-[640px] w-full">
      <title>{diagram.title}</title>
      <desc>{diagram.rationale}</desc>
      {arrowMarker()}
      {diagram.edges.map((edge, index) => {
        const from = positions.get(edge.from)!;
        const to = positions.get(edge.to)!;
        const downward = to > from;
        const startY = from + (downward ? 36 : -36);
        const endY = to + (downward ? -36 : 36);
        const directStep = downward && Math.abs(to - from) === 112;
        const curveX = x + 145 + (index % 2) * 45;
        return (
          <g key={`${edge.from}-${edge.to}-${index}`}>
            {directStep
              ? <line x1={x} y1={startY} x2={x} y2={endY} stroke="hsl(var(--primary))" strokeWidth="2.5" markerEnd="url(#evaluation-arrow)" />
              : <path d={`M ${x} ${startY} C ${curveX} ${startY}, ${curveX} ${endY}, ${x} ${endY}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" markerEnd="url(#evaluation-arrow)" />}
            <text x={directStep ? x + 16 : curveX + 8} y={(startY + endY) / 2 - 5} className="fill-muted-foreground text-[11px] font-semibold" style={{ paintOrder: "stroke", stroke: "hsl(var(--card))", strokeWidth: 6 }}>{edge.label}</text>
          </g>
        );
      })}
      {diagram.nodes.map((node) => {
        const y = positions.get(node.id)!;
        return (
          <g key={node.id}>
            <rect x={x - 120} y={y - 36} width="240" height="72" rx="18" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
            {nodeLabel(node, x, y + 4)}
          </g>
        );
      })}
    </svg>
  );
}

function ArchitectureDiagram({ diagram }: { diagram: EvaluationDiagramType }) {
  const width = 760;
  const columns = Math.min(3, diagram.nodes.length);
  const rows = Math.ceil(diagram.nodes.length / columns);
  const height = 95 + rows * 138;
  const columnXs = columns === 3 ? [130, 380, 630] : columns === 2 ? [220, 540] : [380];
  const positions = new Map(diagram.nodes.map((node, index) => [node.id, {
    x: columnXs[index % columns],
    y: 75 + Math.floor(index / columns) * 138,
  }]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${diagram.title}，${TYPE_LABELS.architecture}`} className="h-auto min-w-[680px] w-full">
      <title>{diagram.title}</title>
      <desc>{diagram.rationale}</desc>
      {arrowMarker()}
      {diagram.edges.map((edge, index) => {
        const from = positions.get(edge.from)!;
        const to = positions.get(edge.to)!;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const boundaryScale = Math.min(92 / Math.max(Math.abs(dx), 1), 38 / Math.max(Math.abs(dy), 1));
        const start = { x: from.x + dx * boundaryScale, y: from.y + dy * boundaryScale };
        const end = { x: to.x - dx * boundaryScale, y: to.y - dy * boundaryScale };
        return (
          <g key={`${edge.from}-${edge.to}-${index}`}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="hsl(var(--primary))" strokeWidth="2.5" markerEnd="url(#evaluation-arrow)" />
            <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 7} textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold" style={{ paintOrder: "stroke", stroke: "hsl(var(--card))", strokeWidth: 6 }}>{edge.label}</text>
          </g>
        );
      })}
      {diagram.nodes.map((node) => {
        const position = positions.get(node.id)!;
        return (
          <g key={node.id}>
            <rect x={position.x - 96} y={position.y - 38} width="192" height="76" rx="18" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
            {nodeLabel(node, position.x, position.y + 3)}
          </g>
        );
      })}
    </svg>
  );
}

export function EvaluationDiagram({ diagram }: { diagram: EvaluationDiagramType }) {
  return (
    <section className="surface-card overflow-hidden" aria-labelledby="skill-diagram-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5 sm:p-6">
        <div>
          <div className="section-eyebrow">How it works · {TYPE_LABELS[diagram.type]}</div>
          <h3 id="skill-diagram-title" className="mt-2 text-lg font-extrabold">{diagram.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{diagram.rationale}</p>
        </div>
        <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground">AI 提取 · 证据约束</span>
      </div>
      <div className="overflow-x-auto bg-muted/20 p-4 sm:p-6">
        <p className="mb-3 text-[11px] font-medium text-muted-foreground sm:hidden">左右滑动查看完整图示</p>
        {diagram.type === "sequence" ? <SequenceDiagram diagram={diagram} /> : diagram.type === "flow" ? <FlowDiagram diagram={diagram} /> : <ArchitectureDiagram diagram={diagram} />}
      </div>
      <div className="border-t px-5 py-4 sm:px-6">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">图示依据</div>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
          {diagram.evidence.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </div>
    </section>
  );
}
