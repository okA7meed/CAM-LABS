import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await ctx.request.post('http://localhost:3000/api/v1/auth/login', { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const res = {};
  res.base = document.documentElement.scrollWidth;
  res.bodyMargin = getComputedStyle(document.body).margin;
  res.rootSW = document.getElementById('root').scrollWidth;
  for (const sel of ['header', 'main', 'footer', '.order-center__inner', '.oc-list']) {
    const el = document.querySelector(sel);
    if (el) { res[sel] = { sw: el.scrollWidth, cw: el.clientWidth }; }
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
