// DOM UI: project popup, end screens, touch joystick and boost button, rotate-to-landscape overlay, keyboard input.
const UI = {
  touch: false, portrait: false, keys: new Set(), stick: { x: 0, y: 0 }, boostBtn: false, onRestart: null, onClose: null,
  get paused() { return this.touch && this.portrait; },
  boostHeld() { return this.keys.has('shift') || this.boostBtn; },
  axis() {   // x: -1 left .. 1 right; y: -1 rise .. 1 dive
    const k = this.keys, has = (...n) => n.some(v => k.has(v));
    const kx = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0);
    const ky = (has('s', 'arrowdown') ? 1 : 0) - (has('w', 'arrowup', ' ') ? 1 : 0);
    return { x: kx || this.stick.x, y: ky || this.stick.y };
  }
};

// ---------- touch / orientation
(function initTouch() {
  const coarse = matchMedia('(pointer: coarse)'), root = document.documentElement;
  const apply = () => { root.classList.toggle('touch', UI.touch); HUD.setTouch(UI.touch); dispatchEvent(new Event('dd:touch')); };
  const orient = () => { UI.portrait = innerHeight > innerWidth; $('rotate').classList.toggle('hidden', !UI.paused); if (!UI.paused) { resetStick(); resetBoost(); } };
  // joystick: analog, one tracked pointer so other fingers (popup, restart tap) stay independent
  const base = $('stick'), knob = $('stick-knob'); let pid = null, cx = 0, cy = 0, R = 40;
  function move(e) {
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    knob.style.transform = `translate(${dx * R}px,${dy * R}px)`;
    const dz = 0.14, s = v => Math.abs(v) < dz ? 0 : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz);
    UI.stick.x = s(dx); UI.stick.y = s(dy);
  }
  function resetStick() { pid = null; UI.stick.x = UI.stick.y = 0; knob.style.transform = 'translate(0,0)'; }
  base.addEventListener('pointerdown', e => {
    if (pid !== null) return; pid = e.pointerId; try { base.setPointerCapture(pid); } catch (err) { /* pointer already gone */ }
    const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.34; move(e); e.preventDefault();
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(t, e => { if (e.pointerId === pid) resetStick(); });

  // boost button: its own tracked pointer, so it works together with the joystick
  const bbtn = $('boost'); let bid = null;
  function resetBoost() { bid = null; UI.boostBtn = false; HUD.drawBoostButton(false); }
  bbtn.addEventListener('pointerdown', e => {
    if (bid !== null) return; bid = e.pointerId; try { bbtn.setPointerCapture(bid); } catch (err) { /* pointer already gone */ }
    UI.boostBtn = true; HUD.drawBoostButton(true); e.preventDefault();
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) bbtn.addEventListener(t, e => { if (e.pointerId === bid) resetBoost(); });
  UI.releaseControls = () => { resetStick(); resetBoost(); };

  UI.touch = coarse.matches; apply(); orient();
  coarse.addEventListener('change', e => { UI.touch = e.matches; apply(); orient(); });
  addEventListener('resize', orient); addEventListener('orientationchange', orient);
  // first real touch on a hybrid device switches the touch UI on; first tap also tries to lock landscape
  let locked = false;
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && !UI.touch) { UI.touch = true; apply(); orient(); }
    if (e.pointerType === 'touch' && !locked) {
      locked = true;
      try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (err) { /* not supported */ }
    }
  }, { capture: true, passive: true });

})();

