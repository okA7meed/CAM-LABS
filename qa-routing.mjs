import { chromium } from 'playwright';
const FE = 'http://localhost:3000';
const email = 'qamatrix1789997801861@example.com';
const password = 'TestPass123!';
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  // ' + e : ''}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('style property') && !m.text().includes('Failed to load resource')) errs.push(m.text().slice(0, 120)); });
await ctx.request.post(`${FE}/api/v1/auth/login`, { data: { email, password } });

// both hash spellings restore the view
for (const h of ['#/dashboard', '#dashboard', '#/orders', '#/account/security', '#account']) {
  await page.goto(FE + '/' + h, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const mainId = await page.evaluate(() => document.querySelector('main')?.id);
  const ok = h.includes('account') ? mainId === 'account-settings-page'
    : h.includes('orders') ? mainId !== 'view-landing'
    : mainId === 'dash-page' || mainId === 'view-landing' && false;
  check(`direct ${h} restores view`, h.includes('account') ? mainId === 'account-settings-page' : mainId !== 'view-landing', `main=${mainId}`);
}
// refresh preserves
await page.goto(FE + '/#/orders', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
check('refresh preserves orders view', (await page.evaluate(() => document.querySelector('main')?.id)) !== 'view-landing');
// back/forward
await page.goto(FE + '/#/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Dashboard', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(600);
await page.evaluate(() => history.back());
await page.waitForTimeout(800);
console.log('after back hash:', await page.evaluate(() => location.hash));
// logout redirect
await page.goto(FE + '/#/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Sign Out' }).first().click();
await page.waitForTimeout(1500);
const hAfter = await page.locator('header').allInnerTexts();
check('logout returns to logged-out header', hAfter.join(' ').includes('Sign In'));
// unauthenticated protected deep link
await page.goto(FE + '/#/account', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const mainUnauth = await page.evaluate(() => document.querySelector('main')?.id);
const bodyTxt = await page.locator('body').allInnerTexts();
check('logged-out account link gates safely', mainUnauth === 'view-landing' || bodyTxt.join(' ').toLowerCase().includes('sign in'), `main=${mainUnauth}`);
// login again from landing
await page.getByRole('button', { name: 'Sign In' }).click();
await page.waitForTimeout(600);
await page.getByLabel(/work email/i).fill(email);
await page.getByLabel(/^password/i).first().fill(password);
await page.getByRole('button', { name: /sign in to cam labs/i }).click();
await page.waitForTimeout(2000);
check('login again works', (await page.locator('header').allInnerTexts()).join(' ').includes('Sign Out'));
if (errs.length) check('no console errors', false, errs.join(' | '));
await ctx.close();
await browser.close();
console.log(results.join('\n'));
