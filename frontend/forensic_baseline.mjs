import { chromium, webkit } from 'playwright';

const STEEL = '/Users/mac/Desktop/CAM LABS/test-fixtures/tetrahedron.stl';
const RESULTS = {};

async function runSuite(name, browserType, launchOptions = {}) {
  console.log(`\n========== ${name} ==========`);
  const b = await browserType.launch({ headless: true, ...launchOptions });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleLog = [];
  const errors = [];
  page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text().slice(0, 200) }));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  // ── A. Prefers reduced motion + basic compat check ──
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('#hero-cta-start-manufacturing', { timeout: 30000 });

  const compatible = await page.evaluate(() => ({
    uagent: navigator.userAgent,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hasCryptoRandomUUID: typeof crypto.randomUUID === 'function',
    hasWebGL: !!document.createElement('canvas').getContext('webgl2') || !!document.createElement('canvas').getContext('webgl'),
    hasFormData: typeof FormData === 'function',
    hasFetch: typeof fetch === 'function',
    hasXhr: typeof XMLHttpRequest === 'function',
    hasAbortController: typeof AbortController === 'function',
    hasFileReader: typeof FileReader === 'function',
    hasArrayBufferOnBlob: typeof Blob.prototype.arrayBuffer === 'function',
    hasURL: typeof URL.createObjectURL === 'function',
  }));
  console.log('compat:', JSON.stringify(compatible));

  // ── B. Frame + stage timeline ──
  await page.evaluate(() => {
    window.__stages = [];
    window.__frames = [];
    window.__rects = {};
    let lastStage = '';
    const loop = (t2) => {
      const ws = document.querySelector('.mw-workspace');
      const entry = ws ? ws.getAttribute('data-entry') : null;
      if (entry && entry !== lastStage) {
        lastStage = entry;
        window.__stages.push({ stage: entry, t: t2 });
        const lb = document.querySelector('.mw-entry-left-block');
        if (lb) {
          const r = lb.getBoundingClientRect();
          window.__rects[entry] = { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
        }
      }
      window.__frames.push(t2);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  // ── C. Start Manufacturing → navigate flow ──
  const t0 = Date.now();
  await page.click('#hero-cta-start-manufacturing');
  console.log(`[t+0] clicked Start Manufacturing`);

  // Wait for workspace to mount
  await page.waitForSelector('.mw-workspace', { timeout: 20000 });
  console.log(`[t+${Date.now()-t0}] workspace mounted`);

  // Wait for tech-focus (entryStage is initially tech-focus)
  await page.waitForFunction(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry') === 'tech-focus', { timeout: 10000 });
  console.log(`[t+${Date.now()-t0}] tech-focus`);

  // Click first tech item
  await page.waitForSelector('.mw-stage-tech-item', { timeout: 5000 });
  await page.click('.mw-stage-tech-item');
  console.log(`[t+${Date.now()-t0}] clicked tech item`);

  // Wait for process-focus
  await page.waitForFunction(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry') === 'process-focus', { timeout: 10000 });
  console.log(`[t+${Date.now()-t0}] process-focus`);

  // Click first process chip
  await page.waitForSelector('.mw-stage-process-chip', { timeout: 5000 });
  await page.click('.mw-stage-process-chip');
  console.log(`[t+${Date.now()-t0}] clicked process chip`);
  await page.waitForTimeout(400);

  // Click Next to trigger morph
  await page.waitForSelector('.mw-stage-next-btn', { timeout: 8000 });
  await page.click('.mw-stage-next-btn');
  console.log(`[t+${Date.now()-t0}] clicked Next (morph)`);

  // Wait for morph → upload-focus
  await page.waitForFunction(() => {
    const e = document.querySelector('.mw-workspace')?.getAttribute('data-entry');
    return e === 'morph' || e === 'upload-focus';
  }, { timeout: 10000 });
  const stageAfterProcess = await page.evaluate(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry'));
  console.log(`[t+${Date.now()-t0}] after process: ${stageAfterProcess}`);

  // Wait for upload-focus
  await page.waitForFunction(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry') === 'upload-focus', { timeout: 10000 });
  console.log(`[t+${Date.now()-t0}] upload-focus`);

  // Wait a bit for animations to settle
  await page.waitForTimeout(800);

  // ── D. Upload file ──
  console.log(`[t+${Date.now()-t0}] uploading file...`);
  const fileInput = await page.$('input[type=file]');
  if (fileInput) {
    await fileInput.setInputFiles(STEEL);
    console.log(`[t+${Date.now()-t0}] file set`);
  } else {
    console.log('ERROR: no file input found');
  }

  // Watch for upload stages
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const entry = await page.evaluate(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry'));
    const uploadState = await page.evaluate(() => {
      const el = document.querySelector('.mw-panel-upload');
      return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 120) : 'NO_PANEL';
    });
    console.log(`[t+${Date.now()-t0}] entry=${entry} uploadPanel=${uploadState.slice(0, 80)}`);
    if (entry === 'workspace') break;
  }

  // ── E. Check post-upload state ──
  await page.waitForTimeout(1000);
  const postState = await page.evaluate(() => {
    const ws = document.querySelector('.mw-workspace');
    const canvas = document.querySelector('canvas');
    const lb = document.querySelector('.mw-entry-left-block');
    const rect = lb ? lb.getBoundingClientRect() : null;
    return {
      entry: ws?.getAttribute('data-entry'),
      canvasPresent: !!canvas,
      canvasW: canvas ? canvas.width : 0,
      canvasH: canvas ? canvas.height : 0,
      leftBlockW: rect ? Math.round(rect.width) : 0,
      leftBlockH: rect ? Math.round(rect.height) : 0,
    };
  });
  console.log(`post-upload:`, JSON.stringify(postState));

  // ── F. Collect timeline ──
  await page.waitForTimeout(500);
  const timeline = await page.evaluate(() => ({
    stages: window.__stages,
    rects: window.__rects,
    frameCount: window.__frames.length,
  }));
  console.log(`stages:`, JSON.stringify(timeline.stages));
  console.log(`rects:`, JSON.stringify(timeline.rects));
  console.log(`total frames: ${timeline.frameCount}`);

  // ── G. Delete file ──
  const deleteBtn = await page.$('.mw-file-delete-btn');
  if (deleteBtn) {
    await deleteBtn.click();
    console.log('clicked delete');
    // confirm
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.mw-btn')];
      const rm = btns.find(b => b.textContent.trim() === 'Remove');
      if (rm) rm.click();
    });
    await page.waitForTimeout(1000);
    const afterDelete = await page.evaluate(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry'));
    console.log('after delete entry:', afterDelete);
  }

  // ── H. Console errors (filter 401) ──
  const realErrors = consoleLog.filter(l => l.type === 'error' && !l.text.includes('401'));
  console.log(`console errors (${realErrors.length}):`, realErrors.map(e => e.text));
  console.log(`page errors (${errors.length}):`, errors);
  RESULTS[name] = { compat: compatible, timeline, postState, errors, consoleErrors: realErrors };

  await b.close();
}

await runSuite('Chrome', chromium);
await runSuite('WebKit', webkit);
process.exit(0);