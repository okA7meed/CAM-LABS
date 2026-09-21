import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await ctx.request.post('http://localhost:3000/api/v1/auth/login', { data: { email: 'qamatrix1789997801861@example.com', password: 'TestPass123!' } });
await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const root = document.getElementById('root');
  const out = [];
  const walk = (el, depth) => {
    if (depth > 6 || out.length > 15) return;
    for (const child of el.children) {
      const r = child.getBoundingClientRect();
      if (r.right > 1441 || r.left < -1) {
        out.push(`${'  '.repeat(depth)}${child.tagName}.${(child.className.baseVal ?? child.className).toString().split(' ').slice(0,2).join('.')} L=${Math.round(r.left)} R=${Math.round(r.right)}`);
        walk(child, depth + 1);
      }
    }
  };
  walk(root, 0);
  return out;
});
console.log(info.join('\n'));
await browser.close();
