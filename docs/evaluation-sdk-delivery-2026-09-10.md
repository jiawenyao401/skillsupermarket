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

## 初次交付时的分发与上线边界

- 本地生成 `artifacts/skill-supermarket-evaluation-sdk-1.0.0.tgz`，可安装，不代表 npm 公共包已经发布；不擅自注册账号、占用包名或执行发布。
- 本次 SDK 与网站适配代码提交到 main；生产站当前隔离 release 不在此次本地验收中切换。
- 不将 main 上仍需独立配置/验收的注册验证码等改动夹带上线，不重评线上 Skill、不复制密钥、不改数据库、不清理服务器文件。
- 后续网站上线应按既有 release 门槛单独验证、部署，并包含 SDK 源目录。应用回滚使用先前已验证的完整 release，不只恢复旧 facade 文件。
- 下次 SDK 发布前在消费端固定版本与 lockfile，复跑 `sdk:verify`；评分规则变化时同时更新评测器版本和固定回归证据。

## 用户要求发布后的执行记录（2026-09-10）

- 用户明确要求发布、部署，重新核验网络：生产 SSH 正常；GitHub Git HTTPS 仍连接超时，但 GitHub API 可用，不能将单一通道失败描述为整体网络不通。
- 通过现有 GitHub API 同步脚本逐个核验 blob、tree、commit 的原始 Git SHA，非强制快进 main 到 `bdc425eba696ad6d4abc9b2b7323f5d4ea323b8c`。远端 GET 再次确认同一 SHA，没有重写提交历史。
- [Evaluation SDK 1.0.0](https://github.com/jiawenyao401/skillsupermarket/releases/tag/evaluation-sdk-v1.0.0) 已公开发布（非 draft），包含 `.tgz` 与 `.sha256`，应用可直接通过发布 URL 安装。
- GitHub 返回的制品摘要与本地已验证包一致：`c721479d06cf77d1fc3aa9666bb3ac8f6a0ccaeffa934cf1f6224ec89dd86772`，50,060 字节。发布后仅补充仓库文档的安装入口，没有覆盖已发布制品。
- [GitHub Evaluation SDK CI](https://github.com/jiawenyao401/skillsupermarket/actions/runs/34431824207) 已成功完成，覆盖 Node 20/22/24。
- 在生产服务器 Node 20.20.2 的新临时消费目录额外验证：安装包 SHA-256、独立 npm 安装、ESM、CommonJS 动态导入、离线不联网、3.14.0 报告，全部通过。使用明确标记的虚构输入，不读取或写入业务数据库、不调用模型、不变更在线服务。
- npm 登录检查返回 `ENEEDAUTH`：未发布 npm 注册表；不把 GitHub Release 与 npm 发布混为一谈。后续 npm 发布需要具备该 scope 发布权限的身份，不需要在聊天里发送 token。
- 网站 SDK 改动已单独 cherry-pick 到当前生产基线 `6084f03`，候选提交 `3918867d510d0b41d45029136a0541c0e6b4a139`。仅 README 版本说明发生冲突并解决；`lib/auth.ts`、`lib/schema.ts`、`package-lock.json` 与当前生产基线相同，不带入未配置的注册保护。
- 候选源码归档已上传服务器临时目录，SHA-256 `d8e4d0713b42af855d783c9bda57a04e3e02f8e9ff4dcd58c52491cfbe5aeff0`。归档上传不等于网站已部署，未切换线上版本。
- 生产只读检查：仍运行 `skillsupermarket-20260910-6084f03`；前一回滚 `skillsupermarket-20260909-cb55644` 的构建存在；现有数据库备份 2,225,000 字节；11:03:41（北京时间）安全差异检查 healthy。
- 磁盘剩余 5,165,804 KiB（约 4.9 GiB），使用率 87%，未达到既有 6 GiB 新 release 分配门槛。已向用户申请仅删除不在用的 `skillsupermarket-20260902-3209180`、`skillsupermarket-20260903-116203a` 两个旧目录（约 2.1 GiB），保留当前、最近回滚及全部数据库备份。未获授权前不执行清理、不降低门槛。
- 后续：清理授权后，先再次检查目录类型、实际进程 cwd、当前 symlink 和备份，再释放这两个精确目标；重查 6 GiB 门槛，创建新数据库备份，安装、SDK/网站回归、构建全部通过后原子切换；健康、Web/Worker、定时器、报告与代码完整性通过后登记部署。不能直接把 main 全量上线。

### 服务器资源清理检查点（2026-09-10）

- 用户回复“那先清理一下服务器资源”，本轮只处理上文两个精确旧版本，不扩大删除范围、不切换线上。
- 前置检查确认：没有进程 cwd/exe、内存映射、打开文件、systemd/cron/PM2 配置或挂载引用目标；当前版本、近期回滚和数据库备份均有效。
- 在部署锁内为两个旧版本创建完整受限归档，逐文件 `tar --compare` 通过后删除原目录。服务器归档合计 442,306,597 字节；两份随后均经 SSH 下载至本机运维备份目录，SHA-256 一致且 tar 完整可读，可以恢复。备份含配置，仅保存在受限目录，不提交 Git。
- 实测可用空间 5,142,500 → 6,116,116 KiB，使用率 87% → 85%，净释放约 0.93 GiB。以 df 实测为准，不把原目录 du 合计直接当作已释放空间。
- 14:04:31（北京时间）安全检查 healthy；定时采集 active、service Result=success / ExecMainStatus=0；数据库备份仍可读。正式站健康检查 HTTP 200，database/Judge ready；Web/Worker 仍运行 `6084f03`，没有停止或重启服务。
- 当前可用约 5.83 GiB，仍低于 6 GiB 部署门槛。本轮产生的服务器归档副本约 422 MiB，已有完整本机恢复副本，但准备移除服务器副本的脚本上传两次遇到工具权限审查超时，未执行该删除操作。已请求用户确认；在解除这一工具阻塞前保留两端备份，不能声称网站部署已完成。

### 最终清理与生产部署完成（2026-09-10 15:02 北京时间）

- 用户再次明确允许删除服务器冗余归档。本机两份完整恢复包重新通过 SHA-256 和 tar 可读性验证；服务器再次检查当前版本、精确目录清单、归档哈希，随后在部署锁内仅移除这两份服务器副本、校验文件和空目录。数据库备份未删，本机受限运维目录的完整恢复包保留。
- 删除后磁盘可用 6,541,404 KiB（约 6.24 GiB），通过既有 6 GiB 新 release 分配门槛；没有降低门槛。
- 按此前“发布、部署”授权继续上线独立 SDK 候选 `3918867d510d0b41d45029136a0541c0e6b4a139`，生产基线为 `6084f03`。上线前后源码与固定 Git 清单比对通过（旧版本 149、新候选 162 个运行源文件）；注册、schema 和 lockfile 未变。未把 main 全量部署。
- 新数据库备份 `skillsupermarket-pre-3918867.dump` 为 2,245,978 字节，pg_restore --list 验证可读，原生产 release 和旧备份均保留。
- 生产 Node 20.20.2 下完成：npm ci、SDK build、SDK 11/11、隔离 tarball 安装/声明/示例验证、typecheck、lint、网站评测 137/137（0 跳过）、数据库指标集成测试、排名测试、文档/采用度/输出基准、凭证值回归、Next.js 生产 build，全部通过。此隔离生产分支不含 main 的注册保护测试，测试数量不与 main 的 151 项混报。
- 单次真实 Judge 冒烟：只读已收录的公开 README，SDK 通过网站 Judge 配置适配器调用，required AI 成功，评测器 3.14.0、rubric 3.5.0，耗时 4,563 ms；没有写入报告、改动队列或重新评测最近 7 个 Skill。
- 15:02 已原子切换 `/opt/skillsupermarket` 至 `skillsupermarket-20260910-3918867` 并正常 reload Web/Worker。两进程 online，`/proc/<pid>/cwd` 实际目录均为新 release；不是仅检查 PM2 配置中的 symlink 字符串。
- 线上验收：健康 HTTP 200、database/Judge ready；首页、评测入口、案例详情/API、登录页均 200；线上 `seo:check` 全部通过，含匿名评测与受保护页面检查；SDK 离线烟测通过；采集 timer active、service Result=success / ExecMainStatus=0。
- 安全检查仅出现预期代码差异后，核对固定 release 和摘要 `1c3c9f3584d31044347650ec1846aae8ce5a9c8b568c9bf4d4011ab630a11371`，只更新代码基线（374 文件）。账号、公钥、监听端口基线文件哈希未变，15:02:23 复查 healthy。切换脚本配置了验收失败回滚，但此次未触发。
- 新 release 与备份占用约 1.04 GiB；15:02:56 实测可用 5,451,012 KiB（约 5.20 GiB）、磁盘使用率 87%，内存 available 1,187 MiB。清理前后的数字与部署后的数字分开记录，不能继续声称当前可用 6.24 GiB。
- GitHub SDK 1.0.0 正式 release 与已发布制品未覆盖；网站已完成部署。npm 公共注册表仍未发布，后续需要具备对应 scope 权限的 npm 登录身份。
