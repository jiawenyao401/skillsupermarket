// Read-only browser regression: use an existing Playwright installation.
// BASE_URL=http://127.0.0.1:3301 PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-icp-footer.mjs
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "https://skillsupermarket.com";
const output = process.env.QA_OUTPUT || ".cache/icp-footer";
const browser = await chromium.launch({ headless: true });
const errors = [];
const results = [];
try {
  await mkdir(output, { recursive: true });
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, extraHTTPHeaders: { DNT: "1" } });
    // Do not generate analytics, registrations or evaluation jobs during QA.
    await context.route("**/*", route => {
      const request = route.request();
      return !["GET", "HEAD"].includes(request.method()) || new URL(request.url()).pathname === "/api/events"
        ? route.abort() : route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.name));
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/evaluation", "/skill/githubgithub-mcp-server", "/login"]) {
        const response = await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
        assert.equal(response.status(), 200, path);
        const footer = page.locator("footer");
        const link = footer.getByRole("link", { name: "冀ICP备2026036754号-2", exact: true });
        assert.equal(await link.count(), 1);
        await link.scrollIntoViewIfNeeded();
        assert.ok(await link.isVisible());
        assert.equal(await link.getAttribute("href"), "https://beian.miit.gov.cn/");
        assert.equal(await link.getAttribute("target"), "_blank");
        assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
        const bounds = await link.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `filing clipped at ${width}: ${path}`);
        const overflow = await footer.evaluate(el => el.scrollWidth > el.clientWidth + 1);
        assert.equal(overflow, false, `footer overflow at ${width}: ${path}`);
        if (path === "/" && javaScriptEnabled) await footer.screenshot({ path: `${output}/footer-${width}.png` });
        results.push({ width, path, javaScriptEnabled, passed: true });
      }
    }
    await context.close();
  }
  assert.deepEqual(errors, [], "unexpected browser exception");
  console.log(JSON.stringify({ footer: "passed", cases: results.length, screenshots: output }));
} finally {
  await browser.close();
}
