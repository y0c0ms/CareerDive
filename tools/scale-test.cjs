// node tools/scale-test.cjs [--counts 5,22,60] [--out scale-out]
// Loads the game with 5 / 22 / 60 repositories (extra ones synthesised from the bundled list) and reports how the world, shrines,
// obstacles, texture memory, start-up time and frame rate scale. Also checks that appending repos keeps earlier shrines/pillars in place.
'use strict';
const fs = require('fs'), path = require('path');
const { serve, launch, bundled, synthRepos, intercept, hookReady, sleep } = require('./lib.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const COUNTS = arg('counts', '5,22,60').split(',').map(Number), OUT = path.resolve(arg('out', 'scale-out'));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { srv, url } = await serve(), browser = await launch(), base = bundled().repos, results = [], snaps = {};
  for (const n of COUNTS) {
    const page = await (await (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser)).newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/readme|favicon/.test((m.location() || {}).url || '')) errors.push(m.text()); });
    await intercept(page, { repos: synthRepos(base, n) }); await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'load' }); await hookReady(page);
    const ttff = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now()))))));
    const info = await page.evaluate(() => {
      const t = window.__test, sh = t.shrines(), ob = t.obstacles(), xs = sh.map(s => s.x).sort((a, b) => a - b), gaps = xs.slice(1).map((v, i) => v - xs[i]);
      const ins = t.inspect();
      return { world: t.worldSize(), shrines: sh, obstacles: ob, minGap: gaps.length ? Math.min(...gaps) : null, designs: new Set(sh.map(s => s.design)).size,
        sameDesignNeighbours: sh.filter((s, i) => i && s.design === sh[i - 1].design).length, textures: ins.textures.count, textureMegaPixels: ins.textures.megaPixels, maxTexture: ins.textures.maxSide, mounts: ins.shrines.reduce((m, s) => (m[s.mount] = (m[s.mount] || 0) + 1, m), {}), gates: ins.gates };
    });
    snaps[n] = info;
    // swim the whole world quickly in god mode to find hitches, then measure steady frame rate in the middle
    await page.evaluate(() => window.__test.godMode(true));
    const W = info.world.width, frames = await page.evaluate(async W => {
      const t = window.__test, dts = []; let last = performance.now();
      for (let x = 400; x < W - 500; x += 160) { t.teleport(x, 450); await new Promise(r => requestAnimationFrame(() => { const now = performance.now(); dts.push(now - last); last = now; r(); })); }
      dts.sort((a, b) => a - b); return { teleports: dts.length, medianMs: +dts[dts.length >> 1].toFixed(1), p95Ms: +dts[Math.floor(dts.length * 0.95)].toFixed(1), maxMs: +dts[dts.length - 1].toFixed(1) };
    }, W);
    await page.evaluate(W => window.__test.teleport(Math.round(W / 2), 450), W); await sleep(800);
    const fps = await page.evaluate(() => new Promise(res => { let c = 0; const t0 = performance.now(); (function f() { c++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(+(c / ((performance.now() - t0) / 1000)).toFixed(1)); })(); }));
    const insEnd = await page.evaluate(() => window.__test.inspect()), live = insEnd.live;
    await page.evaluate(W => window.__test.teleport(W - 420, 400), W); await sleep(1200);
    await page.screenshot({ path: path.join(OUT, `far-end-${n}.png`) });
    results.push({ repos: n, worldWidth: W, shrines: info.shrines.length, minShrineSpacing: info.minGap, distinctDesigns: info.designs, sameDesignNeighbours: info.sameDesignNeighbours,
      obstacleBoxes: info.obstacles.length, gates: info.gates, shrineMounts: info.mounts, textures: info.textures, textureMegaPixels: info.textureMegaPixels, maxTextureSide: info.maxTexture, textureMegaPixelsAfterSweep: insEnd.textures.megaPixels, texturesAfterSweep: insEnd.textures.count, timeToFirstFrameMs: ttff, fps, teleportSweep: frames, runtime: live, errors });
    await page.close();
  }
  // appending repos must only extend the world: compare the common prefix of the smallest and the largest run
  const a = snaps[COUNTS[1] || COUNTS[0]], b = snaps[COUNTS[COUNTS.length - 1]], na = a.shrines.length;
  const sameShrines = a.shrines.every((s, i) => { const o = b.shrines[i]; return o && o.x === s.x && o.y === s.y && o.design === s.design && o.name === s.name; });
  const limit = a.shrines[na - 1].x + 400, oa = a.obstacles.filter(o => o.x < limit), ob = new Set(b.obstacles.map(o => [o.x, o.y, o.w, o.h].join()));
  const stable = { comparedRuns: [na, b.shrines.length], earlierShrinesIdentical: sameShrines, obstaclesBeforeLastOldShrine: oa.length, obstaclesStillPresent: oa.filter(o => ob.has([o.x, o.y, o.w, o.h].join())).length };
  console.log(JSON.stringify({ results, appendStability: stable }, null, 1));
  fs.writeFileSync(path.join(OUT, 'scale-report.json'), JSON.stringify({ results, appendStability: stable }, null, 1));
  await browser.close(); srv.close();
  process.exit(results.every(r => !r.errors.length) && sameShrines ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
