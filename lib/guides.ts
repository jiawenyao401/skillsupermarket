export interface GuideSource {
  label: string;
  url: string;
}

export interface GuideSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
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
