// node tools/popup-test.cjs [--out popup-out]
// Popup hero layout with synthetic READMEs (served through request interception; media comes from preview.gif / preview.png and a generated webm).
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { ROOT, serve, launch, bundled, hookReady, sleep } = require('./lib.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'popup-out')), checks = [];
const check = (id, pass, detail) => { checks.push({ id, pass: !!pass, detail }); console.error((pass ? '  PASS ' : '  FAIL ') + id + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

const LONG = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}: a paragraph of the long synthetic README, long enough to wrap around on a phone screen.`).join('\n\n');
const CASES = {
  gif: '![demo](https://media.test/hero.gif)\n\n# Gif first\n\nSome text about the project.\n\n![second](https://media.test/second.png)\n',
  badges: '[![build](https://img.shields.io/badge/build-passing-green.svg)](https://ci.test/badge)\n![x](https://img.shields.io/github/stars/a/b)\n<img src="https://media.test/tiny.png" width="40">\n\n![screenshot](https://media.test/shot.png)\n\n# Badges then screenshot\n\nText below.\n',
  text: '# Only text\n\nNo pictures here, just words and a [link](https://example.com).\n\n- one\n- two\n',
  video: '# Video\n\nWatch this:\n\nhttps://github.com/user-attachments/assets/1234abcd-0000-4444-8888-abcdefabcdef\n\nAnd the text goes on.\n',
  mp4: '# Direct mp4\n\n[demo](https://media.test/demo.mp4)\n\nText.\n',
  broken: '![broken](https://media.test/missing.png)\n\n# Broken hero\n\nStill readable.\n',
  long: '# Long README\n\n' + LONG,
  herolong: '![demo](https://media.test/hero.gif)\n\n# Hero and long\n\n' + LONG
};
const REAL = 'System1QLoRa';                                    // a real README from data/readme/
const nameOf = k => (k === 'real' ? REAL : 'case-' + k);
const repos = Object.keys(CASES).map((k, i) => Object.assign({}, bundled().repos.find(r => !r.fork), { id: 7000 + i, name: 'case-' + k, full_name: 'y0c0ms/case-' + k, description: 'Synthetic case ' + k + ', with a description long enough to need two lines on a narrow phone screen.', topics: ['pixel', 'demo'], stargazers_count: 0 }))
  .concat(bundled().repos.filter(r => r.name === REAL));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync('/tmp/dd-popup-'); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10', '-t', '1', '-c:v', 'libvpx', '-b:v', '200k', path.join(tmp, 't.webm')]);
  const gif = fs.readFileSync(path.join(ROOT, 'preview.gif')), png = fs.readFileSync(path.join(ROOT, 'preview.png')), webm = fs.readFileSync(path.join(tmp, 't.webm'));
  const { srv, url } = await serve(), browser = await launch();
  try {
    const open = async (w, h, touch, dpr = 2) => {
      const page = await (await (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser)).newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message)); await page.setRequestInterception(true);
      page.on('request', req => {
        const u = new URL(req.url());
        if (['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return req.continue();
        if (u.hostname === 'api.github.com') {
          if (/\/users\//.test(u.pathname)) return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(repos) });
          const m = u.pathname.match(/^\/repos\/y0c0ms\/case-(\w+)\/readme/), real = u.pathname === '/repos/y0c0ms/' + REAL + '/readme';
          if (real) return req.respond({ status: 200, contentType: 'text/plain', headers: CORS, body: fs.readFileSync(path.join(ROOT, 'data', 'readme', 'y0c0ms__' + REAL + '.md')) });
          return req.respond({ status: m ? 200 : 404, contentType: 'text/plain', headers: CORS, body: m ? CASES[m[1]] : '{}' });
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
      if (touch) await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: dpr, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' }); else await page.setViewport({ width: w, height: h });
      await page.goto(url, { waitUntil: 'load' }); await hookReady(page); await page.evaluate(() => window.__test.godMode(true)); return { page, errors };
    };
    const show = async (page, name) => {
      const sh = (await page.evaluate(() => window.__test.shrines())).find(s => s.name === nameOf(name));
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
    // ---- phones: compact popup, touch scrolling, inert controls
    const swipe = async (page, x, y0, y1, steps = 10, gap = 16) => {
      const f = await page.touchscreen.touchStart(x, y0); for (let i = 1; i <= steps; i++) { await f.move(x, y0 + (y1 - y0) * i / steps); await sleep(gap); } await f.end(); await sleep(650);
    };
    const probe = page => page.evaluate(() => {
      const r = document.getElementById('modal-readme'), m = document.getElementById('modal'), c = document.getElementById('modal-close'), n = document.getElementById('modal-name'), sb = r.getBoundingClientRect(), mb = m.getBoundingClientRect(), cb = c.getBoundingClientRect();
      const chain = []; for (let e = r; e; e = e.parentElement) chain.push(e.tagName + (e.id ? '#' + e.id : '') + ':' + getComputedStyle(e).touchAction);
      return { top: r.scrollTop, sh: r.scrollHeight, ch: r.clientHeight, readmeBox: [sb.left, sb.top, sb.width, sb.height], modal: [mb.left, mb.top, mb.right, mb.bottom, mb.width, mb.height].map(Math.round), close: [cb.left, cb.top, cb.width, cb.height].map(Math.round),
        fonts: { readme: parseFloat(getComputedStyle(r).fontSize), title: parseFloat(getComputedStyle(n).fontSize) }, chain, vw: innerWidth, vh: innerHeight, vv: window.visualViewport ? [window.visualViewport.width, window.visualViewport.height] : null,
        page: [scrollX, scrollY, document.scrollingElement.scrollTop], stick: getComputedStyle(document.getElementById('stick')).visibility, boost: getComputedStyle(document.getElementById('boost')).visibility, hasHero: m.classList.contains('has-hero'), state: window.__test.state() };
    });
    const SIZES = [[667, 375, 2], [740, 360, 3], [844, 390, 2], [852, 393, 3], [915, 412, 2.625], [932, 430, 3]];
    for (const [w, h, dpr] of SIZES) {
      const tag = `[${w}x${h}]`, m = await open(w, h, true, dpr);
      for (const name of ['text', 'gif']) {
        const r = await show(m.page, name); const p = await probe(m.page); await sleep(300);
        await m.page.screenshot({ path: path.join(OUT, `phone-${name}-${w}x${h}.png`) });
        const [ml, mt, mr, mb, mw, mh] = p.modal, [cl, ct, cw, ch] = p.close;
        check(`${tag} ${name}: popup is compact (<= 92vw x 88dvh), inside the viewport and under the HUD`, ml >= 0 && mr <= w && mt >= 20 && mb <= h && mw <= w * 0.93 && mh <= h * 0.89 + 1, { modal: p.modal, vw: p.vw, vh: p.vh, vv: p.vv });
        check(`${tag} ${name}: fonts are compact (title <= 15 px, body 10.5-12.5 px), the README area still has >= 90 px of height`, p.fonts.title <= 15 && p.fonts.readme >= 10.5 && p.fonts.readme <= 12.5 && p.ch >= 90, { fonts: p.fonts, readmeHeight: p.ch });
        check(`${tag} ${name}: close button has a >= 40 px hit area and is inside the viewport`, cw >= 40 && ch >= 40 && cl >= 0 && ct >= 0 && cl + cw <= w && ct + ch <= h, p.close);
        check(`${tag} ${name}: joystick and boost button are hidden while the popup is open`, p.stick === 'hidden' && p.boost === 'hidden', { stick: p.stick, boost: p.boost });
        if (name === 'gif') check(`${tag} hero: hero on the left, text on the right`, r.hasHero && r.heroBox[0] > 100 && r.heroBox[0] < mw * 0.5 && r.heroBox[1] > 40, r.heroBox);
      }
      check(`${tag} no page errors`, m.errors.length === 0, m.errors.slice(0, 3));
      await m.page.close();
    }
    // real touch gestures on a long README (synthetic 200 paragraphs, with and without hero, and a real README from data/readme)
    for (const [w, h, dpr, names] of [[844, 390, 2, ['long', 'herolong', 'real']], [667, 375, 2, ['long']], [932, 430, 3, ['long']]]) {
      const m = await open(w, h, true, dpr);
      for (const name of names) {
        const tag = `[${w}x${h} ${name}]`; await show(m.page, name); const p0 = await probe(m.page), rb = p0.readmeBox, cx = rb[0] + rb[2] / 2, span = rb[3] * 0.7, yb = rb[1] + rb[3] * 0.85;
        check(`${tag} README is scrollable (content ${p0.sh} px in a ${p0.ch} px box) and no ancestor blocks panning (touch-action chain)`, p0.sh > p0.ch * 2 && p0.chain.every(c => !/:none$/.test(c) && /:(auto|pan-x pan-y|pan-y|manipulation)$/.test(c)), p0.chain);
        await swipe(m.page, cx, yb, yb - span); const p1 = await probe(m.page);
        check(`${tag} swiping up scrolls the README (scrollTop ${p0.top} -> ${p1.top})`, p1.top > p0.top + span * 0.5, { before: p0.top, after: p1.top, swipePx: Math.round(span) });
        await swipe(m.page, cx, yb - span, yb); const p2 = await probe(m.page);
        check(`${tag} swiping down scrolls back (scrollTop ${p1.top} -> ${p2.top})`, p2.top < p1.top - span * 0.4, { before: p1.top, after: p2.top });
        // header (not a scroller) swipe, and a swipe that starts where the joystick used to be: nothing may move
        const hb = p0.modal; await swipe(m.page, hb[0] + hb[4] / 2, hb[1] + 14, hb[1] + 90); const jx = 70, jy = h - 70;
        const f = await m.page.touchscreen.touchStart(jx, jy); await f.move(jx + 40, jy); await sleep(700); await f.end(); await sleep(300);
        const p3 = await probe(m.page);
        check(`${tag} swiping in the popup / where the joystick was moves neither the diver (${p0.state.x},${p0.state.y}) nor the page, and the popup stays open`, p3.state.x === p0.state.x && p3.state.y === p0.state.y && p3.page.every(v => v === 0) && p3.state.popupOpen, { before: [p0.state.x, p0.state.y], after: [p3.state.x, p3.state.y], page: p3.page });
        if (name !== 'herolong') {                           // reach the very end by swiping
          let n = 0, q = await probe(m.page); while (q.top + q.ch < q.sh - 2 && n < 90) { await swipe(m.page, cx, rb[1] + rb[3] * 0.9, rb[1] + rb[3] * 0.1, 8, 8); q = await probe(m.page); n++; }
          check(`${tag} a long README is fully reachable by touch (${n} swipes to the end)`, q.top + q.ch >= q.sh - 2, { top: q.top, sh: q.sh, ch: q.ch, swipes: n });
        }
        await m.page.screenshot({ path: path.join(OUT, `scroll-${name}-${w}x${h}.png`) });
        await m.page.keyboard.press('Escape'); await sleep(300);
      }
      check(`[${w}x${h}] no page errors`, m.errors.length === 0, m.errors.slice(0, 3));
      await m.page.close();
    }
  } finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
  const bad = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(checks, null, 1));
  console.log(JSON.stringify({ passed: checks.length - bad.length, total: checks.length, failed: bad.map(c => c.id + ' :: ' + JSON.stringify(c.detail)) }, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
