// node tools/shot.cjs [--size 1280x720] [--wait 2500] [--out shot.png]   screenshots index.html (served locally), prints page errors + colour stats
const fs = require('fs'), path = require('path'), http = require('http');
const pp = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const [W, H] = arg('size', '1280x720').split('x').map(Number), OUT = arg('out', 'shot.png'), WAIT = +arg('wait', 2500);
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
srv.listen(0, async () => {
  const b = await pp.launch({ executablePath: '/usr/bin/chromium-browser', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); await p.setViewport({ width: W, height: H }); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  await p.goto('http://localhost:' + srv.address().port + '/index.html'); await new Promise(r => setTimeout(r, WAIT));
  await p.screenshot({ path: OUT }); const c = await p.evaluate(() => { const k = document.querySelector('canvas'); const r = k && k.getBoundingClientRect(); return r ? [r.x, r.y, r.width, r.height].map(Math.round) : null; });
  console.log(JSON.stringify({ out: OUT, canvasRect: c, errors: errs.slice(0, 5) })); await b.close(); srv.close();
});
