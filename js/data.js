// GitHub data: live API -> localStorage cache (1 h) -> bundled snapshot in data/. Never throws.
const GH_USER = 'y0c0ms';
const GH_REPOS_URL = 'https://api.github.com/users/' + GH_USER + '/repos?per_page=100';
const IGNORED_REPOS = ['CareerDive'];                      // the site's own repo never becomes a shrine
const CACHE_TTL = 3600 * 1000, FETCH_TIMEOUT = 6000;
const REPO_FIELDS = ['id', 'name', 'full_name', 'html_url', 'description', 'fork', 'language', 'topics', 'stargazers_count', 'forks_count', 'open_issues_count', 'default_branch'];

const store = {
  get(key) { try { const v = JSON.parse(localStorage.getItem(key)); return v && Date.now() - v.t < CACHE_TTL ? v.d : null; } catch (e) { return null; } },
  set(key, d) { try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* storage full or blocked */ } }
};
const ignored = new Set(IGNORED_REPOS.map(n => n.toLowerCase()));
const shrineRepos = list => list.filter(r => !r.fork && !ignored.has(String(r.name).toLowerCase()));
const slim = r => Object.fromEntries(REPO_FIELDS.map(k => [k, r[k]]));

function timedFetch(url, opts) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  return fetch(url, Object.assign({ signal: ctl.signal }, opts)).finally(() => clearTimeout(tm));
}
async function bundledJson(path) { const r = await fetch(path); if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); }

// -> { repos: [shrine repos in API order], source: 'cache' | 'live' | 'bundled' }
async function loadRepos() {
  const cached = store.get('dd:repos');
  if (cached) return { repos: shrineRepos(cached), source: 'cache' };
  try {
    const r = await timedFetch(GH_REPOS_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) throw new Error('empty list');
    store.set('dd:repos', list.map(slim));
    return { repos: shrineRepos(list), source: 'live' };
  } catch (e) {
    return { repos: shrineRepos(await bundledJson('data/repos.json')), source: 'bundled' };
  }
}

// -> { text } | { none: true } (repo has no README) | { error: 'message' }
let readmeIndex = null;
async function bundledReadme(repo) {
  try {
    readmeIndex = readmeIndex || await bundledJson('data/readme-index.json');
    const e = readmeIndex[repo.full_name];
    if (!e) return { error: 'README unavailable offline.' };
    if (e.status === 404 || !e.file) return { none: true };
    const r = await fetch('data/readme/' + e.file);
    return r.ok ? { text: await r.text() } : { error: 'README unavailable offline.' };
  } catch (e) { return { error: 'README unavailable offline.' }; }
}
async function loadReadme(repo) {
  const key = 'dd:readme:' + repo.full_name, cached = store.get(key);
  if (cached) return cached.none ? { none: true } : { text: cached.text };
  try {
    const r = await timedFetch('https://api.github.com/repos/' + repo.full_name + '/readme', { headers: { Accept: 'application/vnd.github.v3.raw' } });
    if (r.status === 404) { store.set(key, { none: true }); return { none: true }; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    store.set(key, { text });
    return { text };
  } catch (e) { return bundledReadme(repo); }
}
