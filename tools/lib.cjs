// Shared helpers for the tools in this folder: static server, headless browser, GitHub request interception, synthetic repo lists.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const pp = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), DATA = path.join(ROOT, 'data');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.md': 'text/markdown' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,OPTIONS' };
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function serve(root = ROOT) {
  return new Promise(resolve => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, path.normalize(p));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}
const launch = (extra = {}) => pp.launch(Object.assign({ executablePath: process.env.CHROME || '/usr/bin/chromium-browser', headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio'] }, extra));

const bundled = () => ({ repos: JSON.parse(fs.readFileSync(path.join(DATA, 'repos.json'), 'utf8')), index: JSON.parse(fs.readFileSync(path.join(DATA, 'readme-index.json'), 'utf8')) });

// n non-fork repos: the bundled ones first (when n is larger they are kept in order), extra ones cloned with new names, languages and stars
function synthRepos(base, n) {
  const real = base.filter(r => !r.fork), langs = ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go', 'C', 'Kotlin', 'Shell', 'Svelte', 'HTML', 'Ruby', 'Zig', null];
  const out = real.slice(0, n);
  for (let i = real.length; out.length < n; i++) {
    const src = real[i % real.length], name = 'synth-' + src.name.toLowerCase() + '-' + i;
    out.push(Object.assign({}, src, { id: 9e6 + i, name, full_name: 'y0c0ms/' + name, language: langs[(i * 7) % langs.length], stargazers_count: (i * 5) % 11 === 0 ? 7 : (i % 3 === 0 ? 2 : 0) }));
  }
  return out;
}

// answers api.github.com (and raw.githubusercontent.com) from local data; opts.repos overrides the list, opts.block aborts every github request
async function intercept(page, opts = {}) {
  const { repos, index } = bundled(), list = opts.repos || repos, external = new Set(), log = { api: 0, aborted: 0 };
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = new URL(req.url());
    if (['data:', 'blob:'].includes(u.protocol) || ['127.0.0.1', 'localhost'].includes(u.hostname)) return req.continue();
    if (opts.block && /github/.test(u.hostname)) { log.aborted++; return req.abort('internetdisconnected'); }
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS });
    if (u.hostname === 'api.github.com') {
      log.api++;
      if (/^\/users\/[^/]+\/repos/.test(u.pathname)) return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(list) });
      const m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/readme/), e = m && index[m[1]];
      if (e && e.status === 200) return req.respond({ status: 200, contentType: 'text/plain; charset=utf-8', headers: CORS, body: fs.readFileSync(path.join(DATA, 'readme', e.file)) });
      return req.respond({ status: 404, contentType: 'application/json', headers: CORS, body: '{"message":"Not Found"}' });
    }
    if (u.hostname === 'raw.githubusercontent.com') return req.respond({ status: 200, contentType: 'image/png', headers: CORS, body: PNG1 });
    external.add(u.hostname); return req.respond({ status: 200, contentType: 'text/plain', headers: CORS, body: '' });
  });
  return { external, log };
}
const hookReady = (page, ms = 20000) => page.waitForFunction(() => window.__test && window.__test.state && window.__test.state(), { timeout: ms });
module.exports = { ROOT, DATA, serve, launch, bundled, synthRepos, intercept, hookReady, sleep };
