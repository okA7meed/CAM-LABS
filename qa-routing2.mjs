import { chromium } from 'playwright';
const FE = 'http://localhost:3000';
const email = 'qamatrix1789997801861@example.com';
const password = 'TestPass123!';
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  // ' + e : ''}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await ctx.request.post(`${FE}/api/v1/auth/login`, { data: { email, password } });
const marker = () =>
  page.evaluate(() => ({
    dash: !!document.querySelector('.dash-page'),
    orders: !!document.querySelector('.order-center'),
    account: !!document.querySelector('.account-settings-page'),
    landing: document.querySelector('main')?.id === 'view-landing',
    hash: location.hash,
  }));
for (const [h, key] of [['#/dashboard', 'dash'], ['#dashboard', 'dash'], ['#/orders', 'orders'], ['#/account/security', 'account'], ['#account', 'account']]) {
  await page.goto(FE + '/' + h, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const m = await marker();
  check(`direct ${h} restores view`, m[key] === true && !m.landing, JSON.stringify(m));
}
// account section from hash
await page.goto(FE + '/#/account/security', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const secActive = await page.locator('.account-nav-item.active, [aria-current="page"]').allInnerTexts().catch(() => []);
check('account deep link selects security section', secActive.join(' ').toLowerCase().includes('security'), secActive.join('|').slice(0, 80));
await page.screenshot({ path: '/tmp/qa-acct-security.png' });
await ctx.close();
await browser.close();
console.log(results.join('\n'));
