import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

// Read-only browser QA. Clipboard writes are captured in memory, never sent to
// the system clipboard; all application writes and analytics are blocked.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const site = new URL(process.env.REPORT_SHARE_URL || "https://skillsupermarket.com");
assert.ok(["http:", "https:"].includes(site.protocol));
const output = ".cache/report-share";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
let blockedWrites = 0;
let checks = 0;

async function contextFor(mode, javaScriptEnabled = true) {
  const context = await browser.newContext({ javaScriptEnabled, extraHTTPHeaders: { DNT: "1" } });
  await context.route("**/*", route => {
    const req = route.request();
    if (!["GET", "HEAD"].includes(req.method()) || new URL(req.url()).pathname === "/api/events") {
      blockedWrites++;
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(mode => {
    window.__copiedReportLinks = [];
    const clipboard = mode === "unavailable" ? undefined : {
      writeText: value => {
        if (mode === "denied") return Promise.reject(new DOMException("Denied for test", "NotAllowedError"));
        if (mode === "pending") return new Promise(resolve => { window.__finishCopy = () => { window.__copiedReportLinks.push(value); resolve(); }; });
        window.__copiedReportLinks.push(value);
        return Promise.resolve();
      },
    };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
  }, mode);
  return context;
}

async function openReport(context, width, slug = "modelcontextprotocol-server-filesystem") {
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 844 });
  const response = await page.goto(new URL(`/skill/${slug}?utm_source=test&private_context=must-not-copy`, site).href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  const share = page.getByRole("complementary", { name: "分享公开报告" });
  assert.equal(await share.count(), 1);
  assert.equal(await share.getByRole("textbox", { name: "公开报告链接", includeHidden: true }).inputValue(), `${canonical}#evaluation-report-title`);
  assert.equal(await page.locator('#evaluation-report-title').count(), 1);
  assert.equal(await page.evaluate(() => {
    document.documentElement.style.overflowX = "visible";
    document.body.style.overflowX = "visible";
    return document.documentElement.scrollWidth > innerWidth;
  }), false, `${width}: document overflow`);
  return { page, share, expected: `${canonical}#evaluation-report-title` };
}

try {
  const success = await contextFor("success");
  for (const width of [320, 375, 390, 414, 768, 1024, 1280]) {
    const { page, share, expected } = await openReport(success, width);
    const button = share.getByRole("button", { name: "复制报告链接" });
    assert.ok((await button.boundingBox()).height >= 44);
    const alignment = await button.evaluate(el => {
      const text = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const range = document.createRange();
      range.selectNode(text);
      const label = range.getBoundingClientRect(), icon = el.querySelector("svg").getBoundingClientRect();
      return { display: getComputedStyle(el).display, gap: label.left - icon.right, centerOffset: Math.abs((label.top + label.bottom - icon.top - icon.bottom) / 2) };
    });
    assert.ok(["flex", "inline-flex"].includes(alignment.display));
    assert.ok(alignment.gap >= 0 && alignment.gap < 20 && alignment.centerOffset < 3, "copy icon and label must share one line");
    await button.focus();
    await page.keyboard.press("Enter");
    await share.getByRole("status").filter({ hasText: "链接已复制" }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__copiedReportLinks), [expected]);
    assert.equal(new URL(expected).search, "");
    await share.locator("summary").click();
    await share.getByRole("textbox").focus();
    assert.equal(await share.getByRole("textbox").evaluate(el => el.selectionEnd - el.selectionStart), expected.length);
    await share.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${width}.png` });
    await page.close();
    checks++;
  }
  const second = await openReport(success, 390, "modsettersurfsense");
  await second.share.getByRole("button", { name: "复制报告链接" }).click();
  await second.share.getByRole("status").filter({ hasText: "链接已复制" }).waitFor();
  assert.deepEqual(await second.page.evaluate(() => window.__copiedReportLinks), [second.expected]);
  // Follow the exact copied public route in a fresh anonymous context. The
  // canonical host remains production even when testing a loopback preview.
  const recipient = await success.newPage();
  const destination = new URL(second.expected);
  const response = await recipient.goto(new URL(destination.pathname + destination.hash, site).href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await recipient.locator("#evaluation-report-title").waitFor();
  assert.notEqual(new URL(recipient.url()).pathname, "/login");
  assert.ok(await recipient.locator('meta[property="og:image"]').getAttribute("content"));
  await success.close();
  checks += 2;

  for (const mode of ["denied", "unavailable"]) {
    const context = await contextFor(mode);
    const { page, share, expected } = await openReport(context, 320);
    await share.getByRole("button", { name: "复制报告链接" }).click();
    await share.getByRole("status").filter({ hasText: "请手动复制" }).waitFor();
    assert.equal(await share.locator("details").getAttribute("open"), "");
    const field = share.getByRole("textbox");
    assert.equal(await field.evaluate(el => el === document.activeElement && el.selectionEnd - el.selectionStart === el.value.length), true);
    assert.equal(await field.inputValue(), expected);
    assert.deepEqual(await page.evaluate(() => window.__copiedReportLinks), []);
    assert.doesNotMatch(await share.getByRole("status").textContent(), /链接已复制/);
    await context.close();
    checks++;
  }
  const pending = await contextFor("pending");
  const { page, share, expected } = await openReport(pending, 390);
  await share.getByRole("button", { name: "复制报告链接" }).click();
  await share.getByRole("button", { name: "正在复制…" }).waitFor();
  assert.equal(await share.getByRole("button").isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => window.__copiedReportLinks), []);
  assert.doesNotMatch(await share.getByRole("status").textContent(), /链接已复制/);
  await page.evaluate(() => window.__finishCopy());
  await share.getByRole("status").filter({ hasText: "链接已复制" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__copiedReportLinks), [expected]);
  await pending.close();
  checks++;

  const noJs = await contextFor("unavailable", false);
  const fallback = await openReport(noJs, 320);
  await fallback.share.locator("summary").click();
  assert.equal(await fallback.share.getByRole("textbox").isVisible(), true);
  assert.equal(await fallback.share.getByRole("textbox").inputValue(), fallback.expected);
  await noJs.close();
  checks++;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", checks, widths: 7, browserErrors: errors.length, blockedWrites, systemClipboardWrites: 0, evaluationJobs: 0 }));
} finally { await browser.close(); }
