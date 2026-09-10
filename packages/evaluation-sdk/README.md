# Skill Supermarket Evaluation SDK

把 AI Skill、MCP Server、Agent Pack 的文档检查、静态风险扫描、五维评分、置信度、采用建议与图示数据，集成到自己的服务、Worker 或 CI 中。

这是独立的 **TypeScript / Node.js 业务 SDK**，不是网站 HTTP API 的薄包装。无需 Skill Supermarket 账号、数据库、Next.js、React、GitHub Token 或网站运行环境。网站 Worker 与 SDK 共享同一份规则实现。

- 包名：`@skill-supermarket/evaluation-sdk`
- SDK 接口版本：`1.0.0`
- 本次封装的评测器版本：`3.14.0`；AI rubric：`3.5.0`
- 许可：**Apache-2.0**，完整文本见 [LICENSE](./LICENSE)。
- 发布状态：[SDK 1.0.0 已通过 GitHub Release 发布](https://github.com/jiawenyao401/skillsupermarket/releases/tag/evaluation-sdk-v1.0.0)，提供安装包及 SHA-256；尚未发布 npm 公共注册表。

## 目录

1. [适用范围与职责边界](#1-适用范围与职责边界)
2. [构建、打包与安装](#2-构建打包与安装)
3. [五分钟接入：本地离线评测](#3-五分钟接入本地离线评测)
4. [输入字段与证据准备](#4-输入字段与证据准备)
5. [AI 复核配置](#5-ai-复核配置)
6. [完整报告与图示](#6-完整报告与图示)
7. [评分方法与可复现性](#7-评分方法与可复现性)
8. [超时、取消、错误与重试](#8-超时取消错误与重试)
9. [在现有业务、队列和 CI 中应用](#9-在现有业务队列和-ci-中应用)
10. [自定义 Judge](#10-自定义-judge)
11. [API 索引](#11-api-索引)
12. [安全与资源边界](#12-安全与资源边界)
13. [验证、升级与故障排查](#13-验证升级与故障排查)

## 1. 适用范围与职责边界

适合：内部 Skill 市场、MCP 接入审批、代码仓库准入、项目评测报告、定期复评、开发者工具的质量检查。

```text
应用层：鉴权 / 额度 / 采集 / 缓存 / 队列 / 持久化 / 展示
                         │ 明确的材料快照
                         ▼
SDK：输入校验 → 文档和静态扫描 → 五维评分 → 报告
                                  │
                                  └─ 可选 AI 复核、校准、图示
```

SDK 不做以下事情：

- 不自动克隆仓库、抓取 GitHub/npm/PyPI、联网获取 Stars、验证许可证或判断项目类型。
- 不安装或执行待评测代码，不做动态沙箱测试，不保证扫描出全部漏洞。
- 不创建网站账号、不消耗网站用户额度、不将报告提交到 skillsupermarket.com。
- 不内置数据库、任务重试队列、计费、邮件、鉴权或前端图形渲染器。
- 不提供 Python/Java 原生包，也不支持把服务端密钥放进浏览器。

这些边界使 SDK 可以接入已有生产系统。采集、权限和持久化沿用宿主应用；核心评分只维护一份。

## 2. 构建、打包与安装

### 2.1 运行环境

运行要求 Node.js **20.3+**，交付格式为 **ESM JavaScript + TypeScript 声明**；建议使用组织仍在维护的 Node LTS 版本。消费者运行编译后的包，不需要 tsx 或 TypeScript 编译器。

SDK 只有两项直接运行依赖：CommonMark 解析器 `mdast-util-from-markdown` 与结构校验器 `zod`。不要将网站完整依赖一起拷贝到使用 SDK 的项目。

从源码构建需 TypeScript 5.7+：源码使用显式 `.ts` 相对导入，SDK 编译时通过 `rewriteRelativeImportExtensions` 转为 Node 可运行的 `.js`；网站直接消费同一份源码，不要求提前生成 dist。消费者安装包无需修改构建器的扩展名映射。

### 2.2 安装正式发布包，或从源码构建

直接安装固定版本的正式制品：

```bash
npm install https://github.com/jiawenyao401/skillsupermarket/releases/download/evaluation-sdk-v1.0.0/skill-supermarket-evaluation-sdk-1.0.0.tgz
```

发布包 SHA-256：`c721479d06cf77d1fc3aa9666bb3ac8f6a0ccaeffa934cf1f6224ec89dd86772`。Release 同时提供 `.sha256` 文件；下载后可使用 `shasum -a 256 -c skill-supermarket-evaluation-sdk-1.0.0.sha256` 校验。提交安装生成的 lockfile，以便 CI 使用 `npm ci` 重现依赖。

如需从源码构建：

在 Skill Supermarket 仓库根目录执行：

```bash
npm ci
npm run sdk:build
npm run sdk:test
npm run sdk:pack
```

产物：`artifacts/skill-supermarket-evaluation-sdk-1.0.0.tgz`。打包命令输出路径、字节数、SHA-256。`dist/` 和安装包是生成物，不提交到 Git；源代码、应用文档、示例和测试会提交。

在另一个 Node.js 项目中安装（将路径替换为实际产物位置）：

```bash
npm install /absolute/path/skill-supermarket-evaluation-sdk-1.0.0.tgz
```

把应用的 lockfile 一并提交。生产构建用 `npm ci`，不要在每次上线时重新选择浮动的依赖版本。`.tgz` 要保存在构建系统可访问的制品库，不能依赖某台开发电脑的临时路径。

若已有组织私有 npm registry，也可按组织的发布权限与版本审批流程发布该包，再固定版本安装。当前公共分发渠道是 GitHub Release；本次 npm 权限检查返回 `ENEEDAUTH`，没有创建 npm 组织、申请包名或执行 `npm publish`。

### 2.3 模块用法

ESM 项目使用 `.mjs`，或在应用 `package.json` 设置 `"type": "module"`：

```js
import { evaluate } from '@skill-supermarket/evaluation-sdk';
```

CommonJS 项目使用动态导入，不使用同步 `require()` 加载本包：

```js
async function main() {
  const { evaluate } = await import('@skill-supermarket/evaluation-sdk');
  const result = await evaluate({ name: 'Demo', type: 'agent-pack', readme: '' });
  console.log(result.report.summary.headline);
}
main().catch(() => { process.exitCode = 1; });
```

TypeScript 应用可使用 `module/moduleResolution: NodeNext`，或框架的 `Bundler` 解析模式。不要深度导入 `dist/` 内部文件，公共入口见 API 索引。

## 3. 五分钟接入：本地离线评测

以下程序只读取调用方指定的本地材料，不执行材料中的命令：

```ts
import { readFile } from 'node:fs/promises';
import { evaluate, type EvaluationInput } from '@skill-supermarket/evaluation-sdk';

const input: EvaluationInput = {
  name: 'My MCP Server',
  type: 'mcp-server',
  description: '说明这个项目解决的问题、目标用户以及主要输入和输出。',
  readme: await readFile('./review-materials/README.md', 'utf8'),
  files: [
    {
      path: 'package.json',
      content: await readFile('./review-materials/package.json', 'utf8'),
      kind: 'manifest',
    },
  ],
  // 如果没有核实许可证、仓库或指标，请保留默认 false / 0。
  sources: ['Internal approved evidence snapshot'],
};

const { report, diagnostics } = await evaluate(input, {
  aiPolicy: 'disabled',
  // 固定评测时刻，便于回归；常规实时评测可以不传。
  evaluatedAt: '2026-09-10T00:00:00.000Z',
});

console.log({
  overall: report.overall,
  verdict: report.summary.verdict,
  risk: report.summary.riskLevel,
  confidence: report.summary.confidence,
  nextActions: report.recommendation.nextActions,
  ai: diagnostics.aiStatus,
});
```

也可直接运行包内已验证示例：

```bash
node node_modules/@skill-supermarket/evaluation-sdk/examples/offline.mjs \
  node_modules/@skill-supermarket/evaluation-sdk/examples/input.json
```

`input.json` 是虚构测试材料，不是实际软件推荐，也不是需要安装的 MCP 包。离线模式不会因环境变量中存在 API Key 而自动调用模型。

## 4. 输入字段与证据准备

`evaluate(input, options)` 接受 JSON 形状的 `EvaluationInput`。可以先用 `parseEvaluationInput(untrustedJson)` 进行入口校验；`evaluate` 自身也会再次校验。

| 字段 | 类型 / 默认值 | 使用说明 |
|---|---|---|
| `name` | 必填字符串，1–200 字符 | 去除首尾空白后不能为空 |
| `type` | 必填枚举 | `claude-skill`、`mcp-server`、`agent-pack`；调用方按实际交付物判断 |
| `readme` | 必填字符串，可为空 | 文档评分及 AI 复核的主要材料；不是 README 的 URL |
| `description` | 字符串或 null，默认 null | 最多 10,000 字符，AI 提示实际只取前 1,000 |
| `files` | 数组，默认 `[]` | 补充静态证据，见下面的文件规则 |
| `hasLicense` | boolean，默认 false | 调用方已核实许可证是否存在；不代表许可证兼容性结论 |
| `hasRepository` | boolean，默认 false | 存在仓库来源，影响确定性工程质量 |
| `hasRepositoryMetadata` | boolean，默认 false | 已取得可信仓库元数据，影响置信度；不能仅因有 URL 就设为 true |
| `lastCommitAt` | ISO 8601 字符串或 null | 含时区，例如 `2026-09-01T10:30:00Z`；无记录用 null |
| `openIssues` | 非负安全整数，默认 0 | 活跃度规则的一个输入，不等于缺陷数量 |
| `popularity` | 对象，默认全部 0 | 采用度输入，见下表；不联网补齐 |
| `sources` | 字符串数组 | 默认 `['Caller-provided evidence']`；最多 16 个来源标签，每项 1–200 字符，不放令牌或个人信息 |
| `classifierVersion` | 可选字符串 | 调用方分类器版本，1–80 字符；SDK 不负责分类 |
| `caseStudy` | boolean，默认 false | 报告出处标签；**不会自动启用 required AI 策略** |

`popularity` 的可选字段：

| 字段 | 含义 |
|---|---|
| `stars` | Stars 总数，非负安全整数 |
| `forks` | Forks 总数，非负安全整数 |
| `downloadsWeekly` | 指定来源的一周包下载量，非负安全整数 |
| `starsGrowth7d` | 7 天 Stars 增量，可为负整数，保存在报告中 |
| `starsGrowth30d` | 30 天 Stars 增量，可为负整数，参与采用度计算 |

所有数值均拒绝 `NaN`、Infinity、小数或超出安全整数范围。增长量为负不会让采用度得到负分。未提供采用指标默认 0，**这只是引擎计算缺省值，不是“已确认没有用户”**；请在应用的来源快照中记录哪些指标缺失。

### 文件规则

`files` 每项包含 `path`、`content`、可选 `kind`：

- `path` 是用于识别证据与报告定位的相对 POSIX 路径，不会被 SDK 打开。禁止绝对路径、`..`、反斜杠、空目录段、控制字符。
- `content` 是 UTF-8 解码后的文本字符串；二进制、压缩包请在应用层拒绝。
- `kind` 为 `documentation` / `instruction` / `code` / `manifest`。建议采集时明确提供，尤其是 `.sh`、`.env.example` 等文件。省略时沿用网站现有保守的路径推断规则，不是完整语言识别器。
- `readme` 自动作为 `README.md` 参与扫描，不要在 `files` 中再次传入根目录 `README.md`。文件路径大小写不敏感地查重，重复路径会报错，不会默默覆盖。
- 单份文档（包括 README）最多 **250,000 个 JavaScript 字符**，补充文件最多 **64 个**；README 与补充材料总计最多 **2,000,000 字符**。超限直接拒绝，避免无提示地把漏扫内容当成安全。
- 空 README、空文件允许通过，但不会得到相应证据分。不要把同一文档复制成多个文件来提高置信度；独立来源会去重、分类封顶。
- 未知字段会报 `INVALID_INPUT`。先将数据库/GitHub 返回对象映射为 SDK 字段，不要直接传入整条对象。

生产采集建议：固定仓库 commit / 包版本，保存 README 与高信号文件、来源、采集时间、指标窗口和内容 hash；从同一快照读取，避免文档与代码版本混用。SDK 不核验调用方声称的元数据真实性，因此不能直接相信终端用户提交的 Stars 或 `hasLicense`。

## 5. AI 复核配置

### 5.1 显式创建 Judge

```ts
import { evaluate, createLLMJudge } from '@skill-supermarket/evaluation-sdk';

const judge = createLLMJudge({
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  timeoutMs: 30_000,
});

// input 为前一节准备的材料。配置对象可复用，请求数据不会保存在 Judge 内。
const result = await evaluate(input, {
  judge,
  aiPolicy: 'required',
  judgeTimeoutMs: 65_000,
});
```

示例中 `process.env` 的读取发生在**宿主程序**，SDK 本身不读取环境、不加载 `.env`。密钥只留在服务端；不要在聊天、日志、前端 bundle、Git 或输入 JSON 中存密钥。

### 5.2 支持的协议

| provider | 默认 API 根地址 | 请求路径 |
|---|---|---|
| `deepseek` | `https://api.deepseek.com` | `/chat/completions` |
| `openai` | `https://api.openai.com/v1` | `/chat/completions` |
| `anthropic` | `https://api.anthropic.com` | `/v1/messages` |

`model` 必填，必须是你的服务与账号实际可用、支持相应 JSON 请求格式的模型。本 SDK 的 OpenAI 适配器使用 Chat Completions，不是 Responses API；不是所有新模型都接受相同的采样或 token 参数。

`baseUrl` 可设置为可信的兼容网关 API 根地址（OpenAI 兼容网关通常含 `/v1`）。仅接受 HTTPS，或明确的本机 HTTP 地址 `localhost` / `127.0.0.1` / `[::1]` 用于本地代理与测试。拒绝 URL 内的用户名密码、查询参数、片段；拒绝 HTTP 重定向，避免意外转发授权头。

不能让终端用户、README 或评测材料控制 `baseUrl`，也不能将 DeepSeek 密钥发给未审查的代理。自定义 `fetch` 只用于可信的应用级传输替换或测试，必须遵守 AbortSignal、保持 TLS 验证和请求边界。

### 5.3 三种 AI 策略

| `aiPolicy` | 无 Judge | Judge 失败 / 超时 |
|---|---|---|
| `optional`（默认） | 返回静态报告，`unconfigured` | 返回静态报告，`failed` 和安全错误码 |
| `required` | 抛 `JUDGE_UNAVAILABLE` | 抛错误，不返回成功报告 |
| `disabled` | 完全离线 | 即使传入 Judge 也不调用，状态 `disabled` |

需要“AI 复核完成”才能发布的案例/审批，必须使用 `required`。`caseStudy: true` 仅是报告标签，不能替代该策略。网站继续保留原有案例审批与普通任务降级逻辑。

## 6. 完整报告与图示

返回值结构：

```ts
{
  report: CompletedEvaluationReport,
  diagnostics: {
    aiStatus: 'completed' | 'disabled' | 'unconfigured' | 'failed',
    aiErrorCode?: EvaluationErrorCode,
  },
}
```

`report` 可 JSON 序列化。新报告保证有 `version`、`summary`、`recommendation`、`methodology`；通用 `EvaluationReport` 类型仍容纳历史网站报告缺失这些字段的情况。不存在的可选字段 JSON 序列化时会省略。

| 报告区块 | 核心字段 / 意义 |
|---|---|
| `overall` | 综合分 0–100，已应用风险封顶 |
| `summary` | grade、verdict、riskLevel、confidence、中文结论 |
| `documentation` | score、details、checks（检查编号/权重/是否通过/证据）、strengths、improvements |
| `security` | score、riskLevel、findings、扫描文件及字符数 |
| `popularity` | score、details、输入指标 stats |
| `activity` | score、details、最近提交时间 |
| `quality` | 综合工程质量分、确定性分、AI 分、五个 AI 子分、评论与证据 |
| `recommendation` | strengths、concerns、bestFor、avoidFor、nextActions |
| `methodology` | 时间、评测器版本、AI 模型/rubric、来源、权重、置信度因子、限制、图示状态 |
| `diagram` | 可选的 flow / sequence / architecture 结构化数据 |

`verdict` 可能为 `recommended`、`promising`、`caution`、`needs-work`、`blocked`；`riskLevel` 为 `low`、`medium`、`high`、`critical`。不要只看总分放行高风险项目。

### 风险项

每个 `security.findings` 项含 `level`、`type`、`message`，以及可选 `category`、`location`、`evidence`、`remediation`、`confidence`。`location` 通常为 `path:line`，行号从 1 开始。已知凭证形状会脱敏，但报告仍属于来源相关数据；不能把“脱敏了已知密钥”理解成“可无条件公开全部内容”。

### 图示为什么可能为空？

图示需要 README 中明确的参与方/步骤及其关系，不是每份报告的强制装饰。SDK 输出节点与边，不产生 PNG、SVG、Mermaid 代码或实际执行轨迹。

```ts
const status = result.report.methodology.diagramStatus;
if (result.report.diagram) {
  const { type, title, rationale, nodes, edges, evidence } = result.report.diagram;
  // 把结构化数据交给应用自己的 flow/sequence/architecture 渲染器。
  // 文本必须按纯文本转义，不要直接作为 innerHTML 或 Mermaid 指令拼接。
}
```

| `diagramStatus` | 含义 |
|---|---|
| `generated` | 有通过结构校验的图示 |
| `insufficient-evidence` | 模型未提供图示；不能推断项目自身没有流程 |
| `invalid-output` | 图示结构校验不通过，见 rejection reason |
| `judge-unavailable` | 未完成 AI 复核（含离线、未配置、失败） |

图示最多 6 节点、8 条边，必须连通，不能引用不存在的节点或包含自环、重复边。类型选择：请求/响应优先时序图；有序步骤选流程图；无明确时间顺序的依赖关系选结构图。

首次没有有效图示且 README 存在明确关系证据时，最多进行一次恢复：先尝试严格的显式顺序列表映射，否则再调用一次模型。恢复失败不抹掉有效的质量评分；看 `diagramRecoveryAttempted`、`diagramRecoveryStatus` 区分 `unavailable`、`not-eligible`、`invalid-output` 等情况。`required` 要求质量复核成功，不保证图示一定存在。

## 7. 评分方法与可复现性

本次抽取**没有调整评分权重、风险阈值或 AI rubric**：

| 维度 | 权重 |
|---|---:|
| 文档 | 22% |
| 安全 | 25% |
| 采用度 | 10% |
| 活跃度 | 13% |
| 工程质量 | 30% |

有有效 AI 结果时，工程质量 = 确定性工程质量 × 45% + AI 总分 × 55%；无 AI 时直接使用确定性工程质量。综合分取整后，`critical` 最高 39，`high` 最高 59。高 Stars 不会移除安全告警。

AI 复核有 utility、clarity、reusability、design、documentation 五个 0–20 整数子分。原有证据校准、膨胀拒绝、分维度证据约束和图示校验均保留。

置信度反映本次证据覆盖和复核状态，不是“安全概率”或统计置信区间；去重 README、独立材料类型、仓库元数据、活跃记录与 AI 状态均参与。没有 AI 时不加 AI 置信分；总分优秀但置信度不足，采用结论仍会降档。

复现报告需要同时固定：

1. SDK 版本 + 评测器版本 + 依赖 lockfile。
2. 材料内容、文件 kind、项目类型、指标及其时间窗口。
3. `evaluatedAt`（也用于活跃度计算）。不固定时间，同一输入隔天可能跨过活跃度阈值。
4. AI 模型与已保存的合规复核结果。`temperature: 0` **不保证外部模型绝对确定性**，服务端版本变更也可能产生差异。
5. 运行时与 locale（部分解释文本有数字本地化格式；分数不依赖 locale）。

SDK 版本描述接口/打包兼容性；`EVALUATOR_VERSION` 描述评测规则版本，两者不能互相替代。升级 SDK 不会自动重评或覆盖数据库里的历史报告。

## 8. 超时、取消、错误与重试

```ts
import { evaluate, EvaluationError } from '@skill-supermarket/evaluation-sdk';

const controller = new AbortController();
// 在客户端断开或任务取消时，由应用调用 controller.abort()。
try {
  const result = await evaluate(input, {
    judge,
    aiPolicy: 'required',
    signal: controller.signal,
    judgeTimeoutMs: 65_000,
    onStage: async (stage) => {
      // stage 依次为 security、quality、report。
      // 可更新现有任务进度；回调失败会使本次评测失败。
      console.log({ stage });
    },
  });
  // 用应用自己的事务保存 result。
} catch (error) {
  if (error instanceof EvaluationError) {
    console.error({ code: error.code }); // 不输出供应商正文、密钥或材料。
  } else {
    // 例如 onStage 回调中的数据库失败；由应用按自己的策略处理。
    throw error;
  }
}
```

| 错误码 | 典型原因 | 应用处理 |
|---|---|---|
| `INVALID_INPUT` | 格式、枚举、数字、路径或容量错误 | 修改输入，不自动重试 |
| `INVALID_OPTIONS` | 模型配置、URL、密钥为空、超时或评测时间无效 | 修正服务配置 |
| `JUDGE_UNAVAILABLE` | required 但没传 Judge | 配置服务或改为明确的离线策略 |
| `JUDGE_FAILED` | HTTP 失败、格式错误、证据校准不通过、传输失败 | 检查服务端指标后再决定；不要无限重试 |
| `JUDGE_TIMEOUT` | 请求/响应体或整个 AI 阶段超过时限 | 按任务预算有限重试或人工复核 |
| `ABORTED` | 调用者取消 | 不保存成功结果，不自动当降级成功 |

内置 Judge 的单次请求默认 30 秒，包含读取响应体；整个 AI 阶段默认 65 秒，含可选图示恢复。`timeoutMs` 与 `judgeTimeoutMs` 均为 1–300,000 毫秒整数。

错误不包含原始 HTTP 正文、Authorization、证据或 `cause`，防止日志泄露。`JUDGE_FAILED` 有意合并服务端错误；如需供应商状态码、token 用量和成本统计，可在**可信的自定义 fetch** 中只统计脱敏的状态码、时长、用量，勿记录授权头或请求内容。本 SDK 不返回推测的 token 成本。

SDK 不自动重试质量请求。内置 Judge 最多请求一次质量复核（max_tokens 1800）与一次图示恢复（max_tokens 900），不是保证实际计费 token 数。队列重试由应用持久化 attempt、退避、幂等键和预算决定；第三次“手工重跑”不能代替根因修复。

取消会传到 Judge 的 AbortSignal。同步文档解析/扫描不能在 JavaScript 当前执行栈中途被抢占；回调也必须有自己的数据库/网络时限。面对不可信批量材料，使用 Worker 进程隔离、输入体积限制和并发配额，不要依靠 Promise 超时来终止 CPU 工作。自定义适配器若忽略取消，其外部副作用无法被 SDK 撤销。

## 9. 在现有业务、队列和 CI 中应用

### 9.1 服务端或 Worker

建议接入顺序：

1. API 层鉴权、校验项目访问权限、原子预占额度和去重，再创建任务。不要直接把 SDK 变成不鉴权的公网免费模型接口。
2. 采集层按白名单来源和明确版本获取材料，限制网络目标、重定向、文件大小和下载超时，记录快照；不执行项目。
3. Worker 从快照映射 `EvaluationInput`，调用 `evaluate`。原有任务表接收 `onStage`。
4. 得到结果后，在事务内写报告 + 来源 hash/commit + 模型与版本 + diagnostics + 任务完成状态。AI required 失败不能写成成功。
5. 同一幂等键最多保存一份成功报告。建议键包含项目/来源版本/材料 hash/评测器版本/AI 策略与模型。多 Worker 用数据库原子认领，不能只靠内存 Set。
6. UI 先显示结论、风险与下一步，再展示维度、原文证据和图示；渲染所有外部文本时转义，报告访问权限沿用来源权限。

网站现有适配器位于 `lib/evaluator.ts`：继续负责 GitHub/npm/PyPI 采集、任务队列、指标、缓存及数据库写入；报告生成改为调用本 SDK。`lib/judge.ts` 只保留网站已有的环境配置优先级：DeepSeek → OpenAI → Anthropic。这种隐式环境优先级**不属于 SDK 接口**。

Next.js 应用应仅在 Node 服务端或独立 Worker 使用 SDK；不要在 `use client` 组件实例化 Judge。长耗时评测适合异步队列，不适合与网关请求超时竞争的同步 Route Handler。SDK 不附带任何需要数据库迁移的新表。

### 9.2 CI 准入

包内 `examples/ci.mjs` 是可直接执行的、纯离线的检查器：

```bash
node node_modules/@skill-supermarket/evaluation-sdk/examples/ci.mjs ./evaluation-input.json
```

退出码：0 = 未命中示例人工复核策略；2 = 高/关键风险或置信度低于 40，需人工复核；1 = 输入或执行失败。测试样本故意缺少元数据，因此可能触发低置信度门槛，不能为了“全绿”伪造 Stars 或来源。

这只是明示的组织策略示例，不是安全认证。你应在自己的仓库中版本化审批阈值、豁免记录和人工复核流程。不要修改 SDK 核心权重来迎合特定仓库。

### 9.3 缓存与复评

缓存整个报告及原始版本，不只缓存总分。规则升级、项目类型更正、来源 hash 变化、AI 模式变化时重新评测。旧报告保留历史，不覆盖其生成时间或版本。不应把离线报告缓存命中当作 required AI 任务已完成。

SDK 本身无并发池。离线扫描受 CPU 限制，AI 受供应商并发/费用限制；两者应分开设限。对外 API、批量输入以及队列都要设置总任务上限。不要用无限 `Promise.all` 给模型发送全部库存。

## 10. 自定义 Judge

`Judge` 的签名为：

```ts
type Judge = (
  input: JudgeInput,
  context: { signal: AbortSignal },
) => Promise<JudgeResult>;
```

`JudgeInput` 包含 name、type、description、readme、由引擎生成的 deterministicEvidence。Judge 是**受信任的应用代码**，不是可让用户上传的可执行插件；它收到原始材料，应负责保护输入边界与数据授权。官方适配器已包含提示隔离、已知凭证脱敏、结构验证和校准。

`JudgeResult` 包含：score、scores（五个子分）、details、comment、strengths、concerns、bestFor、avoidFor、evidence（至少两项）、calibrationNotes、可选 diagram、diagramStatus、可选 diagramRejectionReason、diagramRecoveryAttempted、diagramRecoveryStatus、model、rubricVersion。

可用于内部模型网关或经批准保存的固定复核结果。SDK 会校验范围、总分与子分一致性、证据约束、文本容量和图示状态；无效结果走 optional/required 错误策略。结构合法不代表证据真实，来源真实性仍由集成方负责。

大多数用户应使用 `createLLMJudge`，无需重新实现提示词和校准。不要把另一套黑箱评分直接塞进 `score` 字段，不要传入只有总分的伪造结果。

## 11. API 索引

| 入口 | API | 返回 / 用途 |
|---|---|---|
| 包根 | `evaluate(input, options?)` | `Promise<EvaluationResult>`，完整业务入口 |
| 包根 | `parseEvaluationInput(unknown)` | 经过校验、填默认值并复制的输入 |
| 包根 | `createLLMJudge(options)` | 配置复用的 `Judge` 函数，无立即网络调用 |
| 包根 | `scanDocuments(documents)` / `scanText(text)` | 单独静态扫描，`ScanResult` |
| 包根 | `EvaluationError`、`EVALUATOR_VERSION`、`WEIGHTS`、`EVIDENCE_LIMITS` | 错误、版本和只读规则常量 |
| `/judge` | `createLLMJudge`，Judge 相关类型 | 单独接入官方 Judge 适配器 |
| `/scanner` | `scanDocuments`、`scanText`，扫描类型 | 低层扫描函数 |
| `/scoring` | `scoreDocumentation`、`scorePopularity`、`scoreActivity`、`deterministicQualityScore` | 单独维度计算 |
| `/scoring` | `combineQualityScore`、`calculateOverallScore`、`deriveRiskLevel`、`buildSummary`、`buildLegacySummary` | 合分、风险和结论规则 |
| `/scoring` | `calculateConfidenceBreakdown`、`calculateConfidence`、`countIndependentEvidenceSources`、`calculateEffectiveReadmeEvidenceCharacters`、`clamp` | 置信度与规则辅助函数 |

类型从包根导出：`EvaluationInput`、`EvaluationOptions`、`EvaluationResult`、`CompletedEvaluationReport`、`EvaluationReport`、`EvaluationDiagram`、`SecurityFinding`、`RiskLevel`、`SkillType` 等；编辑器可查看完整声明。

低层 scoring/scanner 函数保留网站原有契约，**不执行完整输入校验**。外部不可信数据优先使用 `evaluate`。直接扫描时单文件仅扫描前 250,000 字符、最多记录 60 条 findings；这不是“所有问题总数”，也不能用它声称扫完任意体量仓库。`evaluate` 的输入上限防止单文档静默截断。

## 12. 安全与资源边界

- **离线模式零网络**：不配置 Judge 时，核心不访问网络/磁盘/数据库、不发遥测；传入模型适配器后会向配置的模型服务发送受限的评审材料。
- **最小材料**：AI 只复核 README、有限元数据与确定性检查说明；补充文件用于静态扫描，不把全部仓库源码发送给 AI。README 按章节选择最多 30,000 字符。
- **模型视为不可信**：输出经过 schema 与评分证据校准，图示不接受任意脚本。提示隔离只能降低风险，不能承诺彻底消除提示注入。
- **响应大小**：官方适配器每次响应最多 1 MiB，检查 Content-Length 和实际读取字节；错误正文不写日志。
- **不能滥用密钥**：API Key 只放宿主的 Secret Manager / 服务端环境变量，分别配置生产和测试环境。示例不会复制已有生产密钥。
- **权限**：私有材料是否能发送给外部模型需由材料所有方批准；静态模式可在受控环境离线使用。
- **上游依赖**：锁定与审查依赖、执行组织的漏洞修复流程。Apache-2.0 是本 SDK 的许可证，不会覆盖待评测第三方项目的许可。

## 13. 验证、升级与故障排查

仓库根目录命令：

```bash
npm run sdk:build       # 独立 NodeNext 编译及声明生成
npm run sdk:test        # 完整报告固定基线、边界、AI 协议、超时和取消
npm run sdk:verify      # 打包后在全新目录安装，再运行 JS/TS/CI 示例
npm run typecheck
npm run lint
npm run test:evaluation
npm run test:rankings
npm run build
```

`sdk:verify` 检查 tarball 白名单、无秘密文件、无网站运行依赖、ESM、CommonJS 动态导入、TypeScript、离线示例及 CI 策略。它默认从 npm 官方 registry 安装依赖；依赖已缓存时可设置 `SDK_INSTALL_OFFLINE=1`。临时消费项目保留在系统临时目录，便于检查证据，不会扫描或清理其他项目。

已加入 CI 的 Node 20/22/24 矩阵，执行包编译、SDK 回归、评分测试与隔离安装验收；CI 不需要生产密钥、不调用真实模型、不部署网站、不发布 npm。矩阵配置不等于所有远程任务已经通过，应看具体运行结果。

拆分前基线：仓库 `ef966c4`，评测器 3.14.0，6 份冻结完整报告；每份重复 10 次比较。另保留原有文档、边界/恶意输入、凭证和 Judge 回归集。本次不通过改期望值掩盖评分变化。AI 网络协议测试使用本地/注入模拟响应，不声称已验证真实供应商账户余额或实时模型可用性。

| 现象 | 优先检查 |
|---|---|
| npm 包名安装 404 | 本次仅提供本地 `.tgz`，不是已经发布 npm；用实际 tarball 路径安装 |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | 是否用了 `require()` 或未公开深层路径；改用 ESM/动态 import 与正式子入口 |
| `INVALID_INPUT` | 是否传了整条数据库记录、重复 README、非法日期/路径、超限材料 |
| 分数和网站不同 | 来源版本、材料 kind、类型、指标、时刻、AI 策略/模型、评测器版本是否一致 |
| 无图示 | 先看 aiStatus，再看 diagramStatus 和 recoveryStatus；不是默认判定“都不适合画图” |
| required 失败 | Key/模型/网关协议、超时、结构与证据校准；不能当成功发布 |
| optional 没抛异常 | 这是明示的降级策略；检查 diagnostics，不能忽略 failed |
| 回调后一直等待 | onStage 是宿主异步操作，必须有自己的超时；SDK 不控制你的数据库驱动 |
| `.tgz` 找不到 dist | 必须运行 sdk:pack，其 prepack 会编译；不要直接手工压缩源码目录 |

升级前在固定快照上比较完整报告、风险级别、置信度、图示状态与调用数量；然后小批量灰度。发生退化保留旧版本制品和报告，回滚应用依赖到已知版本，不重写历史记录。

封装依据：[Node.js 模块与包导出规范](https://nodejs.org/api/packages.html)、[npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/)、[DeepSeek Chat Completions 协议](https://api-docs.deepseek.com/api/create-chat-completion/)。本 SDK 的具体范围与限制以本版本代码、类型及测试为准。
