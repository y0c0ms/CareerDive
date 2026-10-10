#!/usr/bin/env node
/* Deep Diver verification. One command, honest results.
 *
 *   node tools/verify.cjs                 (run from the project root; serves the current folder itself)
 *   node tools/verify.cjs --out verify-out --sizes 1280x720,1920x1080
 *   node tools/verify.cjs --image path.png    (only print pixel statistics of an image)
 *
 * It starts a static server for the folder, opens the game in headless Chromium, answers every GitHub request from the recorded
 * fixtures in ../data (the bundled offline snapshot) (the real API is rate limited), and checks the game through the `window.__test` hook described in PROMPT.md.
 * Screenshots go to the output folder; the JSON report is printed and saved as report.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const ROOT = path.resolve(opt('root', process.cwd()));
const OUT = path.resolve(opt('out', path.join(ROOT, 'verify-out')));
const FIX = path.resolve(opt('fixtures', path.join(__dirname, '..', 'data')));
const SIZES = opt('sizes', '1280x720,1920x1080').split(',').map((s) => s.split('x').map(Number));
const CHROME = process.env.CHROME || '/usr/bin/chromium-browser';
const IMAGE_ONLY = opt('image', null);
const QUIET = argv.includes('--quiet');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { if (!QUIET) console.error(...a); };

// ---------------------------------------------------------------- static server
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain', '.md': 'text/markdown' };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

// ---------------------------------------------------------------- GitHub fixtures
const repos = fs.existsSync(path.join(FIX, 'repos.json')) ? JSON.parse(fs.readFileSync(path.join(FIX, 'repos.json'), 'utf8')) : [];
const readmeIndex = fs.existsSync(path.join(FIX, 'readme-index.json')) ? JSON.parse(fs.readFileSync(path.join(FIX, 'readme-index.json'), 'utf8')) : {};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,OPTIONS' };
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function setupInterception(page, external) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return req.continue();
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return req.continue();
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS });
    if (u.hostname === 'api.github.com') {
      if (/^\/users\/[^/]+\/repos/.test(u.pathname)) return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(repos) });
      const m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/readme/);
      if (m) {
        const e = readmeIndex[m[1]];
        if (e && e.status === 200) return req.respond({ status: 200, contentType: 'text/plain; charset=utf-8', headers: CORS, body: fs.readFileSync(path.join(FIX, 'readme', e.file)) });
        return req.respond({ status: 404, contentType: 'application/json', headers: CORS, body: '{"message":"Not Found"}' });
      }
      return req.respond({ status: 404, contentType: 'application/json', headers: CORS, body: '{"message":"Not Found"}' });
    }
    if (u.hostname === 'raw.githubusercontent.com') return req.respond({ status: 200, contentType: 'image/png', headers: CORS, body: PNG1 });
    // anything else on the internet: answer empty so the page does not error, but remember it (PROMPT.md forbids network assets)
    external.add(u.hostname + u.pathname.slice(0, 40));
    return req.respond({ status: 200, contentType: 'text/plain', headers: CORS, body: '' });
  });
}

// ---------------------------------------------------------------- pixel statistics (computed in a blank page from a PNG)
async function pixelStats(browser, png) {
  const p = await browser.newPage();
  try {
    return await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      const key = (i) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      const counts = new Map(); let n = 0, sumL = 0, sumL2 = 0, sat = 0;
      const bands = new Array(8).fill(0), bandN = new Array(8).fill(0); const hue = new Array(12).fill(0); let hueN = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
        const k = key(i); counts.set(k, (counts.get(k) || 0) + 1); n++;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sumL += L; sumL2 += L * L; const bi = Math.min(7, Math.floor((y / h) * 8)); bands[bi] += L; bandN[bi]++;
        const s = mx ? (mx - mn) / mx : 0; if (s > 0.6 && mx > 158) sat++; // vivid = bright AND saturated (corals), not the teal water
        if (s > 0.25 && mx > 60) { let hh; if (mx === r) hh = ((g - b) / (mx - mn)) % 6; else if (mx === g) hh = (b - r) / (mx - mn) + 2; else hh = (r - g) / (mx - mn) + 4; hh = (hh * 60 + 360) % 360; hue[Math.floor(hh / 30) % 12]++; hueN++; }
      }
      const sorted = [...counts.values()].sort((a, b) => b - a);
      const top16 = sorted.slice(0, 16).reduce((a, b) => a + b, 0) / n;
      const significant = sorted.filter((v) => v / n >= 0.003).length;
      // edges: how often neighbouring pixels differ, and how many of those differences are tiny (anti-aliasing / alpha gradients / blur)
      let tot = 0, nz = 0, soft = 0;
      for (let y = 0; y < h; y += 2) for (let x = 1; x < w; x++) {
        const i = (y * w + x) * 4, j = i - 4; tot++;
        const df = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
        if (df) { nz++; if (df < 24) soft++; }
      }
      // integer-scaling: share of aligned k x k blocks that are one flat colour
      const blocks = {};
      for (const k of [1, 2, 3, 4, 5, 6, 8]) { let u = 0, t = 0; for (let by = 0; by + k <= h; by += k * 7) for (let bx = 0; bx + k <= w; bx += k * 7) { t++; const c0 = key((by * w + bx) * 4); let ok = true; for (let yy = 0; yy < k && ok; yy++) for (let xx = 0; xx < k; xx++) if (key(((by + yy) * w + bx + xx) * 4) !== c0) { ok = false; break; } if (ok) u++; } blocks[k] = +(u / Math.max(1, t)).toFixed(3); }
      let pixelBlock = 1; for (const k of [8, 6, 5, 4, 3, 2]) if (blocks[k] >= 0.8) { pixelBlock = k; break; }
      const mean = sumL / n;
      return { w, h, distinctColors: counts.size, significantColors: significant, top16Share: +top16.toFixed(3), edgeRate: +(nz / tot).toFixed(3),
        softEdgeShare: +(soft / Math.max(1, nz)).toFixed(3), blocks, pixelBlock, vividShare: +(sat / n).toFixed(3), meanLuma: +mean.toFixed(1),
        lumaStd: +Math.sqrt(Math.max(0, sumL2 / n - mean * mean)).toFixed(1), bandLuma: bands.map((v, i) => +(v / bandN[i]).toFixed(0)),
        hueBins: hue.filter((v) => hueN && v / hueN >= 0.03).length };
    }, png.toString('base64'));
  } finally { await p.close(); }
}

// ---------------------------------------------------------------- helpers
const checks = [];
const check = (id, pass, detail) => { checks.push({ id, pass: !!pass, detail }); log((pass ? '  PASS ' : '  FAIL ') + id + (detail ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); };
async function tap(page, key, ms = 140) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }
const T = (page, fn, ...a) => page.evaluate(fn, ...a);
const state = (page) => T(page, () => (window.__test && window.__test.state) ? window.__test.state() : null);
async function waitFor(fn, ms = 4000, step = 100) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (e) { /* retry */ } if (Date.now() - t0 > ms) return null; await sleep(step); } }
const popupVisible = (page) => T(page, () => { const m = document.getElementById('modal'); if (!m) return null; const cs = getComputedStyle(m); const r = m.getBoundingClientRect(); return { open: !m.classList.contains('hidden') && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 40 && r.height > 40, text: (m.innerText || '').slice(0, 4000) }; });

