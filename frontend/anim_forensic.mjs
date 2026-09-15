import { chromium, webkit } from 'playwright';

async function animForensic(name, browserType, headless) {
  console.log(`\n===== ${name} (headless=${headless}) =====`);
  const b = await browserType.launch({ headless });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('#hero-cta-start-manufacturing', { timeout: 30000 });
  await page.click('#hero-cta-start-manufacturing');
  await page.waitForSelector('.mw-workspace', { timeout: 20000 });

  // instrument samples on rAF
  await page.evaluate(() => {
    window.__samples = [];
    let reading = false;
    const start = performance.now();
    const source = () => {
      const lb = document.querySelector('.mw-entry-left-block');
      const st = document.querySelector('.mw-workspace')?.getAttribute('data-entry');
      if (!lb || !st) { requestAnimationFrame(source); return; }
      const r = lb.getBoundingClientRect();
      const cs = getComputedStyle(lb);
      const tr = cs.transform;
      window.__samples.push({ t: Math.round(performance.now() - start), stage: st, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, x: Math.round(r.x), scaleFromTransform: tr });
      requestAnimationFrame(source);
    };
    requestAnimationFrame(source);
  });

  // tech → process
  await page.waitForSelector('.mw-stage-tech-item', { timeout: 8000 });
  await page.click('.mw-stage-tech-item');
  await page.waitForFunction(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry') === 'process-focus', { timeout: 8000 });
  // Clear samples buffer before morph to capture a clean window
  await page.evaluate(() => { window.__samples = []; });
  await page.screenshot({ path: `/tmp/anim-${name}-process.png` });
  // morph: dispatch click on Next from page context (bypasses visibility checks)
  await page.evaluate(() => {
    const b = document.querySelector('.mw-stage-next-btn');
    if (b) { b.click(); }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/anim-${name}-morph-end.png` });

  const samples = await page.evaluate(() => window.__samples);
  // extract window around morph: samples roughly 0-1200ms after snapshot; filter those where stage<=morph
  const widths = [];
  let lastW = null;
  for (const s of samples) {
    if (s.stage === 'morph' || s.stage === 'upload-focus') {
      if (lastW !== null && s.w !== lastW) widths.push([s.t, s.w]);
      lastW = s.w;
    }
  }
  // distinct widths observed during morph window
  const morphSamples = samples.filter((s) => s.stage === 'process-focus' || s.stage === 'morph' || s.stage === 'upload-focus');
  const distinctWidths = [...new Set(morphSamples.map((s) => s.w))].slice(0, 25);
  console.log(`distinct widths across focus→morph→upload-focus (${morphSamples.length} samples):`);
  console.log(JSON.stringify(distinctWidths));

  // check transform continuity: any jumps in x?
  const xs = samples.filter((s) => s.stage === 'morph' || s.stage === 'upload-focus').map((s) => [s.t, s.x]);
  console.log(`x positions (t, x) during morph/upload-focus (first 30):`);
  console.log(JSON.stringify(xs.slice(0, 30)));

  await b.close();
}

await animForensic('Chrome', chromium, true);
await animForensic('WebKit-headless', webkit, true);
await animForensic('WebKit-headed', webkit, false);
process.exit(0);