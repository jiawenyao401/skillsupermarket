# 不部署网站，生成第一份本地评测报告

给准备把文档预检接入本地工作流的 Node.js 开发者：先取得一个能查看的结果，再决定是否集成完整 SDK。Node.js 20.3+；不需要本站账号、数据库、GitHub Token 或模型密钥。如果只想读现有公开报告，直接使用[网站查找入口](https://skillsupermarket.com/#homepage-evaluation-source)，无需安装 SDK。

## 1. 安装已发布版本

在自己的 Node.js 项目目录运行；如需空白环境，先新建一个空目录，在其中运行 `npm init -y`。以下安装会修改当前项目的依赖与 lockfile，**不是**运行网站源码。

```bash
npm install --ignore-scripts --no-audit --no-fund https://github.com/jiawenyao401/skillsupermarket/releases/download/evaluation-sdk-v1.0.0/skill-supermarket-evaluation-sdk-1.0.0.tgz
```

使用 [GitHub Release 的 SDK 1.0.0](https://github.com/jiawenyao401/skillsupermarket/releases/tag/evaluation-sdk-v1.0.0)，不使用 `latest`、主干源码安装或不存在的 npm 公共包。该安装会从 GitHub/npm 获取制品和依赖，但禁止安装生命周期脚本；离线评测阶段不联网。提交生成的 lockfile，后续 CI 使用 `npm ci --ignore-scripts`。

需要先校验制品时，在 Release 页面下载 `.tgz` 和同名 `.sha256`。固定包大小 50,060 字节，SHA-256 为 `c721479d06cf77d1fc3aa9666bb3ac8f6a0ccaeffa934cf1f6224ec89dd86772`。macOS/Linux 可在下载目录执行：

```bash
shasum -a 256 -c skill-supermarket-evaluation-sdk-1.0.0.sha256
npm install --ignore-scripts --no-audit --no-fund ./skill-supermarket-evaluation-sdk-1.0.0.tgz
```

Windows 可用 `Get-FileHash -Algorithm SHA256` 对照上述摘要，再安装本地包。摘要只用于检查与这一已发布制品是否一致，不是对软件安全性的认证。本指南不覆盖或重新打包该 Release。

## 2. 先看到一份完整结果

```bash
node node_modules/@skill-supermarket/evaluation-sdk/examples/offline.mjs node_modules/@skill-supermarket/evaluation-sdk/examples/input.json
```

成功时终端输出 JSON，进程退出码为 0。输入明确是**虚构集成样例**，其中的示例包名和安装命令都不是给你执行的；SDK 只把它们当作文字检查。

先看以下字段，不必先理解全部评分实现：

| 字段 | 用它完成什么判断 |
| --- | --- |
| `report.summary.headline` / `verdict` | 阅读当前材料支持的采用建议；不是安装批准 |
| `report.recommendation.nextActions` | 若有具体建议，选择下一项需要补充或验证的证据；空数组不代表无需复核 |
| `report.summary.confidence` | 判断证据是否足以作决定；低置信度是结果，不是运行失败 |
| `diagnostics.aiStatus` | 此路径应为 `disabled`；不会因为环境里存在 Key 就调用模型 |
| `report.version` | 已发布包中评测规则为 3.14.0；不把网站新版本自动当作包已升级 |

此处没有 AI 复核和图示，是预期行为。没有图不意味着项目不适合画图；联网 AI 需要显式配置 Judge，见[完整应用文档](../packages/evaluation-sdk/README.md#5-ai-复核配置)。不建议为了一张图先上传私有材料或配置付费调用。

固定发布包的样例在本次验收中返回 `verdict: caution`、置信度 35、`nextActions: []`，同时进程正常退出。这表明你已经拿到可解释的预检结果，不代表完成了采用审批；下一步是换入真实材料并补证据，而不是追求样例高分。

## 3. 换成自己准备的 README

把下面保存为当前项目目录中的 `review-readme.mjs`。这是一份调用示例，不新增 SDK API，不会克隆仓库、执行 README 中的命令或自行补齐采用数据。

```js
import { open } from 'node:fs/promises';
import { evaluate, EvaluationError } from '@skill-supermarket/evaluation-sdk';

try {
  const [file, type] = process.argv.slice(2);
  if (process.argv.length !== 4 || !['claude-skill', 'mcp-server', 'agent-pack'].includes(type)) {
    throw new Error('usage');
  }
  const handle = await open(file, 'r');
  let readme;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1_000_000) throw new Error('material');
    // Read at most 1 MB + 1 byte, even if the caller's file changes after stat.
    const buffer = Buffer.alloc(1_000_001);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > 1_000_000) throw new Error('material');
    readme = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
  } finally {
    await handle.close();
  }
  const result = await evaluate({
    name: 'Caller-selected project',
    type,
    readme,
    sources: ['Caller-selected local README; no repository metadata verified'],
  }, { aiPolicy: 'disabled' });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof EvaluationError ? error.code :
    'Check usage: node review-readme.mjs README-path project-type; expected a UTF-8 regular file up to 1 MB.');
  process.exitCode = 1;
}
```

传入自己明确选定且有权读取的本地普通文件，以及真实交付类型：

```bash
node review-readme.mjs /path/to/review-materials/README.md mcp-server
```

把 `/path/to/review-materials/README.md` 换成实际路径。仅检查这一份材料，不递归读取目录；不要把它直接暴露为接受任意用户文件路径的网络接口。SDK 另限制单份文档最多 250,000 个 JavaScript 字符，超限返回 `INVALID_INPUT`，不静默截断后给分。

这只是**单份 README 的预检**，不是完整仓库评测或运行时测试。不要把仓库存在、许可证、Stars 等未知字段伪造为已核实；缺少这些证据会影响评分与置信度。需要完整采用决定时按[证据准备契约](../packages/evaluation-sdk/README.md#4-输入字段与证据准备)补充高信号文件和经过核实的元数据。

结果只写入你的终端，不上传本站、不占用网站额度。若自行保存或分享 JSON，先复核来源片段和敏感信息，不把报告脱敏规则当作万无一失的保密工具，也不要把本地私有报告自动提交到 Git。

## 遇到问题时

- **安装找不到包**：使用上面的固定 Release URL 或已校验的本地 `.tgz`；该版本没有发布到 npm 公共注册表。
- **无法联网下载**：在允许访问的环境下载固定制品和组织批准的依赖缓存，然后按组织的离线安装流程交付；不能承诺只有一个 `.tgz` 就包含所有依赖。
- **`INVALID_INPUT` / 退出 1**：核对类型、UTF-8 文本、大小与完整 SDK 输入约束。不要吞掉错误或以空白报告替代失败。
- **分数低 / 没图 / 需补证据**：先查看 nextActions、置信度和 AI 状态；离线、仅 README 的结果不能直接与网站的完整 AI 报告比较。

接口、取消/超时、AI、CI 策略和生产集成见[完整 SDK 文档](../packages/evaluation-sdk/README.md)。此处承诺的是第一份结果的可复现路径，不承诺固定耗时、项目安全或获得新用户。
