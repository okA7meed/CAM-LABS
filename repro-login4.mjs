import { chromium } from 'playwright';
const email = `qafix${Date.now()}@example.com`;
const password = 'TestPass123!';
// register via API first
const b0 = await chromium.launch();
const c0 = await b0.newContext();
const reg = await c0.request.post('http://localhost:3000/api/v1/auth/register', {
  data: { name: 'QA Fix', email, password, company: 'QA', phone: '+201012345678' },
});
console.log('register:', reg.status());
await b0.close();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('response', async (res) => {
  if (res.url().includes('/api/v1/auth/')) {
    let body = '';
    try { body = (await res.text()).slice(0, 250); } catch {}
    const setCookie = res.headers()['set-cookie'] || '';
    console.log('AUTH:', res.request().method(), res.status(), res.url().split('/api')[1], '| set-cookie:', setCookie.slice(0, 100), '| body:', body);
  }
});
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Sign In' }).click();
await page.waitForTimeout(800);
await page.getByLabel(/work email/i).fill(email);
await page.getByLabel(/^password/i).first().fill(password);
await page.getByRole('button', { name: /sign in to cam labs/i }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/shot-loggedin.png' });
const cookies = await ctx.cookies();
console.log('COOKIES:', cookies.filter(c => c.name.includes('session') || c.name.includes('cam')).map(c => `${c.name} httpOnly=${c.httpOnly} sameSite=${c.sameSite} secure=${c.secure}`).join(' | '));
// refresh persistence
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shot-refresh.png' });
const btns = await page.locator('header').allInnerTexts();
console.log('HEADER AFTER REFRESH:', JSON.stringify(btns).slice(0, 300));
await browser.close();
