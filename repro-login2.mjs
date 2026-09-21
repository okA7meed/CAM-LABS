import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('response', async (res) => {
  if (res.url().includes('/api/v1/auth/')) {
    let body = '';
    try { body = (await res.text()).slice(0, 400); } catch {}
    const headers = await res.headersArray().then(h => Object.fromEntries(h.map(x => [x.name.toLowerCase(), x.value]))).catch(() => ({}));
    console.log('AUTH RESP:', res.status(), res.url(), '| set-cookie:', headers['set-cookie']?.slice(0, 120), '| body:', body);
  }
});
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('style property')) console.log('CONSOLE:', m.text().slice(0, 200)); });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
// register throwaway via API
const email = `qafix${Date.now()}@example.com`;
const reg = await page.request.post('http://localhost:3000/api/v1/auth/register', {
  data: { name: 'QA Fix', email, password: 'TestPass123!', company: 'QA', phone: '+201012345678' },
});
console.log('register:', reg.status());
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
// open login
await page.getByRole('button', { name: /^sign in$/i }).first().click({ timeout: 8000 });
await page.waitForTimeout(800);
await page.getByLabel(/email/i).fill(email);
await page.getByLabel(/^password/i).fill('TestPass123!');
await page.screenshot({ path: '/tmp/shot-prefill.png' });
await page.getByRole('button', { name: /sign in to cam labs/i }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/shot-after-login.png' });
const cookies = await page.context().cookies();
console.log('COOKIES:', cookies.map(c => `${c.name} httpOnly=${c.httpOnly} sameSite=${c.sameSite} secure=${c.secure} expires=${c.expires}`).join(' | '));
await browser.close();
