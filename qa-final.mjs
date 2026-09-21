import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const EMAIL = 'qa-1789955654676@example.com';
const PASS = 'QaPass12';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await context.newPage();
const errs = [];
page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('style property')) errs.push(msg.text().slice(0, 120)); });
await context.request.post(`${BASE}/api/v1/auth/login`, { data: { email: EMAIL, password: PASS } });
await page.goto(`${BASE}#/account`, { waitUntil: 'networkidle' });
await page.waitForSelector('.account-settings-page', { timeout: 20000 });
await page.waitForTimeout(800);
await page.click('.account-country-button');
await page.waitForTimeout(500);
await page.fill('.account-country-search input', 'Egypt');
await page.waitForTimeout(400);
const optCount = await page.locator('.account-country-option').count();
console.log('country options visible:', optCount);
await page.screenshot({ path: '/tmp/qa4-phone-open.png' });
// mobile shots with fixed labels
for (const [w, h, label] of [[390, 844, 'm390'], [375, 812, 'm375']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await ctx.request.post(`${BASE}/api/v1/auth/login`, { data: { email: EMAIL, password: PASS } });
  await p.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.dash-page', { timeout: 20000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `/tmp/qa4-mobile-dash-${label}.png` });
  await ctx.close();
}
await context.close();
await browser.close();
console.log('ERRORS:', errs.length ? errs : 'none');
