import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

async function viewerCheck(name, browserType, headless, out) {
  const b = await browserType.launch({ headless });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('#hero-cta-start-manufacturing', { timeout: 30000 });
  await page.click('#hero-cta-start-manufacturing');
  await page.waitForSelector('.mw-workspace', { timeout: 20000 });
  await page.waitForSelector('.mw-stage-tech-item', { timeout: 8000 });
  await page.click('.mw-stage-tech-item');
  await page.waitForFunction(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry') === 'process-focus', { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.click('.mw-stage-process-chip');
  await page.waitForFunction(() => !!document.querySelector('.mw-stage-next-btn'), { timeout: 8000 });
  await page.evaluate(() => document.querySelector('.mw-stage-next-btn')?.click());
  await page.waitForFunction(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry') === 'upload-focus', { timeout: 10000 });

  // upload via payload with Safari-plausible MIME
  await page.setInputFiles('input[type=file]', { name: 'cube.stl', mimeType: 'model/stl', buffer: fs.readFileSync('/Users/mac/Desktop/CAM LABS/test-fixtures/tetrahedron.stl') });

  // wait for workspace settle
  for (let i = 0; i < 60 && (await page.evaluate(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry')) !== 'workspace'); i++) {
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2500); // allow WebGL first frame + thumbnail

  const info = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const canvas = canvases.find((c) => c.width > 80 && c.height > 40) || canvases[0];
    const viewer = document.querySelector('.geometry-module-header, [class*=geometry]');
    const thumbnail = document.querySelector('.mw-thumbnail canvas, [class*=thumb] canvas');
    let glInfo = null;
    if (canvas) {
      try {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          glInfo = { vendor: String(gl.getParameter(gl.VENDOR)).slice(0, 40), renderer: String(gl.getParameter(gl.RENDERER)).slice(0, 40), lost: gl.isContextLost() };
        } else {
          glInfo = { none: 'no webgl context' };
        }
      } catch (e) { glInfo = { err: String(e).slice(0, 60) }; }
    }
    return {
      entry: document.querySelector('.mw-workspace')?.getAttribute('data-entry'),
      canvasCount: canvases.length,
      canvas: canvas ? { w: canvas.width, h: canvas.height, cls: canvas.className } : null,
      glInfo,
      thumbnails: document.querySelectorAll('.mw-thumbnail canvas, [class*=thumb] canvas').length,
    };
  });

  await page.screenshot({ path: `${out}` });
  console.log(name, JSON.stringify(info));
  console.log(name, 'page errors:', errors.length ? errors : '(none)');
  await b.close();
}

await viewerCheck('Chrome', chromium, true, '/tmp/viewer-chrome.png');
await viewerCheck('WebKit', webkit, true, '/tmp/viewer-webkit.png');
process.exit(0);