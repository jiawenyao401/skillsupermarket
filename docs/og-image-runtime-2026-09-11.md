# 分享图常驻进程故障：Next.js 稳定补丁

日期：2026-09-11（北京时间）。业务范围：修复“公开报告 → 分享给同事/社区”链路的实际 500，不以技术升级代替获客。报告正文和评测任务没有因此失败，尚未观察到真实用户因此流失。

## 发现与根因

05:31:43 生产 SEO 检查：GitHub MCP 报告分享图返回 HTTP 500、0 字节、没有图片 Content-Type；正文、报告 API、指南、robots、sitemap 正常。随后只读对照 SurfSense、不存在 slug 的动态分享图也均 500；预生成首页图为 PNG/200。Web 日志显示 `Input buffer contains unsupported image format`，连备用图也无法渲染。

同一 release 的独立 Node 进程，直接 Sharp SVG 转 PNG、ImageResponse、现有动态路由均能生成有效 PNG。另在回环端口启动了 60 秒同版本诊断进程：同一路由在诊断进程 200，常驻 Web 500。诊断进程按期限正常退出（124）；后来安排的 12 次并发请求已在退出后到达，连接失败，**不计为完成的并发验证**。未重启或停止线上 Web/Worker。

本机与服务器独立进程进一步按固定顺序复现：ImageResponse 成功 → 调用当前 Next 图片优化器的 `getSharp()` → ImageResponse 失败，错误一致。原图数据、数据库、Nginx 与普通 PNG 编码因此不是这一复现的根因。资源样本：Web 21 个文件描述符、上限 65,535；RSS 约 191 MiB，主机可用内存约 1.08 GiB，没有文件描述符耗尽证据。

对应 [Next.js 上游问题 #96612](https://github.com/vercel/next.js/issues/96612) 和[合并修复 #96681](https://github.com/vercel/next.js/pull/96681)：16.3.0 的共享 Sharp 加载器白名单漏掉内部 SVG，首次未命中缓存的图片优化会影响随后 OG 渲染。冷启动时先查分享图会漏检；只重启不能根治。

## 修复范围

- Next 与 eslint-config-next 固定到官方稳定版 16.3.4，不采用 canary；[官方发布说明](https://github.com/vercel/next.js/releases/tag/v16.3.4)。安装后核实优化器已包含 SVG 加载器修复。
- lockfile 仅更新 Next/SWC、Sharp/libvips 对应依赖链；没有其他包族升级。用 `npm install --ignore-scripts --no-audit --no-fund` 安装，不在生产共享依赖目录里直接修改文件。
- 新回归覆盖同进程顺序、后续重复/并发三次 PNG 渲染，验证魔数、120×63 尺寸及默认 `dangerouslyAllowSVG=false`。不通过开放外部 SVG、修改安全白名单或吞掉错误修复。
- `seo:check` 在检查分享图前，先优化一次带唯一查询标识的本站 64px PNG，严格要求 HTTP 200 和 `X-Nextjs-Cache: MISS`，防止缓存绕过初始化。这会产生一个很小的测试图片缓存项，不是站内浏览或评测。当前线上单 Web 进程；未来多实例发布还须逐实例验证，不能用负载均衡随机命中替代同进程回归。
- 不改评分、图示生成策略、报告、队列、schema、认证或权益，不重评库存、不调用真实模型。生产候选必须从实际 `d907629` 隔离，不能全量上线 main 中未配置的注册保护。

## 已完成验证与未完成边界

本机 Node 24.19.0：顺序复现修复前“成功/失败”，修复后“成功/成功”；OG 专项 2/2，网站回归 152 通过、1 项 Linux 专属跳过，榜单 3/3，SDK 12/12（六份完整报告 × 十次无漂移）。typecheck、lint、Next.js 16.3.4 webpack 生产 build 均通过；文档/采用度/输出及凭证基准通过。未增加真实模型调用。

本机 build 仍有缺少生产 Better Auth secret 的既有警告；不将构建通过称为实际登录链路已验收。服务器仅完成旧版故障复现，**新版 Linux 安装、生产候选验收与上线尚未完成**；不能声称动态分享图已经在线修好。原版 SEO 检查的失败证据保留，不手工重跑到绿或删掉失败项。

已验证代码提交：`6369b20`。只包含包清单/lockfile、分享图回归测试及 SEO 验证顺序四个文件。

## 唯一部署阻塞与精确清理提案

当前生产仍为 `/opt/releases/skillsupermarket-20260910-d907629`。诊断时磁盘可用 4,969,864 KiB，约 4.74 GiB，使用率 88%；低于既有 6 GiB 新依赖安装门槛。本次更改依赖，不适用上一轮“无依赖变更、共享只读依赖”的例外。不降低门槛、不删除数据库备份、不沿用已经执行完的旧清理授权。

拟仅删除以下六个旧版 **webpack 编译缓存**，尚未执行；不是删除整个 release，不动 `.next/server`、`.next/static`、BUILD_ID、图片/数据缓存、node_modules、配置或业务数据。可由对应源码和 lockfile 重新编译生成，不保证恢复原缓存字节。

| 精确目标 | KiB |
| --- | ---: |
| `/opt/releases/skillsupermarket-20260902-f846adb/.next/cache/webpack` | 293352 |
| `/opt/releases/skillsupermarket-20260903-3e6eb9a/.next/cache/webpack` | 293204 |
| `/opt/releases/skillsupermarket-20260903-459f00e/.next/cache/webpack` | 293364 |
| `/opt/releases/skillsupermarket-20260903-66cf4a5/.next/cache/webpack` | 293500 |
| `/opt/releases/skillsupermarket-20260903-83e4abf/.next/cache/webpack` | 293464 |
| `/opt/releases/skillsupermarket-20260904-0391872/.next/cache/webpack` | 292788 |

合计 du 约 1.68 GiB；这不是已释放空间。目录存在且末级不是符号链接；执行前仍须在部署锁内复核全部祖先路径、挂载/文件引用、当前 symlink、实际进程 cwd 和最近回滚。只按明确授权的六个目标处理，执行后以 df 实测重新判断 6 GiB 门槛，不假定 du 等于净释放。

批准后下一步：重查目标 → 只清上述缓存 → 磁盘门槛 → 新数据库备份与可读性检查 → 隔离候选 npm ci、SDK/网站测试、build → 同进程真实图片优化 MISS 后验证多份报告 PNG与外部 SVG 拦截 → 原子发布及失败回滚 → Web/Worker、健康、采集、SEO 和代码安全基线验收。当前和最近回滚、数据库备份全部保留。
