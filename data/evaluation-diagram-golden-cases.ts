import type { EvaluationDiagramRejectionReason, EvaluationDiagramStatus } from "../lib/types";

export const DIAGRAM_GOLDEN_SET_VERSION = "1.2.0";

export interface DiagramGoldenCase {
  id: string;
  candidate: unknown;
  expectedStatus: Extract<EvaluationDiagramStatus, "generated" | "insufficient-evidence" | "invalid-output">;
  expectedType?: "flow" | "sequence" | "architecture";
  expectedRejectionReason?: EvaluationDiagramRejectionReason;
}

const validFlow = {
  type: "flow",
  title: "文档处理流程",
  rationale: "README 描述了输入、解析与输出的连续步骤。",
  nodes: [
    { id: "input", label: "文档输入" },
    { id: "parse", label: "内容解析" },
    { id: "output", label: "结果输出" },
  ],
  edges: [
    { from: "input", to: "parse", label: "提交" },
    { from: "parse", to: "output", label: "生成" },
  ],
  evidence: ["README Usage 列出输入、解析与输出步骤"],
};

export const DIAGRAM_GOLDEN_CASES: DiagramGoldenCase[] = [
  {
    id: "connected-flow",
    candidate: validFlow,
    expectedStatus: "generated",
    expectedType: "flow",
  },
  {
    id: "request-response-sequence",
    candidate: {
      type: "sequence",
      title: "工具调用时序",
      rationale: "README 描述客户端调用服务端并接收结果。",
      nodes: [{ id: "client", label: "客户端" }, { id: "server", label: "服务端" }],
      edges: [
        { from: "client", to: "server", label: "调用工具" },
        { from: "server", to: "client", label: "返回结果" },
      ],
      evidence: ["README Request flow 描述调用与返回"],
    },
    expectedStatus: "generated",
    expectedType: "sequence",
  },
  {
    id: "connected-architecture",
    candidate: {
      type: "architecture",
      title: "组件依赖关系",
      rationale: "README 列出网关、服务与数据库依赖。",
      nodes: [
        { id: "gateway", label: "网关" },
        { id: "service", label: "服务" },
        { id: "database", label: "数据库" },
      ],
      edges: [
        { from: "gateway", to: "service", label: "转发" },
        { from: "service", to: "database", label: "读取" },
      ],
      evidence: ["README Architecture 列出三个组件及依赖"],
    },
    expectedStatus: "generated",
    expectedType: "architecture",
  },
  {
    id: "explicitly-insufficient-evidence",
    candidate: null,
    expectedStatus: "insufficient-evidence",
  },
  {
    id: "dangling-edge",
    candidate: {
      ...validFlow,
      edges: [{ from: "input", to: "invented", label: "调用" }],
    },
    expectedStatus: "invalid-output",
    expectedRejectionReason: "unknown-node",
  },
  {
    id: "isolated-node",
    candidate: {
      ...validFlow,
      nodes: [...validFlow.nodes, { id: "orphan", label: "孤立组件" }],
    },
    expectedStatus: "invalid-output",
    expectedRejectionReason: "unconnected-node",
  },
  {
    id: "disconnected-subgraphs",
    candidate: {
      ...validFlow,
      nodes: [
        { id: "first", label: "第一组件" },
        { id: "second", label: "第二组件" },
        { id: "third", label: "第三组件" },
        { id: "fourth", label: "第四组件" },
      ],
      edges: [
        { from: "first", to: "second", label: "调用" },
        { from: "third", to: "fourth", label: "依赖" },
      ],
    },
    expectedStatus: "invalid-output",
    expectedRejectionReason: "disconnected-graph",
  },
  {
    id: "duplicate-edge",
    candidate: {
      ...validFlow,
      edges: [validFlow.edges[0], validFlow.edges[0], validFlow.edges[1]],
    },
    expectedStatus: "invalid-output",
    expectedRejectionReason: "duplicate-edge",
  },
  {
    id: "duplicate-node",
    candidate: {
      ...validFlow,
      nodes: [validFlow.nodes[0], { ...validFlow.nodes[1], id: "input" }],
      edges: [{ from: "input", to: "input", label: "处理" }],
    },
    expectedStatus: "invalid-output",
    expectedRejectionReason: "duplicate-node",
  },
  {
    id: "self-loop",
    candidate: {
      ...validFlow,
      nodes: validFlow.nodes.slice(0, 2),
      edges: [
        { from: "input", to: "input", label: "重复处理" },
        { from: "input", to: "parse", label: "继续" },
      ],
    },
    expectedStatus: "invalid-output",
    expectedRejectionReason: "self-loop",
  },
  {
    id: "repairable-presentation-constraints",
    candidate: {
      ...validFlow,
      title: `文档处理流程${"说明".repeat(40)}`,
      rationale: `README 明确描述了输入与解析的调用关系。${"可核实。".repeat(50)}`,
      nodes: [
        { id: "Input Node", label: `文档输入${"详情".repeat(20)}` },
        { id: "Parse Node", label: "内容解析" },
      ],
      edges: [{ from: "Input Node", to: "parse", label: "处理" }],
      evidence: [
        `README Usage：${"输入调用解析。".repeat(30)}`,
        "README Architecture：输入连接解析。",
        "README Flow：解析返回结果。",
        "README 多返回了一条证据。",
      ],
    },
    expectedStatus: "invalid-output",
    expectedRejectionReason: "unknown-node",
  },
  {
    id: "repairable-presentation-only",
    candidate: {
      ...validFlow,
      title: `文档处理流程${"说明".repeat(40)}`,
      rationale: `README 明确描述了输入、解析与输出的调用关系。${"可核实。".repeat(50)}`,
      nodes: validFlow.nodes.map((node, index) => ({
        ...node,
        id: `Node ${index + 1}`,
        label: `${node.label}${"详情".repeat(20)}`,
      })),
      edges: validFlow.edges.map((edge) => ({
        ...edge,
        from: `Node ${validFlow.nodes.findIndex((node) => node.id === edge.from) + 1}`,
        to: `Node ${validFlow.nodes.findIndex((node) => node.id === edge.to) + 1}`,
        label: `${edge.label}${"关系".repeat(30)}`,
      })),
      evidence: [
        `README Usage：${"输入调用解析再输出。".repeat(30)}`,
        "README Architecture：输入连接解析。",
        "README Flow：解析连接输出。",
        "README 多返回了一条证据。",
      ],
    },
    expectedStatus: "generated",
    expectedType: "flow",
  },
];
