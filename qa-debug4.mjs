import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await ctx.request.post('http://localhost:3000/api/v1/auth/login', { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  const walker = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = walker.nextNode())) {
    const r = n.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 0.5) {
      const chain = [];
      let e = n;
      while (e && e.id !== 'root' && chain.length < 6) { chain.unshift(`${e.tagName}.${(e.className.baseVal ?? e.className).toString().split(' ')[0]}`); e = e.parentElement; }
      bad.push(`R=${Math.round(r.right)} :: ${chain.join(' > ')}`);
      if (bad.length > 8) break;
    }
  }
  return bad;
});
console.log(info.join('\n') || 'NONE');
await browser.close();
