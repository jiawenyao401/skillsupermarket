# 公开评测产品能力矩阵

最后增量复核：2026-09-09（GitHub MCP 配置一项）；其余条目仍为 9 月 4 日证据。只记录公开、可追溯信息；不推断私有算法或黑箱权重。

| 产品 / 公开能力 | 解决的问题与目标用户 | 评分 / 报告方式 | 优点 | 局限 | 与本站差距 / 可借鉴假设 | 成本、风险与验证指标 |
| --- | --- | --- | --- | --- | --- | --- |
| [OpenSSF Scorecard](https://scorecard.dev/) | 开源维护者与采用方识别供应链安全实践缺口 | 自动化检查、逐项风险说明、聚合分数和修复建议 | 检查项与建议可追溯，适合进入 CI | 面向通用开源供应链，不回答 AI Skill / MCP 的提示注入和使用价值 | 保留“风险硬上限 + 证据 + 修复建议”；本站已有评分能力，本轮补精确承接 MCP 安全意图的入口 | 低开发风险；7 天内该入口获得真实外部访问或评测 CTA，否则调整关键词与内链 |
| [Socket Package Scores](https://docs.socket.dev/docs/package-scores) | npm / Python 包采用方快速比较供应链风险、质量、维护、漏洞与许可 | 分维度评分，关键告警会限制聚合分数 | 不让高质量分掩盖严重供应链信号 | 评分规则会演进，且不覆盖 MCP 协议语义 | 借鉴维度分离和严重风险上限，不照搬权重 | 已由本站现有五维评分与风险上限覆盖；继续监测误判率和回归集退化 |
| [Snyk Package Health](https://docs.snyk.io/scan-with-snyk/snyk-open-source/manage-vulnerabilities/snyk-vulnerability-database) | 开发者在采用依赖前判断包的健康度 | 以流行度、维护、安全和社区信号形成健康分并支持比较 | 适合采用决策，报告入口清晰 | 健康度不是项目运行时安全证明 | 借鉴“决策入口 + 清晰边界”；本站本轮落地 MCP 接入前筛选页 | 避免“绝对安全”营销；以页面访问、CTA、首次评测和跳出为验证指标 |
| [Official MCP Registry](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx) | MCP 使用方发现可安装、可配置的公开 Server | `server.json` 明确服务器名称、包或远程地址、执行参数、环境变量与能力元数据 | “Server”对应可定位、安装或连接的具体交付物，而非只要内容提到 MCP 就算 Server | 只覆盖提交到 Registry 的公开 Server，不能直接判断 GitHub 教程、SDK 或集合仓库 | 借鉴交付物边界：GitHub 元数据只有明确 Server 证据才归入 `mcp-server`；课程、示例集合、SDK 归入 `agent-pack` | 低运行成本；固定真实样本覆盖 Server、Skill、课程、集合和 SDK；任何已知 Server 被降类即停止发布并补回归样本 |
| [GitHub MCP Server](https://github.com/github/github-mcp-server) / [Playwright MCP](https://github.com/microsoft/playwright-mcp) / [Sentry MCP](https://github.com/getsentry/sentry-mcp) | Claude Code 用户按代码协作、浏览器自动化和故障诊断场景选择 Server | 官方源码与配置文档公开；各产品提供不同的工具、身份与运行边界 | 发布主体和使用场景可交叉验证，能形成可执行的选型对照 | 官方维护不等于默认安全；浏览器、仓库和监控数据仍会扩大权限与不可信输入面 | 不做安装量榜单，落地“场景 → 最小权限 → 越界验收 → 可撤销”的选型指南 | 内容风险低；7 天观察指南访问、继续阅读与评测 CTA，三项均为 0 则停止扩写同类推荐词并调整入口或搜索意图 |

## 当前进入实现的假设

- 问题：D7 指南只有 3 次浏览，继续阅读和评测 CTA 都是 0；评测调度同期完成率 100%，当前主要瓶颈已从交付稳定性转为高意图自然流量与指南承接。
- 实验：发布一篇“Claude Code MCP Server 推荐 2026”选型指南，基于 GitHub、Microsoft、Sentry 和 MCP 官方公开资料，把代码、浏览器、数据库与监控需求映射为最小权限和越界验收步骤，并接入现有指南内链与 SEO 回归。
- 成功指标：7 天内该指南获得真实访问，且指南继续阅读或评测 CTA 至少一项大于 0；同时页面、结构化数据、canonical 与 sitemap 持续通过自动检查。
- 停止条件：7 天访问仍为 0，则不继续扩写相同意图内容，改为调整入口和索引发现；有访问但两类点击都为 0，则重写首屏承诺与 CTA，而不是继续堆篇数。

## 9 月 9 日增量：把配置边界用于一个具体采用任务

[GitHub 官方远程配置，固定提交 7d13a7a](https://github.com/github/github-mcp-server/blob/7d13a7ad6f2a17f351a6d77ce280c85ae1821f4d/docs/remote-server.md) 明确提供按工具集与只读模式限制能力的方式。借鉴的是“按任务收窄能力”的解释方法，不是模仿产品功能、评分或安装量。它不替代底层身份的资源权限；静态源码报告不能验证托管服务和用户令牌。

本站对应差距：推荐指南正文没有直接可读的真实报告。已进入 [PR 只读选型案例](guide-pr-adoption-2026-09-09.md) 实现：任务、证据、工具/身份边界、停止条件和公开报告入口；不新增文章或强制重评，不承诺安全。开发成本低，主要风险是把“只读”误当成全方位隔离，已在正文明确限制。沿用 9 月 11 日指南观察窗口，不用新的发布重置实验时间。
