export interface GuideSource {
  label: string;
  url: string;
}

export interface GuideSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  intent: string;
  sections: GuideSection[];
  sources: GuideSource[];
}

export const GUIDES: readonly Guide[] = [
  {
    slug: "claude-code-mcp-setup-2026",
    title: "Claude Code MCP 配置教程 2026：HTTP、stdio 与权限范围",
    description: "从选择传输方式、安装与作用域，到凭证、验证和故障排查，安全地为 Claude Code 配置 MCP Server。",
    eyebrow: "Claude Code MCP setup",
    publishedAt: "2026-09-03",
    updatedAt: "2026-09-03",
    readingMinutes: 9,
    intent: "适合第一次为 Claude Code 接入 GitHub、数据库、监控或内部 API，也适合需要把 MCP 配置安全共享给团队的开发者。",
    sections: [
      {
        title: "先决定是否真的需要 MCP",
        paragraphs: [
          "当任务需要读取或操作外部系统，而且反复复制粘贴数据已经影响效率时，MCP 才有明显价值。只需要一段固定工作说明时，Skill 通常更轻；只运行一次的脚本，也不必长期连接为 MCP Server。",
          "连接前先写清楚目标动作，例如“只读查询 Issue”或“读取测试数据库 Schema”。不要从“接入整个系统”开始，因为 Server 暴露的每个工具都会扩大 Agent 可选择的动作和需要审计的边界。",
        ],
      },
      {
        title: "远程服务优先用 HTTP",
        paragraphs: [
          "Claude Code 官方文档把 HTTP 作为连接云端服务的推荐传输；旧 SSE 方式已经弃用，新配置应避免继续采用。只连接你能验证来源和 HTTPS 地址的服务，认证优先走服务提供的 OAuth 流程。",
          "下面的命令不会写入密钥。添加后先列出配置，再查看单个 Server 的传输、地址和作用域是否符合预期。",
        ],
        code: "claude mcp add --transport http <name> <https-url>\nclaude mcp list\nclaude mcp get <name>",
      },
      {
        title: "需要本机文件或进程时才使用 stdio",
        paragraphs: [
          "stdio Server 会作为本地子进程启动，适合访问项目文件或内部命令。它继承的环境和可执行权限决定了真实风险，因此应锁定包版本、使用明确命令，并避免默认开放任意 Shell、任意路径或整个主目录。",
          "`--` 前是 Claude Code 的配置选项，后面才是 Server 命令及参数。先用 local 作用域试运行，确认工具清单、输入 Schema 和副作用后，再考虑团队共享。",
        ],
        code: "claude mcp add --transport stdio --scope local <name> -- <command> [args...]\nclaude mcp list",
      },
      {
        title: "正确选择 local、project 与 user 作用域",
        bullets: [
          "local：只在当前项目加载，配置保存在个人配置中，适合实验和包含私有连接信息的 Server。",
          "project：配置写入项目根目录 `.mcp.json`，可以进入版本控制，适合团队共享不含秘密的 Server 定义。",
          "user：在本机所有项目加载，只适合你确实会跨项目使用且权限范围清楚的个人工具。",
          "同名配置同时存在时，Claude Code 按 local、project、user、插件和连接器的顺序选择；排障时先检查是否被更高优先级配置覆盖。",
        ],
      },
      {
        title: "团队配置可以共享，凭证不可以",
        paragraphs: [
          "项目级 `.mcp.json` 可以使用环境变量展开，让团队共享地址结构而不提交 Token。秘密应来自每个人或部署环境的凭证存储，并使用短期、可撤销、最小作用域的账号。不要把真实值放进 URL、命令参数、README 或提交历史。",
          "项目级 Server 首次使用会触发信任确认；确认前核对本次变更的地址、命令、包版本和环境变量名。第三方仓库中的 `.mcp.json` 应视为不可信配置。",
        ],
        code: "{\n  \"mcpServers\": {\n    \"service-name\": {\n      \"type\": \"http\",\n      \"url\": \"${MCP_URL}\",\n      \"headers\": {\n        \"Authorization\": \"Bearer ${MCP_TOKEN}\"\n      }\n    }\n  }\n}",
      },
      {
        title: "连接成功后做四步验收",
        bullets: [
          "状态：运行 `claude mcp list`，并在 Claude Code 的 `/mcp` 面板确认连接成功和工具数量合理。",
          "权限：逐项查看工具名称、描述和参数，只保留完成目标需要的读取或写入能力。",
          "正向测试：用测试账号完成一个最小任务，确认输出、超时、日志和资源范围符合预期。",
          "反向测试：尝试越界路径、跨项目对象、危险 URL 和高影响动作，确认服务端拒绝，而不是只依赖模型自觉。",
        ],
      },
      {
        title: "常见故障按这个顺序排查",
        bullets: [
          "显示已添加但无法连接：用 `claude mcp get <name>` 核对传输类型、URL、命令和实际作用域。",
          "远程认证失败：在 `/mcp` 中重新登录；检查回调地址、HTTPS、令牌受众和服务端授权范围。",
          "本地进程启动失败：确认命令在当前 PATH 可用、包版本已锁定、工作目录和必需环境变量存在。",
          "连接成功但没有工具：检查 Server 是否声明 tools 能力并实际返回工具；不要通过扩大账号权限掩盖协议或配置错误。",
          "上下文或成本异常增长：减少不必要的 Server 和工具，限制单次返回大小，并移除不会在当前项目使用的 user 级配置。",
        ],
      },
      {
        title: "上线前最后一道安全门",
        paragraphs: [
          "MCP 2026-07-28 规范强化了 HTTP 路由和授权，但协议版本本身不是安全认证。Server 仍可能包含提示注入、凭证外泄、过度授权、危险命令或供应链风险。连接前应审查源码、发布来源、许可证和维护状态，连接后还要验证运行时副作用。",
          "Skill Supermarket 的静态评测会区分已验证证据、风险信号和未验证边界。它适合做接入前初筛与版本变化复测，但不能替代你在真实身份、网络和数据边界上的集成测试。",
        ],
      },
    ],
    sources: [
      { label: "Claude Code 官方 MCP 配置文档", url: "https://code.claude.com/docs/en/mcp" },
      { label: "MCP 2026-07-28 稳定规范说明", url: "https://blog.modelcontextprotocol.io/posts/2026-07-28/" },
      { label: "Skill Supermarket MCP 安全扫描", url: "/mcp-server-security-scan" },
      { label: "查看已收录 MCP Server", url: "/search?q=MCP" },
    ],
  },
  {
    slug: "ai-agent-security-risks-2026",
    title: "AI Agent 安全风险与防护清单 2026：从提示注入到工具越权",
    description: "面向开发者和安全团队的 AI Agent 风险清单：覆盖目标劫持、工具滥用、身份权限、记忆污染、跨 Agent 通信与级联故障。",
    eyebrow: "Agent security 2026",
    publishedAt: "2026-09-03",
    updatedAt: "2026-09-03",
    readingMinutes: 9,
    intent: "适合准备把 Agent 接入代码仓库、数据库、SaaS 或生产流程，以及需要建立 Agent 上线准入和复测标准的团队。",
    sections: [
      {
        title: "Agent 风险为什么高于普通聊天机器人",
        paragraphs: [
          "普通聊天的错误通常停留在文本层；Agent 会读取外部内容、规划多步任务并调用工具，错误或恶意指令可能继续传到文件、账号、数据库和部署系统。风险不只来自模型，也来自工具定义、身份权限、记忆、第三方内容和多个 Agent 之间的数据流。",
          "OWASP 2026 Agentic Top 10 把目标劫持、工具滥用、身份与权限滥用、记忆污染、跨 Agent 通信、级联故障和信任利用列为重点。评估时要沿完整调用链保留证据，不能用一次正常演示推导生产安全。",
        ],
      },
      {
        title: "上线前必须覆盖的七类风险",
        bullets: [
          "目标劫持：网页、文档、Issue、工具结果或其他 Agent 可能夹带指令，诱导系统偏离用户目标或泄露数据。",
          "工具滥用与过度自主：一个原本只需读取的任务获得写入、删除、发送、支付或部署能力，并在缺少确认时直接执行。",
          "身份与权限滥用：Agent 使用共享高权限账号，无法区分真实用户，也无法把每次动作约束到最小资源范围。",
          "记忆与上下文污染：未经验证的事实、恶意指令或敏感数据被写入长期记忆，在未来会话持续影响决策。",
          "不安全的跨 Agent 通信：消息缺少来源、完整性、权限和 Schema 校验，一个受损节点即可影响后续协作者。",
          "级联故障：循环规划、无限重试、扇出调用或错误的自动补救会放大成本、负载和业务影响。",
          "供应链与信任利用：Skill、MCP Server、插件、模型、依赖和远程资源可能在更新后改变权限或行为。",
        ],
      },
      {
        title: "权限设计：先削减功能，再削减权限和自主性",
        paragraphs: [
          "OWASP 对 Excessive Agency 的建议可以落成三层控制：只提供任务必需的工具；每个工具只暴露必要功能；下游账号只授予必要资源和操作。只读与写入工具应分离，任意 Shell、任意路径和任意 URL 不应成为默认接口。",
          "删除、支付、外发消息、部署、权限修改和批量操作必须在执行前展示真实目标、参数与影响，并由用户确认。确认不能只显示模型生成的摘要，还应由服务端根据最终参数重新计算。",
        ],
      },
      {
        title: "运行时控制：把每次调用变成可判定事件",
        bullets: [
          "输入边界：把用户内容、网页、文件、工具结果和记忆标记为不可信数据，禁止其覆盖高优先级策略。",
          "策略闸门：在工具执行前根据身份、资源、动作、环境和风险等级做服务端授权，不让模型自行决定权限。",
          "预算与限流：限制单任务步骤、工具调用、Token、时间、金额和并发；重试必须有上限和退避。",
          "结构校验：工具输入输出、Agent 消息和记忆写入使用严格 Schema，拒绝多余字段、危险协议和越界路径。",
          "可观测性：记录主体、工具、目标、决策、结果、耗时和策略命中，日志只保留必要元数据并脱敏秘密。",
          "停止能力：支持按任务、用户、工具或环境撤销执行权限；异常时先阻止新高影响动作并保全证据。",
        ],
      },
      {
        title: "MCP 与外部服务连接的额外检查",
        paragraphs: [
          "远程 MCP Server 应验证来源、TLS、授权服务器元数据、令牌受众和重定向边界；本地 stdio Server 则应从受控环境读取凭证。连接成功不代表拥有全部工具权限，每个工具仍需独立授权。",
          "不要把长期 API Key 写进配置仓库或交给模型读取。使用短期、可撤销、最小作用域凭证，并确保错误、响应、日志和资源内容不会回显秘密。第三方 Server 更新后应重新比较工具清单、Schema、依赖和权限。",
        ],
      },
      {
        title: "建立可复现的安全回归集",
        bullets: [
          "正向样例：代表性任务能够在最小权限下完成，输出、耗时与工具调用符合预期。",
          "注入样例：网页、README、Issue 和工具结果中的越权指令不能改变目标、读取秘密或扩大工具范围。",
          "越权样例：跨用户、跨项目、越界路径、危险 URL 与高影响动作在服务端被拒绝，并产生可审计原因。",
          "可靠性样例：超时、部分失败、重复消息、依赖不可用和循环规划不会造成重复副作用或无限重试。",
          "更新样例：模型、Skill、MCP Server 或依赖版本变化后，固定样例重新执行并比较改善与退化。",
        ],
      },
      {
        title: "如何使用自动评测而不过度相信分数",
        paragraphs: [
          "自动评测适合检查公开文档、权限信号、危险模式、维护状态和证据覆盖，也适合持续发现版本变化。它不能单独证明运行时授权、隔离、网络边界和真实副作用已经安全。",
          "可靠报告应区分已验证、静态发现和未验证，给出证据位置、风险场景、置信度和复测日期。Skill Supermarket 的安全硬上限不会被 Star 或采用度抵消，但生产准入仍应结合隔离运行、人工审计和组织策略。",
        ],
      },
    ],
    sources: [
      { label: "OWASP Top 10 for Agentic Applications 2026", url: "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/" },
      { label: "OWASP Agent Control Standard", url: "https://genai.owasp.org/resource/agent-control-standard-acs/" },
      { label: "Model Context Protocol 授权规范", url: "https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization" },
      { label: "Skill Supermarket 公开评测方法", url: "/evaluation" },
    ],
  },
  {
    slug: "claude-code-skills-recommended-2026",
    title: "Claude Code Skill 推荐 2026：先装哪类、如何判断值不值得",
    description: "按真实工作场景选择 Claude Code Skills：从 Git、前端、功能开发到插件与自动化，并用权限、触发和可复核结果淘汰无效 Skill。",
    eyebrow: "Claude Code skills 2026",
    publishedAt: "2026-09-02",
    updatedAt: "2026-09-02",
    readingMinutes: 8,
    intent: "适合刚开始给 Claude Code 安装 Skills，或已经装了很多 Skill、却不知道哪些真的会触发和节省时间的开发者。",
    sections: [
      {
        title: "结论：先装高频工作流，不要先堆数量",
        paragraphs: [
          "Claude Code Skill 是一组按需加载的工作流、参考资料和脚本。官方文档明确说明，Skill 可以由 Claude 根据描述自动触发，也可以由用户直接调用；因此“仓库里有 SKILL.md”只代表格式存在，不代表它会稳定触发或产生更好的结果。",
          "选择顺序应由重复频率和失败成本决定：每周都会做、步骤稳定、验收明确的任务最适合 Skill 化。偶发的一次性问题、只有一句提示词的包装，通常不值得安装。",
        ],
      },
      {
        title: "2026 年优先考虑的七类 Skill",
        bullets: [
          "Git 提交：官方 commit 与 commit-push-pr 工作流适合统一提交说明、推送和 PR 流程；涉及推送时应保留人工授权边界。",
          "端到端功能开发：feature-dev 适合需要调查、实现、测试和交付闭环的功能，而不是单文件小改动。",
          "前端设计：frontend-design 适合从需求到可用界面的工作；验收时仍要检查移动端、无障碍、性能与项目设计系统。",
          "自动化规则：writing-rules 适合把反复出现的团队约束变成可执行规则，避免每次对话重新说明。",
          "Skill 开发：skill-development 适合创建或维护 Skill 本身，应同时准备触发样例、反例和回归测试。",
          "Hook 开发：hook-development 适合确定性的生命周期动作；删除、部署、外发等高影响动作不应只靠自然语言触发。",
          "MCP 集成：mcp-integration 适合连接外部工具和数据源，但必须额外审核认证、工具参数、数据外发和最小权限。",
        ],
      },
      {
        title: "安装前用五个问题筛掉大多数无效 Skill",
        bullets: [
          "来源可靠吗：优先官方仓库或可验证维护者，确认许可证、最近提交、发布方式与安装文档一致。",
          "触发描述清楚吗：description 应说明何时使用，也应能推导出何时不使用；过于宽泛会造成误触发和上下文浪费。",
          "权限是否最小：检查 allowed-tools、脚本、网络访问和凭证读取，避免把只读任务升级成任意 Shell 或外部写入。",
          "结果能验收吗：至少应有测试、检查清单、格式约束或可比较样例；只有“让结果更专业”之类口号无法回归。",
          "卸载成本多大：确认是否修改全局配置、Hooks、MCP 连接或项目文件，并记录可逆的移除步骤。",
        ],
      },
      {
        title: "用小型回归集验证，而不是凭一次体验打分",
        paragraphs: [
          "为每个候选 Skill 准备 5 到 10 个真实任务，包含应该触发、不该触发、缺少输入、边界输入和带有不可信内容的样例。固定模型与项目状态，比较未安装和安装后的任务成功率、返工次数、执行时间、工具调用与高风险副作用。",
          "只有在核心样例改善、反例没有明显退化时才保留。若 Skill 只是增加输出篇幅、重复模型本来就会做的步骤，或需要频繁手动纠正触发条件，应删除或收窄描述。",
        ],
      },
      {
        title: "团队使用时必须补上的安全边界",
        bullets: [
          "把 Skill 内的远程内容、示例和工具结果当作不可信数据，不允许它们覆盖系统、组织或用户指令。",
          "部署、发送消息、支付、删除、权限修改等动作应设置为用户显式调用，并在执行前展示真实目标和参数。",
          "不要在 SKILL.md、脚本、示例或日志中保存 API Key；凭证应由运行环境注入并限制作用域。",
          "锁定依赖和来源提交，定期复评权限、维护状态和行为差异；Star 与下载量不能抵消高危设计。",
        ],
      },
      {
        title: "怎样形成自己的最小组合",
        paragraphs: [
          "个人开发者通常先选择一个 Git 工作流、一个主要业务工作流，再按实际需要增加前端、测试或部署 Skill。团队则应先建立准入和回归基线，再维护少量经验证的共享 Skills。",
          "官方 Skills 是可靠的起点，但不是自动安全认证。第三方 Skill 更需要查看公开证据、权限与维护记录。Skill Supermarket 会把文档、安全、工程质量、活跃度和采用度拆开呈现，便于先筛选再在隔离环境验证。",
        ],
      },
    ],
    sources: [
      { label: "Claude Code 官方 Skills 文档", url: "https://code.claude.com/docs/en/skills" },
      { label: "Anthropic 官方 Claude Code Skills 推荐参考", url: "https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-code-setup/skills/claude-automation-recommender/references/skills-reference.md" },
      { label: "Anthropic Agent Skills 官方仓库", url: "https://github.com/anthropics/skills" },
      { label: "Skill Supermarket 公开评测方法", url: "/evaluation" },
    ],
  },
  {
    slug: "how-to-evaluate-ai-skill",
    title: "如何评测一个 AI Skill：从文档、安全到可维护性的完整清单",
    description: "一套可以实际执行的 AI Skill 评测流程：先确认来源，再检查权限、提示注入、工程质量、维护状态和采用证据。",
    eyebrow: "AI Skill evaluation",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 7,
    intent: "适合准备安装第三方 Skill、为团队建立准入标准，或希望改进自己 Skill 的开发者。",
    sections: [
      {
        title: "先确认你评测的确实是 Skill",
        paragraphs: [
          "Skill 的核心通常是可被 Agent 按需加载的指令、脚本和资源，而不是一个必须常驻运行的网络服务。仓库标题里出现 skill 并不能作为充分证据，应继续检查 SKILL.md、安装位置、触发说明和配套资源。",
          "如果项目主要暴露 MCP tools、resources 或 prompts，并要求客户端通过协议连接，它更接近 MCP Server；如果同时打包多个 Agent、工作流和钩子，则更接近 Agent Pack。类型判断错误会让后续安全结论失真。",
        ],
      },
      {
        title: "七步准入检查",
        bullets: [
          "来源：确认仓库、作者、许可证、发布包与文档指向同一项目，并记录将要安装的精确版本或提交。",
          "文档：验证安装、触发条件、输入输出、失败处理、限制和卸载方式是否完整，而不是只看宣传示例。",
          "权限：列出文件、网络、Shell、浏览器和凭证访问范围；默认拒绝与任务无关的权限。",
          "静态安全：搜索提示注入、隐藏下载执行、凭证外传、危险命令、路径穿越和不受约束的远程内容加载。",
          "隔离验证：在测试账号、临时目录和最小权限环境中运行代表性任务，观察实际访问和副作用。",
          "维护状态：检查最近更新、未解决安全问题、依赖锁定、发布节奏和维护者响应，而不只看总 Star。",
          "留存证据：报告应给出文件位置、规则、局限和复测日期，确保其他人能复核，而不是只留下一个分数。",
        ],
      },
      {
        title: "如何理解 Skill Supermarket 的分数",
        paragraphs: [
          "本站把文档完整度、安全性、工程质量、活跃度和采用度拆开评分。安全风险设置硬上限，流行度不能抵消高危行为；AI Judge 只对已经取得的公开证据做结构化复核。",
          "自动评测适合初筛和持续监测，不替代代码审计、渗透测试或生产环境验证。报告里没有取得的证据，不应被解释成项目已经通过对应测试。",
        ],
      },
    ],
    sources: [
      { label: "Anthropic Agent Skills 公开仓库", url: "https://github.com/anthropics/skills" },
      { label: "Skill Supermarket 公开评测方法", url: "/evaluation" },
    ],
  },
  {
    slug: "mcp-server-security-checklist-2026",
    title: "MCP Server 安全评测清单：适配 2026-07-28 稳定规范",
    description: "从协议版本、认证授权、工具参数、凭证、网络边界到供应链，系统检查一个 MCP Server 是否适合接入。",
    eyebrow: "MCP security checklist",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
    intent: "适合准备接入第三方 MCP Server、审核内部 Server，或希望让自己的项目进入团队白名单的开发者。",
    sections: [
      {
        title: "规范兼容不等于安全通过",
        paragraphs: [
          "Model Context Protocol 在 2026 年 7 月 28 日发布了新的稳定规范版本。版本协商、SDK 采用节奏和具体 Server 实现仍需分别验证。项目出现在 Registry、能被客户端发现，也不能推导出它已经完成安全审计。",
          "静态评测可以确认文档、清单、源码模式和维护信号，但无法单独证明握手、认证、工具调用和异常路径在运行时完全符合规范。因此报告必须把协议兼容性与静态安全证据分开描述。",
        ],
      },
      {
        title: "接入前必须过的十项检查",
        bullets: [
          "版本：记录声明支持的协议版本、SDK 版本和版本协商行为；不要默认客户端与 Server 自动兼容。",
          "身份与授权：确认谁能连接、每个身份能调用哪些工具；认证成功不等于拥有全部工具权限。",
          "传输边界：区分本地 stdio 与远程 HTTP 的威胁面，校验来源、TLS、重定向和反向代理配置。",
          "工具定义：逐项审核名称、描述和 JSON Schema，拒绝含糊参数、任意命令、任意路径或任意 URL。",
          "输入验证：对路径、域名、SQL、Shell、模板和文件类型做允许列表，并在服务端二次校验。",
          "用户确认：删除、支付、发送消息、部署和权限变更等高影响工具必须在执行前显示真实参数并确认。",
          "凭证：使用最小权限、短期凭证和服务端密钥库；响应、错误、日志和资源内容不得回显秘密。",
          "内容边界：把工具结果和外部资源视为不可信数据，防止其被拼接为更高优先级指令。",
          "依赖与发布：锁定依赖和发布来源，检查安装脚本、二进制下载、维护者变更与安全响应流程。",
          "运行监控：记录工具名、结果状态和耗时等必要审计信息，同时避免保存敏感参数和完整内容。",
        ],
      },
      {
        title: "怎样形成可复核结论",
        paragraphs: [
          "对每一项检查，至少保留证据位置、风险场景、影响、置信度和建议。没有运行协议测试时，应明确写成“未验证”，而不是“通过”。",
          "本站对 MCP Server 使用与 Skill 一致的五维框架，但会保留项目类型，并在报告中区分静态发现、AI 复核和协议兼容性边界。你可以直接提交公开 GitHub、npm 或 PyPI 项目生成报告。",
        ],
      },
    ],
    sources: [
      { label: "MCP 2026-07-28 稳定规范发布", url: "https://github.com/modelcontextprotocol/modelcontextprotocol/releases/tag/2026-07-28" },
      { label: "MCP Official Registry API", url: "https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/api/official-registry-api.md" },
      { label: "Skill Supermarket 真实 MCP 评测案例", url: "/skill/githubgithub-mcp-server" },
    ],
  },
  {
    slug: "skill-vs-mcp-vs-agent",
    title: "AI Skill、MCP Server 与 Agent Pack 有什么区别？",
    description: "用运行方式、能力边界、权限和评测方法区分 AI Skill、MCP Server 与 Agent Pack，避免把不同项目用同一结论评估。",
    eyebrow: "Skill vs MCP vs Agent",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 6,
    intent: "适合不知道该安装 Skill、连接 MCP Server 还是采用 Agent Pack，以及需要为项目正确分类的开发者。",
    sections: [
      {
        title: "一句话区分三种能力",
        bullets: [
          "AI Skill：给 Agent 按需加载的专门知识、步骤、脚本和资源，重点是“如何完成某类任务”。",
          "MCP Server：通过 Model Context Protocol 对外提供 tools、resources 或 prompts 的服务，重点是“如何让客户端连接并调用外部能力”。",
          "Agent Pack：把多个 Agent、Skill、工作流、钩子或配置组合成一套较完整的工作系统，重点是“如何编排多项能力完成端到端流程”。",
        ],
      },
      {
        title: "为什么不能只看仓库名称",
        paragraphs: [
          "很多仓库会同时包含 MCP Server、客户端配置、Skills 和示例 Agent。分类应以实际交付物为准：是否存在 SKILL.md，是否实现 MCP 协议端点，是否包含多个 Agent 或编排入口。",
          "Skill Supermarket 的类型是索引和评测入口，不是认证标签。若仓库同时提供多种交付物，应在报告中说明本次具体评测对象，而不是用一个标签覆盖整个仓库。",
        ],
      },
      {
        title: "三类项目的评测重点",
        bullets: [
          "Skill：触发条件、指令完整性、提示注入、脚本权限、资源来源和卸载边界。",
          "MCP Server：协议版本、认证授权、传输、工具 Schema、运行时副作用、凭证与兼容性测试。",
          "Agent Pack：角色和权限分离、任务路由、共享记忆、跨 Agent 数据流、失败恢复和整体成本。",
          "共同项：文档、安全、工程质量、维护活跃度与真实采用信号；总 Star 只能作为一个弱信号。",
        ],
      },
      {
        title: "选择建议",
        paragraphs: [
          "只需要让现有 Agent 更擅长一类任务，优先看 Skill；需要连接数据库、SaaS 或本地工具，优先看 MCP Server；需要一整套多角色流程，再考虑 Agent Pack。",
          "无论选择哪一类，都先用最小权限做静态初筛和隔离验证。公开评测报告可以降低筛选成本，但最终权限和生产准入仍应由使用方决定。",
        ],
      },
    ],
    sources: [
      { label: "Model Context Protocol 官方规范", url: "https://modelcontextprotocol.io/specification/2026-07-28" },
      { label: "Anthropic Agent Skills 公开仓库", url: "https://github.com/anthropics/skills" },
      { label: "Skill Supermarket 评测方法", url: "/evaluation" },
    ],
  },
] as const;

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
