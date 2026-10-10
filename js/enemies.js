// Dangerous wildlife: jellyfish and cave anglerfish. Danger is telegraphed by a brighter "hot" copy of each sheet that pulses,
// hitboxes are smaller than the sprites, and the anglerfish patrols with slow lurches. Spawning rules live in Scenery.enemyOk (segments.js).
const ENEMY_KINDS = { jelly: 'jellyfish', angler: 'anglerfish' };
const HIT_BODY = 0.64, LURE_BOX = 6;           // hitbox = 64 % of the sprite; the angler lure is a 6x6 px box
const INVULN_S = 1.2, MAX_HEARTS = 3, KNOCK = 520;

// brighter tentacles (below the bell) for a jellyfish frame
function hotJelly(cv) {
  const out = mkCanvas(cv.w, cv.h), src = cv.x.getImageData(0, 0, cv.w, cv.h).data, y0 = Math.round(cv.h * 0.36);
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    const o = (y * cv.w + x) * 4; if (!src[o + 3]) continue;
    const c = rgb2hex([src[o], src[o + 1], src[o + 2]]);
    px(out.x, x, y, y >= y0 ? mix(c, PAL.sun[2], y > cv.h * 0.7 ? 0.8 : 0.55) : y >= y0 - 2 ? mix(c, PAL.caustic[0], 0.35) : c);
  }
  return out;
}
// every frame of the angler gets 6 px of padding top/right so the lure halo fits; the hot copy brightens the lure and adds a halo
const LURE_PAD = 6;
function lureCentroid(cv) {
  const d = cv.x.getImageData(0, 0, cv.w, cv.h).data, bright = [PAL.sun[0], PAL.sun[1], PAL.sun[2]].map(hex2rgb); let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < cv.h * 0.5; y++) for (let x = Math.floor(cv.w * 0.6); x < cv.w; x++) {
    const o = (y * cv.w + x) * 4; if (d[o + 3] && bright.some(b => Math.abs(b[0] - d[o]) + Math.abs(b[1] - d[o + 1]) + Math.abs(b[2] - d[o + 2]) < 12)) { sx += x; sy += y; n++; }
  }
  return n ? [sx / n, sy / n] : [cv.w * 0.88, cv.h * 0.15];
}
function padAngler(cv) { const out = mkCanvas(cv.w + LURE_PAD, cv.h + LURE_PAD); out.x.drawImage(cv.c, 0, LURE_PAD); return out; }
function hotAngler(cv, lure) {
  const out = mkCanvas(cv.w, cv.h); out.x.drawImage(cv.c, 0, 0);
  const d = out.x.getImageData(0, 0, cv.w, cv.h).data, solid = (x, y) => x >= 0 && y >= 0 && x < cv.w && y < cv.h && d[(y * cv.w + x) * 4 + 3];
  const lx = Math.round(lure[0]), ly = Math.round(lure[1]), glow = [];
  for (let y = ly - 4; y <= ly + 4; y++) for (let x = lx - 4; x <= lx + 4; x++) {
    const r = Math.hypot(x - lx, y - ly); if (r > 4.2 || solid(x, y)) continue;
    if (r <= 2.6 || ((x + y) & 1) === 0) glow.push([x, y, r <= 2.6 ? PAL.sun[0] : PAL.sun[1]]);
  }
  glow.forEach(([x, y, c]) => { if (x >= 0 && y >= 0 && x < cv.w && y < cv.h) px(out.x, x, y, c); });
  for (let y = ly - 2; y <= ly + 2; y++) for (let x = lx - 2; x <= lx + 2; x++) if (solid(x, y) && Math.hypot(x - lx, y - ly) <= 2) px(out.x, x, y, (x + y) & 1 ? PAL.cloud[2] : PAL.sun[2]);
  return out;
}
// -> { frames: [normal..., hot...], base: n, lure: [x, y] in frame coords | null, sprite: [w, h] of the drawn animal }
function withHot(key, frames) {
  if (key === 'angler') { const padded = frames.map(padAngler), lure = lureCentroid(padded[0]); return { frames: padded.concat(padded.map(f => hotAngler(f, lure))), base: frames.length, lure, sprite: [frames[0].w, frames[0].h] }; }
  return { frames: frames.concat(frames.map(hotJelly)), base: frames.length, lure: null, sprite: [frames[0].w, frames[0].h] };
}

// slow patrol with lurches: speed pulses between ~0.1x and ~1.9x. p = phase in cycles (one cycle = there and back); returns offset -1..1 and heading
function patrol(p, k = 3, amp = 0.9) {
  const h = Math.floor(p * 2), u = p * 2 - h, pos = u + amp / (2 * Math.PI * k) * (1 - Math.cos(2 * Math.PI * k * u));
  return h % 2 === 0 ? { off: -1 + 2 * pos, dir: 1 } : { off: 1 - 2 * pos, dir: -1 };
}

// dims[key] = { fw, fh (frame), w, h (animal), lure }. The animal sits at the frame's bottom-left corner when padded (angler only).
// hitboxes of one creature in world px (centre-based): jellies use the bell + tentacle body, anglers body + lure
function enemyBoxes(c, dims) {
  const d = dims[c.f.sheet]; if (!d) return [];
  const dir = c.img.flipX ? -1 : 1, cx = c.img.x * K, cy = c.img.y * K, padX = d.fw - d.w, padY = d.fh - d.h;
  const boxes = [{ cx: cx + dir * (-padX / 2) * K, cy: cy + (padY / 2) * K, w: d.w * K * HIT_BODY, h: d.h * K * HIT_BODY, kind: ENEMY_KINDS[c.f.kind], part: 'body' }];
  if (d.lure) boxes.push({ cx: cx + dir * (d.lure[0] - d.fw / 2) * K, cy: cy + (d.lure[1] - d.fh / 2) * K, w: LURE_BOX * K, h: LURE_BOX * K, kind: ENEMY_KINDS[c.f.kind], part: 'lure' });
  return boxes;
}
