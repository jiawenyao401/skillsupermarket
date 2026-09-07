# 远程 MCP 接入证据回归 · 2026-09-07

## 证据与范围

对生产 125 份有效缓存 README 做只读审计，发现 SurfSense 的 `mcpServers -> url + headers` 接入配置被 3.11.0 漏判为缺少接入步骤。根因是采用证据只识别本地命令/`command`，没有识别远程端点配置。

3.12.0 只增加对完整 JSON MCP 配置的识别：要求顶层对象、命名服务器对象、HTTP(S) URL、可选字符串请求头，以及受支持的可选传输类型。拒绝数组伪装、损坏 JSON、无关 URL、非法协议、非法类型和输出/隐藏块。它不执行文档、访问端点、验证令牌或增加模型请求；不改权重、风险封顶、置信度和模型提示词。

接入证据表示至少一种客户端有可核对的配置示例，不等于可在所有客户端直接运行。Cursor 官方示例允许省略 `type`；Claude Code 要求显式 `http` / `streamable-http` / `sse`。本轮不将 URL-only 配置宣称为 Claude Code 兼容，也不把 HTTP(S) 配置视为安全性或可达性认证。JSONC、TOML、WebSocket 和动态 URL 模板不在本次新增范围。

## 基线与固定集

基线：提交 `f77b81a` 的 3.11.0；候选：3.12.0。固定集 `remote-mcp-adoption-cases.ts` 版本 1.0.0，均由原创成熟金标替换接入示例构成，不复制外部 README。最终 29 个样本的序列化 SHA-256：`81a90be07fce5694a9257121b5de0ede50f4b6304ac432440010bdca28233c1f`。

| 指标 | 3.11.0 | 3.12.0 |
| --- | ---: | ---: |
| 固定样本通过 | 23/29 | 29/29 |
| 6 个合法远程配置漏判 | 6 | 0 |
| 23 个负例安装检查误通过 | 0 | 0 |
| 每样本重复 10 次输出漂移 | 0 | 0 |
| 每 README CPU 中位耗时 | 0.145ms | 0.178ms |
| 每 README CPU p95 | 0.158ms | 0.256ms |
| 新增模型调用 | 0 | 0 |

先记录未改动评分器的基线，再与不可变基线源文件同进程比较。计时为重复 10 次后运行 50 轮批量评分，非生产端到端时延；中位增加 0.033ms、p95 增加 0.098ms，不声称性能改善。原金标 1.5.1、12 个格式对照及原异常/超长/恶意输入测试保持通过。

真实缓存对比：125 份中 124 份完整输出不变，仅 `modsettersurfsense` 的安装检查变为通过，文档分 61 → 75。该 README SHA-256：`495da7c842dbf8cf05ccbe82dba0cc36eeca002d33c965b5ba72e1d2260565b5`。比较用同一批缓存、描述与空文件列表，未修改数据库；不是完整报告总分，也不是全站准确率估计。其余评分检查不变，不能用这个样本数外推总体误判率。

## 复现与验收

将基线评分源码从指定提交导出到仓库忽略的 `.cache/adoption-baseline/evaluation-scoring.ts`（以便解析现有依赖），执行：

```sh
SCORING_BENCHMARK_BASELINE="$PWD/.cache/adoption-baseline/evaluation-scoring.ts" npm run benchmark:adoption
npm run benchmark:documentation
npm run typecheck
npm run lint
npm run test:evaluation
npm run test:rankings
npm run build
```

主分支类型/lint、117 项测试和 3 项榜单测试通过，1 项 Linux 专属测试在 macOS 跳过。tsx IPC 最初被本机沙箱拒绝，测试尚未开始；改用正常本机权限后执行相同完整验证，未减少检查。本机生产构建缺少认证密钥时出现默认密钥警告；使用只存在于构建进程的随机密钥验证，不将该密钥保存或部署。生产须使用原有实际配置独立构建。

发布从现有生产 `93d0d30` 隔离应用本次提交，不包含未开通服务的注册改动；无依赖升级、无数据库迁移。旧报告不会被就地改分，后续评测采用 3.12.0；不批量重评消耗模型额度。

## 发布验收（北京时间 20:08）

- 主分支实现 `5f89f3b` 已推送 GitHub main；隔离生产提交 `20fa571`，发布包 SHA-256 `7926916895a1be5ba2a34dfb0afa9aa5d5773582395f3e64a835d9584ce79fac`。认证、数据库 schema 和锁文件与生产基线逐项相同。
- PostgreSQL 自定义格式备份 1,920,432 字节且归档目录校验成功。旧 release 和备份保留，未清理文件、未迁移数据库。
- 服务器独立 `npm ci`、typecheck、lint、103/103 测试、3/3 榜单、12/12 格式集、29/29 接入集和生产构建全部通过。本机使用构建进程随机密钥后的构建亦通过且无默认密钥警告。
- 20:06 原子切换到 `/opt/releases/skillsupermarket-20260907-20fa571`；Web/Worker 的实际进程目录一致。健康 3.12.0、database/Judge ready；SEO、关键页面和登录保护通过。
- 20:07 一次 SurfSense 运营冒烟由真实 Worker 完成（attempt=1、用户额度扣减 0）。新报告文档分 75、接入检查通过，AI 评审使用正常配置，并生成时序图；公开详情 HTTP 200、版本和图形渲染均验证。旧报告文档分 61 保留。这一次模型冒烟与离线零模型调用基准分开计数。
- 安全检查只有预期代码哈希变化，按已验证 release/摘要单独更新代码基线，未修改账号、公钥或监听端口基线；20:08 复检 healthy。HSTS/nosniff 存在，采集最近运行 success、采集与安全 timer active。健康请求 14ms 为单次采样，不是 SLA。磁盘 50% → 53% 来自保留新 release，仍有 18G 可用，无文件删除。

依据：[Cursor MCP 配置](https://cursor.com/docs/mcp)、[Claude Code MCP 配置](https://code.claude.com/docs/en/mcp)、[SurfSense 公开 README](https://github.com/ModSetter/SurfSense/blob/main/README.md)。于 2026-09-07 核验。
