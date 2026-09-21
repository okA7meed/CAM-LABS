import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const EMAIL = 'qa-1789955654676@example.com';
const PASS = 'QaPass12';
const errors = [];
const failedRequests = [];
const results = [];
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

const browser = await chromium.launch();

// Seed API counts for the data matrix
const probeCtx = await browser.newContext();
const probe = probeCtx.request;
const loginProbe = await probe.post(`${BASE}/api/v1/auth/login`, { data: { email: EMAIL, password: PASS } });
if (!loginProbe.ok()) throw new Error('seed login failed: ' + (await loginProbe.text()).slice(0, 200));
console.log('probe login ok');
const ro = await probe.get(`${BASE}/api/v1/orders`);
const rq = await probe.get(`${BASE}/api/v1/quotes`);
console.log('orders status:', ro.status(), 'quotes status:', rq.status());
const apiOrders = await ro.json();
const apiQuotes = await rq.json();
const count = (list, pred) => list.data.filter(pred).length;
const apiMatrix = {
  ordersTotal: apiOrders.data.length,
  inReview: count(apiOrders, (o) => o.status === 'In Review'),
  inProduction: count(apiOrders, (o) => o.status === 'In Production'),
  quality: count(apiOrders, (o) => o.status === 'Quality Inspection'),
  delivered: count(apiOrders, (o) => o.status === 'Delivered'),
  quotesTotal: apiQuotes.data.length,
  ready: count(apiQuotes, (q) => q.status === 'Ready for Approval'),
  pending: count(apiQuotes, (q) => q.status === 'Draft' || q.status === 'Revised'),
  approved: count(apiQuotes, (q) => q.status === 'Approved'),
  rejected: count(apiQuotes, (q) => q.status === 'Rejected'),
};
console.log('API MATRIX:', JSON.stringify(apiMatrix));

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('style property')) errors.push(msg.text().slice(0, 160)); });
page.on('response', (res) => { if (res.status() >= 400 && !res.url().includes('viewer-asset')) failedRequests.push(`${res.status()} ${res.url().slice(0, 100)}`); });

await context.request.post(`${BASE}/api/v1/auth/login`, { data: { email: EMAIL, password: PASS } });
await page.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForSelector('.dash-page', { timeout: 20000 });
await page.waitForTimeout(1000);

// Data matrix: DOM vs API
const domNum = async (sel) => Number((await page.textContent(sel)).trim());
const dom = {
  ordersTotal: await domNum('.dash-orders .dash-stat.is-blue .dash-stat-value'),
  inReview: await domNum('.dash-orders .dash-stat.is-amber .dash-stat-value'),
  inProduction: await domNum('.dash-orders .dash-stat.is-cyan .dash-stat-value'),
  quality: await domNum('.dash-orders .dash-stat.is-purple .dash-stat-value'),
  delivered: await domNum('.dash-orders .dash-stat.is-green .dash-stat-value'),
  quotesTotal: await domNum('.dash-quotes .dash-stat.is-purple .dash-stat-value'),
  ready: await domNum('.dash-quotes .dash-stat.is-blue .dash-stat-value'),
  pending: await domNum('.dash-quotes .dash-stat.is-amber .dash-stat-value'),
  approved: await domNum('.dash-quotes .dash-stat.is-green .dash-stat-value'),
  rejected: await domNum('.dash-quotes .dash-stat.is-red .dash-stat-value'),
};
for (const k of Object.keys(apiMatrix)) check(`counter ${k}: API=${apiMatrix[k]} DOM=${dom[k]}`, apiMatrix[k] === dom[k]);
check('welcome uses first name', (await page.textContent('.dash-welcome h1')).includes('Qa'));

const orderRows = await page.locator('.dash-orders .dash-row').count();
const quoteRows = await page.locator('.dash-quotes .dash-row').count();
check('recent orders capped at 5', orderRows === 5, String(orderRows));
check('recent quotes capped at 5', quoteRows === 5, String(quoteRows));
check('orders have NO delete buttons', (await page.locator('.dash-orders button.account-btn-danger-ghost').count()) === 0);
const quoteDeletes = await page.locator('.dash-quotes button.account-btn-danger-ghost').count();
check('eligible quotes show delete', quoteDeletes > 0, String(quoteDeletes));
await page.screenshot({ path: '/tmp/qa-dashboard.png' });

