# 单点分发包：Awesome MCP DevTools

准备日期：2026-09-09（北京时间）。状态：**目标、内容和产品链接已核实，尚未向第三方发送，等待用户确认这一个 PR**。

9 月 10 日增量：继续同一目标，将正文从泛化示例改成“只读查看 PR”的可核对任务，并附可直接校验的一行补丁；没有新增渠道、发送或重置观察窗口。

## 目标与用户价值

- 目标仓库：[punkpeye/awesome-mcp-devtools](https://github.com/punkpeye/awesome-mcp-devtools)，目标分支 `main`，文件 `README.md` 的 `Testing Tools` 分类。
- 面向正在接入或维护 MCP Server 的开发者：安装前阅读已有报告，对照静态风险与文档证据，再决定是否评测自己的公开项目。
- 路径：目录条目 → 本项目 README 的免登录示例 → 报告 → 登录后评测。不是把网站冒充 MCP Server，也不是声称替代运行时测试。
- 只投一个匹配条目，不群发 Issue、不索要 Stars、不购买推荐位，不向被评测项目发送漏洞定性或安全背书。

## 收录规则与可行性证据

核实了目标仓库 [README](https://github.com/punkpeye/awesome-mcp-devtools/blob/0b704918976f0c6c08e14746dd97a312bca3380e/README.md) 与[贡献规则](https://github.com/punkpeye/awesome-mcp-devtools/blob/0b704918976f0c6c08e14746dd97a312bca3380e/CONTRIBUTING.md)。规则要求链接到项目仓库、一工具一行、简短准确描述、合适分类，并关注字母排序。该分类已有静态扫描工具和评测工具，因此本项目的静态评测用途与分类匹配；是否收录仍由维护者判断。

- API 核实目标未归档，基准提交 `0b704918976f0c6c08e14746dd97a312bca3380e`，README blob `a50d22d47e7ead12832a67c158247d60aa3f91fb`。
- 文件树仅有 README、CONTRIBUTING、LICENSE；这些已检查入口没有单列 AI 投稿禁令或 PR 模板。这不是平台永久许可，提交前仍需重新检查规则。
- README 不含本站品牌或域名；全状态 Issue/PR 搜索 `skillsupermarket` 和 `"Skill Supermarket"` 均为 0。搜索存在索引延迟，发送前再次查重。
- 目标有 482 Stars，但这不是活跃访客数。最近主分支更新为 8 月 4 日，存在较多待审 PR；最近关闭的三条未合并，不能承诺快速收录。只做一次小规模、可停止的匹配实验。
- 拟把新条目放在 `greynewell/mcpbr` 后、`Typewise/mcp-chaos-rig` 前，使附近名称顺序相容。原列表并非整体严格排序，不重排其他作者的条目。

本轮不采用 V2EX 自动生成推广帖，其[站规](https://www.v2ex.com/about)明确禁止 AI 生成内容；也不采用 DEV 的 AI 辅助产品推广文章，其[规则](https://dev.to/guidelines-for-ai-assisted-articles-on-dev)明确排除此用途。不通过改写或隐藏 AI 参与绕过规则。

其他筛选结果保留为排除项，不同时投稿：appcypher 的 MCP 目录已归档；punkpeye 的 MCP servers 列表要求实际可安装运行的 Server；VoltAgent 的 Skill 列表要求实际 Skill 与社区采用证据。它们不是本网站当前适合的收录分类，不为进入目录临时造一个空壳 Skill 或 Server。

## 可直接提交的内容

拟用分支名：`codex/add-skill-supermarket`。确认前不创建远程 fork、分支、Issue 或 PR。

PR 标题：

```text
Add Skill Supermarket to Testing Tools
```

README 唯一新增条目：

```markdown
- [Skill Supermarket](https://github.com/jiawenyao401/skillsupermarket) 📇 - Evaluates public MCP server repositories and agent skills using static risk checks and documentation evidence, with public reports and review recommendations.
```

PR 正文：

```markdown
## Summary

Adds Skill Supermarket to Testing Tools as an open-source, evidence-based evaluator for public MCP server repositories and agent skills.

Disclosure: this is a maintainer submission for Skill Supermarket, prepared with AI assistance.

## Why it fits

The tool brings static risk findings, documentation checks, source evidence and review recommendations into a public report. It is intended to help developers decide what to inspect before adopting a project; it does not install or execute the projects being evaluated.

For a concrete example, a developer considering GitHub MCP for read-only pull-request inspection can open the [public GitHub MCP report](https://skillsupermarket.com/skill/githubgithub-mcp-server#evaluation-report-title) without an account. It shows the report date and version, source-based review findings, and an inferred deployment diagram—not a record of a live MCP session.

The linked [PR adoption checklist](https://skillsupermarket.com/guides/claude-code-mcp-server-recommendations-2026) separates the proposed task from tool permissions, identity permissions and repository scope. It gives checks and stopping conditions; we have not executed that integration test for the reader.

[Methodology and limitations](https://skillsupermarket.com/evaluation) are also public. The website is currently in Chinese. Creating a new evaluation requires signing in, and results are public.

## Scope and limitations

These are static checks and optional AI review of the retrieved project materials, not runtime testing or a security certification. Findings can be incomplete or false positives and should be checked against the source. Existing reports display their evaluation version and date; deploying a new evaluator does not refresh old reports automatically.

## Validation

- The source repository is public and licensed under Apache-2.0.
- The linked report and methodology page return HTTP 200 without a session.
- The existing list and issue/PR search were checked for duplicates.
- This change adds one entry and does not modify other projects.
```

## 发布前验收

2026-09-09 02:05 完成只读 HTTP/API 核对：

- 自有 GitHub 仓库 public，GitHub 识别许可为 Apache-2.0，Website 为正式域名。
- 首页、方法页、Filesystem 报告、SurfSense 报告均为 200，公开报告锚点存在，HTTPS 校验正常且带 HSTS。
- Filesystem 现有报告版本 3.10.0；SurfSense 为 3.12.0。示例不是当前 3.13.0 的新产出，不引用固定分数做推荐，也不声称每份报告有图。
- `/evaluate` 匿名请求为 307，准确跳转本站 `/login?returnTo=%2Fevaluate`。首轮临时验收脚本误把受保护入口也要求为 200；核对认证契约后改为严格验证 307、本站登录地址和返回路径，再完整重验通过。没有改应用或放开鉴权。
- 本轮未启动浏览器统计、未注册账号、未提交评测、无模型调用。HTTP 链接验收不冒充新完成的登录后评测端到端测试；移动端完整验收沿用 9 月 8 日发布记录。
- 发送前重新读取 upstream HEAD、贡献规则、查重结果与链接状态；若规则变更、已有同名投稿、链接失效或类别不再匹配，暂停这个投稿，不自动换目标发送。

02:16 最终校验：文档代码块闭合、本地引用存在；在内存中把条目插入固定 upstream README，确认恰好多一行，移除这一行后与原文完全一致。没有执行第三方仓库代码，也没有写入第三方仓库。全部公开链接与匿名登录返回路径再次通过。项目主干 typecheck、lint、生产 build 通过；评测相关测试 136 通过、1 项 Linux 专属跳过，榜单 3/3 通过。它们是交付护栏，不是增长结果或本轮算法提升。

## 基线、观察与停止条件

延续 [GitHub 首次价值实验](../growth-github-entry.md)，不重新开始原有观察窗口。

9 月 9 日 02:02 的生产基线：D7 PV 58、评测 CTA 2、GitHub 来源 PV 0；D7 新用户 0、首次完成评测用户 0，用户评测任务 1/1 完成。PV 不是独立用户，运营评测不算增长。当天刚开始，没有理由据此宣告 9 月 9–15 日的入口实验失败。

- **交付里程碑**：用户确认后提交 1 个 PR，并回读 URL、目标分支与一行差异。提交、被收录和产生用户价值分别记录，不能相互替代。
- **前置信号**：7 个完整北京时间自然日内观察到真实 GitHub 来源的目标报告/指南访问，以及至少一次相关评测 CTA；结合新增用户与首次完成评测判断有没有继续使用。报告路径纳入本次 MCP 示例，不把所有指南浏览混在一起。
- **归因限制**：现有系统只存粗粒度来源，不能区分这条 PR、目录主分支、本仓库 README 或其他 GitHub 链接，也不能串联个人访问与注册；不把 GitHub 增量直接归因于此 PR。不新增追踪 Cookie 或用 UTM 冒充已有的细分归因。
- **停止条件**：提交 7 天无人处理，或维护者拒绝，则停止催促和重复提交，不同仓库间批量复制；等待用户确认的状态不反复提醒。若收录后 7 个完整自然日无目标访问，不继续润色同一条目，调整分发目标；有访问无 CTA 时，回到报告可理解性与首次评测阻力。新增对外目标仍需发送前确认。
- 不把“提交 PR”“增加一条链接”报告成获客成功，也不保证外链能带来排名或收入。

## 下一检查点

唯一需要用户决策：是否按上述内容向 `punkpeye/awesome-mcp-devtools` 提交这 **1 个**收录 PR。确认只覆盖该目标与内容，不扩大为社区群发、其他目录或后续推广评论。

未获确认期间，保持现有增长观察；继续处理真实首次使用问题或维护者已有反馈，不用新增内部技术功能替代获客结果。本次只保存分发资料，不做应用发版，不将未配置的注册保护部署到生产。

## 2026-09-10 · 可执行投稿材料与证据更新

### 为什么调整这一份材料

原稿证明“有一个公开报告”，但没有让目录维护者快速判断它如何帮助开发者完成具体选择。本站现有 PR 案例已经上线，GitHub MCP 报告的真实凭证误报也已纠正；现在可以用同一任务展示“先看报告，再单独核对权限”的边界。不是借项目高分做安全背书，也不把新报告说成实测成功。

07:49 的目标路径基线仍为最近七个北京时间自然日：指南直接浏览 1、站内浏览 1，评测 CTA/继续阅读均为 0；GitHub MCP 报告没有流量行。它不证明无人读取或零收录，不能计算独立用户转化率；凌晨纠错和本轮验收均不算用户访问。

### 一行补丁

文件：[awesome-mcp-devtools.patch](awesome-mcp-devtools.patch)。补丁只在原 `Testing Tools` 分类插入已审核的同一条目，不复制或重排其他作者条目。使用零上下文补丁，**必须先核对固定基线，不能应用到任意更新后的 README**：

- upstream main：`0b704918976f0c6c08e14746dd97a312bca3380e`。
- README SHA-256：`bdaf04d25336754dd76a02e3277f01195174d3bcf4bba4222474058f6c5ea622`。
- 原文件第 208 行之前插入；在对应的本地副本里运行 `git apply --check --unidiff-zero <补丁绝对路径>`，再核对仅 1 行新增、0 行删除。发送前按上面的规则再次查重和复核目标 HEAD。
- 本文件的 PR 标题与正文是唯一待发内容；补丁不授权建 fork 或提交 PR。

### 本轮已核实的边界

目标仍未归档、默认分支 main、HEAD 未变；重新读取[贡献规则](https://github.com/punkpeye/awesome-mcp-devtools/blob/0b704918976f0c6c08e14746dd97a312bca3380e/CONTRIBUTING.md)与 README，分类仍适用。品牌精确词的全状态 Issue/PR 搜索返回 0；搜索有索引延迟，不能替代发送前查重。没有维护者同意或合并保证。

示例报告、对应指南和方法页本轮匿名 HTTP 200、canonical 指向正式站，报告锚点和图示存在；最新样例为 9 月 10 日的 3.14.0 报告。正文不写固定分数，若报告以后变化，应如实保留新的风险或无图说明，不自动重评来迎合投稿。当前页面主要是中文，英文 PR 明确披露这一点及维护者身份、AI 辅助、登录要求、静态评测限制。

搜索后台仍未取得只读数据：本机无 Vercel 项目标识，Google/百度验证变量未配置；这仅是本机状态，不证明生产缺失或站点未被验证。浏览器入口因 Mac 锁定无法检查，本轮没有尝试绕过锁屏或读取浏览器凭证。搜索抽样未提供本站目标 URL，不据此推导零收录。发现/索引问题仍按原计划处理，不新增一个后台功能或反复提交 sitemap 来代替证据。

本轮仅更新这份可执行分发包，不做应用发版；发送授权仍是原有唯一待确认项，未重复催问。9 月 11 日指南与 9 月 16 日 GitHub 链路观察窗口不变。

07:57 验收：在临时只读 clone 中确认精确 HEAD 和 README 哈希，再运行补丁 `--check` 和 `--numstat`：可应用，恰好新增 1 行、删除 0 行；clone 工作区仍干净，没有实际改动或推送第三方仓库。补丁 SHA-256 为 `0030a3b6b33118e4ff99ecd2728fd0ce8a315441ab38fe283b836bf3a4d794d7`。草稿代码块闭合、所有本地引用及披露检查通过；本机 typecheck、lint、完整评测回归、榜单回归与生产 build 全部退出 0。它们证明材料可交付，不证明投稿、收录或增长已经发生。
