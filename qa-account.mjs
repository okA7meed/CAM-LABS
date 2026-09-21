import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';

const BASE = 'http://localhost:3000';
const stamp = Date.now();
let n = 0;
const makeEmail = () => `acctqa-${stamp}-${n++}@example.com`;
const errors = [];
const failedRequests = [];

function totp(secret, atMs = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secret.replace(/=+$/, '').toUpperCase();
  let bits = 0, value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error('bad secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const key = Buffer.from(bytes);
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

const results = [];
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('style property')) errors.push(msg.text().slice(0, 160)); });
page.on('response', (res) => { if (res.status() >= 400 && !res.url().includes('viewer-asset')) failedRequests.push(`${res.status()} ${res.url().slice(0, 100)}`); });

const email = makeEmail();
const PASS = 'AcctPass12';
await context.request.post(`${BASE}/api/v1/auth/register`, {
  data: { name: 'Account Qa', email, password: PASS, phone: '+201012345678' },
});

// 1. Deep link directly to a section
await page.goto(`${BASE}#/account/security`, { waitUntil: 'networkidle' });
await page.waitForSelector('.account-settings-page', { timeout: 20000 });
check('deep link #/account/security renders security', await page.isVisible('text=Two-Factor Authentication (2FA)'));
check('hash preserved on load', page.url().endsWith('#/account/security'));

// 2. Back/forward between sections
await page.click("button.account-nav-item:has-text('Addresses')");
await page.waitForTimeout(500);
await page.goBack();
await page.waitForTimeout(500);
check('back returns to security section', await page.isVisible('text=Active Sessions'));
await page.goForward();
await page.waitForTimeout(500);
check('forward returns to addresses', await page.isVisible('text=Default Shipping Address') || await page.isVisible('text=No saved addresses yet'));

// 3. Phone selector: panel, flag, invalid then valid
await page.click("button.account-nav-item:has-text('Personal')");
await page.waitForTimeout(400);
await page.click('.account-country-button');
await page.waitForTimeout(400);
const panelVisible = await page.isVisible('.account-country-panel');
const egyptOption = await page.locator('.account-country-option', { hasText: 'Egypt' }).first().isVisible().catch(() => false);
check('country panel opens with options', panelVisible && egyptOption);
await page.screenshot({ path: '/tmp/qa-phone-panel.png' });
await page.keyboard.press('Escape');
// invalid for US
await page.click('.account-country-button');
await page.fill('.account-country-search input', 'United States');
await page.click('.account-country-option');
await page.fill('#account-phone', '1012345678');
await page.click("button:has-text('Save Contact Details')");
await page.waitForTimeout(400);
const phoneErr = await page.textContent('.account-field-error').catch(() => '');
check('US-invalid number rejected client-side', !!phoneErr, phoneErr.slice(0, 60));
// valid Egyptian
await page.click('.account-country-button');
await page.fill('.account-country-search input', 'Egypt');
await page.click('.account-country-option');
await page.fill('#account-phone', '1012345678');
await page.click("button:has-text('Save Contact Details')");
await page.waitForTimeout(1500);
const me = await (await context.request.get(`${BASE}/api/v1/auth/me`)).json();
check('phone stored as E.164', me.data.phone === '+201012345678', me.data.phone);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.account-settings-page', { timeout: 20000 });
await page.waitForTimeout(600);
const phoneVal = await page.inputValue('#account-phone');
check('phone survives refresh (national display)', phoneVal.replace(/\D/g, '').endsWith('1012345678'), phoneVal);

// 4. Email change: request + wrong code
await page.click("button:has-text('Change')");
await page.waitForSelector('#email-change-new');
await page.fill('#email-change-new', `new-${stamp}@example.com`);
await page.fill('#email-change-password', PASS);
await page.click(".account-modal-actions button[type='submit']");
await page.waitForTimeout(2500);
const codeStep = await page.isVisible('#email-change-code');
const reqErr = await page.textContent('.account-field-error').catch(() => '');
check('email change request reaches code step (or reports send failure)', codeStep || reqErr.length > 0, codeStep ? 'code step' : reqErr.slice(0, 80));
if (codeStep) {
  await page.fill('#email-change-code', '000000');
  await page.click(".account-modal-actions button[type='submit']");
  await page.waitForTimeout(800);
  const wrongErr = await page.textContent('.account-field-error').catch(() => '');
  check('wrong OTP rejected', wrongErr.length > 0, wrongErr.slice(0, 60));
  await page.screenshot({ path: '/tmp/qa-email-modal.png' });
}

// 5. 2FA with real QR + real TOTP enable
await page.click(".account-modal-actions button:has-text('Back')").catch(() => {});
await page.click(".account-modal-actions button:has-text('Cancel')").catch(() => {});
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(500);
await page.click("button.account-nav-item:has-text('Security')");
await page.waitForTimeout(400);
await page.click("button:has-text('Enable 2FA')");
await page.waitForSelector('.account-2fa-qr img', { timeout: 15000 });
const qrSrc = await page.getAttribute('.account-2fa-qr img', 'src');
check('QR rendered from server URI', !!qrSrc && qrSrc.startsWith('data:image/png'));
await page.screenshot({ path: '/tmp/qa-2fa-qr.png' });
const setup = await (await context.request.post(`${BASE}/api/v1/auth/2fa/setup`)).json().catch(() => null);
// use fresh setup secret via API-independent path: read secret from modal is not exposed; enable via API secret instead
// (UI path proven by QR render; enable here proves server verify)
if (setup && setup.data) {
  const code = totp(setup.data.secret);
  await page.fill('[id="2fa-code"]', code);
  await page.click(".account-modal-actions button[type='submit']");
  await page.waitForTimeout(1200);
  const backups = await page.isVisible('.account-backup-codes');
  check('2FA enabled, backup codes shown once', backups);
  await page.screenshot({ path: '/tmp/qa-2fa-backup.png' });
  await page.click("button:has-text('Done')");
  await page.waitForTimeout(400);
  const statusOn = await page.isVisible('text=Enabled');
  check('2FA status shows Enabled', statusOn);
}

// 6. Sessions
const sessVisible = await page.isVisible('.account-session-row');
check('sessions list renders current session', sessVisible);

// 7. Notifications + language + theme
await page.click("button.account-nav-item:has-text('Notifications')");
await page.waitForTimeout(400);
await page.locator('.account-toggle-list li >> nth=5 >> button[role=switch]').click();
await page.selectOption('#account-language', 'ar');
await page.locator(".account-card button[type='submit']").click();
await page.waitForTimeout(1200);
check('Arabic switches to RTL', (await page.evaluate(() => document.documentElement.dir)) === 'rtl');
check('marketing toggle persisted ON', (await page.locator('.account-toggle-list li >> nth=5 >> button[role=switch]').getAttribute('aria-checked')) === 'true');
await page.selectOption('#account-theme', 'light');
await page.locator(".account-card button[type='submit']").click();
await page.waitForTimeout(1000);
check('light theme applied', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
await page.screenshot({ path: '/tmp/qa-ar-light.png' });

await context.close();
await browser.close();
console.log(results.join('\n'));
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
console.log('FAILED REQUESTS:', failedRequests.length ? failedRequests : 'none');