// Quote detail modal
await page.locator('.dash-quotes .dash-row').first().locator("button:has-text('View Details')").click();
await page.waitForTimeout(600);
check('quote detail modal opens with reference', await page.isVisible('.dash-detail-ref'));
await page.screenshot({ path: '/tmp/qa-quote-detail.png' });
await page.click(".account-modal-actions button:has-text('Close')");

// Delete flow: cancel first
const draftRow = page.locator('.dash-quotes .dash-row', { hasText: 'Bracket-2' });
await draftRow.locator('button.account-btn-danger-ghost').click();
await page.waitForTimeout(400);
check('delete dialog shows reference context', await page.isVisible('.dash-delete-context'));
await page.click(".account-modal-actions button:has-text('Cancel')");
await page.waitForTimeout(300);
check('cancel keeps the row', (await page.locator('.dash-quotes .dash-row', { hasText: 'Bracket-2' }).count()) === 1);

// Delete success: Draft quote Bracket-2
await draftRow.locator('button.account-btn-danger-ghost').click();
await page.waitForTimeout(400);
await page.click(".account-modal-actions button:has-text('Delete Quote')");
await page.waitForTimeout(1500);
const quotesAfter = await domNum('.dash-quotes .dash-stat.is-purple .dash-stat-value');
const pendingAfter = await domNum('.dash-quotes .dash-stat.is-amber .dash-stat-value');
const ordersAfter = await domNum('.dash-orders .dash-stat.is-blue .dash-stat-value');
check('total quotes decremented', quotesAfter === apiMatrix.quotesTotal - 1, `${apiMatrix.quotesTotal}→${quotesAfter}`);
check('pending decremented', pendingAfter === apiMatrix.pending - 1, `${apiMatrix.pending}→${pendingAfter}`);
check('orders unchanged by quote delete', ordersAfter === apiMatrix.ordersTotal, String(ordersAfter));
check('deleted row gone', (await page.locator('.dash-quotes .dash-row', { hasText: 'Bracket-2' }).count()) === 0);

// Protected quote: direct API must 409
const approved = apiQuotes.data.find((q) => q.status === 'Approved');
const prot = await context.request.delete(`${BASE}/api/v1/quotes/${approved.id}`);
check('converted quote protected (409)', prot.status() === 409, String(prot.status()));
const foreign = await context.request.delete(`${BASE}/api/v1/quotes/q-does-not-exist`);
check('unknown quote 404', foreign.status() === 404, String(foreign.status()));

// Navigation: order details, view-alls, CTAs
await page.locator('.dash-orders .dash-row').first().locator("button:has-text('View Details')").click();
await page.waitForTimeout(1200);
check('order View Details opens orders detail', (page.url().includes('#/orders')) && (await page.isVisible('.oc-detail, [class*="detail"]')));
await page.screenshot({ path: '/tmp/qa-order-detail.png' });
await page.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.click(".dash-orders .dash-head-cta");
await page.waitForTimeout(800);
check('View All Orders → orders view', page.url().includes('#/orders') && (await page.isVisible('.order-center')));
await page.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.click(".dash-quotes .dash-head-cta");
await page.waitForTimeout(800);
check('View All Quotes → quotes view', page.url().includes('#/quotes'));
await page.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.click(".dash-cta button:has-text('Contact Support')");
await page.waitForTimeout(800);
check('Contact Support → contact view', page.url().includes('#/contact'));
await page.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.click(".dash-cta button:has-text('New Manufacturing Request')");
await page.waitForTimeout(1500);
check('New Manufacturing Request → workspace', page.url().includes('#/manufacturing-request'));

// Empty states with a fresh user
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const email2 = `empty-${Date.now()}@example.com`;
await ctx2.request.post(`${BASE}/api/v1/auth/register`, { data: { name: 'Empty User', email: email2, password: 'EmptyPass12', phone: '+201012345678' } });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await p2.waitForSelector('.dash-page', { timeout: 20000 });
await p2.waitForTimeout(1000);
check('empty orders state with CTA', await p2.isVisible('text=You have no manufacturing orders yet'));
check('empty quotes state with CTA', await p2.isVisible('text=You have no quotation requests yet'));
await p2.screenshot({ path: '/tmp/qa-dashboard-empty.png' });
await ctx2.close();

await context.close();
await browser.close();
console.log(results.join('\n'));
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
console.log('FAILED REQUESTS:', failedRequests.length ? failedRequests : 'none');
