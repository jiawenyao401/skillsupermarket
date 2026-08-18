# Skill Supermarket

面向 AI Builder 的 Skill、MCP Server 与 Agent Pack 发现和可信评测平台。

- 正式站：[skillsupermarket.com](https://skillsupermarket.com)
- 运行时：Node.js 20+、Next.js 16、React 19、PostgreSQL
- 核心原则：只使用公开来源、评测证据可追溯、不执行被评测仓库代码

## 产品能力

### 能力市场与趋势榜单

- 统一收录 Claude Skill、MCP Server、Agent Pack，并保留真实类型，避免把 MCP Server 当作 Skill 展示或评测。
- 从 GitHub、npm、PyPI 和人工种子数据采集公开元数据。
- 基于每日快照生成今日、本周、本月榜单；新周期没有足够增量数据时会使用最近可用窗口，而不是展示伪造趋势。
- 支持搜索、分类、标签、30 天热度趋势、关联能力和外部仓库跳转。

### 可信评测

评测引擎当前版本为 `3.0.0`，由确定性检查和可选 AI Judge 共同组成：

| 维度 | 权重 | 主要证据 |
|---|---:|---|
| 文档完整度 | 22% | 用途、安装、示例、输入输出、限制、排错、许可证 |
| 安全性 | 25% | Prompt 注入、敏感信息、危险命令、可疑网络行为等静态规则 |
| 工程质量 | 30% | Skill/MCP 结构、清单文件、示例、边界说明和 AI Judge |
| 活跃度 | 13% | 最近提交时间与问题维护情况 |
| 采用度 | 10% | Stars、Forks、包下载和增长数据 |

评测过程不会安装依赖或执行第三方代码。报告包含评分证据、风险项、优势、改进建议、置信度、评测器版本和 AI Judge 使用状态。公开评测案例必须成功经过 AI Judge；普通用户评测在 Judge 暂时不可用时仍可降级完成，并在报告中明确标识。

### 用户、额度与运营

- Better Auth 邮箱密码注册和登录，评测入口始终可见；未登录点击后跳转登录并返回原页面。
- 免费用户每周 10 次评测，服务端事务内原子预占额度。
- 同一网络下的免费账号共享周额度，降低批量注册小号绕过限制的收益。
- 个人中心展示本周额度、累计任务、完成情况和最近评测记录。
- 超级管理员后台展示用户 D1/D7/D30 新增、活跃评测用户、任务成功率、订阅、库存、当日采集和报告覆盖率。
- 已具备订阅权益数据模型；支付下单、回调验签和自动续费尚未接入，不能将数据库中的订阅记录视为真实收入。

### SEO 与公开案例

- 服务端 Metadata、Canonical、Open Graph、JSON-LD、`robots.txt` 和动态 `sitemap.xml`。
- Skill 详情页和真实评测报告可被索引，评测结果可生成公开分数徽章。
- `/guides` 提供 Skill 评测、MCP 安全清单和 Skill/MCP/Agent 分类等高意图实战内容，并连接真实报告与评测入口。
- 采集完成后可向支持 IndexNow 的搜索引擎提交更新 URL。
- README 使用 GFM 渲染并经过 HTML 白名单清洗，避免直接展示原始标签或执行不可信 HTML。

### 隐私友好的转化统计

- 自建统计只按日期、公开页面和粗粒度来源聚合页面浏览与评测入口点击。
- 不持久化访问者 IP、完整 Referer、User-Agent、广告标识或跨天访客 ID，不使用统计 Cookie。
- 浏览器启用 Do Not Track 或 Global Privacy Control 时不发送统计事件。
- 运营后台和 `npm run growth:report` 按 D1/D7/D30 展示访问、注册、评测、免费额度与订阅数据，不用估算值代替真实数据。

## 技术架构

| 层 | 实现 |
|---|---|
| Web | Next.js 16 App Router、React 19、TypeScript、Tailwind CSS |
| 数据 | PostgreSQL、Drizzle ORM、版本化 SQL migration |
| 认证 | Better Auth、数据库 Session、服务端路由保护 |
| 评测 | 常驻异步 Worker、幂等任务认领、超时恢复、最多 3 次尝试 |
| 采集 | GitHub / npm / PyPI 公共 API、每日指标快照 |
| 生产运行 | PM2 Web + Worker、systemd timer 数据流水线 |

```text
公开数据源 ──> 定时采集 ──> skills / metrics_daily ──> D1/D7/D30 榜单
                              │
登录用户 ──> 额度预占 ──> evaluation_jobs ──> 常驻 Worker ──> 公开评测报告
                              │                                  │
                              └──────── 个人中心 / 运营后台 <────┘

公开页面 ──> 无 Cookie 聚合事件 ──> traffic_daily ──> D1/D7/D30 转化漏斗
```

## 目录结构

```text
app/                  页面、Route Handlers、Metadata、Sitemap
components/           页面组件、评测报告、图表和认证组件
lib/                  数据访问、采集、评测、认证、额度和排名逻辑
scripts/              Worker、采集、榜单、SEO、运营统计与案例工具
tests/                评测、Judge、认证、额度、代理和榜单测试
drizzle/              PostgreSQL migration
deploy/               systemd service / timer
public/               品牌与公开静态资源
ecosystem.config.cjs  PM2 Web 与评测 Worker 定义
```

## 本地开发

### 前置条件

- Node.js 20 或更高版本
- PostgreSQL 14 或更高版本
- GitHub Token（推荐，避免公共 API 的低限流）
- DeepSeek、OpenAI 或 Anthropic API Key 之一（用于 AI Judge）

### 初始化

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run seed
npm run dev
```

开发地址默认为 [http://localhost:3000](http://localhost:3000)。`db:push` 仅适合本地快速试验；共享环境和生产环境必须使用已提交的 migration。

### 关键环境变量

| 变量 | 要求 | 说明 |
|---|---|---|
| `DATABASE_URL` | 必填 | PostgreSQL 连接串 |
| `BETTER_AUTH_SECRET` | 生产必填 | 至少 32 字节的随机认证密钥 |
| `BETTER_AUTH_URL` | 生产必填 | 认证回调基准地址 |
| `NEXT_PUBLIC_SITE_URL` | 生产必填 | Canonical、Sitemap 和公开徽章域名 |
| `GITHUB_TOKEN` | 推荐 | 只需读取公共仓库的权限 |
| `ABUSE_HASH_SECRET` | 生产必填 | 对网络来源标识做不可逆 HMAC，必须与认证密钥不同 |
| `FREE_NETWORK_WEEKLY_LIMIT` | 可选 | 免费账号共享网络周额度，默认 20 |
| `DEEPSEEK_API_KEY` | 三选一 | DeepSeek Judge |
| `OPENAI_API_KEY` | 三选一 | OpenAI Judge |
| `ANTHROPIC_API_KEY` | 三选一 | Anthropic Judge |

生成生产密钥示例：

```bash
openssl rand -base64 48
```

API Key 只保存在部署环境的 `.env` 或密钥管理系统中，不得写入仓库、日志、评测报告或客户端变量。AI Judge Key 就是所选大模型服务商的服务端 API Key，不是本站用户密码。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run typecheck` | TypeScript 检查 |
| `npm run lint` | ESLint 检查，零警告策略 |
| `npm run test:evaluation` | 评测、Judge、认证、额度和后台测试 |
| `npm run test:rankings` | 榜单算法测试 |
| `npm run collect` | 采集并写入当日指标快照 |
| `npm run rank` | 生成 D1/D7/D30 榜单 |
| `npm run worker:evaluate` | 启动常驻评测 Worker |
| `npm run seo:check` | 检查正式站健康、评测转化页、真实案例、榜单、认证边界与 SEO |
| `npm run growth:report` | 输出真实用户、评测、库存和报告覆盖数据 |
| `npm run indexnow` | 提交更新 URL |
| `npm run admin:promote -- user@example.com` | 将已注册用户提升为超级管理员 |

Judge 连通性检查不会写入评测报告：

```bash
npx tsx scripts/check-judge.ts
```

## 评测任务流程

1. 用户从能力详情页或评测页发起任务。
2. API 校验登录态、来源 URL、能力类型和重复运行任务。
3. 数据库事务同时预占用户额度与网络共享额度，并创建 `pending` 任务。
4. Worker 原子认领任务，拉取公开文档和必要的仓库文件。
5. 静态扫描与确定性评分运行；配置了服务端 Key 时调用 AI Judge。
6. 报告写入后，任务变为 `done`；失败任务记录安全化错误并按策略重试。
7. 详情页、个人中心、后台和公开评测案例使用同一份报告数据。

案例评测使用两阶段流程，避免把 API Key 或未审核内容带到生产服务器：

```bash
# 本地使用 Judge 生成待应用结果
npm run prepare:case-judgments

# 审核生成文件后，在目标数据库中原子应用
npm run apply:case-judgments
```

`data/case-study-judgments.json` 是本地中间产物，不应提交到 Git。

## API 与页面

### 主要页面

| 路径 | 说明 |
|---|---|
| `/` | 市场首页和 D1/D7/D30 榜单 |
| `/skill/[slug]` | 能力详情与最新评测报告 |
| `/evaluation` | 评测方法、真实案例和转化落地页 |
| `/guides`、`/guides/[slug]` | AI Skill、MCP 与 Agent 实战指南 |
| `/evaluate` | 登录用户评测工作台 |
| `/account` | 个人中心与额度记录 |
| `/admin` | 超级管理员运营后台 |
| `/login` | 登录与注册 |
| `/privacy` | 账户、评测与最小化统计隐私说明 |

### 主要 API

| 方法与路径 | 说明 |
|---|---|
| `GET /api/health` | 应用和数据库健康检查 |
| `GET /api/skills` | 能力列表 |
| `GET /api/search` | 搜索能力 |
| `GET /api/rankings` | 获取指定周期榜单 |
| `POST /api/evaluate` | 登录后创建评测任务并预占额度 |
| `GET /api/evaluate/[jobId]` | 查询本人任务状态 |
| `GET /api/badge/[slug]` | 获取公开评测分数徽章 |
| `POST /api/events` | 同源、无 Cookie 的页面浏览与评测入口聚合事件 |
| `ALL /api/auth/[...all]` | Better Auth 认证接口 |

所有写接口都必须在服务端校验身份、输入和权限；前端按钮隐藏或禁用不能作为安全边界。

## 数据采集与榜单

生产流水线由 `deploy/skillsupermarket-pipeline.timer` 每 6 小时触发：

```text
collect -> rank -> IndexNow -> snapshot
```

- 常驻评测 Worker 与采集流水线分离，单次采集失败不会阻塞用户任务。
- `flock` 防止定时任务重入，日志写入独立目录。
- 今日采集覆盖和最近采集日期可在超级管理员后台与增长报告中核对。
- 榜单只使用真实快照与上游公开指标，不生成虚假访问、注册、评测或增长数据。

## 生产部署

当前生产拓扑使用 `ecosystem.config.cjs` 启动 Web 和评测 Worker，使用 systemd timer 运行数据流水线。推荐采用不可变 release 目录和原子软链接切换：

```text
/opt/releases/<release-id>  # 不可变版本目录
/opt/skillsupermarket       # 指向当前版本的软链接
```

每次发布必须遵循以下顺序：

1. 记录当前 release，并完成 PostgreSQL 备份。
2. 在新 release 中执行 `npm ci`、`npm run typecheck`、`npm run lint`、测试和 `npm run build`。
3. 审核 migration；涉及数据库变更时先验证备份可恢复，再执行 `npm run db:migrate`。
4. 原子切换 `/opt/skillsupermarket`，执行 `pm2 reload ecosystem.config.cjs --update-env`。
5. 验证 `/api/health`、首页、榜单、至少一个报告详情页、登录、评测、个人中心和后台权限。
6. 失败时切回上一 release 并重新加载 PM2；不可逆 migration 必须准备独立回滚方案。

安装定时流水线后可用以下命令核对：

```bash
systemctl status skillsupermarket-pipeline.timer
systemctl list-timers skillsupermarket-pipeline.timer
journalctl -u skillsupermarket-pipeline.service --since today
pm2 status
```

不要把服务器地址、SSH 密码、数据库口令或 API Key 写入 README、PM2 配置、systemd unit 或提交历史。

## 上线前检查

```bash
npm run typecheck
npm run lint
npm run test:evaluation
npm run test:rankings
npm run build
npm run seo:check
git diff --check
```

上线后还应检查：

- `/api/health` 返回健康状态且数据库可访问。
- PM2 的 Web 与 Worker 都在线，无持续重启。
- systemd timer 有下一次触发时间，最近一轮采集成功。
- 首页、榜单、公开报告、登录返回链路、评测额度和管理员权限正常。
- 真实运营数据能够按 D1/D7/D30 读取；数据缺失时明确显示缺口，不填造数据。

## 安全边界

- 只读取公开仓库和公共包元数据，不克隆后执行、不安装第三方依赖。
- README 原始 HTML 经过清洗；外链和图片遵循安全策略。
- 用户只能读取自己的评测任务，管理员页面同时校验 Session 与 `super_admin` 角色。
- 额度在数据库事务中原子预占，不能依赖客户端计数。
- 日志和公开错误必须脱敏，禁止输出 Token、邮箱列表、连接串和上游响应正文。
- 流量统计只保存日级聚合值；IP 与 User-Agent 仅用于进程内限流并立即哈希，不写入数据库。
- 支付接入前必须实现服务端验签、幂等回调、权益状态机、退款/撤销和审计记录。

## License

仓库当前未包含开源许可证文件。对外分发或接受外部贡献前，应由项目所有者明确许可证并提交对应 `LICENSE` 文件。
