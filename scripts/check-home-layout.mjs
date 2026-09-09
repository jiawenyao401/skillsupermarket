import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

// Optional QA runtime: PLAYWRIGHT_MODULE can point to an existing installation.
// No browser dependency, analytics event or evaluation job is added to the app.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const site = new URL(process.env.HOME_LAYOUT_URL || "https://skillsupermarket.com");
assert.ok(["https:", "http:"].includes(site.protocol));
const output = ".cache/home-layout";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
let blockedWrites = 0;
const failures = [];
try {
  const context = await browser.newContext({ extraHTTPHeaders: { DNT: "1" } });
  await context.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.pathname === "/api/events") {
      blockedWrites++;
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => failures.push(error.message));
  const checkContrast = async () => page.locator('.home-hero').evaluate(hero => {
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const failures = [];
    let checked = 0;
    for (const el of hero.querySelectorAll('*')) {
      if (![...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
      const style = getComputedStyle(el);
      let parent = el;
      while (parent && ["rgba(0, 0, 0, 0)", "transparent"].includes(getComputedStyle(parent).backgroundColor)) parent = parent.parentElement;
      if (!parent) continue;
      const values = [luminance(style.color), luminance(getComputedStyle(parent).backgroundColor)].sort((a, b) => b - a);
      const ratio = (values[0] + .05) / (values[1] + .05);
      const threshold = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio < threshold) failures.push({ selector: el.className, ratio });
      checked++;
    }
    return { checked, failures };
  });
  const widths = [320, 375, 390, 414, 768, 1023, 1024, 1280, 1920];
  for (const width of widths) {
    const height = width < 768 ? 844 : 800;
    await page.setViewportSize({ width, height });
    const response = await page.goto(site.href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.locator('.home-primary').waitFor();
    assert.equal(await page.locator('h1').count(), 1);
    const contrast = await checkContrast();
    assert.ok(contrast.checked > 10);
    assert.deepEqual(contrast.failures, [], `${width}: contrast failures`);
    const measurements = await page.evaluate(() => {
      const bounds = selector => {
        const { top, bottom } = document.querySelector(selector).getBoundingClientRect();
        return { top, bottom };
      };
      const clip = [getComputedStyle(document.documentElement).overflowX, getComputedStyle(document.body).overflowX];
      document.documentElement.style.overflowX = "visible";
      document.body.style.overflowX = "visible";
      const overflow = document.documentElement.scrollWidth > innerWidth;
      document.documentElement.style.removeProperty("overflow-x");
      document.body.style.removeProperty("overflow-x");
      return { hero: bounds('.home-hero'), primary: bounds('.home-primary'), form: bounds('.home-evaluate'), margin: getComputedStyle(document.querySelector('.home-hero')).marginTop, clip, overflow };
    });
    assert.equal(measurements.overflow, false, `${width}: horizontal overflow`);
    assert.equal(measurements.margin, "0px");
    assert.deepEqual(measurements.clip, ["clip", "clip"]);
    assert.ok(measurements.primary.bottom < height, `${width}: primary CTA below fold`);
    if (width >= 1280) assert.ok(measurements.form.bottom < height, `${width}: evaluation form below fold`);
    for (const item of await page.locator('.home-hero a, .home-hero button').all()) {
      const rect = await item.boundingBox();
      assert.ok(rect.height >= 44 && rect.height <= 52, `${width}: wrapped or undersized control`);
    }
    const field = page.locator('#homepage-evaluation-source');
    assert.equal(await field.evaluate(el => el.checkValidity()), false);
    await page.locator('a[href="#homepage-evaluation-source"]').click();
    await field.focus();
    assert.equal(await field.evaluate(el => el === document.activeElement), true);
    assert.ok((await field.boundingBox()).y >= 64, "sticky navigation covers input");
    await page.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); });
    await page.screenshot({ path: `${output}/${width}.png` });
    console.log(JSON.stringify({ width, ...measurements, contrastPairs: contrast.checked }));
  }
  const reportHref = await page.locator('.home-primary').getAttribute('href');
  assert.match(reportHref, /^\/skill\/[^/]+#evaluation-report-title$/);
  await page.locator('.home-primary').click();
  await page.locator('#evaluation-report-title').waitFor();
  assert.equal(new URL(page.url()).pathname, new URL(reportHref, site).pathname);
  await page.goto(site.href, { waitUntil: "networkidle" });
  const source = "https://github.com/example/example";
  await page.locator('#homepage-evaluation-source').fill(source);
  await page.locator('.home-submit').click();
  await page.waitForURL(url => url.pathname === "/login");
  const login = new URL(page.url());
  const destination = login.searchParams.get("returnTo") || login.searchParams.get("callbackURL") || login.searchParams.get("next");
  assert.ok(destination, "login return destination missing");
  assert.equal(new URL(destination, site).searchParams.get("source"), source);
  assert.equal(failures.length, 0, `browser errors: ${failures.join(", ")}`);
  console.log(JSON.stringify({ result: "PASS", widths: widths.length, blockedWrites, browserErrors: failures.length, evaluationJobs: 0, sourcePreservedAtLogin: true }));
} finally { await browser.close(); }
