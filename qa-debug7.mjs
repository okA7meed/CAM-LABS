import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await ctx.request.post('http://localhost:3000/api/v1/auth/login', { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const res = [];
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.scrollWidth > n.clientWidth + 1 && n.clientWidth > 0) {
      res.push(`${n.tagName}.${(n.className.baseVal ?? n.className).toString().split(' ').slice(0,2).join('.')} sw=${n.scrollWidth} cw=${n.clientWidth}`);
      if (res.length > 10) break;
    }
  }
  return res;
});
console.log(out.join('\n') || 'NONE');
await browser.close();
