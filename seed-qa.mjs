import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const email = `qa-${Date.now()}@example.com`;
const reg = await context.request.post(`${BASE}/api/v1/auth/register`, {
  data: { name: 'Qa Engineer', email, password: 'QaPass12', phone: '+201012345678' },
});
console.log('register:', reg.status(), (await reg.text()).slice(0,200));
await browser.close();
