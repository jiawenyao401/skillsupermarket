# GitHub Skill 类型分类回归：2026-09-01

目标：按仓库实际交付物选择评测语义，避免仅因名称、描述或 topic 提到 MCP，就把教程、课程、示例集合和 SDK 当作可安装 MCP Server 评分。

## 真实基线

- 线上样本 `microsoft/mcp-for-beginners` 被标为 `mcp-server`。
- 最近一次生产评测的确定性检查有 6 项缺失，AI Judge 因总分与缺失证据不一致而安全降级，图示状态为 `judge-unavailable`。
- 当前 180 个有效项目中，使用公开元数据粗筛出 7 个疑似“学习资源或集合却标为 MCP Server”的项目，其中 5 个已有报告。

## 候选分类器 1.1.0

分类顺序：

1. 课程、教程、示例、集合、模板、SDK 等资源仓库优先归为 `agent-pack`。
2. 有明确 Claude / Agent Skill 名称或 topic 的单体交付归为 `claude-skill`。
3. 只有名称、描述或 topic 明确表达 MCP Server 交付物时才归为 `mcp-server`。
4. 只有通用 MCP 关键词而无 Server 证据时归为 `agent-pack`。

这一边界与 Official MCP Registry 的公开 `server.json` 定位一致：Server 需要对应可定位的包或远程地址，并携带执行、配置或能力元数据，而非只讨论 MCP 概念。

## 固定回归与同输入对比

固定样本覆盖课程、awesome 集合、SDK、Server、参考 Servers 集合、Claude Skill 和 Server 示例集合，共 7 组，候选结果 7/7 符合金标。

同一公开 README、同一模型、temperature 0 的 `microsoft/mcp-for-beginners` 对比：

| 指标 | 旧分类 `mcp-server` | 候选分类 `agent-pack` |
| --- | --- | --- |
| 总分 | 78 | 78 |
| 最大缺口 | 错误要求实际服务器代码与接口 | 高级主题细节与设计证据不足 |
| 适用判断 | 夹带“作为 MCP Server”的错误前提 | 明确按课程和学习路径判断 |
| 图示 | flow，generated | flow，generated |

候选没有借分类变化抬分，但移除了错误产品前提，保留了同一证据下的保守评分和流程图。

第一次生产复评证明分类已从 `mcp-server` 修正为 `agent-pack`，但仍触发旧的“4 项缺失且总分超过 72”整体拒绝规则，AI 结论和有效图示一起被丢弃。根因是该规则将中度偏高和极端投机输出放在同一条硬失败路径。

Rubric 3.3.3 将两者分开：90 分以上且缺失至少 4 项证据的极端膨胀仍硬拒绝；有区分度的中度偏高输出先执行单维上限，再将总分确定性压到 72，并在公开方法中记录校准说明。固定样本验证 78 分候选被校准为 72，100 分投机样本与五维同分样本仍被拒绝。上线后再次强制复评，并以 AI Judge 成功、图示生成、分类正确和校准可见作为最终验收门槛。