// ---------------------------------------------------------------- main
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const report = { root: ROOT, startedAt: new Date().toISOString(), sizes: SIZES.map((s) => s.join('x')), checks, stats: {}, shots: [], notes: [] };
  try {
    if (IMAGE_ONLY) { const st = await pixelStats(browser, fs.readFileSync(IMAGE_ONLY)); console.log(JSON.stringify(st, null, 1)); await browser.close(); process.exit(0); }
    if (!fs.existsSync(path.join(ROOT, 'index.html'))) { check('index.html exists', false, ROOT); throw new Error('no index.html in ' + ROOT); }
    const { srv, port } = await startServer();
    const url = `http://127.0.0.1:${port}/`;
    const nonFork = repos.filter((r) => !r.fork);

    for (let si = 0; si < SIZES.length; si++) {
      const [W, H] = SIZES[si]; const tag = `${W}x${H}`; const primary = si === 0;
      log(`\n== ${tag} ==`);
      const page = await browser.newPage();
      const errors = [], external = new Set();
      page.on('pageerror', (e) => errors.push('pageerror: ' + (e.message || String(e)).slice(0, 300)));
      page.on('console', (m) => { if (m.type() === 'error') { const u = (m.location() && m.location().url) || ''; if (/\/readme|favicon/.test(u)) return; errors.push('console.error: ' + m.text().slice(0, 300)); } });
      await setupInterception(page, external);
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      const t0 = Date.now();
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      const hooked = await waitFor(() => T(page, () => !!(window.__test && window.__test.state && window.__test.state())), 12000);
      const loadMs = Date.now() - t0;
      await sleep(2500);

      // ---- canvas fills the window, no bars, no scrollbars
      const lay = await T(page, () => {
        const cs = [...document.querySelectorAll('canvas')]; const c = cs.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
        if (!c) return null; const r = c.getBoundingClientRect(); const de = document.documentElement;
        return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], win: [innerWidth, innerHeight], scroll: [de.scrollWidth, de.scrollHeight], buffer: [c.width, c.height], css: c.style.imageRendering || getComputedStyle(c).imageRendering };
      });
      if (!lay) check(`[${tag}] a canvas exists`, false);
      else {
        const [l, t, w, h] = lay.rect; const tol = 6;
        const fits = l <= tol && t <= tol && Math.abs(w - W) <= tol && Math.abs(h - H) <= tol;
        check(`[${tag}] canvas fills the window (no bars)`, fits, `canvas ${w}x${h} at ${l},${t} in window ${W}x${H}`);
        check(`[${tag}] no page scrollbars`, lay.scroll[0] <= W + 1 && lay.scroll[1] <= H + 1, `scroll size ${lay.scroll.join('x')}`);
        if (primary) report.stats.canvas = lay;
      }
      check(`[${tag}] window.__test hook present`, hooked, hooked ? `loaded in ${loadMs} ms` : 'window.__test.state() never returned');

      // ---- what is on screen
      const shotPath = path.join(OUT, `shot-${tag}-start.png`);
      const png = await page.screenshot({ type: 'png' }); fs.writeFileSync(shotPath, png); report.shots.push({ size: tag, name: 'start', file: path.basename(shotPath) });
      const st = await pixelStats(browser, png); if (primary) report.stats.start = st; else report.stats['start-' + tag] = st;
      check(`[${tag}] screen is not blank`, st.significantColors >= 8 && st.lumaStd > 8 && st.meanLuma > 30 && st.meanLuma < 220, `${st.significantColors} significant colours, luma std ${st.lumaStd}, mean luma ${st.meanLuma}`);

      if (primary && hooked) {
        // ---- world + movement
        const ws = await T(page, () => window.__test.worldSize && window.__test.worldSize());
        report.stats.world = ws;
        check('worldSize() returns width/height', ws && ws.width > 0 && ws.height > 0, ws);
        await T(page, () => window.__test.godMode && window.__test.godMode(true));
        const s0 = await state(page);
        await page.keyboard.down('d'); await sleep(1600); await page.keyboard.up('d'); const s1 = await state(page);
        check('holding D moves the diver right', s1 && s0 && s1.x - s0.x > 120, `x ${s0 && s0.x} -> ${s1 && s1.x}`);
        await page.keyboard.down('a'); await sleep(1100); await page.keyboard.up('a'); const s2 = await state(page);
        check('holding A moves the diver left', s2 && s1 && s1.x - s2.x > 60, `x ${s1 && s1.x} -> ${s2 && s2.x}`);
        const yBefore = (await state(page)).y; await page.keyboard.down('w'); await sleep(700); await page.keyboard.up('w'); const yUp = (await state(page)).y;
        check('holding W swims up', yUp < yBefore - 15, `y ${yBefore} -> ${yUp}`);
        const idle0 = await state(page); await sleep(1500); const idle1 = await state(page);
        check('with no key the diver does not drift sideways', Math.abs(idle1.x - idle0.x) < 12, `x ${idle0.x} -> ${idle1.x}`);

        // ---- shrines
        const sh = await T(page, () => window.__test.shrines && window.__test.shrines()) || [];
        check(`one shrine per non-fork repo (${nonFork.length})`, sh.length === nonFork.length, `${sh.length} shrines`);
        if (sh.length) {
          const xs = sh.map((s) => s.x), ys = sh.map((s) => s.y), designs = new Set(sh.map((s) => s.design));
          const sorted = [...xs].sort((a, b) => a - b); const gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
          const mean = (a) => a.reduce((p, c) => p + c, 0) / a.length; const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
          const H0 = ws ? ws.height : 600;
          const noRepeat = sh.every((s, i) => i === 0 || s.design !== sh[i - 1].design);
          report.stats.shrines = { count: sh.length, designs: designs.size, minGap: Math.min(...gaps), meanGap: Math.round(mean(gaps)), ySpreadFrac: +(sd(ys) / H0).toFixed(3), ySpan: [Math.min(...ys), Math.max(...ys)], firstX: sorted[0], lastX: sorted[sorted.length - 1] };
          check('at least 8 different shrine designs', designs.size >= 8, `${designs.size} distinct design values`);
          check('no identical design twice in a row', noRepeat);
          check('shrines are at least 700 px apart', Math.min(...gaps) >= 700, `closest pair ${Math.round(Math.min(...gaps))} px`);
          check('shrines vary in height (not one line)', sd(ys) / H0 > 0.06, `std of y = ${(sd(ys) / H0 * 100).toFixed(1)} % of the world height`);
          check('world is long enough for all shrines', ws && ws.width >= sorted[sorted.length - 1] + 400 && ws.width >= 1600 + nonFork.length * 900, `world ${ws && ws.width} px, last shrine at ${Math.round(sorted[sorted.length - 1])}`);
        }

        // ---- progress screenshots along the world (god mode: pillars cannot crash us)
        if (ws) for (const [name, f] of [['reef', 0.08], ['kelp', 0.45], ['cave', 0.85]]) {
          await T(page, (x, y) => window.__test.teleport(x, y), Math.round(ws.width * f), Math.round(ws.height * 0.55)); await sleep(1100);
          if ((await popupVisible(page) || {}).open) { await tap(page, 'Escape'); await sleep(400); }
          const b = await page.screenshot({ type: 'png' }); const fn = `shot-${tag}-${name}.png`; fs.writeFileSync(path.join(OUT, fn), b); report.shots.push({ size: tag, name, file: fn });
          report.stats['stats-' + name] = await pixelStats(browser, b);
        }

        // ---- popup behaviour
        if (sh.length) {
          const target = sh[Math.min(2, sh.length - 1)]; const repo = nonFork[Math.min(2, nonFork.length - 1)];
          const fx = readmeIndex[repo.full_name]; const readme = fx && fx.file ? fs.readFileSync(path.join(FIX, 'readme', fx.file), 'utf8') : '';
          const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
          const firstLine = norm(readme.split('\n').map((l) => l.replace(/^[\s#>*-]+/, '').trim()).find((l) => /[A-Za-z]{4}/.test(l) && !/^(<|!\[|\[!)/.test(l)) || '').slice(0, 18);
          await T(page, (x, y) => window.__test.teleport(x, y), 200, Math.round(ws.height * 0.5)); await sleep(500);
          await T(page, (x, y) => window.__test.teleport(x, y), target.x, target.y); await sleep(900);
          let pv = await waitFor(async () => { const v = await popupVisible(page); return v && v.open ? v : null; }, 3500);
          check('popup opens next to a shrine', pv && pv.open, pv ? `${(pv.text || '').slice(0, 60).replace(/\s+/g, ' ')}` : 'no #modal element or it stays hidden');
          if (pv) {
            check('popup shows the repo name', (pv.text || '').toLowerCase().includes(repo.name.toLowerCase()), repo.name);
            const rd = firstLine ? await waitFor(async () => { const v = await popupVisible(page); return v && norm(v.text).includes(firstLine) ? v : null; }, 4000) : true;
            check('popup shows the README text', !!rd, firstLine ? `looked for "${firstLine}"` : 'repo has no README');
            const fields = await popupVisible(page); const t = (fields.text || '').toLowerCase();
            check('popup shows stars, forks and issues', /star|★/.test(t) && /fork/.test(t) && /issue/.test(t));
            const pb = await page.screenshot({ type: 'png' }); fs.writeFileSync(path.join(OUT, `shot-${tag}-popup.png`), pb); report.shots.push({ size: tag, name: 'popup', file: `shot-${tag}-popup.png` });
            await tap(page, 'Escape'); await sleep(500); const closed = await popupVisible(page);
            check('Esc closes the popup', closed && !closed.open);
            await sleep(1200); const still = await popupVisible(page);
            check('popup stays closed while the diver is still at the shrine', still && !still.open);
            await T(page, (x, y) => window.__test.teleport(x, y), Math.min(ws.width - 300, target.x + 1500), target.y); await sleep(700);
            await T(page, (x, y) => window.__test.teleport(x, y), target.x, target.y); await sleep(1000);
            const again = await waitFor(async () => { const v = await popupVisible(page); return v && v.open ? v : null; }, 3000);
            check('popup opens again after leaving and coming back', !!again);
            if (again) { try { await page.click('#modal-close', { timeout: 3000 }); await sleep(500); const c2 = await popupVisible(page); check('X button closes the popup', c2 && !c2.open); } catch (e) { check('X button closes the popup', false, 'could not click #modal-close: ' + e.message.slice(0, 80)); } }
            await T(page, (x, y) => window.__test.teleport(x, y), 200, Math.round(ws.height * 0.5)); await sleep(700);
            const away = await popupVisible(page); check('popup closes when the diver swims away', !away || !away.open);
          }
        }

        // ---- crash, restart, finish
        const obs = await T(page, () => window.__test.obstacles && window.__test.obstacles()) || [];
        check('obstacles() returns pillar boxes', obs.length >= 6, `${obs.length} boxes`);
        if (obs.length) {
          await T(page, () => window.__test.godMode(false)); const o = obs[Math.min(1, obs.length - 1)];
          await T(page, (x, y) => window.__test.teleport(x, y), Math.round(o.x), Math.round(o.y)); await sleep(900);
          const cs = await state(page); check('touching a pillar crashes the diver', cs && cs.mode === 'crashed', `mode ${cs && cs.mode}`);
          const cb = await page.screenshot({ type: 'png' }); fs.writeFileSync(path.join(OUT, `shot-${tag}-crash.png`), cb); report.shots.push({ size: tag, name: 'crash', file: `shot-${tag}-crash.png` });
          await tap(page, 'r', 180); await sleep(1000); const rs = await state(page);
          check('R restarts after a crash', rs && rs.mode === 'play' && rs.x < 600, `mode ${rs && rs.mode}, x ${rs && rs.x}`);
          await T(page, () => window.__test.godMode(true)); const x2 = await state(page); await page.keyboard.down('d'); await sleep(900); await page.keyboard.up('d'); const x3 = await state(page);
          check('controls still work after a restart', x3 && x2 && x3.x - x2.x > 60, `x ${x2 && x2.x} -> ${x3 && x3.x}`);
          const pa = await popupVisible(page); void pa;
        }
        if (ws) {
          await T(page, () => window.__test.godMode(true)); await T(page, (x, y) => window.__test.teleport(x, y), ws.width - 40, Math.round(ws.height * 0.5)); await sleep(1400);
          const fs2 = await state(page); check('reaching the end finishes the game', fs2 && fs2.mode === 'finished', `mode ${fs2 && fs2.mode}`);
          const fb = await page.screenshot({ type: 'png' }); fs.writeFileSync(path.join(OUT, `shot-${tag}-finish.png`), fb); report.shots.push({ size: tag, name: 'finish', file: `shot-${tag}-finish.png` });
        }
        const fps = await T(page, () => new Promise((res) => { let n = 0; const t = performance.now(); (function f() { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t) / 1000)); })(); }));
        report.stats.fps = +fps.toFixed(1); report.stats.loadMs = loadMs;
      }

      // resize: the canvas must follow the window
      if (primary && SIZES.length > 1) { /* the next size is a fresh page; resize is covered by the second size's fit check */ }
      check(`[${tag}] zero page errors and console errors`, errors.length === 0, errors.length ? errors.slice(0, 4) : undefined);
      if (external.size) report.notes.push(`[${tag}] external requests (forbidden by PROMPT.md): ` + [...external].slice(0, 6).join(', '));
      report.stats['errors-' + tag] = errors.slice(0, 20);
      await page.close();
    }
    srv.close();
  } catch (e) {
    report.fatal = String(e && e.stack || e).slice(0, 600); check('verification ran to the end', false, report.fatal.split('\n')[0]);
  } finally {
    report.passed = checks.filter((c) => c.pass).length; report.total = checks.length; report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
    const bad = checks.filter((c) => !c.pass);
    console.log(JSON.stringify({ passed: report.passed, total: report.total, failed: bad.map((c) => c.id + (c.detail ? ' :: ' + (typeof c.detail === 'string' ? c.detail : JSON.stringify(c.detail)) : '')), notes: report.notes, screenshots: report.shots.map((s) => path.join(path.relative(process.cwd(), OUT), s.file)), report: path.relative(process.cwd(), path.join(OUT, 'report.json')) }, null, 1));
    try { await browser.close(); } catch (e) { /* ignore */ }
    process.exit(report.passed === report.total ? 0 : 1);
  }
})();
