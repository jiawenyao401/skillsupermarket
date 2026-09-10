# 生产评测切换 DeepSeek V4.1 Flash（2026-09-10）

## 需求与实际 API 名称

用户要求线上使用 `deepseek-v4.1-flash`。2026-09-10 联网核验：[DeepSeek 官方模型说明](https://api-docs.deepseek.com/quick_start/pricing/)明确将 DeepSeek-V4.1-Flash 的 API ID 定为 `deepseek-flash`。生产既有密钥的 `/models` 返回 HTTP 200，列出 `deepseek-flash` 和 `deepseek-v4-pro`。因此使用官方 ID 接入指定模型，不使用过期的 beta 名称或改为其他版本。

原生产 `.env` 没有显式 `DEEPSEEK_MODEL`，应用默认使用 `deepseek-chat`。本轮真实响应表明该旧名称也已被供应商路由到 `deepseek-flash`，并不是把仍运行旧代模型的 API 实例升级。本次将配置显式化，并修复新名称的默认思考模式兼容问题。

## 根因和最小修复

- 直接使用 `deepseek-flash` 时，API 默认思考模式。原质量请求预算 1,800 tokens 全部用于 reasoning，HTTP 200 但 `finish_reason=length`、正文 0 字符，SDK 正确报告 `JUDGE_FAILED`。未把此配置切到生产。
- DeepSeek 请求显式携带 `thinking: { type: "disabled" }`，维持原 `deepseek-chat` 非思考 JSON 评审的行为。正常质量请求和可选图示恢复均适用；不改 OpenAI/Anthropic 请求。
- 保持质量预算 1,800、图示恢复预算 900、超时、重试策略、提示词、评分维度/权重、风险封顶和证据校准不变。评测器仍为 3.14.0，rubric 3.5.0。
- 生产候选的 `.env` 仅新增 `DEEPSEEK_MODEL=deepseek-flash`，解析前后逐项比较其他环境值相同；不复制、轮换或输出任何密钥。
- 网站适配器在服务器运行时读取配置，Next.js 16.3.0 的对应环境变量和部署指南已阅读。因为服务端打包中也包含传输适配器，不能只改 Worker 文件或直接修改旧构建。

## 验证证据

本机 SDK 12/12（新增官方 Flash 请求和图示恢复的非思考模式测试），6 份冻结完整报告 × 10 次保持 0 差异；typecheck、lint、151 项网站评测测试及生产 build 通过。macOS 跳过 1 项需要 Linux 工具的主机检查；最终候选另在 Linux 验证。首次 SDK 测试被沙箱禁止监听回环地址（EPERM），解除这一环境限制后完整重跑，未跳过超时测试。主仓库本地构建有缺少生产 Better Auth secret 的警告，不据此声称本机认证链路已验收；生产候选使用既有正式配置独立构建和验证。

真实 API 验证（不写报告、不改队列）：

| 样本 | 原调用 | 候选调用 | 结果 |
|---|---|---|---|
| 已收录 GitHub MCP README | 5,085 ms；751 输出 tokens | 4,507 ms；680 输出 tokens | 均成功生成架构图；候选无 reasoning 消耗 |
| 固定正常 MCP × 2 | 总分 93 / 93；质量 85 / 84 | 总分 93 / 93；质量 84 / 84 | 均成功生成图示 |
| 固定提示注入 × 2 | 总分 59 / 59；质量 83 / 82 | 总分 59 / 59；质量 83 / 83 | 高风险识别与封顶保持，均成功生成图示 |

固定样本来自 `tests/fixtures/sdk-parity-v3.14.0.json`，固定评测时间 `2026-09-10T00:00:00.000Z`。8 次固定样本调用全部 HTTP 200、`finish_reason=stop`；四个确定性维度与禁用 AI 基线逐字段相同。总分未漂移，AI 质量分存在小幅随机波动。固定样本候选平均输出约 708 tokens，基线 689（约 +2.7%）；候选中位延迟约 3,889 ms，基线 4,074 ms。样本很小，且旧别名也映射到同一新模型，不据此宣称准确率、成本或性能提升。

代码提交：main `c74bc4339f9eb6141f57567b1bb27998e6e75ced`；隔离生产提交 `d9076293426ebf8da1f7e2b121801f4ba26c4b91`，基于实际生产 `3918867`，仅 2 文件、22 行新增，不带入 main 上的注册验证码等其他功能。GitHub main 已按原始 Git 对象 SHA 非强制快进并复查；[Evaluation SDK CI](https://github.com/jiawenyao401/skillsupermarket/actions/runs/34469101394) 成功。

## 发布策略与边界

- 普通完整安装的 6 GiB 空间门槛不修改。此次无依赖变化的独立小修复，package.json/lockfile 与当前 release 完全相同；仅对现有已安装的 node_modules 使用硬链接复用，不运行 npm install/ci/lifecycle，所有源码、配置与 `.next` 独立。构建前后对完整依赖文件逐一 SHA-256 校验，防止共享文件被修改。
- 这一受限构建单独预算为现有 `.next` 大小 + 512 MiB 余量，且上线前至少保留 4 GiB 可用空间；不是删除备份或降低普通安装的空间检查。后续若改变依赖必须走完整安装，不能在共享依赖上直接覆盖文件。
- 创建新数据库备份 `skillsupermarket-pre-d907629.dump`，2,246,082 字节，pg_restore --list 验证；保留原 release、环境和所有旧备份。未执行任何清理。
- 在独立目录完成源码 Git blob 校验、SDK build/test、typecheck、lint、网站评测测试、文档/采用度/输出/凭证回归及 Next.js build，再验证实际网站 Judge 适配器的真实模型响应。
- 激活使用部署锁、队列空闲检查、原子 symlink、Web/Worker reload、验收失败自动恢复旧 symlink/模型/代码基线。只接受经固定摘要验证的代码基线，不重置账号、公钥、监听端口基线。
- 历史报告和缓存不重写；后续新评测或正常重评才记录 `aiJudgeModel=deepseek-flash`。不擅自强制批量重评。
- GitHub SDK 1.0.0 已发布制品不覆盖；本次是网站生产模型切换和源码兼容修复，不宣称已重新发布 npm/GitHub SDK 包。

## 生产结果

- 2026-09-10 19:10（北京时间）完成，生产实际 release 为 `skillsupermarket-20260910-d907629`。Web/Worker 均 online，`/proc/<pid>/cwd` 确认为新目录，不仅检查配置中的 symlink。
- Linux SDK 12/12、网站评测 137/137（0 跳过）、全部上述回归、typecheck、lint、Next.js 生产 build 通过；旧/新 release 各 242 个 Git 跟踪文件验证一致，依赖全文件 SHA-256 构建后校验通过。
- 首次发布检查脚本把 Next 的 `[...all]` 文件名误判为路径穿越，以及把原模型默认值误认为 `.env` 显式值，均在配置写入前退出。修正为路径段检查、允许原变量缺省后重新完整验证；未忽略校验，未修改在线版本。
- 权限审查阻止了候选验收阶段再次向外部模型发送数据库中的真实 Skill 材料。按审查建议，将最终上线前/后验收改为公开仓库的合成固定样本，完全移除数据库连接和内容读取；没有通过其他通道重发被阻止的请求。
- 候选适配器冒烟 4,082 ms、上线后 3,829 ms，均 required AI completed、`finish_reason=stop`，配置名/报告字段/API 返回均为 `deepseek-flash`，流程图生成成功；上线后输入 1,445 tokens、输出 682 tokens。均不访问业务数据库、不写报告、不改队列。
- `/api/health` HTTP 200，database/Judge ready；首页、评测入口、样例详情/API、登录页均 200；线上 `seo:check` 全部通过，定时采集 timer active。
- 仅更新与固定新 release 对应的代码基线：`7714ce51fb1d86045e06f35b859df9dbe60f89ab956b7a39c69bd95adc57113d`，374 文件。账号、公钥、监听端口基线哈希未变；19:10:28 安全检查 healthy；没有触发回滚。
- 部署后磁盘可用 5,117,464 KiB（约 4.88 GiB）、使用率仍为 87%。本次隔离发布消耗约 0.32 GiB，没有再次清理服务器。
