# 注册人机验证和邮箱验证码

注册需要通过 Turnstile 的服务端校验（单次 token、主机名、`registration` action），然后输入邮件中的 6 位验证码。验证码 5 分钟有效、最多 5 次错误尝试、成功后不可重放，数据库保存哈希。新用户验证完成后需用邮箱密码登录；旧会话持有者从 `/verify-email` 补验证。未验证用户不能调用评测提交 API，也不能通过底层额度事务创建任务；额度页面显示未开放。

发信接口按 IP 10 分钟最多 5 次；同一邮箱注册/重发合计每 60 秒 1 次、每小时 5 次，计数持久化 PostgreSQL 并用原子更新限制并发。重发会使旧验证码失效。邮件发送失败会返回 503、使该验证码失效，并给出重发入口。默认的 OTP 登录、找回密码、变更邮箱、验证码探测与链接验证端点均关闭，避免开出未经设计的新入口。

没有服务配置时注册和发码失败关闭。不要把缺少正式配置的 release 切到生产；现有未验证用户也需要邮箱服务才能继续使用评测。

## 阿里云邮件推送

1. 在阿里云控制台开通 **邮件推送 DirectMail**，选择发信地域；按控制台提示完成必要审核/额度申请。不要把账号登录密码作为 SMTP 密码。
2. 使用独立子域名，例如 `mail.skillsupermarket.com`。在“发信域名”添加它，按控制台给出的实际值配置 DNS 验证、SPF、DKIM 等记录；保留根域名的网站解析。通过域名验证后再配置发信地址。
3. 在“发信地址”创建用于验证码的触发邮件地址，例如 `verify@mail.skillsupermarket.com`，为该地址设置独立 SMTP 密码。`SMTP_USER` 和 `MAIL_FROM` 填这个地址。
4. 中国杭州地域使用 `SMTP_HOST=smtpdm.aliyun.com`、`SMTP_PORT=465`（TLS）。其他地域必须使用对应控制台的 SMTP 地址，不要混用地域。

官方依据（2026-09-05 核验）：[配置发信域名](https://help.aliyun.com/zh/direct-mail/user-guide/how-to-configure-sending-domain-names)、[设置发信地址及 SMTP 密码](https://help.aliyun.com/zh/direct-mail/user-guide/setup-sender-addresses)、[SMTP 地址](https://help.aliyun.com/zh/direct-mail/smtp-endpoints)。

## Turnstile

在 Cloudflare 的 Turnstile 控制台添加 **Managed** 小组件，允许主机 `skillsupermarket.com`。Turnstile 可以独立使用，不要求迁移网站或更换域名解析。把小组件的 Site Key 和 Secret Key 分别配置为 `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY`。应用传入 action `registration`；服务端校验 action 和当前应用域名。

官方依据：[添加小组件](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)、[服务端验证](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)。测试小组件不能上线。

## 配置与发布

在项目 `.env` 写入 `.env.example` 中的 7 个必需项；不要把密钥提交到 Git 或发送到聊天。公开 Site Key 由服务端运行时传给注册页，其余配置均只供服务端使用。

```text
TURNSTILE_SITE_KEY=实际 Site Key
TURNSTILE_SECRET_KEY=实际 Secret Key
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=实际发信地址
SMTP_PASS=该地址的 SMTP 密码
MAIL_FROM=实际发信地址
```

发布前运行 `npm run auth:check`（仅验证 SMTP TLS 和账号，不发送邮件），再完成类型检查、Lint、`npm run test:evaluation`、排名测试和生产 build。用独立验收邮箱在待发布版本完成真实人机验证 → 注册 → 邮件到达 → 验证 → 登录 → 免费评测。确认 SMTP 控制台的投递状态，不能只凭 SMTP 接受就宣称邮件已到达。

凭据配置和真实服务验收是生产切换门槛。遵守现有数据库备份和 release 回滚流程；此功能复用已有认证表，不需要数据库迁移。不能批量把旧用户标记为已验证。可回滚到之前的 release，但它会恢复旧注册行为，需同时告知维护者防滥用保护已撤销。

数据库集成回归另用一次性的本机 PostgreSQL 数据库 `skillsupermarket_auth_test`，按当前 schema 执行 `db:push` 初始化（历史迁移从已有产品表开始，不能用于空库初始化）。设置独立的 `AUTH_TEST_DATABASE_URL` 后运行 `npm run test:auth:postgres`，测试强制拒绝非本机或其他库名。验证 20 路并发发码仅 1 次放行、每小时上限失败时事务回滚、10 路验证码仅消费 1 次、未验证用户零任务/零额度写入和验证后的正常评测。禁止指向生产数据库。

## 2026-09-05 验证记录与上线状态

- 修复边界：原先邮箱密码注册直接建立登录会话，评测入口和额度事务未校验邮箱归属。现在注册必须先通过服务端人机验证，不建立会话；验证邮箱并正常密码登录后才开放评测。
- 安全复核补修：重复注册不得删除已有验证码；错误尝试以数据库原子比较更新计数，不使用“删除后重建”，避免并发重发把旧码重新写回。成功验证按原子条件删除，防止重复消费。
- `npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`：通过。构建环境没有真实认证凭据时会出现既有的 Better Auth secret 提示，生产仍须使用已有独立强密钥，不能使用测试密钥。
- `npm run test:evaluation`：112 项，111 通过、1 项 Linux 专用安全监控测试在 macOS 跳过；其中注册保护 15 项通过。`npm run test:rankings`：3/3 通过。
- `npm run test:auth:postgres`：3/3 通过，使用临时 PostgreSQL 17；覆盖真实适配器、并发计数及额度事务。首次重置夹具遗漏无外键级联的测试额度账本，已补空库断言并在完整清理夹具后通过；生产数据未参与。
- 浏览器：1280px 和 390px 注册 → 验证码错误提示 → 成功后返回密码登录、无横向溢出检查通过。人机验证与邮件为测试替身，不代表真实服务已接通。
- `npm run auth:check`：按预期退出 1，正式 Turnstile/SMTP 配置尚未提供。真实人机验证、发信鉴权、邮件投递和生产评测冒烟仍待验收，**不得部署此版本或宣称线上防滥用已生效**。
