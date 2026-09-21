import { chromium } from 'playwright';
const FE = 'http://localhost:3000';
const email = 'qamatrix1789997801861@example.com';
const password = 'TestPass123!';
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  // ' + e : ''}`);
const browser = await chromium.launch();
const errors = [];

// viewports for login modal + order details
for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [414, 896], [390, 844], [375, 812]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('style property') && !m.text().includes('Failed to load resource')) errors.push(`${w}: ` + m.text().slice(0, 120)); });
  await ctx.request.post(`${FE}/api/v1/auth/login`, { data: { email, password } });
  await page.goto(FE + '/#dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  // open first order detail
  const cards = page.locator('.oc-card, [data-order-id], article');
  const n = await cards.count();
  let opened = false;
  if (n > 0) { await cards.first().click().catch(() => {}); await page.waitForTimeout(1200); }
  const detailVisible = await page.locator('.oc-detail, [role="dialog"]').count().then((c) => c > 0).catch(() => false);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`viewport ${w}x${h} no h-overflow`, overflow <= 1, `overflow=${overflow}px detail=${detailVisible}`);
  if (w === 390) await page.screenshot({ path: '/tmp/qa-mobile-detail.png' });
  if (w === 1440) await page.screenshot({ path: '/tmp/qa-dark-detail.png' });
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
console.log('ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
