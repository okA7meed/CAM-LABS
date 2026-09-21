import { chromium } from 'playwright';
const FE = 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await ctx.request.post(`${FE}/api/v1/auth/login`, { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
await page.goto(FE + '/#dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/qa-debug-dash.png' });
const wide = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > document.documentElement.clientWidth + 1 || r.left < -1) {
      out.push(`${el.tagName}.${(el.className.baseVal ?? el.className).toString().split(' ').slice(0, 2).join('.')} right=${Math.round(r.right)} left=${Math.round(r.left)}`);
    }
  });
  return out.slice(0, 12);
});
console.log('WIDE:', JSON.stringify(wide, null, 1));
console.log('hash:', await page.evaluate(() => location.hash));
await browser.close();
