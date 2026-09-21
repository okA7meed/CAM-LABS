import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await ctx.request.post('http://localhost:3000/api/v1/auth/login', { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
for (const h of ['#/dashboard', '#/orders', '#/account/security', '#/quotes']) {
  await page.goto('http://localhost:3000/' + h, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const mainId = await page.evaluate(() => document.querySelector('main')?.id || document.querySelector('main')?.className);
  console.log(h, '=> main:', String(mainId).slice(0, 60));
}
// client-side nav comparison
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Dashboard', exact: true }).first().click().catch(() => console.log('no dash btn'));
await page.waitForTimeout(1000);
console.log('after click Dashboard => hash:', await page.evaluate(() => location.hash), 'main:', await page.evaluate(() => document.querySelector('main')?.id));
await browser.close();
