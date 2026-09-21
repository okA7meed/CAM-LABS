import { chromium } from 'playwright';
const FE = 'http://localhost:3000';
const email = 'qamatrix1789997801861@example.com';
const password = 'TestPass123!';
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  // ' + e : ''}`);
const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [414, 896], [390, 844], [375, 812]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await ctx.request.post(`${FE}/api/v1/auth/login`, { data: { email, password } });
  await page.goto(FE + '/#/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const mainId = await page.evaluate(() => document.querySelector('main')?.id);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`viewport ${w}x${h} dashboard renders`, mainId !== 'view-landing', mainId);
  check(`viewport ${w}x${h} no h-overflow`, overflow <= 1, `overflow=${overflow}px`);
  // open the seeded order detail
  const cards = page.locator('.oc-card');
  if (await cards.count()) {
    await cards.first().click();
    await page.waitForTimeout(1500);
    const detailOpen = await page.locator('.oc-detail, [role="dialog"]').count();
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`viewport ${w}x${h} order detail opens`, detailOpen > 0);
    check(`viewport ${w}x${h} detail no h-overflow`, overflow2 <= 1, `overflow=${overflow2}px`);
    if (w === 1440) await page.screenshot({ path: '/tmp/qa-detail-dark.png' });
    if (w === 390) await page.screenshot({ path: '/tmp/qa-detail-mobile.png' });
  } else {
    check(`viewport ${w}x${h} order cards present`, false, 'no .oc-card found');
  }
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
