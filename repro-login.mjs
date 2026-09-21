import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reqs = [];
page.on('response', async (res) => {
  if (res.url().includes('/api/')) {
    let body = '';
    try { body = (await res.text()).slice(0, 300); } catch {}
    reqs.push({ status: res.status(), url: res.url(), body });
  }
});
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/shot-home.png' });
// open login modal
await page.getByRole('button', { name: /sign in/i }).first().click({ timeout: 8000 }).catch(async () => {
  console.log('no sign-in button found');
});
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/shot-login.png' });
console.log('RESPONSES:', JSON.stringify(reqs, null, 1));
await browser.close();
