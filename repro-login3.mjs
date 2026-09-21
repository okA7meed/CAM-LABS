import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('response', async (res) => {
  if (res.url().includes('/api/v1/auth/login') || res.url().includes('/api/v1/auth/me')) {
    let body = '';
    try { body = (await res.text()).slice(0, 300); } catch {}
    console.log('AUTH RESP:', res.request().method(), res.status(), res.url().split('/api')[1], '| body:', body);
  }
});
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/shot-header.png' });
// dump header buttons
const btns = await page.locator('header button, header a').allInnerTexts();
console.log('HEADER BTNS:', JSON.stringify(btns));
await browser.close();
