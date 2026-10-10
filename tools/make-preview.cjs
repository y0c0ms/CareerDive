// node tools/make-preview.cjs [--frames 22] [--interval 380]
// Records the game and writes preview.gif (960x540, <= 3 MB, palette optimised, looping) and preview.png (1200x630 social card) into the project root.
// Needs puppeteer-core (PUPPETEER_CORE=/path/to/puppeteer-core), chromium and ffmpeg. GitHub data comes from the bundled snapshot.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const { ROOT, serve, launch, intercept, hookReady, sleep } = require('./lib.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const FRAMES = arg('frames', 22), INTERVAL = arg('interval', 380), HIDE_HUD = '#hud,#loading{display:none !important}';

async function open(browser, url, w, h) {
  const page = await browser.newPage(); await intercept(page); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' }); await hookReady(page); await page.addStyleTag({ content: HIDE_HUD });
  await page.evaluate(() => window.__test.godMode(true)); return page;
}

(async () => {
  const { srv, url } = await serve(), browser = await launch(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-preview-'));
  try {
    // ---- GIF: the diver swims right through the reef; the route follows gate gaps and keeps clear of shrines so no popup opens
    const page = await open(browser, url, 960, 540);
    const route = await page.evaluate(() => {
      const t = window.__test, sh = t.shrines(), ob = t.obstacles(), gates = [];
      for (let i = 0; i + 1 < ob.length; i += 2) gates.push({ x: ob[i].x + ob[i].w / 2, c: (ob[i].h + ob[i + 1].y) / 2 });
      return { shrines: sh, gates, W: t.worldSize().width };
    });
    const x0 = Math.max(240, route.shrines[0].x - 1700), step = 430;
    const yAt = x => {
      let y = 420, best = 1e9;
      for (const g of route.gates) { const d = Math.abs(g.x - x); if (d < 520 && d < best) { best = d; y = g.c; } }
      for (const s of route.shrines) if (Math.abs(s.x - x) < 520) y = s.y > 450 ? Math.max(200, s.y - 330) : Math.min(690, s.y + 330);
      return y;
    };
    let y = yAt(x0); await page.evaluate((x, y) => window.__test.teleport(x, y), x0, y); await sleep(600);
    await page.keyboard.down('d');
    for (let i = 0; i < FRAMES; i++) {
      const t0 = Date.now(), st = await page.evaluate(() => window.__test.state());
      const ty = yAt(st.x + 260); y += (ty - y) * 0.45;
      await page.evaluate((x, y) => window.__test.teleport(x, y), st.x + (i ? step : 0) * 0.5, Math.round(y));
      await sleep(40);
      await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(3, '0')}.png`) });
      await sleep(Math.max(0, INTERVAL - (Date.now() - t0)));
    }
    await page.keyboard.up('d'); await page.close();
    const gif = path.join(ROOT, 'preview.gif');
    const run = colors => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '9', '-i', path.join(tmp, 'f%03d.png'), '-vf',
      `split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', gif]);
    let colors = 96; run(colors);
    while (fs.statSync(gif).size > 3 * 1024 * 1024 && colors > 24) { colors -= 24; run(colors); }
    console.log('preview.gif', (fs.statSync(gif).size / 1048576).toFixed(2) + ' MB', colors + ' colours', FRAMES + ' frames');

    // ---- PNG: 3x pixel scale (1440x810), centre-cropped to the 1200x630 social card size, diver just outside the first shrine's popup radius
    const big = await open(browser, url, 1440, 810);
    const sh = route.shrines[Math.min(1, route.shrines.length - 1)];
    await big.evaluate((x, y) => window.__test.teleport(x, y), sh.x - 330, Math.min(620, Math.max(260, sh.y)));
    await sleep(2500);
    await big.screenshot({ path: path.join(ROOT, 'preview.png'), clip: { x: 120, y: 90, width: 1200, height: 630 } });
    await big.close();
    console.log('preview.png', (fs.statSync(path.join(ROOT, 'preview.png')).size / 1024).toFixed(0) + ' KB 1200x630');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exit(1); });
