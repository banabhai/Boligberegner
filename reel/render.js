// Render the reel to a 1080x1920 MP4.
// Usage: node render.js <ejer|andel> <price> <out.mp4>
// Needs: npm ci, npx playwright install chromium, ffmpeg on PATH.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const [mode, price, out] = process.argv.slice(2);
if (!['ejer', 'andel'].includes(mode) || !(+price > 0 && +price <= 1e9) || !out || !out.endsWith('.mp4')) {
  console.error('Usage: node render.js <ejer|andel> <price> <out.mp4>');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.addInitScript(() => { window.__RENDER = true; }); // stops the live player loop
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  // The page loads its own fonts from ../fonts; wait until every face is ready.
  await page.evaluate(async () => {
    for (const f of ['700 40px "Archivo Narrow"', '600 40px "Archivo Narrow"', '500 40px "IBM Plex Mono"',
      '400 40px "IBM Plex Mono"', '400 40px "Public Sans"', '600 40px "Public Sans"', '700 40px "Public Sans"',
      'italic 400 40px "Public Sans"']) await document.fonts.load(f);
  });
  await page.evaluate(([m, p]) => window.__set(m === 'ejer' ? { mode: m, price: +p } : { mode: m, aprice: +p }), [mode, price]);

  const fps = 30, frames = (await page.evaluate(() => window.__DUR)) * fps;
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  const done = new Promise((ok, fail) => ff.on('close', c => (c === 0 ? ok() : fail(new Error('ffmpeg exit ' + c)))));

  for (let i = 0; i < frames; i++) {
    const url = await page.evaluate(t => { window.__draw(t); return document.getElementById('cv').toDataURL('image/jpeg', 0.93); }, i / fps);
    if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log('Wrote', out);
})().catch(e => { console.error(e); process.exit(1); });
