// Pixel-art HUD: one low-resolution canvas (1 unit = S css px, nearest-neighbour) drawn with the game's 3x5 pixel font.
// Left: distance, shrine counter + progress bar, hearts, boost meter. Right: key caps that dissolve to a compact version after a while.
const $ = id => document.getElementById(id);
const HUD_H = 11, HUD_FULL_MS = 8000, HUD_FADE_MS = 650;
const HUD_KEYS = [['AD', 'SWIM'], ['WS', 'UP DOWN'], ['SHIFT', 'BOOST'], ['ESC', 'CLOSE'], ['R', 'RESTART']];
const HUD = {
  cv: null, ctx: null, S: 3, w: 0, padL: 0, padR: 0, touch: false, full: true, fullSince: 0, fade: null, key: '', last: null
};

(function initHud() {
  const cv = $('hud'), ctx = cv.getContext('2d'), C = { ink: PAL.rock[0], shade: PAL.rock[1], mid: PAL.rock[2], txt: PAL.caustic[0], dim: PAL.caustic[2], sun: PAL.sun[1], sunL: PAL.sun[2],
    teal: PAL.teal[2], tealD: PAL.teal[0], red: PAL.crimson[1], redL: PAL.crimson[2], redD: PAL.crimson[0], bar: 'rgba(42,52,40,0.55)', cap: PAL.cloud[1], capD: PAL.cloud[0], capL: PAL.cloud[2] };
  HUD.cv = cv; HUD.ctx = ctx;

  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }, P = (x, y, c) => R(x, y, 1, 1, c);
  const EXTRA = { '?': ['xx.', '..x', '.x.', '...', '.x.'], ':': ['...', '.x.', '...', '.x.', '...'] };
  const glyph = ch => EXTRA[ch] || FONT[ch] || FONT[' '];
  const textW = s => s.length * 4 - 1;
  function text(s, x, y, c, shadow = true) {
    for (let k = 0; k < s.length; k++) glyph(s[k]).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === 'x') { if (shadow) P(x + k * 4 + i + 1, y + j + 1, C.ink); } });
    for (let k = 0; k < s.length; k++) glyph(s[k]).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === 'x') P(x + k * 4 + i, y + j, c); });
    return x + textW(s) + 1;
  }
  const HEART = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  function heart(x, y, full, hot) {
    const on = (i, j) => (HEART[j] || '')[i] === 'x';
    HEART.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === 'x') {
      const edge = !on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1);
      P(x + i, y + j, edge ? (full ? C.redD : C.ink) : full ? (hot || (j < 2 && i < 3) ? C.redL : C.red) : C.shade); } });
  }
  const BOLT = ['..xx', '.xx.', 'xxxx', '..xx', '.xx.', 'xx..'];
  const SHRINE = ['.xxx.', 'x...x', 'x.x.x', 'x.x.x', 'xxxxx'];
  function icon(rows, x, y, c) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'x') { P(x + i + 1, y + j + 1, C.ink); } });
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'x') P(x + i, y + j, c); }); }
  function meter(x, y, w, h, frac, c, tick) {
    R(x - 1, y - 1, w + 2, h + 2, C.ink); R(x, y, w, h, C.shade);
    const f = Math.round(w * Math.max(0, Math.min(1, frac))); if (f > 0) { R(x, y, f, h, c); R(x, y, f, 1, C.txt); }
    if (tick) R(x + Math.round(w * tick), y - 1, 1, h + 2, C.sunL);
  }
  function cap(label, x, y, small) {
    const w = label.length * 4 + 1, c = small ? C.capD : C.cap;
    R(x, y + 1, w + 2, 7, C.ink); R(x + 1, y, w, 7, C.ink); R(x + 1, y + 1, w, 5, c); R(x + 1, y + 6, w, 1, small ? C.mid : C.capD);
    text(label, x + 2, y + 1, C.ink, false); return x + w + 3;
  }

  // ---- hint rows (right side). Each layout returns its width and a painter, so the dissolve can render old and new.
  function hintLayout(mode) {
    const parts = [];
    if (HUD.touch) {
      if (mode === 'full') parts.push({ w: textW('DRAG TO SWIM') + 9, draw: x => text('DRAG TO SWIM', x, 3, C.txt) }, { w: textW('BOOST BUTTON') + 4, draw: x => text('BOOST BUTTON', x, 3, C.sunL) });
    } else if (mode === 'full') {
      HUD_KEYS.forEach(([keys, label]) => {
        const kw = keys === 'AD' || keys === 'WS' ? 2 * (4 + 3) + 1 : keys.length * 4 + 3;
        parts.push({ w: kw + 2 + textW(label) + 5, draw: x => { let cx = x; if (keys === 'AD' || keys === 'WS') for (const ch of keys) cx = cap(ch, cx, 1, false) + 1; else cx = cap(keys, cx, 1, false); text(label, cx + 1, 3, C.txt); } });
      });
    } else {
      HUD_KEYS.forEach(([keys]) => {
        const sep = keys === 'AD' || keys === 'WS' ? keys.split('') : [keys];
        parts.push({ w: sep.reduce((a, k) => a + k.length * 4 + 4, 0) + 1, draw: x => { let cx = x; sep.forEach(k => { cx = cap(k, cx, 1, true) + 1; }); } });
      });
    }
    parts.push({ w: 9, draw: x => cap('?', x, 1, mode !== 'full') });
    return { w: parts.reduce((a, p) => a + p.w, 0), parts };
  }
  function paintHints(layout, x0) { let x = x0; for (const p of layout.parts) { p.draw(x); x += p.w; } }

  // ---- main draw
  HUD.layout = () => {
    const S = Math.max(2, Math.floor(innerHeight / 270)); HUD.S = S;
    HUD.w = Math.ceil(innerWidth / S);
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:0 env(safe-area-inset-right,0px) 0 env(safe-area-inset-left,0px)';
    document.body.appendChild(probe); const cs = getComputedStyle(probe);
    HUD.padL = Math.ceil((parseFloat(cs.paddingLeft) || 0) / S); HUD.padR = Math.ceil((parseFloat(cs.paddingRight) || 0) / S); probe.remove();
    cv.width = HUD.w; cv.height = HUD_H; cv.style.width = HUD.w * S + 'px'; cv.style.height = HUD_H * S + 'px';
    document.documentElement.style.setProperty('--hud-h', HUD_H * S + 'px'); HUD.key = '';
  };

  function render(st, mode) {
    const w = HUD.w; ctx.clearRect(0, 0, w, HUD_H);
    R(0, 0, w, HUD_H - 1, C.bar); R(0, HUD_H - 1, w, 1, 'rgba(42,52,40,0.8)');
    let x = HUD.padL + 3;
    x = text('DIST', x, 3, C.dim) + 3; x = text(String(st.dist).padStart(4, '0') + 'M', x, 3, C.txt) + 6;
    icon(SHRINE, x, 3, C.sunL); x += 7; x = text(st.found + '/' + st.total, x, 3, C.sunL) + 2;
    meter(x + 1, 4, 20, 3, st.total ? st.found / st.total : 0, C.sun); x += 25;
    for (let i = 0; i < 3; i++) heart(x + i * 8, 2, i < st.hearts, st.blink); x += 3 * 8 + 5;
    icon(BOLT, x, 2, st.boosting ? C.sunL : st.lock ? C.red : C.teal); x += 7;
    meter(x, 4, 24, 3, st.stamina, st.boosting ? C.sunL : st.lock || st.stamina < 0.15 ? C.red : C.teal, 0.15); x += 28;
    const avail = w - x - HUD.padR - 6;
    let right = hintLayout(mode);
    if (right.w > avail) right = hintLayout('compact');
    if (right.w > avail) right = { w: 9, parts: [hintLayout('compact').parts.pop()] };
    if (right.w <= avail) paintHints(right, w - HUD.padR - 2 - right.w);
  }

  HUD.draw = st => {
    const now = performance.now();
    if (HUD.full && now - HUD.fullSince > HUD_FULL_MS) HUD.setFull(false);
    const mode = HUD.fade ? 'fade' : HUD.full ? 'full' : 'compact', blink = !!st.blink;
    const key = [st.dist, st.found, st.total, st.hearts, blink, Math.round(st.stamina * 40), st.boosting, st.lock, mode, HUD.touch, HUD.w, HUD.S].join();
    if (key === HUD.key && !HUD.fade) return; HUD.key = key; HUD.last = st;
    cv.dataset.hint = HUD.touch ? 'touch' : 'keys'; cv.dataset.hints = HUD.full ? 'full' : 'compact';
    cv.setAttribute('aria-label', `Distance ${st.dist} meters, found ${st.found} of ${st.total}, hearts ${st.hearts}, boost ${Math.round(st.stamina * 100)} percent`);
    if (mode !== 'fade') { render(st, mode); return; }
    // dissolve between the two hint layouts: render both, then pick pixels by an irregular threshold
    const p = Math.min(1, (now - HUD.fade.t0) / HUD_FADE_MS);
    render(st, HUD.fade.from); const a = ctx.getImageData(0, 0, HUD.w, HUD_H);
    render(st, HUD.fade.to); const b = ctx.getImageData(0, 0, HUD.w, HUD_H), x0 = HUD.w - 330 > 0 ? HUD.w - 330 : 0;
    for (let y = 0; y < HUD_H; y++) for (let x = x0; x < HUD.w; x++) { if (bayer(x, y) >= p) { const o = (y * HUD.w + x) * 4; b.data[o] = a.data[o]; b.data[o + 1] = a.data[o + 1]; b.data[o + 2] = a.data[o + 2]; b.data[o + 3] = a.data[o + 3]; } }
    ctx.putImageData(b, 0, 0);
    if (p >= 1) { HUD.fade = null; HUD.key = ''; }
  };
  HUD.setFull = full => {
    if (HUD.full === full) return;
    HUD.fade = { from: HUD.full ? 'full' : 'compact', to: full ? 'full' : 'compact', t0: performance.now() }; HUD.full = full; HUD.fullSince = performance.now();
  };
  HUD.toggle = () => HUD.setFull(!HUD.full);
  HUD.setTouch = t => { HUD.touch = t; HUD.full = true; HUD.fade = null; HUD.fullSince = performance.now(); HUD.key = ''; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); HUD.toggle(); });
  addEventListener('resize', () => { HUD.layout(); if (HUD.last) HUD.draw(HUD.last); });
  HUD.fullSince = performance.now(); HUD.layout();

  // ---- round boost button (touch), same pixel style: 19x19 units shown at 4x
  const bcv = $('boost-cv'), bx = bcv.getContext('2d'), BB = ['..xx', '.xx.', 'xxxx', '..xx', '.xx.', 'xx..'];
  HUD.drawBoostButton = on => {
    bx.clearRect(0, 0, 19, 19); const c = 9;
    for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) {
      const d = Math.hypot(x - c, y - c); if (d > 9.3) continue;
      bx.fillStyle = d > 8.2 ? C.ink : d > 6.6 ? (on ? C.sunL : C.cap) : (x + y < 14 && d < 6 ? (on ? PAL.sun[2] : PAL.sun[1]) : (on ? PAL.sun[1] : PAL.sun[0]));
      bx.fillRect(x, y, 1, 1);
    }
    bx.fillStyle = C.ink; BB.forEach((row, j) => { for (let i = 0; i < 4; i++) if (row[i] === 'x') bx.fillRect(7 + i + (on ? 1 : 0), 6 + j + (on ? 1 : 0), 1, 1); });
  };
  HUD.drawBoostButton(false);
})();
