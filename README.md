# 🛒 Skill Supermarket

> AI 技能超市 —— 发现、评测、跟踪 Claude Skills / MCP Servers / Agent Packs

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)

---

## 📖 目录

- [项目简介](#-项目简介)
- [核心功能](#-核心功能)
- [技术栈](#-技术栈)
- [目录结构](#-目录结构)
- [快速开始](#-快速开始)
- [环境变量](#-环境变量)
- [数据库设置](#-数据库设置)
- [部署到 Vercel](#-部署到-vercel)
- [CLI 命令](#-cli-命令)
- [数据模型](#-数据模型)
- [API 文档](#-api-文档)
- [评测系统](#-评测系统)
- [热度算法](#-热度算法)
- [采集策略](#-采集策略)
- [GitHub Actions 自动化](#-github-actions-自动化)
- [开发路线图](#-开发路线图)
- [贡献指南](#-贡献指南)
- [排错 FAQ](#-排错-faq)
- [许可证](#-许可证)

---

## 🎯 项目简介

**Skill Supermarket** 是一个面向开发者的 **AI 技能发现 / 评测 / 跟踪平台**。收录的对象是 AI 时代的三类"可复用资产"：

| 类型 | 说明 | 例子 |
|---|---|---|
| **Claude Skill** | `SKILL.md` + 资源包, Anthropic 官方/社区发布 | PDF Skill, Web Fetch Skill |
| **MCP Server** | Model Context Protocol 服务, stdio/http/sse | `server-git`, `server-postgres` |
| **Agent Pack** | 完整 prompt + 工具定义的 Agent 模板 | `awesome-claude-code` |

**暂时不做**的事情（明确的范围边界）：
- ❌ 不托管 / 跑用户上传的代码（不跑沙箱）
- ❌ 不做付费 / 订阅（纯展示 + 评测）
- ❌ 不做信创 / 企业版
- ❌ 不做注册 / 评论 / 用户系统（V1）

**要做的**核心三件事：
- ✅ **Skill 超市**：浏览、搜索、分类、详情
- ✅ **热度榜单**：每日 / 每周 / 每月最火
- ✅ **Skill 评测**：5 维自动评分 + 安全扫描

---

## ✨ 核心功能

### 1. 三大榜单（首页）

- **今日 TOP 10**：基于过去 24 小时数据
- **本周 TOP 10**：基于过去 7 天数据
- **本月 TOP 10**：基于过去 30 天数据

热度综合考虑：**stars 增长（40%）+ 下载增长（30%）+ 活跃度（20%）+ 提及量（10%）**

### 2. Skill 详情页

每个 Skill 都有独立页面：
- 基本信息（类型、分类、License、版本）
- 统计（GitHub stars、forks、下载量、最近 commit）
- 评测雷达图（5 维：文档/安全/流行/活跃/质量）
- 30 天热度趋势图
- 安全发现详情
- 完整 README 渲染
- 相关标签

### 3. 自动评测系统

评测流程（异步队列）：
1. 拉取 GitHub 仓库元数据
2. 抓取 README
3. **安全扫描**：prompt 注入、敏感数据、危险 API
4. **LLM Judge**：5 维质量评分（DeepSeek 默认）
5. **流行度评分**：stars、forks、downloads
6. **活跃度评分**：commit 频率
7. 入库并展示

### 4. 多数据源采集

- GitHub（topic 搜索 + repos API）
- npm Registry（@modelcontextprotocol/*）
- PyPI
- 手动收录（冷启动种子数据）

### 5. 全自动化（GitHub Actions）

- 每 6 小时采集一次
- 每 2 小时跑一次评测队列
- 每小时生成一次榜单

---

## 🛠 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| **前端** | Next.js 15 (App Router) + TypeScript | SSR + RSC + 一套代码 |
| **样式** | Tailwind CSS + shadcn/ui 风格 | 快速 + 现代 |
| **图表** | Recharts | 简单 + 够用 |
| **DB** | PostgreSQL + Drizzle ORM | 类型安全 + 性能好 |
| **API** | Next.js Route Handlers | 一体化 |
| **采集** | GitHub Actions + tsx | 免费 + 简单 |
| **LLM** | DeepSeek (默认) | 便宜 ($0.14/M input) |
| **部署** | Vercel | 免费 Hobby 额度 |

**月固定成本估算**：≤ ¥300（主要是 LLM 调用）

---

## 📁 目录结构

```
skillsupermarket/
├── app/                       # Next.js App Router
│   ├── layout.tsx             # 全局 layout (header/footer)
│   ├── page.tsx               # 首页 (3 个榜单)
│   ├── globals.css            # Tailwind 基础样式
│   ├── skill/[slug]/          # Skill 详情页
│   ├── category/[name]/       # 分类页
│   ├── search/                # 搜索页
│   ├── evaluate/              # 评测提交页
│   └── api/                   # API routes
│       ├── skills/            # 列表/详情
│       ├── rankings/          # 榜单
│       ├── search/            # 搜索
│       └── evaluate/          # 评测任务提交
│
├── components/                # React 组件
│   ├── ui/                    # 基础 UI (Badge, Button)
│   ├── SkillCard.tsx          # Skill 卡片
│   ├── RankingTabs.tsx        # 榜单 tabs
│   ├── EvaluationRadar.tsx    # 评测雷达图
│   ├── TrendChart.tsx         # 趋势图
│   └── SearchBar.tsx          # 搜索框
│
├── lib/                       # 核心库
│   ├── types.ts               # TypeScript 类型
│   ├── schema.ts              # Drizzle 数据库 schema
│   ├── db.ts                  # 数据库连接
│   ├── utils.ts               # 工具函数 (cn, formatNumber)
│   ├── github.ts              # GitHub API 封装
│   ├── npm.ts                 # npm Registry 封装
│   ├── pypi.ts                # PyPI 封装
│   ├── ranker.ts              # 热度计算 + 榜单生成
│   ├── scanner.ts             # 安全扫描器
│   ├── judge.ts               # LLM Judge
│   └── evaluator.ts           # 评测主流程
│
├── scripts/                   # CLI 脚本
│   ├── collect.ts             # 采集入口
│   ├── evaluate.ts            # 评测 worker
│   └── rank.ts                # 榜单生成
│
├── data/
│   └── seed-skills.ts         # 种子数据
│
├── .github/workflows/         # GitHub Actions
│   ├── collect.yml            # 采集 (每 6h)
│   ├── evaluate.yml           # 评测 (每 2h)
│   └── rank.yml               # 榜单 (每小时)
│
├── docs/                      # 文档
├── public/                    # 静态资源
├── drizzle/                   # Drizzle migrations
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── postcss.config.js
├── drizzle.config.ts
├── .env.example
├── .gitignore
└── README.md                  # 本文件
```

---

## 🚀 快速开始

### 前置要求

- **Node.js ≥ 20** （[下载](https://nodejs.org)）
- **PostgreSQL ≥ 14** （本地 / Supabase / Neon / Vercel Postgres）
- **GitHub Token** （[申请](https://github.com/settings/tokens), 选 `public_repo`）
- **DeepSeek API Key** （[申请](https://platform.deepseek.com), 用于 LLM Judge）

### 1. 克隆 & 安装

```bash
git clone https://github.com/your-username/skillsupermarket.git
cd skillsupermarket
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env, 填入你的 DATABASE_URL / GITHUB_TOKEN / DEEPSEEK_API_KEY
```

### 3. 初始化数据库

假设你已经有一个 Postgres 数据库, 然后生成 migration:

```bash
npm run db:generate     # 生成 SQL
npm run db:migrate      # 应用到数据库
```

或者用 push（开发期更快, 不写 migration 文件）:

```bash
npm run db:push
```

### 4. 种子数据（推荐先跑）

```bash
npm run seed
```

这会插入 16 个高质量 Skill 作为冷启动数据。

### 5. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 查看。

### 6. 跑采集 + 评测 + 榜单

另开一个终端:

```bash
# 采集 GitHub + npm
npm run collect

# 跑评测队列
npm run evaluate

# 生成榜单
npm run rank
```

---

## 🔑 环境变量

完整配置见 `.env.example`。**必填项**：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres 连接串 |
| `GITHUB_TOKEN` | 推荐 | 不填会被限流到 60 次/小时 |
| `DEEPSEEK_API_KEY` | 可选 | 不填则跳过 LLM Judge |

**LLM Judge provider 三选一**（优先级从高到低）：

```bash
# 1. DeepSeek (推荐, 便宜)
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# 2. OpenAI
OPENAI_API_KEY=sk-xxx

# 3. Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 🗄 数据库设置

### 选项 1: Supabase（推荐个人）

1. 注册 [Supabase](https://supabase.com)
2. 创建项目
3. 复制 Connection String（Settings > Database > Connection string > URI）
4. 填入 `.env` 的 `DATABASE_URL`

**优点**：免费 500MB、自动备份、Web Dashboard

### 选项 2: Neon

1. 注册 [Neon](https://neon.tech)
2. 创建项目
3. 复制 Connection String
4. 填入 `.env`

**优点**：Serverless、Scale to 0、Postgres 17

### 选项 3: 本地 Postgres

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
createdb skillsupermarket

# DATABASE_URL=postgres://localhost:5432/skillsupermarket
```

### 选项 4: Docker

```bash
docker run --name skills-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/skillsupermarket
```

### Migration 命令

```bash
npm run db:generate   # 根据 schema.ts 生成 SQL
npm run db:migrate    # 应用 migration
npm run db:push       # 直接同步（开发期, 不写文件）
npm run db:studio     # 打开 Drizzle Studio
```

---

## ☁️ 部署到 Vercel

### 1. 推送代码

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-username/skillsupermarket.git
git push -u origin main
```

### 2. Vercel 导入

1. 打开 [vercel.com](https://vercel.com)
2. Import Project
3. 选择你的 repo
4. **环境变量**：填入 `DATABASE_URL` / `GITHUB_TOKEN` / `DEEPSEEK_API_KEY`
5. Deploy

### 3. 配置 Vercel Postgres（可选）

在 Vercel 项目里:
- Storage > Create Database > Postgres
- 复制 `DATABASE_URL` 到环境变量

### 4. 首次部署后跑 migration

Vercel 不会自动跑 migration。两种方式:

**方式 A: 本地连远程 DB 跑 migration**
```bash
DATABASE_URL=你的远程URL npm run db:migrate
```

**方式 B: 在 Vercel Build Command 加 migration**
```
Build Command: npm run db:migrate && npm run build
```

### 5. 配 GitHub Actions Secrets

在 GitHub repo > Settings > Secrets and variables > Actions 添加:
- `DATABASE_URL`
- `GITHUB_TOKEN`（自动提供, 不需要手动配）
- `DEEPSEEK_API_KEY`

之后每 6h 自动采集, 每 2h 自动评测, 每小时生成榜单。

---

## 🖥 CLI 命令

```bash
# ===== 开发 =====
npm run dev              # 启动 Next.js (端口 3000)
npm run build            # 生产构建
npm run start            # 启动生产服务
npm run lint             # ESLint
npm run typecheck        # TypeScript 检查

# ===== 数据库 =====
npm run db:generate      # 生成 Drizzle migration
npm run db:migrate       # 应用 migration
npm run db:push          # 直接同步（开发用）
npm run db:studio        # 打开可视化 Drizzle Studio

# ===== 数据流水线 =====
npm run seed             # 插入种子数据
npm run collect          # 采集 GitHub + npm
npm run evaluate         # 跑评测队列
npm run rank             # 生成日/周/月榜
```

**典型工作流**：

```bash
# 第一次启动
npm install
cp .env.example .env  # 填入密钥
npm run db:push
npm run seed
npm run collect        # 抓取真实数据
npm run evaluate       # 跑评测
npm run rank           # 生成榜单
npm run dev            # 启动网站
```

---

## 📊 数据模型

详细 schema 见 [`lib/schema.ts`](lib/schema.ts)。核心 5 张表：

### `skills` - 主表

```ts
{
  id: uuid,
  slug: string,             // URL 友好, 唯一
  type: "claude-skill" | "mcp-server" | "agent-pack",
  name: string,
  description: text,
  tags: string[],
  category: "programming" | "data" | "design" | "productivity" | "other",
  source: "official" | "github" | "npm" | "pypi" | "manual",
  repoUrl, packageUrl, homepageUrl,
  authorName, authorAvatar, authorUrl,
  license, currentVersion,
  firstSeenAt, lastUpdatedAt, lastIndexedAt,
  githubStars, githubForks, githubWatchers, githubOpenIssues,
  githubLastCommit,
  npmDownloadsWeekly, pypiDownloadsWeekly,
  status: "active" | "archived" | "removed"
}
```

### `evaluations` - 评测

```ts
{
  skillId, overallScore (0-100),
  documentationScore, securityScore,
  popularityScore, activityScore, qualityScore,
  report: jsonb  // 详细报告
}
```

### `metrics_daily` - 每日指标

```ts
{
  skillId, date,
  githubStars, githubStarsDelta,
  githubForks, githubOpenIssues,
  npmDownloadsWeekly, pypiDownloadsWeekly,
  hotScore  // 0-1000
}
```

### `rankings` - 榜单快照

```ts
{
  period: "daily" | "weekly" | "monthly",
  date, rank, skillId, score
}
```

### `evaluation_jobs` - 评测队列

```ts
{
  skillId, status: "pending" | "running" | "done" | "failed",
  triggeredBy, startedAt, finishedAt, error
}
```

---

## 🔌 API 文档

Base URL: `https://your-domain.com/api`

### `GET /api/skills`

列表或详情。

**列表**：
```
GET /api/skills?type=mcp-server&category=data&limit=20
```

**详情**：
```
GET /api/skills?slug=modelcontextprotocol-server-git
```

### `GET /api/rankings`

榜单。

```
GET /api/rankings?period=daily&limit=20
GET /api/rankings?period=weekly
GET /api/rankings?period=monthly
```

### `GET /api/search`

搜索。

```
GET /api/search?q=stripe&type=mcp-server&limit=10
```

### `POST /api/evaluate`

提交评测任务。

```bash
curl -X POST https://your-domain.com/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/anthropics/skills"}'
```

支持的 URL 格式：
- GitHub: `https://github.com/owner/repo`
- npm: `@modelcontextprotocol/server-git`
- PyPI: `requests`

返回：
```json
{
  "ok": true,
  "slug": "anthropics-skills",
  "skillId": "uuid",
  "message": "已加入评测队列, 通常 1-2 分钟完成"
}
```

---

## 🔍 评测系统

5 维评分，权重：

| 维度 | 权重 | 评分方法 |
|---|---|---|
| **文档 (20%)** | 0-100 | README 长度 + 代码块 + 标题 + 示例 |
| **安全 (20%)** | 0-100 | 关键词扫描（注入/密钥/危险 API） |
| **流行 (20%)** | 0-100 | log10(stars) + log10(downloads) |
| **活跃 (10%)** | 0-100 | commit 距今天数 |
| **质量 (30%)** | 0-100 | LLM Judge（5 维 → 总分） |

**总分 = 加权平均**。

### 安全扫描规则

`lib/scanner.ts` 定义了三类规则：

1. **Prompt 注入**：12 种模式（"ignore previous instructions"、角色覆写、模板注入等）
2. **敏感数据**：API keys、tokens、私钥、身份证、手机号
3. **危险 API**：`eval`/`exec`/`os.system`/`subprocess`/`child_process`

每条匹配扣分：
- `danger` 扣 20 分
- `warning` 扣 5 分
- 上限扣到 0

### LLM Judge 提示词

详见 [`lib/judge.ts`](lib/judge.ts)。核心 prompt：

```
你是一个 AI Skill 质量评审专家。请根据以下信息给这个 AI Skill 打分（0-100）。

5 维：实用性(20) + 清晰度(20) + 可复用性(20) + 设计质量(20) + 文档质量(20)
```

**为什么用 DeepSeek**：cache hit $0.0001/千 token，比 GPT-4o-mini 便宜 30+ 倍。

---

## 📈 热度算法

**Hot Score**（0-1000）：

```ts
const stars = Math.log10(1 + starsDelta) * 100;       // 40%
const downloads = Math.log10(1 + dlDelta) * 80;       // 30%
const activity = activityScore * 200;                 // 20%
const mentions = Math.log10(1 + mentionCount) * 30;   // 10%

const hotScore = (stars * 0.4 + downloads * 0.3 + activity * 0.2 + mentions * 0.1) * 10;
```

**为什么用 log 平滑**：避免单日爆量（如 1k+ stars）垄断榜单。

**为什么按增量算**：绝对值会被大 repo 主导（如 React），增量反映"正在变火"。

详见 [`lib/ranker.ts`](lib/ranker.ts)。

---

## 📡 采集策略

**当前**：
- `lib/github.ts` - GitHub topic 搜索 + repos API
- `lib/npm.ts` - npm Registry + 下载量 API
- `lib/pypi.ts` - PyPI JSON API

**采集的查询**：
- `topic:claude-skill`
- `topic:mcp-server`
- `anthropic-skills in:name`
- `claude-skill in:name,description`
- `mcp-server in:name,description`
- 硬编码的 `@modelcontextprotocol/*` 包列表

**TODO**（V1.1+）：
- [ ] awesome-claude-skills / awesome-mcp-servers 列表抓取
- [ ] Hugging Face Skills
- [ ] 论坛提及（X / Reddit / V2EX / 即刻）
- [ ] npm 全量增量（按关键词）

---

## ⚙️ GitHub Actions 自动化

3 个 workflow：

| Workflow | 频率 | 任务 |
|---|---|---|
| `collect.yml` | 每 6 小时 | 采集 GitHub + npm |
| `evaluate.yml` | 每 2 小时 | 跑评测队列 |
| `rank.yml` | 每小时第 17 分 | 生成日/周/月榜 |

**触发时机**都特意**避开整点**（17 分），避免和全球用户抢资源。

**手动触发**：在 GitHub repo > Actions > 选 workflow > Run workflow。

---

## 🗺 开发路线图

### V0.1 - 脚手架（已完成 ✅）
- [x] Next.js + Drizzle + Tailwind 基础
- [x] 首页 + 详情页 + 搜索 + 分类
- [x] 评测系统（安全扫描 + LLM Judge）
- [x] 采集脚本（GitHub + npm）
- [x] 榜单生成
- [x] GitHub Actions 自动化
- [x] 种子数据

### V0.2 - 内容质量（1-2 周）
- [ ] 种子数据扩到 100+ 个
- [ ] 跑一次全量采集 + 评测
- [ ] README 渲染优化（去重图片加载）
- [ ] 详情页 SEO meta
- [ ] sitemap.xml / robots.txt

### V0.3 - 用户互动（2-3 周）
- [ ] 提交 Skill 表单（公开收录）
- [ ] 用户评分（5 星）
- [ ] 收藏 / 列表（Cookie 持久化）
- [ ] RSS 订阅

### V0.4 - 高级功能（1-2 月）
- [ ] 相关 Skill 推荐
- [ ] Skill 对比
- [ ] 趋势 / 收藏 / 评测统计 Dashboard
- [ ] 邮件订阅（"今日 TOP" 推送）

### V1.0 - 稳定版（3+ 月）
- [ ] API 限流 + 缓存层
- [ ] 全文搜索（Meilisearch / Algolia）
- [ ] MCP 沙箱预览（不跑, 只展示元数据）
- [ ] 多语言（中英双语）

**有意不做**：
- ❌ 付费 / 会员
- ❌ 用户注册
- ❌ 评论系统
- ❌ 私有部署

---

## 🤝 贡献指南

欢迎 PR！

### 提 PR 的方式

1. Fork
2. 新建 branch (`git checkout -b feat/xxx`)
3. 改完跑 `npm run typecheck && npm run lint`
4. Commit (`git commit -m 'feat: add xxx'`)
5. Push (`git push origin feat/xxx`)
6. 开 PR

### 提新 Skill

**方式 1（推荐）**：开 Issue，附上 GitHub URL / npm 包名，运营同学会收录。

**方式 2**：直接改 `data/seed-skills.ts` 加条目，提 PR。

**收录标准**：
- ✅ 有 README
- ✅ 有 License
- ✅ 最近 6 个月有更新（活跃）
- ✅ 解决真实问题
- ❌ 不收录纯营销 / 教程类
- ❌ 不收录 demo / 玩具

---

## 🐛 排错 FAQ

### Q: 启动 dev 报 "DATABASE_URL is not set"
**A**: 没创建 `.env` 文件。`cp .env.example .env` 然后填入。

### Q: 跑 `npm run collect` 报 403 / rate limit
**A**: 没设 `GITHUB_TOKEN`，或在 `.env` 里重新填一个。

### Q: 跑 `npm run rank` 榜单为空
**A**: 还没有 `metrics_daily` 数据。先跑 `npm run collect`，再跑 `npm run rank`。

### Q: 跑 `npm run evaluate` 报 LLM 错误
**A**:
- 检查 `DEEPSEEK_API_KEY` 是否正确
- 检查余额（DeepSeek 充值后才有 key）
- 或临时不配，跳过 LLM Judge（其他维度照常评分）

### Q: Vercel 部署后榜单一直空
**A**: Vercel 不会跑 GitHub Actions。需要：
- 在 GitHub repo 配 Actions secrets（DATABASE_URL 等）
- 手动触发一次 collect/evaluate/rank workflow

### Q: TypeScript 报错 "Cannot find module @/..."
**A**: `tsconfig.json` 的 `paths` 配了 `@/*` 别名。重启 IDE 或 `rm -rf .next` 重启。

### Q: Drizzle migration 生成失败
**A**: 可能是 schema.ts 有语法错误。检查后重跑 `npm run db:generate`。

### Q: 评测慢 / LLM 调用贵
**A**:
- DeepSeek 缓存命中便宜 10 倍，确保 README 不变就不重跑
- 跳过大 repo（stars > 10k），它们评分稳定
- 限制每批 5 个（改 `lib/evaluator.ts` 的 `batchSize`）

---

## 📜 许可证

[MIT](LICENSE) © 2025 Skill Supermarket Contributors

---

## 🙏 致谢

- [Anthropic](https://anthropic.com) - Claude Skills / MCP 协议
- [Model Context Protocol](https://modelcontextprotocol.org) - 标准化 AI 工具接入
- [Vercel](https://vercel.com) - Next.js + 部署
- [Drizzle](https://orm.drizzle.team) - 极简 ORM
- [DeepSeek](https://deepseek.com) - 便宜好用的 LLM

---

## 📮 联系方式

- GitHub Issues: [提问题/建议](https://github.com/your-username/skillsupermarket/issues)
- 邮箱: jiawenyao401@sina.com

---

> ⭐ 如果这个项目对你有帮助, 欢迎 Star!
