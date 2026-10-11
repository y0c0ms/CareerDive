// node tools/device-test.cjs [--out device-out]
// 1. touch devices: landscape joystick moves the diver, portrait pauses behind the rotate overlay, popup/end screens work by touch
// 2. GitHub unreachable: every github request is aborted, the game must still build the bundled world and show bundled READMEs
// 3. cache: a second load inside the TTL must not hit the API again
'use strict';
const fs = require('fs'), path = require('path');
const { serve, launch, intercept, hookReady, bundled, sleep } = require('./lib.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'device-out')), checks = [];
const check = (id, pass, detail) => { checks.push({ id, pass: !!pass, detail }); console.error((pass ? '  PASS ' : '  FAIL ') + id + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const st = p => p.evaluate(() => window.__test.state());

const fresh = async browser => (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser);   // isolated localStorage

async function device(browser, url, w, h, dpr = 2) {
  const page = await (await fresh(browser)).newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/readme|favicon/.test((m.location() || {}).url || '')) errors.push(m.text()); });
  await intercept(page);
  await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: dpr, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' });
  await page.goto(url, { waitUntil: 'load' }); await hookReady(page); await sleep(1500);
  return { page, errors };
}
async function drag(page, dx, dy, ms) {
  const r = await page.evaluate(() => { const b = document.getElementById('stick').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.touchscreen.touchStart(r.x, r.y); await page.touchscreen.touchMove(r.x + dx, r.y + dy); await sleep(ms);
  const mid = await st(page); await page.touchscreen.touchEnd(); return mid;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { srv, url } = await serve(), browser = await launch();
  try {
    for (const [w, h] of [[844, 390], [932, 430]]) {
      console.error(`\n== touch landscape ${w}x${h} ==`);
      const { page, errors } = await device(browser, url, w, h);
      await page.evaluate(() => window.__test.godMode(true));
      const info = await page.evaluate(() => {
        const s = document.getElementById('stick').getBoundingClientRect(), c = document.querySelector('canvas').getBoundingClientRect(), hint = document.getElementById('hud').dataset.hint, bb = document.getElementById('boost').getBoundingClientRect(), hudBox = document.getElementById('hud').getBoundingClientRect();
        return { boost: [bb.left, bb.top, bb.width, bb.height].map(Math.round), hud: [hudBox.width, hudBox.height].map(Math.round), stick: [s.left, s.top, s.width, s.height].map(Math.round), canvas: [c.left, c.top, c.width, c.height].map(Math.round), hint, touchClass: document.documentElement.classList.contains('touch'), rotateHidden: document.getElementById('rotate').classList.contains('hidden'), scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], gw: Phaser.GAMES ? null : null };
      });
      check(`[${w}x${h}] touch UI on, rotate overlay hidden`, info.touchClass && info.rotateHidden, info);
      check(`[${w}x${h}] joystick at bottom-left inside viewport`, info.stick[0] >= 0 && info.stick[0] < w * 0.25 && info.stick[1] + info.stick[3] <= h && info.stick[1] > h * 0.4 && info.stick[2] >= 96, info.stick);
      check(`[${w}x${h}] canvas fills the window`, info.canvas[0] <= 1 && info.canvas[1] <= 1 && Math.abs(info.canvas[2] - w) <= 2 && Math.abs(info.canvas[3] - h) <= 2, info.canvas);
      check(`[${w}x${h}] HUD shows the touch hints (drag to swim + boost button) and stays thin`, info.hint === 'touch' && info.hud[1] <= 40 && info.hud[0] >= w - 2, { hint: info.hint, hud: info.hud });
      check(`[${w}x${h}] boost button at bottom-right inside the viewport, clear of the joystick`, info.boost[0] + info.boost[2] <= w && info.boost[1] + info.boost[3] <= h && info.boost[0] > w * 0.75 && info.boost[1] > h * 0.4 && info.boost[2] >= 70, info.boost);
      check(`[${w}x${h}] no page scroll`, info.scroll[0] <= w + 1 && info.scroll[1] <= h + 1, info.scroll);
      await page.screenshot({ path: path.join(OUT, `landscape-${w}x${h}.png`) });
      const s0 = await st(page), mid = await drag(page, 46, 0, 1400), s1 = await st(page);
      check(`[${w}x${h}] dragging the joystick right moves the diver right`, mid.x - s0.x > 150, { x0: s0.x, whileHeld: mid.x, afterRelease: s1.x });
      await page.screenshot({ path: path.join(OUT, `landscape-${w}x${h}-moved.png`) });
      const y0 = (await st(page)).y, midUp = await drag(page, 0, -46, 700);
      check(`[${w}x${h}] dragging the joystick up rises`, midUp.y < y0 - 40, { y0, y: midUp.y });
      const x2 = (await st(page)).x, midHalf = await drag(page, 17, 0, 1000);
      check(`[${w}x${h}] analog: a half deflection swims slower than a full one`, midHalf.x - x2 > 20 && (midHalf.x - x2) < (mid.x - s0.x) * 0.9 * (1000 / 1400), { half: midHalf.x - x2, full: mid.x - s0.x });
      // boost button + joystick at the same time (two fingers)
      {
        await page.evaluate(() => { window.__test.godMode(true); window.__test.teleport(300, 300); }); await sleep(300);
        const bb = await page.evaluate(() => { const b = document.getElementById('boost').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
        const js = await page.evaluate(() => { const b = document.getElementById('stick').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
        const run = async withBoost => {
          await page.evaluate(() => window.__test.teleport(300, 300)); await sleep(300); const a = await st(page);
          const f1 = await page.touchscreen.touchStart(js.x, js.y); await f1.move(js.x + 46, js.y); let f2 = null; if (withBoost) f2 = await page.touchscreen.touchStart(bb.x, bb.y);
          await sleep(1200); const m = await st(page), boosting = await page.evaluate(() => window.__test.state() && document.getElementById('boost-cv') && true);
          const stam = await page.evaluate(() => window.__test.inspect().boost); if (f2) await f2.end(); await f1.end(); await sleep(400); return { dx: m.x - a.x, boost: stam };
        };
        const plain = await run(false); await sleep(4500); const fast = await run(true);
        check(`[${w}x${h}] touching the boost button while dragging the joystick boosts (multi-touch, ~1.7x)`, fast.boost.boosting && fast.dx / plain.dx > 1.4, { plain: plain.dx, boosted: fast.dx, state: fast.boost });
        await sleep(300); const after = await page.evaluate(() => window.__test.inspect().boost);
        check(`[${w}x${h}] releasing the boost finger stops the boost`, !after.boosting, after);
        await page.screenshot({ path: path.join(OUT, `landscape-${w}x${h}-hud.png`) });
        await page.evaluate(() => window.__test.godMode(false));
      }
      // popup + X by touch
      const sh = (await page.evaluate(() => window.__test.shrines()))[0];
      await page.evaluate((x, y) => window.__test.teleport(x, y), sh.x, sh.y); await sleep(900);
      const pop = await page.evaluate(() => { const m = document.getElementById('modal'), c = document.getElementById('modal-close').getBoundingClientRect(), r = m.getBoundingClientRect(); return { open: !m.classList.contains('hidden'), close: [c.width, c.height].map(Math.round), box: [r.left, r.top, r.width, r.height].map(Math.round) }; });
      check(`[${w}x${h}] popup opens, X button is touch sized (>=40px)`, pop.open && pop.close[0] >= 40 && pop.close[1] >= 40, pop);
      await page.screenshot({ path: path.join(OUT, `popup-${w}x${h}.png`) });
      const cb = await page.evaluate(() => { const c = document.getElementById('modal-close').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 }; });
      await page.touchscreen.tap(cb.x, cb.y); await sleep(400);
      check(`[${w}x${h}] tapping X closes the popup`, !(await st(page)).popupOpen);
      // crash screen + tap to restart
      await page.evaluate(() => { window.__test.godMode(false); const o = window.__test.obstacles()[1]; window.__test.teleport(o.x + 10, o.y + 10); }); await sleep(700);
      check(`[${w}x${h}] crash screen shows`, (await st(page)).mode === 'crashed');
      await page.screenshot({ path: path.join(OUT, `crash-${w}x${h}.png`) });
      await page.touchscreen.tap(w / 2, h / 2); await sleep(700);
      const rs = await st(page); check(`[${w}x${h}] tapping the end screen restarts`, rs.mode === 'play' && rs.x < 400, rs);
      check(`[${w}x${h}] no page errors`, errors.length === 0, errors.slice(0, 3));
      await page.close();
    }

    console.error('\n== touch portrait 390x844 ==');
    {
      const { page, errors } = await device(browser, url, 390, 844);
      const o = await page.evaluate(() => { const r = document.getElementById('rotate'), b = r.getBoundingClientRect(); return { hidden: r.classList.contains('hidden'), box: [b.left, b.top, b.width, b.height].map(Math.round), text: r.innerText, stick: getComputedStyle(document.getElementById('stick')).display }; });
      check('[portrait] rotate overlay visible full screen', !o.hidden && o.box[2] === 390 && o.box[3] === 844 && /ROTATE/i.test(o.text), o);
      await page.screenshot({ path: path.join(OUT, 'portrait-390x844.png') });
      await page.evaluate(() => window.__test.godMode(true));
      const a = await st(page); await page.touchscreen.touchStart(60, 760);
      await sleep(1800); const b = await st(page); await page.touchscreen.touchEnd();
      check('[portrait] game is paused (x and y unchanged)', a.x === b.x && a.y === b.y, { a: [a.x, a.y], b: [b.x, b.y] });
      await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(900);
      const c = await page.evaluate(() => document.getElementById('rotate').classList.contains('hidden')), s1 = await st(page); await sleep(1500); const s2 = await st(page);
      check('[portrait->landscape] overlay hides and the game resumes (diver sinks again)', c && s2.y > s1.y, { hidden: c, y1: s1.y, y2: s2.y });
      check('[portrait] no page errors', errors.length === 0, errors.slice(0, 3));
      await page.close();
    }

    console.error('\n== GitHub unreachable ==');
    {
      const page = await (await fresh(browser)).newPage(), errors = [], { repos, index } = bundled(), expect = repos.filter(r => !r.fork && r.name.toLowerCase() !== 'careerdive');
      page.on('pageerror', e => errors.push(e.message));
      const net = await intercept(page, { block: true }); await page.setViewport({ width: 1280, height: 720 });
      await page.goto(url, { waitUntil: 'load' }); await hookReady(page); await sleep(1200);
      const ws = await page.evaluate(() => window.__test.worldSize()), sh = await page.evaluate(() => window.__test.shrines());
      check('[offline] world builds from the bundled repos', sh.length === expect.length && ws.width === 1600 + expect.length * 1100, { shrines: sh.length, width: ws.width, aborted: net.log.aborted });
      check('[offline] github requests were really blocked', net.log.aborted > 0, net.log.aborted);
      const target = sh.find(s => index['y0c0ms/' + s.name] && index['y0c0ms/' + s.name].status === 200) || sh[0], nonE = sh.find(s => index['y0c0ms/' + s.name] && index['y0c0ms/' + s.name].status === 404);
      await page.evaluate(() => window.__test.godMode(true));
      await page.evaluate((x, y) => window.__test.teleport(x, y), target.x, target.y); await sleep(1500);
      const txt = await page.evaluate(() => document.getElementById('modal-readme').innerText);
      const file = fs.readFileSync(path.join(__dirname, '..', 'data', 'readme', index['y0c0ms/' + target.name].file), 'utf8');
      const norm = t => t.toLowerCase().replace(/[^a-z0-9]/g, ''), first = norm(file.split('\n').map(l => l.replace(/^[\s#>*-]+/, '').trim()).find(l => /[A-Za-z]{4}/.test(l) && !/^(<|!\[|\[!)/.test(l)) || '').slice(0, 16);
      check('[offline] popup shows the bundled README', norm(txt).includes(first), { repo: target.name, looked: first });
      await page.screenshot({ path: path.join(OUT, 'offline-popup.png') });
      if (nonE) { await page.keyboard.press('Escape'); await page.evaluate((x, y) => window.__test.teleport(x, y), 200, 400); await sleep(400); await page.evaluate((x, y) => window.__test.teleport(x, y), nonE.x, nonE.y); await sleep(1500);
        check('[offline] repo without README shows "No README"', /No README/.test(await page.evaluate(() => document.getElementById('modal-readme').innerText)), nonE.name); }
      check('[offline] no page errors', errors.length === 0, errors.slice(0, 3));
      await page.close();
    }

    console.error('\n== phone view: visible world, diver vs controls ==');
    for (const [w, h, d] of [[844, 390, 2], [852, 393, 3], [915, 412, 2.625], [932, 430, 3], [667, 375, 2], [740, 360, 3]]) {
      const { page, errors } = await device(browser, url, w, h, d);
      const v = await page.evaluate(() => window.__test.inspect().view), tag = `[${w}x${h}@${d}]`;
      const sc = v.canvas[2] / v.gw;                                          // css px per internal px
      const oldW = Math.min(1024, Math.max(480, 2 * Math.round(270 * w / h / 2)));             // the original (pre-phone-view) visible width
      const prevW = { '844x390': 844, '852x393': 852, '915x412': 870, '932x430': 932, '667x375': 668, '740x360': 804 }[`${w}x${h}`];   // the previous phone view
      check(`${tag} phone view: ~0.9x the previous visible width (${prevW} -> ${v.gw} internal px), still >= 1.2x the original ${oldW}, whole 270-row world visible (${v.gh} rows)`, v.phone && Math.abs(v.gw / prevW - 0.9) <= 0.035 && v.gw >= 1.2 * oldW && v.gh >= 270, { oldW, prevW, view: v, ratioToPrev: +(v.gw / prevW).toFixed(3), ratioToOriginal: +(v.gw / oldW).toFixed(2) });
      check(`${tag} canvas covers the window (${(sc * d).toFixed(2)} device px per internal px)`, v.canvas[0] <= 1 && v.canvas[1] <= 1 && Math.abs(v.canvas[2] - w) <= 2 && Math.abs(v.canvas[3] - h) <= 2, { css: v.canvas });
      const zones = await page.evaluate(() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { stick: r('stick'), boost: r('boost'), hud: r('hud') }; });
      const stickW = zones.stick[2] - zones.stick[0];
      check(`${tag} joystick base is ~100 css px and stays in the bottom-left corner`, stickW >= 92 && stickW <= 110 && zones.stick[0] < 40 && zones.stick[3] <= h, zones.stick.map(Math.round));
      // the diver's possible screen area: fixed band around its camera anchor, widened by the camera lag while boosting at full speed in both directions
      await page.evaluate(() => { window.__test.godMode(true); window.__test.teleport(4000, 400); }); await sleep(900);
      const xs = [], ys = [];
      for (const key of ['d', 'a']) {
        await page.evaluate(() => window.__test.boost(true)); await page.keyboard.down(key);
        for (let i = 0; i < 6; i++) { await sleep(180); const s = (await page.evaluate(() => window.__test.inspect().view)); xs.push(s.diverScreen[0] * sc); ys.push(s.diverScreen[1] * sc); }
        await page.keyboard.up(key); await page.evaluate(() => window.__test.boost(false)); await sleep(500);
      }
      const half = 24 * sc, minX = Math.min(...xs) - half, maxX = Math.max(...xs) + half;
      const hit = (z, x0, x1, y0, y1) => !(x1 < z[0] || x0 > z[2] || y1 < z[1] || y0 > z[3]);
      const vy = [Math.min(...ys) - 20 * sc, Math.max(...ys) + 20 * sc];
      // vertical range of the diver over the whole water column (not just what was sampled): rows SURF+6..FLOOR-8 of the world
      const yTop = (49 + 6 + v.top) * sc - 20 * sc, yBot = (248 - 8 + v.top) * sc + 20 * sc;
      check(`${tag} diver sprite (any swim speed, either direction, any depth) never overlaps the joystick or the boost button`, !hit(zones.stick, minX, maxX, yTop, yBot) && !hit(zones.boost, minX, maxX, yTop, yBot), { diverX: [Math.round(minX), Math.round(maxX)], diverY: [Math.round(yTop), Math.round(yBot)], stick: zones.stick.map(Math.round), boost: zones.boost.map(Math.round), diverPercentFromLeft: +((xs.reduce((a, b) => a + b, 0) / xs.length / w) * 100).toFixed(1) });
      await page.screenshot({ path: path.join(OUT, `phone-${w}x${h}.png`) });
      await page.evaluate(() => { window.__test.godMode(false); }); await page.keyboard.press('r').catch(() => {});
      check(`${tag} no page errors`, errors.length === 0, errors.slice(0, 3));
      await page.close();
    }
    {
      const { page, errors } = await device(browser, url, 1000, 430);          // aspect 2.33, wider than 16:9
      const meas = async () => page.evaluate(() => { const c = document.querySelector('canvas'), r = c.getBoundingClientRect(); return { css: [r.left, r.top, r.width, r.height].map(Math.round), buffer: [c.width, c.height] }; });
      const wide = await meas();
      check('[wide phone 1000x430] canvas covers the window and the internal width grew with it', wide.css[2] >= 999 && wide.css[3] >= 429 && wide.buffer[1] >= 270 && wide.buffer[0] > 640, wide);
      await page.screenshot({ path: path.join(OUT, 'wide-1000x430.png') });
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false }); await sleep(900);
      const after = await meas();
      check('[resize] canvas follows a resize to a 1280x720 desktop window (internal 480x270 again)', after.css[2] === 1280 && after.css[3] === 720 && after.buffer[0] === 480 && after.buffer[1] === 270, after);
      check('[wide] no page errors', errors.length === 0, errors.slice(0, 3));
      await page.close();
    }

    console.error('\n== live data + cache ==');
    {
      const page = await (await fresh(browser)).newPage(); const net = await intercept(page); await page.setViewport({ width: 1280, height: 720 });
      await page.goto(url, { waitUntil: 'load' }); await hookReady(page); const first = net.log.api;
      const cached = await page.evaluate(() => !!localStorage.getItem('dd:repos'));
      check('[live] repo list fetched from api.github.com and cached in localStorage', first >= 1 && cached, { apiCalls: first, cached });
      await page.reload({ waitUntil: 'load' }); await hookReady(page);
      check('[cache] reload within the TTL does not call the repo list API again', net.log.api === first, { before: first, after: net.log.api });
      await page.close();
    }

    console.error('\n== ignored repos ==');
    {
      const { repos } = bundled(), extra = Object.assign({}, repos.find(r => !r.fork), { id: 1, name: 'careerdive', full_name: 'y0c0ms/careerdive' });
      const page = await (await fresh(browser)).newPage(); await intercept(page, { repos: [extra, ...repos] }); await page.setViewport({ width: 1280, height: 720 });
      await page.goto(url, { waitUntil: 'load' }); await hookReady(page);
      const names = (await page.evaluate(() => window.__test.shrines())).map(s => s.name.toLowerCase());
      check('[ignore] CareerDive (any case) gets no shrine', !names.includes('careerdive') && names.length === repos.filter(r => !r.fork).length, names.length);
      await page.close();
    }
  } finally { await browser.close(); srv.close(); }
  const bad = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(checks, null, 1));
  console.log(JSON.stringify({ passed: checks.length - bad.length, total: checks.length, failed: bad.map(c => c.id + ' :: ' + JSON.stringify(c.detail)) }, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });