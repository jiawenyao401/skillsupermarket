// Reuses an installed Playwright runtime; blocks telemetry and all business writes.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

if (!process.env.PLAYWRIGHT_MODULE) throw new Error("Set PLAYWRIGHT_MODULE to an existing Playwright installation");
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const origin = process.env.GUIDE_CHECK_ORIGIN || "https://skillsupermarket.com";
const previewOnly = process.env.GUIDE_PREVIEW_ONLY === "1";
const path = "/guides/claude-code-mcp-server-recommendations-2026";
const reportPath = "/skill/githubgithub-mcp-server#evaluation-report-title";
const widths = [320, 375, 390, 414, 768, 1024, 1280];
const browser = await chromium.launch({ headless: true });
const errors = [];
let blockedWrites = 0;
let checks = 0;
await mkdir(".cache/guide-report", { recursive: true });
try {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, extraHTTPHeaders: { DNT: "1" } });
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(20000);
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (!["GET", "HEAD"].includes(request.method()) || new URL(request.url()).pathname === "/api/events") {
        blockedWrites++;
        await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of javaScriptEnabled ? widths : [320, 1280]) {
      console.log(`Checking guide width=${width}, JavaScript=${javaScriptEnabled}`);
      await page.setViewportSize({ width, height: 900 });
      assert.equal((await page.goto(origin + path, { waitUntil: "networkidle" })).status(), 200);
      await page.evaluate(() => {
        document.documentElement.style.overflowX = "visible";
        document.body.style.overflowX = "visible";
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}, JS=${javaScriptEnabled}`);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://skillsupermarket.com" + path);
      const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((text) => JSON.parse(text));
      assert.ok(schemas.some((item) => item["@type"] === "Article" && item.dateModified === "2026-09-09"));
      const link = page.getByRole("link", { name: "免登录查看 GitHub MCP 报告与风险证据", exact: true });
      assert.equal(await link.getAttribute("href"), reportPath);
      const section = link.locator("xpath=ancestor::section[1]");
      assert.ok(await section.locator("p").evaluateAll((paragraphs) => paragraphs.every((el) => el.scrollWidth <= el.clientWidth)), "case prose must not be clipped by the article container");
      assert.ok((await section.innerText()).includes("不是本站已执行"));
      assert.ok((await section.innerText()).includes("停止接入"));
      await link.focus();
      assert.ok(await link.evaluate((el) => el === document.activeElement));
      assert.ok((await link.boundingBox()).height >= 44);
      if (javaScriptEnabled && [320, 390, 1280].includes(width)) {
        await link.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `.cache/guide-report/${width}.png` });
      }
      checks++;
    }
    if (!previewOnly) {
      const link = page.getByRole("link", { name: "免登录查看 GitHub MCP 报告与风险证据", exact: true });
      await link.focus();
      await link.press("Enter");
      await page.waitForURL((url) => url.pathname + url.hash === reportPath);
      await page.getByRole("heading", { name: "综合采用结论", exact: true }).waitFor();
      assert.ok(!new URL(page.url()).pathname.startsWith("/login"));
      assert.equal(await page.locator("#evaluation-report-title").count(), 1);
      checks++;
    }
    await context.close();
  }
  assert.deepEqual(errors, [], "browser errors must not be ignored");
  console.log(JSON.stringify({ result: "PASS", checks, widths: widths.length, reportNavigationChecks: previewOnly ? 0 : 2, browserErrors: errors.length, blockedWrites, evaluationJobs: 0 }));
} finally {
  await browser.close();
}