// ---------- keyboard
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k) && !(e.target.closest && e.target.closest('#modal-readme'))) e.preventDefault();
  if (k === 'h' || k === '?') { HUD.toggle(); return; }
  if (k === 'escape') { if (UI.onClose) UI.onClose(); return; }
  if (k === 'r') { if (UI.onRestart) UI.onRestart(); return; }
  UI.keys.add(k);
});
addEventListener('keyup', e => UI.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => UI.keys.clear());
UI.flash = () => { const f = $('flash'); f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit'); };
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- end screens
UI.end = (mode, found, total) => {
  const el = $('end');
  if (!mode) { el.classList.add('hidden'); return; }
  $('end-title').textContent = mode === 'crashed' ? 'CRASHED' : 'EXPLORATION COMPLETE';
  $('end-sub').textContent = mode === 'finished' ? 'found ' + found + ' / ' + total + ' projects' : '';
  $('end-hint').textContent = UI.touch ? 'tap to ' + (mode === 'crashed' ? 'try again' : 'dive again') : 'Press R ' + (mode === 'crashed' ? 'to try again' : 'to dive again');
  el.classList.remove('hidden');
};
$('end').addEventListener('pointerdown', e => { e.preventDefault(); if (UI.onRestart) UI.onRestart(); });

// ---------- project popup
const modal = { repo: null, token: 0 };
const BLOCKED_TAGS = 'script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select,svg,math,audio,video,source,frame,frameset,template';
function sanitizeReadme(html, repo) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), raw = 'https://raw.githubusercontent.com/' + repo.full_name + '/' + (repo.default_branch || 'HEAD') + '/';
  const blob = 'https://github.com/' + repo.full_name + '/blob/' + (repo.default_branch || 'HEAD') + '/';
  doc.body.querySelectorAll(BLOCKED_TAGS).forEach(n => n.remove());
  doc.body.querySelectorAll('*').forEach(n => {
    for (const a of [...n.attributes]) if (/^on/i.test(a.name) || a.name === 'style' || a.name === 'srcdoc' || a.name === 'formaction') n.removeAttribute(a.name);
  });
  const abs = (u, base) => { try { return new URL(u, base).href; } catch (e) { return ''; } };
  doc.body.querySelectorAll('img').forEach(n => {
    const s = n.getAttribute('src') || ''; const u = /^https?:\/\//i.test(s) ? abs(s) : s.startsWith('//') ? abs('https:' + s) : /^(javascript|data|vbscript):/i.test(s) ? '' : abs(s.replace(/^\.?\//, ''), raw);
    if (u) { n.setAttribute('src', u); n.setAttribute('loading', 'lazy'); n.removeAttribute('srcset'); } else n.remove();
  });
  doc.body.querySelectorAll('a').forEach(n => {
    const h = n.getAttribute('href') || '';
    if (/^(javascript|data|vbscript):/i.test(h.trim())) { n.removeAttribute('href'); return; }
    if (h.startsWith('#')) { n.removeAttribute('href'); return; }
    if (!/^(https?:|mailto:)/i.test(h)) n.setAttribute('href', abs(h.replace(/^\.?\//, ''), blob));
    n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer');
  });
  const hero = pickHero(doc);
  return { html: doc.body.innerHTML, hero };
}

// ---- hero media: the first real picture (not a badge) or the first video link of the README, taken out of the text flow
const BADGE_RE = /shields\.io|badge|travis-ci|codecov\.io|badgen|\/actions\/workflows\/|[?&]branch=|sonarcloud|codacy\.com\/project/i;
const VIDEO_RE = /^https:\/\/github\.com\/user-attachments\/assets\/[\w-]+|\.(mp4|webm|mov)(\?[^#]*)?(#.*)?$/i;
function isBadge(img) {
  const src = img.getAttribute('src') || '', w = parseInt(img.getAttribute('width'), 10), h = parseInt(img.getAttribute('height'), 10), a = img.closest('a');
  return BADGE_RE.test(src) || (a && /badge/i.test(a.getAttribute('href') || '')) || (w > 0 && w < 120) || (h > 0 && h < 120);
}
function dropFromFlow(node) {
  let p = node;
  while (p.parentElement && p.parentElement !== node.ownerDocument.body && ['A', 'P', 'SPAN', 'CENTER', 'DIV', 'PICTURE'].includes(p.parentElement.tagName) && !p.parentElement.textContent.trim() && p.parentElement.querySelectorAll('img').length <= 1) p = p.parentElement;
  p.remove();
}
function pickHero(doc) {
  const els = doc.body.querySelectorAll('img, a'), isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };
  for (const el of els) {
    if (el.tagName === 'IMG') {
      if (isBadge(el) || !isHttps(el.getAttribute('src'))) continue;
      const hero = { type: 'img', src: el.getAttribute('src'), alt: el.getAttribute('alt') || '' }; dropFromFlow(el); return hero;
    }
    const href = el.getAttribute('href') || '';
    if (isHttps(href) && VIDEO_RE.test(href) && !el.querySelector('img')) { const hero = { type: 'video', src: href }; dropFromFlow(el); return hero; }
  }
  return null;
}
function buildHero(hero) {
  const box = $('modal-hero'); box.textContent = '';
  const wait = document.createElement('div'); wait.className = 'hero-wait'; wait.textContent = 'loading...'; box.appendChild(wait);
  const fail = () => {                                        // broken media: back to the plain text layout
    if (hero.type === 'video') { box.textContent = ''; const a = document.createElement('a'); a.href = hero.src; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'hero-link'; a.textContent = 'open video'; box.appendChild(a); }
    else { box.textContent = ''; $('modal').classList.remove('has-hero'); }
  };
  if (hero.type === 'img') {
    const img = new Image(); img.referrerPolicy = 'no-referrer'; img.decoding = 'async'; img.alt = hero.alt; img.className = 'hero-media';
    img.onload = () => { wait.remove(); box.classList.add('ready'); }; img.onerror = fail; img.src = hero.src; box.appendChild(img);
  } else {
    const v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.controls = true; v.preload = 'metadata'; v.className = 'hero-media';
    v.setAttribute('muted', ''); v.setAttribute('loop', ''); v.setAttribute('playsinline', ''); v.setAttribute('referrerpolicy', 'no-referrer');
    v.addEventListener('loadeddata', () => { wait.remove(); box.classList.add('ready'); }); v.addEventListener('error', fail); v.src = hero.src; box.appendChild(v);
    const p = v.play && v.play(); if (p && p.catch) p.catch(() => {});
  }
  $('modal').classList.add('has-hero');
}
modal.open = function (repo) {
  const tok = ++modal.token; modal.repo = repo;
  $('modal-name').textContent = repo.name;
  $('modal-stats').innerHTML = '';
  const stat = (t, cls) => { const s = document.createElement('span'); s.textContent = t; if (cls) s.className = cls; $('modal-stats').appendChild(s); };
  stat('★ ' + (repo.stargazers_count || 0) + ' stars'); stat((repo.forks_count || 0) + ' forks'); stat((repo.open_issues_count || 0) + ' open issues'); stat(repo.language || 'no language', 'lang');
  const tp = $('modal-topics'); tp.textContent = '';
  (repo.topics || []).forEach(t => { const s = document.createElement('span'); s.textContent = t; tp.appendChild(s); });
  $('modal-desc').textContent = repo.description || 'No description.';
  const link = $('modal-link'); link.href = repo.html_url; link.textContent = 'open on GitHub ↗';
  const rd = $('modal-readme'); rd.textContent = 'loading README…'; rd.scrollTop = 0;
  $('modal').classList.remove('has-hero'); $('modal-hero').textContent = ''; $('modal-hero').classList.remove('ready');
  $('modal').classList.remove('hidden'); document.documentElement.classList.add('modal-open'); UI.releaseControls();
  loadReadme(repo).then(res => {
    if (tok !== modal.token) return;                      // the player moved on
    if (res.none) rd.textContent = 'No README';
    else if (res.error) rd.textContent = res.error;
    else { const r = sanitizeReadme(marked.parse(res.text, { gfm: true, async: false }), repo); rd.innerHTML = r.html; if (r.hero) buildHero(r.hero); }
    rd.scrollTop = 0;
  });
};
modal.close = function () { modal.token++; modal.repo = null; $('modal').classList.add('hidden'); document.documentElement.classList.remove('modal-open'); const v = $('modal-hero').querySelector('video'); if (v) v.pause(); $('modal-hero').textContent = ''; $('modal').classList.remove('has-hero'); };
modal.isOpen = () => !$('modal').classList.contains('hidden');
$('modal-close').addEventListener('click', () => { if (UI.onClose) UI.onClose(); });
