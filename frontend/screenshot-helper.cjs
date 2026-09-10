const WebSocket = require('ws');
const http = require('http');

const url = process.argv[2] || 'http://localhost:9222/json';
const outFile = process.argv[3] || '/tmp/mfg-page.png';
const port = process.argv[4] || '3002';

http.get(url, (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    const targets = JSON.parse(data);
    const page = targets.find((t) => t.type === 'page');
    if (!page) { console.error('No page target'); process.exit(1); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (method, params = {}) => {
      const reqId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    };
    ws.on('message', (msg) => {
      const m = JSON.parse(msg);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p.reject(m.error);
        else p.resolve(m.result);
      }
    });
    ws.on('open', async () => {
      try {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
        await new Promise((r) => setTimeout(r, 2500));
        // Click "Start Manufacturing"
        await send('Runtime.evaluate', {
          expression: `(function(){const b=Array.from(document.querySelectorAll('button,a')).find(x=>/start\\s*manufacturing/i.test(x.textContent||''));if(b){b.click();return 'clicked';}return 'not-found';})()`,
          returnByValue: true,
        });
        await new Promise((r) => setTimeout(r, 2500));
        // Select 3D Printing
        await send('Runtime.evaluate', {
          expression: `(function(){const i=Array.from(document.querySelectorAll('.mw-tech-item')).find(x=>/3d\\s*printing/i.test(x.textContent||''));if(i){i.click();return 'tech';}return 'no';})()`,
          returnByValue: true,
        });
        await new Promise((r) => setTimeout(r, 700));
        // Select FDM Printing
        await send('Runtime.evaluate', {
          expression: `(function(){const i=Array.from(document.querySelectorAll('.mw-tech-item')).find(x=>/fdm\\s*printing/i.test(x.textContent||''));if(i){i.click();return 'proc';}return 'no';})()`,
          returnByValue: true,
        });
        await new Promise((r) => setTimeout(r, 1500));
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: 1000, scale: 1 } });
        require('fs').writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
        console.log('Saved:', outFile);
        ws.close();
        process.exit(0);
      } catch (e) { console.error('Error:', e); process.exit(1); }
    });
    ws.on('error', (e) => { console.error('WS:', e.message); process.exit(1); });
  });
});
