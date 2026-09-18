# MCP Skills 评测适配记录（2026-09-18）

## 决策

SEP-2640 已成为 MCP 官方可选扩展。普通 MCP Server 不因未实现 Skills 扩展扣分；只有实际提供 `SKILL.md` 证据时，评测器才检查 Agent Skills 格式并将一个确定候选的正文交给质量复核。

官方依据：

- <https://modelcontextprotocol.io/extensions/skills/overview>
- <https://github.com/modelcontextprotocol/ext-skills/blob/main/specification/stable/skills.mdx>
- <https://agentskills.io/specification>

## 已确认的旧基线问题

在评测器 3.15.0 上，固定 README、仓库与许可证条件后：

| 输入 | 确定性质量分 |
|---|---:|
| 不提供 `SKILL.md` | 38 |
| 提供空 `SKILL.md` | 58 |
| 提供含步骤和失败处理的 `SKILL.md` | 58 |

原因是旧规则只检查文件名，AI Judge 也只收到 README 与检查摘要，没有收到 Skill 正文。

## 3.16.0 候选行为

- 使用安全 YAML 解析校验 frontmatter；检查 `name`、`description`、父目录、可选字段类型和非空正文。
- 有效格式贡献 12 分确定性质量；正文同时包含可核实步骤/示例时再贡献 8 分。空文件不加分。
- `claude-skill` 的有效正文参与文档检查；AI Judge 在独立的不可信边界内接收最多 16,000 字符的一个 Skill 正文。
- 多 Skill 输入全部做格式扫描，只选一个确定候选做质量复核，报告公开覆盖限制。
- 混合“Agent Skills over MCP”仓库保持 `mcp-server` 为主要类型。
- 报告新增可选 `agentSkills` 合规结果；现有消费者不需要该字段也可继续读取报告。

## 固定回归与边界结果

- 专项回归：48/48 通过，覆盖有效、空文件、错误目录、错误大小写、YAML alias、薄正文、多 Skill 和普通 MCP 无扩展。
- 全量回归：165 通过、0 失败、1 个 Linux 专用安全监控测试跳过。
- SDK 契约：6 份报告 × 10 次，无漂移；12/12 SDK 测试通过。
- SDK 独立安装：package allowlist、ESM、CommonJS 动态导入、TypeScript、离线示例、许可证全部通过。

## 真实模型对比

使用 `deepseek-flash` 对纯合成样本各运行 2 次；没有数据库写入，也没有发送真实仓库或用户数据。

| 样本 | 输入证据字符 | 分数 | 图示 | 延迟 | 模型请求 |
|---|---:|---:|---|---:|---:|
| 仅 37 字符 README | 37 | 9 / 9 | 均无（证据不足） | 2.33s / 2.56s | 每次 1 |
| README + 实际 Skill 正文 | 458 | 39 / 42 | 均生成 flow | 3.33s / 2.98s | 每次 1 |

候选让模型基于真实工作流而非仓库宣传作判断；两次分数漂移为 3 分，模型请求数没有增加。小样本中候选中位延迟约 3.15 秒，基线约 2.44 秒，增加约 0.71 秒。供应商响应没有向 SDK 暴露 token 用量，因此不编造成本结论；可确认输入证据增加 421 个字符。

## 未包含的范围

本轮不主动连接远端 MCP Server，也不执行 `server/discover`、`skills/list`、`skills/get` 或 `resources/read`。远端协议一致性、来源服务器绑定、manifest digest/size 和动态资源应由后续受控采集适配层提供证据，不能由静态仓库材料推断。

## 生产发布验收

- 主干提交 `81874e7` 已推送；生产从现有隔离分支只纳入长 README 证据修复和本次 Agent Skill 适配，发布提交为 `ef64212`，没有带入尚未配置外部服务的注册保护。
- 清理 28 个未被进程或当前链接引用的过期 release 后，保留当时当前版本和两个回滚版本；磁盘使用率 88% → 21%，数据库备份、上传文件与日志未删除。
- 发布前数据库备份 2,492,228 字节并通过 `pg_restore --list`。服务器门禁为 151/151、SDK 12/12、typecheck、lint、SDK build 和 Next build 全部通过；首次 Next build 因 2 GB 主机无 Swap 被内核 OOM 终止，流量未切换。随后只在构建生命周期启用临时 2 GB Swap，原检查通过后自动卸载并删除，未降低门槛或停止线上服务。
- 北京时间 11:34 激活 `skillsupermarket-20260918-agent-skill`。Web/Worker 实际目录一致，健康接口返回 evaluator `3.16.0`、数据库和 Judge ready；五个公开路径 200、两个 timer active、最近流水线 success，安全检查 healthy。PM2 持久化进程列表已重新保存。
- 生产 DeepSeek 使用纯合成材料各调用一次：37 字符 README 得分 17、证据不足不生成图；增加有效 Skill 正文后得分 42、生成 flow。两次各 1 个模型请求、约 1.85s / 3.32s，不写数据库，也不代表总体准确率或线上 SLA。
- 发布后临时 Swap 为 0 行且文件不存在；磁盘 23%、约 28.7 GiB 可用。旧报告没有自动重评，只有后续 3.16.0 评测会使用新证据规则。
