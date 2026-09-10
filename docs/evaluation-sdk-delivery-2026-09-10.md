# 评测核心 SDK 交付记录（2026-09-10）

需求：把评审核心业务封装为生产可用 SDK，并提供详细应用文档。此次是明确的用户需求，不是增长实验或评分算法调参。

## 交付

- `packages/evaluation-sdk`：独立 ESM/TypeScript 包 `@skill-supermarket/evaluation-sdk@1.0.0`，Apache-2.0。
- 核心：完整报告、文档评分、静态风险、工程质量、采用度/活跃度、置信度、证据校准和图示数据；评测器维持 3.14.0，rubric 维持 3.5.0。
- 边界：应用显式提供材料；不依赖数据库、Next.js、React、登录、额度或环境变量。可选择离线、optional AI、required AI。
- 官方 Judge：DeepSeek/OpenAI Chat Completions 与 Anthropic Messages 协议，显式密钥/模型、响应体大小限制、超时（包括响应体）、取消、安全错误码；不新增自动付费调用或质量重试。
- 网站 `lib/evaluator.ts` 改用同一核心；`lib/judge.ts` 保留原网站配置优先级；原低层 import 通过兼容导出继续工作。数据库结构与任务认领规则未更改。
- 应用文档：`packages/evaluation-sdk/README.md`，含安装、完整字段、模式、图示、错误/取消、队列/CI、持久化、安全边界和升级；3 个可运行示例 + 1 份明确标记的虚构输入。
- `sdk:pack` 与 `sdk:verify`：制品白名单、隔离安装、ESM/CommonJS 动态导入、完整 TS 声明校验（无 skipLibCheck）、无网站依赖、示例退出码验证。
- 新 SDK 目录及包清单加入主机代码完整性范围，源码迁移不会移出检查范围。未接受/重置线上主机基线。
- CI 配置 Node 20/22/24，运行 SDK、既有评分、Linux 主机完整性测试与隔离安装；是否已在 GitHub 执行成功需单独查看运行结果。

## 基线与验收

拆分前从 `ef966c4` 原有报告组装逻辑捕获 6 份完整报告，固定时间 `2026-09-10T00:00:00.000Z`，样本含完整证据/AI 图、稀疏材料、关键词刷分、凭证风险、提示注入、无仓库。冻结文件为 `tests/fixtures/sdk-parity-v3.14.0.json`，未为迁就候选结果改写期望。

最终本机 Node 24.19.0 验收：

| 检查 | 结果 |
|---|---|
| SDK NodeNext 编译 | 通过 |
| SDK 测试 | 11/11；6 份完整报告 × 10 次，0 差异、0 漂移 |
| 已有评测测试 | 151 通过、0 失败、1 项 Linux 工具检查在 macOS 跳过 |
| 排名测试 | 3/3 |
| 文档格式、远程 MCP 接入、输出/日志反刷分基准 | 全部 `--check` 通过 |
| 凭证值回归 | 36/36，0 漂移，0 额外模型请求 |
| 网站 typecheck / lint | 通过 |
| Next.js 16.3.0 webpack 生产 build | 通过（17 个预生成页面） |
| tarball 隔离安装与消费 | 10 项通过；仅包含 dist、文档、许可、示例和 package.json |
| 静态扫描/脱敏/评分规则迁移检查 | 除导入路径、类型导出与冻结权重外，与旧实现文本一致 |

SDK 完整报告本轮离线测量约 median 0.381ms、p95 1.911ms；初始旧实现记录 median 0.951ms、p95 1.685ms。运行次序与 JIT 不同，不能据此宣称速度改善或显著退化；此次目标是业务隔离和结果等价。测试未调用真实模型，不声称验证了供应商当前模型可用性或实际 token 成本。协议模拟验证正常 1 次、可选图示恢复最多再 1 次请求。

### 验证中发现并修复的构建问题

第一轮网站 build 无法从 SDK 的 `.js` 导入解析到 `.ts` 源码（失败输出 SHA-256：`5b7fa1eb75bbc0b2735cf09c94d57f0fd9e266ddb47ab6f5824aff98df17e88b`）。

根因修复：源码使用明确 `.ts` 相对导入，SDK 使用 TypeScript 5.7+ 的 `rewriteRelativeImportExtensions` 输出标准 `.js`；网站 noEmit typecheck 允许 `.ts` 导入。不使用失效的模块别名、不降低检查、不改预期分数。修复后完整隔离安装、回归、基准、网站构建全部重跑通过。

最终网站 build 输出 SHA-256：`1295ff62708ac192b3a85e87545da5cc02177a2a75fb83cbd837b9788075b3a5`。

## 分发与上线边界

- 本地生成 `artifacts/skill-supermarket-evaluation-sdk-1.0.0.tgz`，可安装，不代表 npm 公共包已经发布；不擅自注册账号、占用包名或执行发布。
- 本次 SDK 与网站适配代码提交到 main；生产站当前隔离 release 不在此次本地验收中切换。
- 不将 main 上仍需独立配置/验收的注册验证码等改动夹带上线，不重评线上 Skill、不复制密钥、不改数据库、不清理服务器文件。
- 后续网站上线应按既有 release 门槛单独验证、部署，并包含 SDK 源目录。应用回滚使用先前已验证的完整 release，不只恢复旧 facade 文件。
- 下次 SDK 发布前在消费端固定版本与 lockfile，复跑 `sdk:verify`；评分规则变化时同时更新评测器版本和固定回归证据。
