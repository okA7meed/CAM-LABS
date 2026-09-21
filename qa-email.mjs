import { chromium } from 'playwright';
const FE = 'http://localhost:3000';
const email = 'qamatrix1789997801861@example.com';
const password = 'TestPass123!';
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  // ' + e : ''}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'ar-EG' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('style property') && !m.text().includes('Failed to load resource')) errs.push(m.text().slice(0, 120)); });
await ctx.request.post(`${FE}/api/v1/auth/login`, { data: { email, password } });
await page.goto(FE + '/#/account', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
check('AR locale active', (await page.evaluate(() => document.documentElement.lang)).startsWith('ar'));
// open email change (button text in Arabic: look for change-email trigger near email field)
const changeBtn = page.locator('button', { hasText: 'تغيير' }).first();
if (await changeBtn.count()) {
  await changeBtn.click();
  await page.waitForTimeout(800);
  await page.locator('input[type="email"]').last().fill('newaddr@example.com');
  const pwField = page.locator('.account-modal input[type="password"], [role="dialog"] input[type="password"]');
  if (await pwField.count()) await pwField.first().fill(password);
  await page.locator('[role="dialog"] button[type="submit"], .account-modal button.btn-primary').first().click();
  await page.waitForTimeout(4000);
  const modalText = await page.locator('[role="dialog"]').allInnerTexts().catch(() => []);
  const txt = modalText.join(' ');
  check('email send failure is graceful + localized', txt.includes('تعذر') && !txt.includes('validation_error') && !txt.includes('Resend'), txt.slice(0, 160));
  await page.screenshot({ path: '/tmp/qa-email-ar-light.png' });
} else {
  check('email change entry point found', false, 'no change button');
}
// forgot password flow
await ctx.clearCookies();
await page.goto(FE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /تسجيل الدخول|Sign In/ }).click();
await page.waitForTimeout(600);
const forgot = page.getByRole('button', { name: /نسيت|Forgot/ });
if (await forgot.count()) {
  await forgot.click();
  await page.waitForTimeout(800);
  check('forgot password opens', (await page.locator('[role="dialog"]').count()) > 0);
  await page.screenshot({ path: '/tmp/qa-forgot.png' });
} else {
  check('forgot password entry found', false, 'no forgot button');
}
if (errs.length) check('no console errors', false, errs.join(' | '));
await ctx.close();
await browser.close();
console.log(results.join('\n'));
