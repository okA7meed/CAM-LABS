import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const scheme of [undefined, 'dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(scheme ? { colorScheme: scheme } : {}) });
  const page = await ctx.newPage();
  await ctx.request.post('http://localhost:3000/api/v1/auth/login', { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
  await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log(scheme ?? 'default', '=> main:', await page.evaluate(() => document.querySelector('main')?.id));
  await ctx.close();
}
await browser.close();
