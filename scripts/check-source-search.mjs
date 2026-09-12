import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.SOURCE_SEARCH_URL || "https://skillsupermarket.com");
const source = "https://github.com/github/github-mcp-server";
const report = "/skill/githubgithub-mcp-server#evaluation-report-title";
const missing = "https://github.com/skillsupermarket-lookup-fixture/nonexistent-20260913";
const errors = [];
let blockedWrites = 0;
const browser = await chromium.launch({ headless: true });
await mkdir(".cache/source-search", { recursive: true });

async function context(javaScriptEnabled) {
  const ctx = await browser.newContext({ javaScriptEnabled, extraHTTPHeaders: { DNT: "1" } });
  await ctx.route("**/*", route => {
    const req = route.request();
    if (!["GET", "HEAD"].includes(req.method()) || new URL(req.url()).pathname === "/api/events") {
      blockedWrites++;
      return route.abort();
    }
    return route.continue();
  });
  return ctx;
}

try {
  const ctx = await context(true);
  const page = await ctx.newPage();
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal((await page.goto(base.href, { waitUntil: "networkidle" })).status(), 200);
    await page.locator("#homepage-evaluation-source").fill(source);
    await page.locator("#homepage-evaluation-source").press("Enter");
    await page.waitForURL(url => url.pathname === "/search");
    assert.equal(new URL(page.url()).searchParams.get("source"), source);
    const link = page.locator(`a[href="${report}"]`);
    await link.waitFor();
    assert.match(await link.textContent(), /无需登录/);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://skillsupermarket.com/search");
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
    assert.equal(await page.evaluate(() => {
      document.documentElement.style.overflowX = "visible";
      document.body.style.overflowX = "visible";
      return document.documentElement.scrollWidth > innerWidth;
    }), false, `${width}: page overflow`);
    await page.screenshot({ path: `.cache/source-search/${width}.png`, fullPage: true });
    await link.click();
    await page.locator("#evaluation-report-title").waitFor();
    assert.equal(new URL(page.url()).pathname, "/skill/githubgithub-mcp-server");
  }
  await page.goto(new URL(`/search?source=${encodeURIComponent(missing)}`, base));
  await page.getByRole("link", { name: "登录后评测项目", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/login");
  const returnTo = new URL(page.url()).searchParams.get("returnTo");
  assert.ok(returnTo);
  assert.equal(new URL(returnTo, base).pathname, "/evaluate");
  assert.equal(new URL(returnTo, base).searchParams.get("source"), missing);

  for (const query of ["source=https%3A%2F%2Fu%3Acredential-canary%40github.com%2Fa%2Fb", "source=react&source=other", `source=${"x".repeat(501)}`]) {
    assert.equal((await page.goto(new URL(`/search?${query}`, base))).status(), 200);
    assert.match(await page.locator("main").innerText(), /请输入支持的项目地址或包名/);
    assert.equal(await page.locator("input[name=source]").inputValue(), "");
    for (const href of await page.locator("main a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))) {
      assert.ok(!href.includes("credential-canary"));
    }
  }
  await page.goto(new URL("/search?q=GitHub", base));
  assert.equal(await page.locator("h1").innerText(), "搜索 AI 能力");
  assert.ok(await page.locator('a[href^="/skill/"]').count() > 0);
  await page.goto(new URL(`/search?source=${encodeURIComponent(source)}`, base));
  await page.locator("input[name=source]").fill("https://u:credential-canary@github.com/a/b");
  await page.getByRole("button", { name: "提交搜索", exact: true }).click();
  await page.getByRole("heading", { name: "请输入支持的项目地址或包名", exact: true }).waitFor();
  assert.equal(await page.locator("input[name=source]").inputValue(), "");
  await ctx.close();

  const noJs = await context(false);
  const plain = await noJs.newPage();
  await plain.goto(base.href);
  await plain.locator("#homepage-evaluation-source").fill(source);
  await plain.locator(".home-submit").click();
  await plain.waitForURL(url => url.pathname === "/search");
  await plain.locator(`a[href="${report}"]`).waitFor();
  await plain.locator("input[name=source]").fill(missing);
  await plain.getByRole("button", { name: "提交搜索", exact: true }).click();
  await plain.waitForURL(url => url.searchParams.get("source") === missing);
  await plain.getByRole("link", { name: "登录后评测项目", exact: true }).waitFor();
  await noJs.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", widths: 4, anonymousReport: true, loginSourcePreserved: true, noJavaScript: true, rejectedInput: 3, textSearch: true, browserErrors: errors.length, blockedWrites, evaluationJobs: 0 }));
} finally {
  await browser.close();
}
