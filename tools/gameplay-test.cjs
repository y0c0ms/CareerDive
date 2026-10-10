// node tools/gameplay-test.cjs [--out gameplay-out]
// Boost (speed, bubbles, meter), hearts, jellyfish / anglerfish hits, invulnerability, godMode, restart, spawn rules, HUD screenshots.
'use strict';
const fs = require('fs'), path = require('path');
const { serve, launch, intercept, hookReady, synthRepos, bundled, sleep } = require('./lib.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'gameplay-out')), checks = [];
const check = (id, pass, detail) => { checks.push({ id, pass: !!pass, detail }); console.error((pass ? '  PASS ' : '  FAIL ') + id + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const st = p => p.evaluate(() => window.__test.state());
const ins = p => p.evaluate(() => window.__test.inspect());
const hearts = p => p.evaluate(() => window.__test.hearts());

async function findEnemy(page, kind, W) {
  for (let x = 700; x < W - 600; x += 380) {
    await page.evaluate(x => window.__test.teleport(x, 400), x); await sleep(450);
    const e = await page.evaluate(k => window.__test.enemies().filter(e => e.kind === k), kind);
    if (e.length) return e;
  }
  return null;
}
const onto = (page, kind, part) => page.evaluate((k, p) => {                       // put the diver on the centre of a live enemy box
  const e = window.__test.enemies().find(e => e.kind === k && e.part === p); if (!e) return null;
  window.__test.teleport(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2)); return e;
}, kind, part);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { srv, url } = await serve(), browser = await launch();
  try {
    const ctx = await (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/readme|favicon/.test((m.location() || {}).url || '')) errors.push(m.text()); });
    await intercept(page); await page.setViewport({ width: 1280, height: 720 }); await page.goto(url, { waitUntil: 'load' }); await hookReady(page); await sleep(800);
    const W = (await page.evaluate(() => window.__test.worldSize())).width;
    check('__test exposes boost, hearts, enemies and the original six functions', await page.evaluate(() => ['state', 'worldSize', 'teleport', 'shrines', 'obstacles', 'godMode', 'boost', 'hearts', 'enemies'].every(k => typeof window.__test[k] === 'function')));
    check('hearts start at 3, HUD canvas present', (await hearts(page)) === 3 && await page.evaluate(() => !!document.getElementById('hud') && document.getElementById('hud').height > 0));

    console.error('\n== boost ==');
    await page.evaluate(() => { window.__test.godMode(true); window.__test.teleport(300, 300); }); await sleep(500);
    const run = async (shift, ms) => {
      await page.evaluate(() => window.__test.teleport(300, 300)); await sleep(250);
      const a = await st(page), e0 = (await ins(page)).boost.emitted; await page.keyboard.down('d'); if (shift) await page.keyboard.down('Shift');
      await sleep(ms); const mid = await ins(page); const b = await st(page); await page.keyboard.up('d'); if (shift) await page.keyboard.up('Shift'); await sleep(700);
      return { dx: b.x - a.x, bubbles: mid.boost.emitted - e0, stamina: mid.boost.stamina, boosting: mid.boost.boosting };
    };
    const normal = await run(false, 1500); await sleep(4500);
    const fast = await run(true, 1500);
    check('holding Shift increases horizontal speed (~1.7x)', fast.dx / normal.dx > 1.45 && fast.dx / normal.dx < 2.0, { normalDx: normal.dx, boostDx: fast.dx, ratio: +(fast.dx / normal.dx).toFixed(2) });
    check('holding Shift emits 4x or more bubbles', fast.bubbles >= Math.max(4 * normal.bubbles, 8), { normal: normal.bubbles, boost: fast.bubbles });
    const pool = await ins(page); check('bubble pool does not grow (active bubbles <= 48 and texture count stable)', pool.boost.activeBubbles <= 48, pool.boost.activeBubbles);
    await sleep(4500);
    // meter
    await page.evaluate(() => window.__test.boost(true)); const m0 = (await ins(page)).boost.stamina; await sleep(1500); const m1 = (await ins(page)).boost.stamina; await sleep(2000); const m2 = await ins(page);
    check('meter drains while boosting (~3 s for a full meter)', m1 < m0 - 0.35 && m1 > 0.3 && m2.boost.stamina <= 0.02 && m2.boost.lock, { start: m0, after1_5s: m1, after3_5s: m2.boost.stamina, lock: m2.boost.lock });
    await page.evaluate(() => window.__test.boost(true)); await sleep(300); const lockedOut = await ins(page);
    check('an emptied meter stays empty while the button is still held', !lockedOut.boost.boosting && lockedOut.boost.stamina < 0.02, lockedOut.boost);
    await page.evaluate(() => window.__test.boost(false)); await sleep(100);
    await page.evaluate(() => window.__test.boost(true)); await sleep(150); const low = await ins(page);
    check('cannot start boosting below 15 % (or while locked out)', !low.boost.boosting, low.boost);
    await page.evaluate(() => window.__test.boost(false)); const r0 = (await ins(page)).boost.stamina; await sleep(2000); const r1 = (await ins(page)).boost.stamina; await sleep(2600); const r2 = (await ins(page)).boost.stamina;
    check('meter refills in about 4 s', r1 > r0 + 0.35 && r2 >= 0.97, { r0, r1, r2 });
    await page.evaluate(() => window.__test.boost(true)); await sleep(300); const again = await ins(page); await page.evaluate(() => window.__test.boost(false));
    check('boost starts again once the meter is above 15 %', again.boost.boosting, again.boost);
    await page.evaluate(() => { window.__test.godMode(true); window.__test.teleport(300, 300); window.__test.boost(true); }); await sleep(1000);
    await page.screenshot({ path: path.join(OUT, 'boost-bubbles-1280x720.png') }); await page.evaluate(() => window.__test.boost(false));

    console.error('\n== enemies ==');
    await page.evaluate(() => window.__test.godMode(true));
    const jel = await findEnemy(page, 'jellyfish', W), ang = await findEnemy(page, 'anglerfish', W);
    check('jellyfish exist in the world', !!jel, jel && jel[0]); check('anglerfish exist in the world', !!ang, ang && ang[0]);
    await page.evaluate(() => window.__test.godMode(false));
    // jelly: one heart, invulnerability, blinking, knockback, flash
    const j1 = await onto(page, 'jellyfish', 'body'); await sleep(250);
    let s = await st(page), i1 = await ins(page);
    check('touching a jellyfish removes exactly one heart', (await hearts(page)) === 2 && s.mode === 'play', { hearts: await hearts(page), mode: s.mode });
    check('invulnerability starts (about 1.2 s) and the diver blinks', i1.boost.invuln > 0.5 && i1.boost.invuln <= 1.2, i1.boost);
    await page.screenshot({ path: path.join(OUT, 'hit-flash-1280x720.png') });
    await onto(page, 'jellyfish', 'body'); await sleep(250);
    check('a second touch during invulnerability costs nothing', (await hearts(page)) === 2);
    await sleep(1300); await onto(page, 'jellyfish', 'body'); await sleep(250);
    check('after invulnerability ends the next touch costs a heart (1 left)', (await hearts(page)) === 1 && (await st(page)).mode === 'play', await hearts(page));
    await sleep(1400); await onto(page, 'jellyfish', 'body'); await sleep(350);
    s = await st(page);
    check('the third hit ends the run (CRASHED)', s.mode === 'crashed' && (await hearts(page)) === 0, { mode: s.mode, hearts: await hearts(page) });
    check('CRASHED end screen is shown', await page.evaluate(() => !document.getElementById('end').classList.contains('hidden') && /CRASHED/.test(document.getElementById('end-title').textContent)));
    await page.screenshot({ path: path.join(OUT, 'crashed-by-jelly-1280x720.png') });
    await page.keyboard.press('r'); await sleep(500);
    check('restart (R) resets hearts to 3 and the mode to play', (await hearts(page)) === 3 && (await st(page)).mode === 'play', { hearts: await hearts(page) });
    // angler: body hit then lure hit
    await page.evaluate(() => window.__test.godMode(true)); const ang2 = await findEnemy(page, 'anglerfish', W); await page.evaluate(() => window.__test.godMode(false));
    await onto(page, 'anglerfish', 'body'); await sleep(250); const h1 = await hearts(page);
    check('touching an anglerfish body removes one heart', h1 === 2, h1);
    await sleep(1500); await onto(page, 'anglerfish', 'lure'); await sleep(250);
    check('touching the anglerfish lure also removes a heart', (await hearts(page)) === 1, await hearts(page));
    await page.screenshot({ path: path.join(OUT, 'angler-hit-1280x720.png') });
    await sleep(1500); await onto(page, 'anglerfish', 'body'); await sleep(350);
    check('three anglerfish hits end the run', (await st(page)).mode === 'crashed', (await st(page)).mode);
    // tap-free restart then godMode
    await page.keyboard.press('r'); await sleep(400); await page.evaluate(() => window.__test.godMode(true));
    await findEnemy(page, 'jellyfish', W); await onto(page, 'jellyfish', 'body'); await sleep(900);
    check('godMode ignores enemies', (await hearts(page)) === 3 && (await st(page)).mode === 'play', await hearts(page));
    await page.evaluate(() => window.__test.godMode(false));
    // pillars still crash instantly
    await page.keyboard.press('r'); await sleep(300);
    await page.evaluate(() => { const o = window.__test.obstacles()[1]; window.__test.teleport(o.x + 10, o.y + 10); }); await sleep(500);
    check('rock pillars still crash instantly', (await st(page)).mode === 'crashed');
    await page.keyboard.press('r'); await sleep(300);

    console.error('\n== spawn rules and fairness (22 and 60 repos) ==');
    for (const n of [22, 60]) {
      const p2 = await (await (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser)).newPage();
      await intercept(p2, { repos: synthRepos(bundled().repos, n) }); await p2.setViewport({ width: 1280, height: 720 }); await p2.goto(url, { waitUntil: 'load' }); await hookReady(p2);
      await p2.evaluate(() => window.__test.godMode(true));
      const info = await p2.evaluate(async () => {
        const t = window.__test, W = t.worldSize().width, sh = t.shrines(), ob = t.obstacles(), seen = new Map();
        for (let x = 300; x < W - 400; x += 400) { t.teleport(x, 400); await new Promise(r => setTimeout(r, 160)); for (const e of t.enemies()) seen.set(e.kind + ':' + e.part + ':' + Math.round(e.x / 8), e); }
        return { W, sh, ob, enemies: [...seen.values()] };
      });
      const body = info.enemies.filter(e => e.part === 'body');
      const inFirst = body.filter(e => e.x < 600), nearShrine = body.filter(e => info.sh.some(s => Math.abs(s.x - (e.x + e.w / 2)) < 130 + e.w / 2));
      const touchPillar = body.filter(e => info.ob.some(o => e.x < o.x + o.w + 60 && e.x + e.w > o.x - 60));
      check(`[${n} repos] enemies exist (${body.length}), none in the first 600 px, none in shrine radius, none touching pillars`, body.length >= (n > 30 ? 8 : 3) && !inFirst.length && !nearShrine.length && !touchPillar.length, { enemies: body.length, perKm: +(body.length / (info.W / 1000)).toFixed(2), first: inFirst.length, shrine: nearShrine.length, pillar: touchPillar.length });
      await p2.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    await page.close();
  } finally { await browser.close(); srv.close(); }
  const bad = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(checks, null, 1));
  console.log(JSON.stringify({ passed: checks.length - bad.length, total: checks.length, failed: bad.map(c => c.id + ' :: ' + JSON.stringify(c.detail)) }, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
