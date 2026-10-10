// node tools/popup-test.cjs [--out popup-out]
// Popup hero layout with synthetic READMEs (served through request interception; media comes from preview.gif / preview.png and a generated webm).
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { ROOT, serve, launch, bundled, hookReady, sleep } = require('./lib.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'popup-out')), checks = [];
const check = (id, pass, detail) => { checks.push({ id, pass: !!pass, detail }); console.error((pass ? '  PASS ' : '  FAIL ') + id + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

const CASES = {
  gif: '![demo](https://media.test/hero.gif)\n\n# Gif first\n\nSome text about the project.\n\n![second](https://media.test/second.png)\n',
  badges: '[![build](https://img.shields.io/badge/build-passing-green.svg)](https://ci.test/badge)\n![x](https://img.shields.io/github/stars/a/b)\n<img src="https://media.test/tiny.png" width="40">\n\n![screenshot](https://media.test/shot.png)\n\n# Badges then screenshot\n\nText below.\n',
  text: '# Only text\n\nNo pictures here, just words and a [link](https://example.com).\n\n- one\n- two\n',
  video: '# Video\n\nWatch this:\n\nhttps://github.com/user-attachments/assets/1234abcd-0000-4444-8888-abcdefabcdef\n\nAnd the text goes on.\n',
  mp4: '# Direct mp4\n\n[demo](https://media.test/demo.mp4)\n\nText.\n',
  broken: '![broken](https://media.test/missing.png)\n\n# Broken hero\n\nStill readable.\n'
};
const repos = Object.keys(CASES).map((k, i) => Object.assign({}, bundled().repos.find(r => !r.fork), { id: 7000 + i, name: 'case-' + k, full_name: 'y0c0ms/case-' + k, description: 'Synthetic case ' + k, topics: ['pixel', 'demo'], stargazers_count: 0 }));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync('/tmp/dd-popup-'); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10', '-t', '1', '-c:v', 'libvpx', '-b:v', '200k', path.join(tmp, 't.webm')]);
  const gif = fs.readFileSync(path.join(ROOT, 'preview.gif')), png = fs.readFileSync(path.join(ROOT, 'preview.png')), webm = fs.readFileSync(path.join(tmp, 't.webm'));
  const { srv, url } = await serve(), browser = await launch();
  try {
    const open = async (w, h, touch) => {
      const page = await (await (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser)).newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message)); await page.setRequestInterception(true);
      page.on('request', req => {
        const u = new URL(req.url());
        if (['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return req.continue();
        if (u.hostname === 'api.github.com') {
          if (/\/users\//.test(u.pathname)) return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(repos) });
          const m = u.pathname.match(/^\/repos\/y0c0ms\/case-(\w+)\/readme/); return req.respond({ status: m ? 200 : 404, contentType: 'text/plain', headers: CORS, body: m ? CASES[m[1]] : '{}' });
        }
        if (u.hostname === 'media.test') {
          if (u.pathname === '/hero.gif') return req.respond({ status: 200, contentType: 'image/gif', headers: CORS, body: gif });
          if (/shot|second/.test(u.pathname)) return req.respond({ status: 200, contentType: 'image/png', headers: CORS, body: png });
          if (/\.(webm|mp4)$/.test(u.pathname)) return req.respond({ status: 200, contentType: 'video/webm', headers: CORS, body: webm });
          return req.respond({ status: 404, headers: CORS, body: '' });
        }
        if (u.hostname === 'github.com' && /user-attachments/.test(u.pathname)) return req.respond({ status: 200, contentType: 'video/webm', headers: CORS, body: webm });
        return req.respond({ status: 200, contentType: 'text/plain', headers: CORS, body: '' });
      });
      if (touch) await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' }); else await page.setViewport({ width: w, height: h });
      await page.goto(url, { waitUntil: 'load' }); await hookReady(page); await page.evaluate(() => window.__test.godMode(true)); return { page, errors };
    };
    const show = async (page, name) => {
      const sh = (await page.evaluate(() => window.__test.shrines())).find(s => s.name === 'case-' + name);
      await page.evaluate(() => window.__test.teleport(200, 400)); await sleep(400);
      await page.evaluate((x, y) => window.__test.teleport(x, y), sh.x, sh.y); await sleep(1800);
      return page.evaluate(() => {
        const m = document.getElementById('modal'), h = document.getElementById('modal-hero'), rd = document.getElementById('modal-readme'), v = h.querySelector('video'), i = h.querySelector('img'), r = m.getBoundingClientRect(), hb = h.getBoundingClientRect();
        return { open: !m.classList.contains('hidden'), hasHero: m.classList.contains('has-hero'), heroImg: i ? i.getAttribute('src') : null, heroLoaded: i ? i.complete && i.naturalWidth > 0 : null,
          video: v ? { muted: v.muted, loop: v.loop, autoplay: v.autoplay, playsinline: v.hasAttribute('playsinline'), controls: v.controls, src: v.getAttribute('src') } : null, heroLink: !!h.querySelector('a'), heroBox: [hb.width, hb.height].map(Math.round),
          bodyImgs: [...rd.querySelectorAll('img')].map(x => x.getAttribute('src')), bodyText: rd.innerText.slice(0, 200), modalBox: [r.left, r.top, r.width, r.height].map(Math.round), fitsViewport: r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 };
      });
    };
    const d = await open(1280, 720, false);
    let r = await show(d.page, 'gif');
    check('(1) hero GIF first: hero container present with that src, image not duplicated in the body', r.hasHero && r.heroImg === 'https://media.test/hero.gif' && r.heroLoaded && !r.bodyImgs.includes('https://media.test/hero.gif') && r.bodyImgs.length === 1, r);
    await d.page.screenshot({ path: path.join(OUT, 'case1-gif-1280x720.png') });
    r = await show(d.page, 'badges');
    check('(2) shields.io badges are skipped, the screenshot becomes the hero', r.hasHero && r.heroImg === 'https://media.test/shot.png' && !r.bodyImgs.includes('https://media.test/shot.png'), r);
    r = await show(d.page, 'text');
    check('(3) text-only README: no hero container shown, text layout unchanged', !r.hasHero && r.heroBox[0] === 0 && /Only text/.test(r.bodyText), r);
    await d.page.screenshot({ path: path.join(OUT, 'case3-text-1280x720.png') });
    r = await show(d.page, 'video');
    check('(4a) user-attachments link: <video> created with muted + loop + autoplay + playsinline', r.hasHero && r.video && r.video.muted && r.video.loop && r.video.autoplay && r.video.playsinline && /user-attachments/.test(r.video.src), r);
    check('(4a) the video link is removed from the text flow', !/user-attachments/.test(r.bodyText) && /text goes on/.test(r.bodyText), r.bodyText);
    r = await show(d.page, 'mp4'); check('(4b) a link ending .mp4 becomes the hero video', r.hasHero && r.video && r.video.muted && r.video.loop, r);
    r = await show(d.page, 'broken');
    check('(5) broken hero image falls back to the text layout', !r.hasHero && /Broken hero/.test(r.bodyText), r);
    check('[desktop] no page errors', d.errors.length === 0, d.errors.slice(0, 3));
    await d.page.close();
    const m = await open(844, 390, true);
    r = await show(m.page, 'gif'); await m.page.screenshot({ path: path.join(OUT, 'case1-gif-844x390.png') });
    check('[phone 844x390] hero left, text right, popup fits the viewport', r.hasHero && r.fitsViewport && r.heroBox[0] > 150 && r.heroBox[0] < r.modalBox[2] * 0.55, r);
    r = await show(m.page, 'text'); await m.page.screenshot({ path: path.join(OUT, 'case3-text-844x390.png') });
    check('[phone 844x390] text-only popup fits the viewport', !r.hasHero && r.fitsViewport, r);
    check('[phone] no page errors', m.errors.length === 0, m.errors.slice(0, 3));
    await m.page.close();
  } finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
  const bad = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(checks, null, 1));
  console.log(JSON.stringify({ passed: checks.length - bad.length, total: checks.length, failed: bad.map(c => c.id + ' :: ' + JSON.stringify(c.detail)) }, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
