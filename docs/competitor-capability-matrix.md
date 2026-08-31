# 公开评测产品能力矩阵

最后复核：2026-09-01。只记录公开、可追溯信息；不推断私有算法或黑箱权重。

| 产品 / 公开能力 | 解决的问题与目标用户 | 评分 / 报告方式 | 优点 | 局限 | 与本站差距 / 可借鉴假设 | 成本、风险与验证指标 |
| --- | --- | --- | --- | --- | --- | --- |
| [OpenSSF Scorecard](https://scorecard.dev/) | 开源维护者与采用方识别供应链安全实践缺口 | 自动化检查、逐项风险说明、聚合分数和修复建议 | 检查项与建议可追溯，适合进入 CI | 面向通用开源供应链，不回答 AI Skill / MCP 的提示注入和使用价值 | 保留“风险硬上限 + 证据 + 修复建议”；本站已有评分能力，本轮补精确承接 MCP 安全意图的入口 | 低开发风险；7 天内该入口获得真实外部访问或评测 CTA，否则调整关键词与内链 |
| [Socket Package Scores](https://docs.socket.dev/docs/package-scores) | npm / Python 包采用方快速比较供应链风险、质量、维护、漏洞与许可 | 分维度评分，关键告警会限制聚合分数 | 不让高质量分掩盖严重供应链信号 | 评分规则会演进，且不覆盖 MCP 协议语义 | 借鉴维度分离和严重风险上限，不照搬权重 | 已由本站现有五维评分与风险上限覆盖；继续监测误判率和回归集退化 |
| [Snyk Package Health](https://docs.snyk.io/scan-with-snyk/snyk-open-source/manage-vulnerabilities/snyk-vulnerability-database) | 开发者在采用依赖前判断包的健康度 | 以流行度、维护、安全和社区信号形成健康分并支持比较 | 适合采用决策，报告入口清晰 | 健康度不是项目运行时安全证明 | 借鉴“决策入口 + 清晰边界”；本站本轮落地 MCP 接入前筛选页 | 避免“绝对安全”营销；以页面访问、CTA、首次评测和跳出为验证指标 |
| [Official MCP Registry](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx) | MCP 使用方发现可安装、可配置的公开 Server | `server.json` 明确服务器名称、包或远程地址、执行参数、环境变量与能力元数据 | “Server”对应可定位、安装或连接的具体交付物，而非只要内容提到 MCP 就算 Server | 只覆盖提交到 Registry 的公开 Server，不能直接判断 GitHub 教程、SDK 或集合仓库 | 借鉴交付物边界：GitHub 元数据只有明确 Server 证据才归入 `mcp-server`；课程、示例集合、SDK 归入 `agent-pack` | 低运行成本；固定真实样本覆盖 Server、Skill、课程、集合和 SDK；任何已知 Server 被降类即停止发布并补回归样本 |

## 当前进入实现的假设

- 问题：旧采集规则只要元数据出现 “MCP” 就归为 `mcp-server`，导致课程、示例集合和 SDK 使用了错误的评分语义；当前库存粗筛有 7 个疑似误分类项目，其中 5 个已有报告。
- 实验：上线版本化 GitHub 交付物分类器；学习资源优先归为 `agent-pack`，明确 Claude/Agent Skill 才归为 `claude-skill`，只有名称、描述或 topic 出现具体 Server 交付证据才归为 `mcp-server`。
- 成功指标：固定 7 组回归样本全部正确；`microsoft/mcp-for-beginners` 复评不再因“缺少服务器实现”产生错误结论，且 AI 复核与图示正常生成。
- 停止条件：发现已知可安装 MCP Server 被降类，或真实误分类率没有下降，则回滚分类器并扩充金标集后再发布。
