import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

async function pixelCheck(name, browserType) {
  const b = await browserType.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('#hero-cta-start-manufacturing', { timeout: 30000 });
  await page.click('#hero-cta-start-manufacturing');
  await page.waitForSelector('.mw-workspace', { timeout: 20000 });
  // navigate to upload-focus via DOM clicks (bypasses visibility gating of detached/hidden phases)
  await page.waitForSelector('.mw-stage-tech-item', { timeout: 8000 });
  await page.evaluate(() => document.querySelector('.mw-stage-tech-item')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('.mw-stage-process-chip')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = document.querySelector('.mw-stage-next-btn'); if (b) b.click(); });
  await page.waitForTimeout(800);
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({ name: 'cube.stl', mimeType: 'model/stl', buffer: fs.readFileSync('/Users/mac/Desktop/CAM LABS/test-fixtures/tetrahedron.stl') });
  for (let i = 0; i < 60; i++) {
    const entry = await page.evaluate(() => document.querySelector('.mw-workspace')?.getAttribute('data-entry'));
    if (entry === 'workspace') break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const canvas = [...document.querySelectorAll('canvas')][0];
    if (!canvas) return { noCanvas: true };
    let out = {};
    if (canvas.getContext) {
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl && gl.readPixels) {
        const w = canvas.width, h = canvas.height;
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let nonBg = 0, uniq = new Set();
        for (let i = 0; i < px.length; i += 16) { uniq.add(px[i] * 256 + px[i + 1]); }
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i], g = px[i + 1], b = px[i + 2];
          if (r + g + b < 200 || (r > 60 || g > 60 || b > 60)) nonBg++;
        }
        out = { w, h, uniqueColors: uniq.size, nonBgRatio: (nonBg / (px.length / 4)).toFixed(3) };
      } else {
        out.none = 'no readPixels';
      }
    }
    return out;
  });
  console.log(name, JSON.stringify(result));
  await b.close();
}
await pixelCheck('Chrome', chromium);
await pixelCheck('WebKit', webkit);
process.exit(0);
