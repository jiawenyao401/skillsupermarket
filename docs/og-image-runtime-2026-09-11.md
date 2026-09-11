# 分享图常驻进程故障：Next.js 稳定补丁

日期：2026-09-11（北京时间）。业务范围：修复“公开报告 → 分享给同事/社区”链路的实际 500，不以技术升级代替获客。报告正文和评测任务没有因此失败，未观察到真实用户因此流失。修复已于 10:44 上线，线上分享图链路恢复。

## 发现与根因

05:31:43 生产 SEO 检查：GitHub MCP 报告分享图返回 HTTP 500、0 字节、没有图片 Content-Type；正文、报告 API、指南、robots、sitemap 正常。随后只读对照 SurfSense、不存在 slug 的动态分享图也均 500；预生成首页图为 PNG/200。Web 日志显示 `Input buffer contains unsupported image format`，连备用图也无法渲染。

同一 release 的独立 Node 进程中，直接 Sharp SVG 转 PNG、ImageResponse、现有动态路由均能生成有效 PNG。诊断进程按期限退出后，原计划的 12 次并发请求在退出节点到达，连接失败，不计为完成验证。未重启或停止线上 Web/Worker。

本机与服务器独立进程进一步按固定顺序复现：ImageResponse 成功 → 调用当前 Next 图片优化器的 `getSharp()` → ImageResponse 失败，错误一致。原图数据、数据库、Nginx 与普通 PNG 编码因此不是这一复现的根因。对应上游：

- https://github.com/vercel/next.js/issues/96612
- https://github.com/vercel/next.js/pull/96681
- https://github.com/vercel/next.js/releases/tag/v16.3.4

对应版本的共享 Sharp 白名单未覆盖内部 SVG 首次未命中场景，首次未命中缓存的图片优化会影响随后 OG 渲染。根因定位为可重建的运行时边界，不是数据库或权限问题。

## 修复范围

- Next 与 eslint-config-next 固定到 `16.3.4`（非 canary）。
- lockfile 仅更新 Next/SWC/Sharp/libvips 对应链路，不升级其他业务库。
- 新增并收紧 OG 回归与 SEO 探针：`lib/og-image-probe.ts`，在服务进程内严格计算固定图片 cache key、只清理单个 `/brand-icon.png` 条目；不使用任意查询参数探针。
- `scripts/seo-check.ts` 与此探针对齐：先发起 `/brand-icon.png` 的 optimizer 请求（不再加随机参数），要求 200 + PNG + `X-Nextjs-Cache: MISS`。
- 回归测试新增：
  - 真实查询参数禁用场景（Next localPatterns）
  - 探针缓存目录非符号链接与安全检查
  - 仅一个 `brand-icon.png` 缓存项清理，不影响其他 optimizer 缓存
  - 升级后 HTTP/PNG 断言（`1200x630`，12 条动态 OG + 首页）
- 不改评分、图示生成策略、报告、队列、schema、认证或权益，不新增模型调用。

## 已完成验证与边界

### 本机

- Node 24.19.0：顺序复现修复前“成功/失败”，修复后“成功/成功”；OG 专项 2/2。
- 网站回归：`154 通过 / 1 跳过（Linux 专属）`，排行榜 3/3，SDK 12/12。
- typecheck、lint、Next.js 16.3.4 webpack build 全部通过。
- `tests/og-image.test.ts`：4/4。

### Linux 候选（v2）与线上发布前

- 网站回归 140/140，无 skip。
- 生产构建与评测回归通过，`npm run seo:check` 全绿（含匿名401、受保护307、canonical、robots/sitemap）。
- `12` 条报告图 + 首页图 HTTP + 解码通过，外链 SVG 仍按策略返回 400。

### 安全与运行边界

- 本机与线上均保留现有 Better Auth 运行时告警语义，只是构建提示，不将其视为新风险。
- 不做登录链路、权限模型、账密或 API 秘钥变更。

## 线上发布与当前状态

- 清理并发布基线：`/opt/releases/skillsupermarket-20260911-og`，`RELEASE_ACTIVE` 更新于 `2026-09-11 10:44:00`（北京时间）。
- 前置数据库备份保留：`/opt/backups/skillsupermarket-pre-20260911-og.dump`（2,276,232 字节，mode0600）。
- Web 与 Worker 都在线；`/api/health`、登录链路、公共 API、采集/调度器心跳、关键页面、security-check 均通过。
- 分享图上线验收通过：12 条报告图和首页图均可完整返回 `1200x630` PNG。
- 当前线上磁盘：总量约 40,900,228 KiB，可用 5,740,780 KiB，约 86%。

## 已完成清理（非重复）

按授权清理的旧 webpack 缓存（六项）已完成：

- `/opt/releases/skillsupermarket-20260902-f846adb/.next/cache/webpack`
- `/opt/releases/skillsupermarket-20260903-3e6eb9a/.next/cache/webpack`
- `/opt/releases/skillsupermarket-20260903-459f00e/.next/cache/webpack`
- `/opt/releases/skillsupermarket-20260903-66cf4a5/.next/cache/webpack`
- `/opt/releases/skillsupermarket-20260903-83e4abf/.next/cache/webpack`
- `/opt/releases/skillsupermarket-20260904-0391872/.next/cache/webpack`

实际回收：约 `1,759,672 KiB`（`~1.678 GiB`），当前与回滚、数据库备份全部保留。

## 运营含义

这次修复优先解决“分享到社区后首屏失败”的真实阻断链路，降低内容传播摩擦。与算法或注册增长无直接冲突；下一步继续在同一主链路上持续验证“搜索入口 → 首次评测体验 → 重复评测/回访”闭环。
