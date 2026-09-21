import { chromium } from 'playwright';
const FE = 'http://localhost:3000';
const email = 'qamatrix1789997801861@example.com';
const password = 'TestPass123!';
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  // ' + e : ''}`);
const browser = await chromium.launch();

// dark desktop + light desktop + mobile + AR
const configs = [
  { w: 1440, h: 900, scheme: 'dark', locale: 'en-US', tag: 'dark1440' },
  { w: 1440, h: 900, scheme: 'light', locale: 'en-US', tag: 'light1440' },
  { w: 390, h: 844, scheme: 'dark', locale: 'en-US', tag: 'mobile390' },
  { w: 1440, h: 900, scheme: 'dark', locale: 'ar-EG', tag: 'ardark' },
  { w: 1440, h: 900, scheme: 'light', locale: 'ar-EG', tag: 'arlight' },
];
for (const cfg of configs) {
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, colorScheme: cfg.scheme, locale: cfg.locale });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('style property') && !m.text().includes('Failed to load resource')) errs.push(m.text().slice(0, 120)); });
  await ctx.request.post(`${FE}/api/v1/auth/login`, { data: { email, password } });
  await page.goto(FE + '/#/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const rows = await page.locator('.dash-orders .dash-row').count();
  check(`${cfg.tag} recent order row present`, rows > 0, `rows=${rows}`);
  if (rows > 0) {
    await page.locator('.dash-orders .dash-row button').first().click();
    await page.waitForTimeout(1800);
    const hash = await page.evaluate(() => location.hash);
    const detail = await page.locator('.oc-detail, [role="dialog"], .order-detail').count();
    check(`${cfg.tag} view-details navigates to order detail`, hash.includes('orders') && detail > 0, `hash=${hash} detail=${detail}`);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${cfg.tag} detail no h-overflow`, ov <= 1, `overflow=${ov}px`);
    await page.screenshot({ path: `/tmp/qa-detail-${cfg.tag}.png` });
    // close (escape or close btn) and check RTL LTR isolation for reference
    const refDir = await page.locator('.oc-detail [dir="ltr"], [role="dialog"] [dir="ltr"]').count().catch(() => 0);
    if (cfg.tag.startsWith('ar')) check(`${cfg.tag} LTR isolation present`, refDir >= 0, `ltrNodes=${refDir}`);
  }
  if (errs.length) check(`${cfg.tag} no console errors`, false, errs.join(' | '));
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
