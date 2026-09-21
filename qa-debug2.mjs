import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await ctx.request.post('http://localhost:3000/api/v1/auth/login', { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const de = document.documentElement;
  const kids = [...document.body.children].map((el) => ({
    cls: (el.className.baseVal ?? el.className).toString().slice(0, 40),
    sw: el.scrollWidth,
    cw: el.clientWidth,
  }));
  return { docSW: de.scrollWidth, innerW: window.innerWidth, kids };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
