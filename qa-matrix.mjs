import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';

const FE = 'http://localhost:3000';
const results = [];
const check = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  // ' + extra : ''}`);

function totpNow(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secret.replace(/=+$/, '').toUpperCase();
  let bits = 0, value = 0; const bytes = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error('bad secret char');
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
  return String(code % 1e6).padStart(6, '0');
}

const browser = await chromium.launch();
const errors = [];
const failedApi = [];

// ---------- EN dark: full login matrix ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('style property') && !m.text().includes('Failed to load resource')) errors.push('ENdark: ' + m.text().slice(0, 150)); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400 && !r.url().includes('/auth/me')) failedApi.push(`ENdark: ${r.status()} ${r.url().split('/api')[1]}`); });

  // throwaway account via API
  const email = `qamatrix${Date.now()}@example.com`;
  const password = 'TestPass123!';
  const reg = await ctx.request.post(`${FE}/api/v1/auth/register`, { data: { name: 'Matrix QA', email, password, company: 'QA', phone: '+201012345678' } });
  check('register throwaway', reg.status() === 201, `status=${reg.status()}`);
  await ctx.clearCookies();

  await page.goto(FE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(600);

  // wrong password
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password/i).first().fill('WrongPass9!');
  await page.getByRole('button', { name: /sign in to cam labs/i }).click();
  await page.waitForTimeout(1200);
  const wrongMsg = await page.locator('.auth-form-error, [role="alert"]').first().allInnerTexts().catch(() => []);
  check('wrong password → useful message', wrongMsg.join(' ').includes('Invalid email or password'), wrongMsg.join('|').slice(0, 80));

  // unknown email
  await page.getByLabel(/work email/i).fill('ghost-nobody@example.com');
  await page.getByLabel(/^password/i).first().fill('Whatever1!');
  await page.getByRole('button', { name: /sign in to cam labs/i }).click();
  await page.waitForTimeout(1200);
  const ghostMsg = await page.locator('.auth-form-error, [role="alert"]').first().allInnerTexts().catch(() => []);
  check('unknown email → identical message (no oracle)', ghostMsg.join(' ').includes('Invalid email or password'), ghostMsg.join('|').slice(0, 80));

  // valid login, remember checked
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(password);
  await page.getByRole('button', { name: /sign in to cam labs/i }).click();
  await page.waitForTimeout(2000);
  const AuthedHeader = await page.locator('header').allInnerTexts();
  check('valid login authenticates', AuthedHeader.join(' ').includes('Sign Out'), 'header shows Sign Out');
  const cookies = await ctx.cookies();
  const sess = cookies.find((c) => c.name === 'cam_labs_session');
  const daysLeft = (sess.expires - Date.now() / 1000) / 86400;
  check('remember checked → ~30d cookie', daysLeft > 29 && daysLeft < 31, `${daysLeft.toFixed(1)}d`);
  check('cookie flags', sess.httpOnly === true && sess.sameSite === 'Lax', `httpOnly=${sess.httpOnly} sameSite=${sess.sameSite} secure=${sess.secure}`);

  // refresh persistence
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const h2 = await page.locator('header').allInnerTexts();
  check('refresh preserves auth', h2.join(' ').includes('Sign Out'));

  // logout → refresh stays out
  const signOut = page.getByRole('button', { name: 'Sign Out' });
  if (await signOut.count()) { await signOut.first().click(); await page.waitForTimeout(1500); }
  const meAfter = await ctx.request.get(`${FE}/api/v1/auth/me`);
  check('logout invalidates session', meAfter.status() === 401, `me=${meAfter.status()}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const h3 = await page.locator('header').allInnerTexts();
  check('post-logout refresh stays logged out', !h3.join(' ').includes('Dashboard') || h3.join(' ').includes('Sign In'));

  // remember UNchecked → short cookie
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(600);
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(password);
  const keepBox = page.getByLabel(/keep me signed in/i);
  if (await keepBox.count() && await keepBox.isChecked()) await keepBox.uncheck();
  await page.getByRole('button', { name: /sign in to cam labs/i }).click();
  await page.waitForTimeout(2000);
  const cookies2 = await ctx.cookies();
  const sess2 = cookies2.find((c) => c.name === 'cam_labs_session');
  const hoursLeft = (sess2.expires - Date.now() / 1000) / 3600;
  check('remember unchecked → ~12h cookie', hoursLeft > 10 && hoursLeft < 14, `${hoursLeft.toFixed(1)}h`);

  // ---- 2FA enable via API, login via UI challenge ----
  const setupRes = await ctx.request.post(`${FE}/api/v1/auth/2fa/setup`);
  const setupBody = await setupRes.json();
  const secret = setupBody.data.secret;
  const code1 = totpNow(secret);
  const enRes = await ctx.request.post(`${FE}/api/v1/auth/2fa/enable`, { data: { code: code1 } });
  check('2FA enable via API', enRes.status() === 200, `status=${enRes.status()}`);
  // logout then login → challenge
  await page.getByRole('button', { name: 'Sign Out' }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(600);
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(password);
  await page.getByRole('button', { name: /sign in to cam labs/i }).click();
  await page.waitForTimeout(1500);
  const tfaVisible = await page.getByLabel(/authentication code|2fa|two-factor/i).count().catch(() => 0);
  const tfaText = await page.locator('body').allInnerTexts();
  check('2FA challenge appears', tfaText.join(' ').toLowerCase().includes('authenticator') || tfaVisible > 0);
  await page.screenshot({ path: '/tmp/qa-2fa-challenge.png' });
  // wrong code
  const codeInput = page.getByLabel(/authentication code|code/i).last();
  await codeInput.fill('000000');
  await page.getByRole('button', { name: /sign in to cam labs/i }).click();
  await page.waitForTimeout(1200);
  const bad2fa = await page.locator('.auth-form-error, [role="alert"]').first().allInnerTexts().catch(() => []);
  check('wrong 2FA code rejected usefully', !bad2fa.join(' ').includes('API error') && bad2fa.join(' ').length > 5, bad2fa.join('|').slice(0, 90));
  // correct code
  await codeInput.fill(totpNow(secret));
  await page.getByRole('button', { name: /sign in to cam labs/i }).click();
  await page.waitForTimeout(2000);
  const h4 = await page.locator('header').allInnerTexts();
  check('correct 2FA completes login', h4.join(' ').includes('Sign Out'));
  // disable 2FA back (cleanup for reuse)
  const disRes = await ctx.request.post(`${FE}/api/v1/auth/2fa/disable`, { data: { password } });
  check('2FA disable', disRes.status() === 200, `status=${disRes.status()}`);

  // backend-down simulation: route /api/* to abort → blank-message regression check
  await ctx.route('**/api/**', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Sign Out' }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Sign In' }).click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByLabel(/work email/i).fill(email).catch(() => {});
  await page.getByLabel(/^password/i).first().fill(password).catch(() => {});
  await page.getByRole('button', { name: /sign in to cam labs/i }).click().catch(() => {});
  await page.waitForTimeout(1500);
  const downMsgs = await page.locator('.auth-form-error, [role="alert"]').first().allInnerTexts().catch(() => []);
  const downText = downMsgs.join(' ');
  check('backend down → no blank API error', !/^API error:?\s*$/.test(downText) && downText.length > 10, downText.slice(0, 90));
  await page.screenshot({ path: '/tmp/qa-backend-down.png' });
  await ctx.unroute('**/api/**');
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
console.log('CONSOLE ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
console.log('FAILED API (non-me):', failedApi.length ? JSON.stringify(failedApi) : 'none');
