// Scenery: sprite library (built once, size independent of the world), zone-blended backdrops and the painter
// that composes a 512-px world segment from library sprites. Segments are repainted into a small pool of canvases.
const SEG_W = 512, SEG_POOL = 4, TILE_W = 1024, GW_MIN = 480, GW_MAX = 1024;
// Tall (phone) views show extra rows above the sky line and below the seabed. Segment canvases and the backdrop therefore carry PADT rows above
// world row 0 and PADB rows below row GH; the world proper (rows 0..GH-1, everything physics knows about) is unchanged.
const PADT = 72, PADB = 110, SEGH = PADT + GH + PADB;

// ---- 3x5 pixel font for labels
const FONT = {
  A: ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'], B: ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'], C: ['.xx', 'x..', 'x..', 'x..', '.xx'], D: ['xx.', 'x.x', 'x.x', 'x.x', 'xx.'],
  E: ['xxx', 'x..', 'xx.', 'x..', 'xxx'], F: ['xxx', 'x..', 'xx.', 'x..', 'x..'], G: ['.xx', 'x..', 'x.x', 'x.x', '.xx'], H: ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'],
  I: ['xxx', '.x.', '.x.', '.x.', 'xxx'], J: ['..x', '..x', '..x', 'x.x', '.x.'], K: ['x.x', 'x.x', 'xx.', 'x.x', 'x.x'], L: ['x..', 'x..', 'x..', 'x..', 'xxx'],
  M: ['x.x', 'xxx', 'xxx', 'x.x', 'x.x'], N: ['xx.', 'x.x', 'x.x', 'x.x', 'x.x'], O: ['.x.', 'x.x', 'x.x', 'x.x', '.x.'], P: ['xx.', 'x.x', 'xx.', 'x..', 'x..'],
  Q: ['.x.', 'x.x', 'x.x', 'xx.', '.xx'], R: ['xx.', 'x.x', 'xx.', 'x.x', 'x.x'], S: ['.xx', 'x..', '.x.', '..x', 'xx.'], T: ['xxx', '.x.', '.x.', '.x.', '.x.'],
  U: ['x.x', 'x.x', 'x.x', 'x.x', 'xxx'], V: ['x.x', 'x.x', 'x.x', 'x.x', '.x.'], W: ['x.x', 'x.x', 'xxx', 'xxx', 'x.x'], X: ['x.x', 'x.x', '.x.', 'x.x', 'x.x'],
  Y: ['x.x', 'x.x', '.x.', '.x.', '.x.'], Z: ['xxx', '..x', '.x.', 'x..', 'xxx'],
  0: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], 1: ['.x.', 'xx.', '.x.', '.x.', 'xxx'], 2: ['xx.', '..x', '.x.', 'x..', 'xxx'], 3: ['xx.', '..x', '.x.', '..x', 'xx.'],
  4: ['x.x', 'x.x', 'xxx', '..x', '..x'], 5: ['xxx', 'x..', 'xx.', '..x', 'xx.'], 6: ['.xx', 'x..', 'xxx', 'x.x', 'xxx'], 7: ['xxx', '..x', '.x.', '.x.', '.x.'],
  8: ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'], 9: ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
  '-': ['...', '...', 'xxx', '...', '...'], _: ['...', '...', '...', '...', 'xxx'], '.': ['...', '...', '...', '...', '.x.'], '/': ['..x', '..x', '.x.', 'x..', 'x..'], ' ': ['...', '...', '...', '...', '...']
};
function makeLabel(text, accent) {
  const t = text.toUpperCase().slice(0, 28), cv = mkCanvas(t.length * 4 + 7, 9), gems = [[1, 3], [0, 4], [1, 4], [2, 4], [1, 5]];
  const glyph = (ch, ox, col) => (FONT[ch] || FONT[' ']).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === 'x') px(cv.x, ox + i, 2 + j, col); });
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    for (let k = 0; k < t.length; k++) (FONT[t[k]] || FONT[' ']).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === 'x') px(cv.x, 6 + k * 4 + i + dx, 2 + j + dy, PAL.rock[0]); });
  }
  gems.forEach(([x, y]) => px(cv.x, x + 1, y, accent[1]));
  px(cv.x, 2, 4, accent[2]);
  for (let k = 0; k < t.length; k++) glyph(t[k], 6 + k * 4, PAL.caustic[0]);
  return cv;
}

// ---- zone colours as FLAT tone steps (no dithering): the same palette ramps as before, cut into 5 water / 4 haze / 5 sky steps.
// Step edges get a 1-px noisy wobble; nothing here is a 50% dither, so nothing crawls when the view scrolls.
const ZONE_COLOURS = {};
function zoneColours(zone) {
  if (ZONE_COLOURS[zone]) return ZONE_COLOURS[zone];
  const Wt = PAL.water, K0 = PAL.kelp[0], R0 = PAL.rock[0];
  const wt = zone === 'kelp' ? Wt.map(c => mix(c, K0, 0.28)) : zone === 'cave' ? Wt.map(c => mix(c, R0, 0.6)) : Wt;
  const hz = zone === 'kelp' ? mix(PAL.haze[2], K0, 0.35) : zone === 'cave' ? mix(PAL.haze[2], R0, 0.55) : PAL.haze[2];
  const sky = zone === 'kelp' ? [mix(PAL.sky[0], K0, 0.3), mix(PAL.sky[0], PAL.cloud[0], 0.4), PAL.cloud[0]] : PAL.sky;
  const steps = (c, n) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1) * (c.length - 1), j = Math.min(c.length - 2, Math.floor(t)); return mix(c[j], c[j + 1], t - j); });
  return (ZONE_COLOURS[zone] = { water: steps([wt[1], wt[2], wt[3]], 5), haze: steps([wt[3], hz], 4), sky: steps(sky, 5) });
}
const waterStep = y => Math.round(sstep(0, 0.3, (y - SURF) / (GH - SURF)) * 4);      // water tone step of screen row y (no wobble)

// ---- zone tint: the darkening of the cave and the green of the kelp forest, baked into the pixels that carry it.
// Flat steps along depth (3 dark, 2 green) with 1-px noisy edges, one memoised colour table per source colour. It replaces a
// screen-space dither overlay whose lattice did not move with the scenery under it, which is what shimmered while scrolling.
// The ramps (0 at the surface line .. 1 at the floor) and the dark target (the old overlay's 45% rock / 55% haze pixel mix) reproduce its mean
// darkness / green, times the zone weight.
const TINT_D = [0, 0.12, 0.24, 0.36], TINT_G = [0, 0.12, 0.25];               // mix amount toward the dark target / moss[0] for each step
const TINT_DT = [0.06, 0.18, 0.30], TINT_GT = [0.1, 0.2];                       // step thresholds on the weighted ramp amount
const TINT_DA = [0.1, 0.34], TINT_GA = [0.08, 0.2], TINT_WX = 128, TINT_WY = 64;   // ramp = A[0] + A[1] * depth; wobble tile (divides 512 and 1024)
const tintMemo = new Map(), TINT_DK = hex2rgb(mix(PAL.rock[0], PAL.haze[2], 0.55)), TINT_GK = hex2rgb(PAL.moss[0]);
let tintWob = null;
function tintTable(c) {
  let t = tintMemo.get(c); if (t) return t;
  t = new Uint32Array(12); const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
  for (let dl = 0; dl < 4; dl++) for (let gl = 0; gl < 3; gl++) {
    const d = TINT_D[dl], k = TINT_G[gl], f = (v, dk, gk) => Math.round((v + (dk - v) * d) * (1 - k) + gk * k);
    t[dl * 3 + gl] = ((255 << 24) | (f(b, TINT_DK[2], TINT_GK[2]) << 16) | (f(g, TINT_DK[1], TINT_GK[1]) << 8) | f(r, TINT_DK[0], TINT_GK[0])) >>> 0;
  }
  tintMemo.set(c, t); return t;
}
function tintPixels(d, w, h, y0, cave, kelp, xo) {     // d: Uint32 pixels of a w*h canvas whose row 0 is screen row y0 and column 0 is world x xo; cave/kelp: weight per column
  const span = GH - SURF, BD = new Float32Array(w * 3), BG = new Float32Array(w * 2); let any = false;
  for (let x = 0; x < w; x++) {
    const c = cave[x], k = kelp[x];
    for (let l = 0; l < 3; l++) { const y = c > 0.01 ? SURF + Math.max(2, (TINT_DT[l] / c - TINT_DA[0]) / TINT_DA[1] * span) : 1e9; BD[x * 3 + l] = y; if (y < GH) any = true; }
    for (let l = 0; l < 2; l++) { const y = k > 0.01 ? SURF + Math.max(2, (TINT_GT[l] / k - TINT_GA[0]) / TINT_GA[1] * span) : 1e9; BG[x * 2 + l] = y; if (y < GH) any = true; }
  }
  if (!any) return false;
  if (!tintWob) {
    const nz = makeNoise(61); tintWob = new Int8Array(TINT_WX * TINT_WY);
    for (let y = 0; y < TINT_WY; y++) for (let x = 0; x < TINT_WX; x++) tintWob[y * TINT_WX + x] = Math.round((nz.fbm(x / 8, y / 4, 2, TINT_WX / 8, TINT_WY / 4) - 0.5) * 3.4 + (hashN(x, y, 61) - 0.5) * 1.1);
  }
  let last = -1, tab = null;
  for (let y = 0; y < h; y++) {
    const sy = y0 + y, wr = (sy & (TINT_WY - 1)) * TINT_WX, o = y * w;
    for (let x = 0; x < w; x++) {
      const c = d[o + x]; if (c >>> 24 !== 255) continue;
      const ly = sy + tintWob[wr + ((xo + x) & (TINT_WX - 1))], x3 = x * 3, x2 = x * 2;
      const dl = (ly >= BD[x3] ? 1 : 0) + (ly >= BD[x3 + 1] ? 1 : 0) + (ly >= BD[x3 + 2] ? 1 : 0), gl = (ly >= BG[x2] ? 1 : 0) + (ly >= BG[x2 + 1] ? 1 : 0);
      if (!(dl | gl)) continue;
      if (c !== last) { last = c; tab = tintTable(c); }
      d[o + x] = tab[dl * 3 + gl];
    }
  }
  return true;
}
function tintVariant(cv, zone, y0) {                    // zone tint for a layer texture that sits at screen row y0 (reef: none)
  if (zone === 'reef') return cv;
  const id = cv.x.getImageData(0, 0, cv.w, cv.h), one = new Float32Array(cv.w).fill(1), none = new Float32Array(cv.w);
  if (tintPixels(new Uint32Array(id.data.buffer), cv.w, cv.h, y0, zone === 'cave' ? one : none, zone === 'kelp' ? one : none, 0)) cv.x.putImageData(id, 0, 0);
  return cv;
}
function tintBack(ctx, x0, zones) {                     // world-anchored: tint the back canvas of the segment at world x0 (internal px)
  const cave = new Float32Array(SEG_W), kelp = new Float32Array(SEG_W); let any = false;
  for (let x = 0; x < SEG_W; x++) { const w = zones.weights((x0 + x) * K); cave[x] = w.cave; kelp[x] = w.kelp; if (w.cave > 0.01 || w.kelp > 0.01) any = true; }
  if (!any) return;
  const id = ctx.getImageData(0, 0, SEG_W, SEGH);          // raw canvas rows: row 0 is world row -PADT
  if (tintPixels(new Uint32Array(id.data.buffer), SEG_W, SEGH, -PADT, cave, kelp, x0)) ctx.putImageData(id, 0, 0);
}

// ---- zone backdrops (water + sky/ceiling), identical size for the three zones so they can be blended
let stepWobTile = null;                                  // 128x64 tile (divides the 1024 texture), row shift of a step edge: smooth along x plus 1-px jitter
function makeBackdrop(W, H, seed, zone) {              // H = PADT + GH: canvas row y is world row y - PADT; the extra top rows continue the sky / cave rock
  const nz = makeNoise(seed), cv = mkCanvas(W, H), Z = zoneColours(zone), span = GH - SURF;
  if (!stepWobTile) { const wn = makeNoise(53); stepWobTile = new Float32Array(128 * 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) stepWobTile[y * 128 + x] = (wn.fbm(x / 8, y / 4, 2, 16, 16) - 0.5) * 2.6 + (hashN(x, y, 53) - 0.5) * 0.9; }
  const wob = (x, y) => stepWobTile[((y & 63) << 7) | (x & 127)];
  paint(cv, (x, y) => {
    y -= PADT;
    if (y < SURF) {
      if (zone === 'cave') { const v = nz.fbm(x / 8, y / 5, 3, W / 8); return v > 0.62 ? PAL.rock[1] : v > 0.3 ? PAL.rock[0] : PAL.midRock[0]; }
      return Z.sky[Math.max(0, Math.min(4, Math.floor((y + wob(x, y)) / (SURF - 2) * 5)))];
    }
    const v = (y - SURF + wob(x, y)) / span, hzv = sstep(0.55, 0.88, v + (nz.fbm(x / W * 6, v * 3, 3, 6, 3) - 0.5) * 0.3) * 0.95, hi = Math.round(hzv / 0.95 * 3);
    return hi ? Z.haze[hi] : Z.water[Math.round(sstep(0, 0.3, v) * 4)];
  });
  return tintVariant(cv, zone, -PADT);
}
// bedrock under the sand for tall views: mirrored sand rows fade out (blue-noise dither) into dark strata; the tile scrolls with the world
function makeSeabedExt(W, H, sand) {
  const nz = makeNoise(131), R = PAL.rock, cv = mkCanvas(W, H);
  paint(cv, (x, y) => {
    const deep = sstep(0, H * 0.8, y), b = nz.fbm(x / 26, y / 3.4, 3, W / 26), c = nz.n2(x / 5, y / 2.2 + 11);
    if (c > 0.86 - 0.1 * (1 - deep) && b > 0.45) return R[2];
    const v = b + 0.18 * (1 - deep) + (nz.n2(x / 3, y / 3 + 40) - 0.5) * 0.12;
    return v > 0.7 ? R[2] : v > 0.46 ? R[1] : R[0];
  });
  for (let j = 0; j < 36 && j < H; j++) cv.x.drawImage(sand.c, 0, 35 - j, W, 1, 0, j, W, 1);
  return cv;
}
function hazeRamp(zone) {
  const H = PAL.haze;
  return zone === 'kelp' ? H.map(c => mix(c, PAL.kelp[0], 0.4)) : zone === 'cave' ? H.map(c => mix(c, PAL.rock[0], 0.6)) : H;
}
function makeClouds(W, H, seed) {
  const rng = makeRng(seed), nz = makeNoise(seed), cv = mkCanvas(W, H), C = PAL.cloud, n = 9, blobs = [];
  for (let i = 0; i < n; i++) {
    const cx = (i + rng() * 0.8) * W / n, cy = 10 + rng() * (H - 18), parts = [];
    for (let k = 0; k < ri(rng, 3, 6); k++) parts.push([cx + (rng() - 0.5) * 46, cy + (rng() - 0.5) * 5, 7 + rng() * 9, 3 + rng() * 4]);
    blobs.push({ cy, parts });
  }
  return paint(cv, (x, y) => {
    for (const b of blobs) for (const [px0, py0, rx, ry] of b.parts) {
      let dx = Math.abs(x - px0); dx = Math.min(dx, W - dx);
      const d = (dx / rx) ** 2 + ((y - py0) / ry) ** 2;
      if (d <= 1 && y <= b.cy + ry * 0.55) { const s = (y - (py0 - ry)) / (2 * ry) + 0.25 * nz.n2(x / 3, y / 2) + 0.4 * (dx / rx) * (x > px0 ? 1 : 0); return s < 0.34 ? C[2] : s < 0.62 ? C[1] : C[0]; }
    }
    return null;
  });
}
// the water surface: a crisp 1-px wave line (the periods divide the tile, so it wraps without a seam) with sky above and the top water step below.
// One strip per zone, blended like the other layers; in the cave the part above the wave is left clear so the rock ceiling shows through.
function makeSurfaceStrip(W, zone) {
  const cv = mkCanvas(W, 6), Z = zoneColours(zone), sky = zone === 'cave' ? null : Z.sky[4], deep = Z.water[0];
  for (let x = 0; x < W; x++) {
    const a = 2 * Math.PI * x / W, yy = 2 + Math.round(1.15 * Math.sin(a * 18 + 0.7) + 0.75 * Math.sin(a * 43 + 2.1));
    for (let y = 0; y < 6; y++) {
      const c = y < yy ? (y === yy - 1 && hashN(x, 3, 5) < 0.1 ? PAL.cloud[2] : sky) : y === yy ? PAL.caustic[0] : y === yy + 1 ? PAL.caustic[2] : deep;
      if (c) px(cv.x, x, y, c);
    }
  }
  return cv;
}

// ---- spires (stalagmites / stalactites) and pillars
function makeSpire(w, h, seed, down) {
  const nz = makeNoise(seed), rng = makeRng(seed), R = PAL.rock, cv = mkCanvas(w, h), cx = (w - 1) / 2, lean = (rng() - 0.5) * w * 0.3;
  return paint(cv, (x, y) => {
    const yy = down ? y : h - 1 - y, t = yy / h, half = Math.max(0.6, (w / 2) * (1 - Math.pow(t, 0.8)) * (0.88 + 0.24 * nz.n2(yy / 5, seed % 7))), d = (x - (cx + lean * t)) / half;
    if (Math.abs(d) > 1) return null;
    if (Math.abs(d) > 0.82 || yy === 0) return R[0];
    const s = nz.fbm(x / 5, yy / 4, 3) - 0.28 * d + 0.08 * (1 - t);
    return s > 0.72 ? R[3] : s > 0.58 ? R[2] : s > 0.42 ? R[1] : R[0];
  });
}
// a pillar with the gap-facing tip at the top (standing) or bottom (hanging); zone styles the stone
function makePillar(w, h, seed, zone, hang) {
  const nz = makeNoise(seed), rng = makeRng(seed), R = PAL.rock, M = PAL.moss, cv = mkCanvas(w, h), mossy = zone === 'kelp' ? 0.55 : zone === 'reef' ? 0.25 : 0.04;
  const edge = [], tipCut = 5;
  for (let y = 0; y < h; y++) edge[y] = [Math.round(nz.n2(y / 7, 3.1) * 2), Math.round(nz.n2(y / 9, 8.4) * 2)];
  paint(cv, (x, y) => {
    const e = hang ? h - 1 - y : y, cut = e < tipCut ? Math.ceil((tipCut - e) * 0.8) : 0, xl = edge[y][0] + cut, xr = w - 1 - edge[y][1] - cut;
    if (x < xl || x > xr) return null;
    const dl = x - xl, dr = xr - x;
    if (e === 0) return R[0];
    if (e < 2 + mossy * 4 * nz.n2(x / 3, 0.5)) return nz.n2(x / 4, 9.2) < mossy + 0.3 ? (e < 1 ? M[1] : M[0]) : R[3];
    if (dr < 2) return R[0];
    if (dl < 1) return R[3];
    const s = nz.fbm(x / 9, y / 5, 3) + 0.16 * (1 - dl / w) - 0.12 * (dr < 5 ? 1 : 0) + (Math.floor(y / 17) % 2 ? 0.05 : -0.05);
    if (nz.n2(x / 3, y / 6 + 4) < mossy * 0.45 && dl < 4) return M[0];
    return s > 0.76 ? R[3] : s > 0.62 ? R[2] : s > 0.46 ? R[1] : R[0];
  });
  for (let k = 0; k < Math.max(2, h / 22); k++) {
    let x = ri(rng, 3, w - 4), y = ri(rng, 4, h - 6), n = ri(rng, 6, 14);
    while (n-- > 0 && y < h - 2 && x > 1 && x < w - 2) { px(cv.x, x, y, R[0]); if (rng() < 0.3) px(cv.x, x + 1, y, R[3]); x += ri(rng, -1, 1); y += rng() < 0.75 ? 1 : 0; }
  }
  return cv;
}
function makePedestal(w, seed) {
  const nz = makeNoise(seed), R = PAL.rock, M = PAL.moss, H = 22, cv = mkCanvas(w, H);
  return paint(cv, (x, y) => {
    const half = (w / 2) * (1 - Math.pow(y / H, 1.25)) * (0.9 + 0.2 * nz.n2(x / 4, y / 3)), d = Math.abs(x - (w - 1) / 2);
    if (d > half) return null;
    if (y < 2) return nz.n2(x / 3, 2) < 0.5 ? M[1] : R[3];
    if (y < 4) return nz.n2(x / 4, 6) < 0.4 ? M[0] : R[2];
    const s = nz.fbm(x / 6, y / 4, 3) - 0.3 * (x - w / 2) / w;
    return d > half - 1.2 ? R[0] : s > 0.7 ? R[3] : s > 0.55 ? R[2] : s > 0.4 ? R[1] : R[0];
  });
}
const BUOY = ['..kkk..', '.kcccck', 'kcrrrck', 'kcrrrck', 'kccccck', '.kkkkk.', '...k...'];
const BUOY_PAL = { k: '#2a3428', c: '#b3cbb6', r: '#d83048' };

// ---- sprite library
function buildLibrary() {
  const L = {}, kinds = ['staghorn', 'pinkbush', 'crimson', 'whip', 'yellow', 'spray', 'chunky', 'mintree'];
  const tiny = kinds.map((k, i) => coralBranch(k, 30 + i, 0.3));
  tiny.push(makeFan(14, 14, 4, PAL.crimson), makeTubes(10, 8, 5, PAL.gold), makeBrain(10, 6, 6, PAL.salmon), makeTable(14, 10, 7, PAL.teal), makeAnemone(10, 10, 8, PAL.pink), makeFan(12, 12, 9, PAL.purple), makeTubes(9, 7, 10, PAL.yellow));
  const tinyKelp = [coralBranch('mintree', 31, 0.3), coralBranch('whip', 33, 0.3), coralBranch('yellow', 34, 0.3), coralBranch('spray', 35, 0.3), makeAnemone(10, 10, 8, PAL.teal), makeTubes(9, 7, 10, PAL.teal)];
  const tinyCave = [coralBranch('spray', 35, 0.3), coralBranch('mintree', 31, 0.3), makeAnemone(10, 10, 8, PAL.purple)];
  const ZN = ['reef', 'kelp', 'cave'];
  L.backdrop = ZN.map((z, i) => makeBackdrop(TILE_W, PADT + GH, 3 + i * 5, z));
  L.haze = ZN.map((z, i) => tintVariant(makeHaze(TILE_W, 165, 5 + i, { base: 0.22, amp: 0.35, lumps: 30, ramp: hazeRamp(z) }), z, 105));
  L.mid = [makeMidReef(TILE_W, 78, 9, tiny, 130), makeMidReef(TILE_W, 78, 12, tinyKelp, 70), makeMidReef(TILE_W, 78, 14, tinyCave, 16)].map((c, i) => tintVariant(c, ZN[i], 173));
  L.clouds = makeClouds(TILE_W, 44, 17); L.surface = ZN.map(z => tintVariant(makeSurfaceStrip(TILE_W, z), z, SURF - 2));
  // light shafts and caustics exist only in the water: texture row 0 is the row under the surface line (screen y SURF + 1); the cave variant is empty
  const SH = GH - SURF - 1, shafts = (seed, n, slope) => [...['reef', 'kelp'].map(z => tintVariant(makeShafts(TILE_W, SH, seed, { n, slope, base: y => zoneColours(z).water[waterStep(SURF + 1 + y)] }), z, SURF + 1)), mkCanvas(TILE_W, SH)];
  const caustic = (h, seed, o) => { const c = makeCaustic(TILE_W, h, seed, o); return [c, c, mkCanvas(TILE_W, h)]; };
  L.shaftsA = shafts(7, 5, 0.26); L.shaftsB = shafts(19, 5, 0.38);
  L.causA = caustic(50, 1, { cx: 28, cy: 2, th: 1.9, fade: 1, glow: 0.55 }); L.causB = caustic(44, 11, { cx: 22, cy: 2, th: 1.5, fade: 1, glow: 0.4 });
  L.sand = makeSand(TILE_W, 36, 4, 32, 3, 10); L.seabedExt = makeSeabedExt(TILE_W, PADB, L.sand);

  const small = { reef: [], kelp: [], cave: [] };
  kinds.forEach((k, i) => { small.reef.push(coralBranch(k, 200 + i, 0.4), coralBranch(k, 220 + i, 0.62)); });
  small.reef.push(makeFan(18, 18, 41, PAL.crimson), makeFan(16, 16, 42, PAL.purple), makeTubes(14, 10, 43, PAL.gold), makeBrain(16, 8, 44, PAL.salmon), makeTable(20, 13, 45, PAL.teal), makeAnemone(14, 14, 46, PAL.pink), makeAnemone(12, 12, 47, PAL.gold, PAL.sun[2]));
  ['mintree', 'whip', 'yellow', 'pinkbush', 'chunky'].forEach((k, i) => small.kelp.push(coralBranch(k, 240 + i, 0.45)));
  small.kelp.push(makeAnemone(14, 14, 48, PAL.teal), makeBrain(14, 7, 49, PAL.salmon), makeTubes(12, 9, 50, PAL.teal));
  small.cave.push(coralBranch('spray', 250, 0.45), coralBranch('mintree', 251, 0.4), makeAnemone(14, 14, 52, PAL.purple, PAL.caustic[1]), makeAnemone(12, 12, 53, PAL.teal, PAL.caustic[0]), makeTubes(12, 9, 54, PAL.teal));
  L.small = small;
  const big = { reef: [], kelp: [], cave: [] };
  [['staghorn', 61, 1.1], ['staghorn', 62, 1.35], ['pinkbush', 63, 1.1], ['crimson', 64, 1.0], ['whip', 65, 0.9], ['yellow', 66, 0.95], ['spray', 67, 0.9]].forEach(([k, s, sc]) => big.reef.push(coralBranch(k, s, sc)));
  big.reef.push(makeFan(34, 34, 2, PAL.crimson), makeFan(30, 30, 71, PAL.purple), makeAnemone(24, 24, 72, PAL.gold, PAL.sun[2]), makeAnemone(26, 24, 73, PAL.pink), makeTable(38, 26, 74, PAL.teal), makeBrain(28, 14, 75, PAL.salmon), makeTubes(22, 16, 76, PAL.gold));
  [['mintree', 81, 1.15], ['whip', 82, 0.95], ['chunky', 83, 0.85], ['pinkbush', 84, 0.9]].forEach(([k, s, sc]) => big.kelp.push(coralBranch(k, s, sc)));
  big.kelp.push(makeAnemone(22, 22, 85, PAL.teal), makeBrain(24, 12, 86, PAL.salmon), makeFan(26, 26, 87, PAL.purple));
  big.cave.push(coralBranch('spray', 91, 0.85), coralBranch('mintree', 92, 0.8), makeAnemone(22, 22, 93, PAL.purple, PAL.caustic[1]), makeTubes(20, 14, 94, PAL.teal), makeAnemone(20, 20, 95, PAL.teal, PAL.caustic[0]));
  L.big = big;

  const mkRocks = (specs, moss) => specs.map(([w, h, s, o]) => { const r = makeRock(w, h, s, Object.assign({ moss }, o)); return r; });
  L.rocks = {
    reef: mkRocks([[130, 90, 11, { lean: -1, bumps: 3, steep: 0.5, cracks: 6 }], [70, 52, 17, { lean: 0.5, steep: 0.5, cracks: 2 }], [96, 62, 41, { lean: 1, bumps: 3, steep: 0.45, cracks: 5 }], [60, 34, 29, { bumps: 2, steep: 0.55, cracks: 2 }], [110, 40, 31, { bumps: 2, steep: 0.4, cracks: 3 }]], 0.25),
    kelp: mkRocks([[120, 80, 111, { lean: 1, bumps: 3, steep: 0.5, cracks: 5 }], [80, 56, 117, { lean: -0.5, steep: 0.5, cracks: 3 }], [64, 36, 129, { bumps: 2, steep: 0.55, cracks: 2 }], [104, 44, 131, { bumps: 2, steep: 0.4, cracks: 3 }]], 0.6),
    cave: mkRocks([[110, 76, 211, { lean: -1, bumps: 3, steep: 0.7, cracks: 8 }], [80, 60, 217, { lean: 0.6, steep: 0.75, cracks: 5 }], [70, 38, 229, { bumps: 3, steep: 0.65, cracks: 4 }], [120, 46, 231, { bumps: 3, steep: 0.6, cracks: 5 }]], 0.03)
  };
  L.frontRocks = [makeRock(96, 28, 301, { bumps: 2, steep: 0.5, moss: 0.2, cracks: 2 }), makeRock(70, 22, 303, { bumps: 2, steep: 0.5, moss: 0.1, cracks: 1 }), makeRock(120, 30, 305, { bumps: 3, steep: 0.45, moss: 0.25, cracks: 3 }), makeRock(54, 20, 307, { steep: 0.55, moss: 0.1, cracks: 1 })];
  L.pebbles = [makeRock(16, 8, 311, { steep: 0.6 }), makeRock(12, 7, 313, { steep: 0.6 }), makeRock(22, 9, 317, { steep: 0.6, moss: 0.2 })];
  L.up = [[14, 30], [18, 44], [24, 56], [12, 22], [20, 38], [30, 64]].map(([w, h], i) => makeSpire(w, h, 400 + i, false));
  L.down = [[14, 34], [18, 48], [26, 66], [12, 26], [22, 42], [30, 72]].map(([w, h], i) => makeSpire(w, h, 420 + i, true));
  L.buoy = gridSprite(BUOY, BUOY_PAL);
  return L;
}

// ---- zone blending: three same-size canvases, mixed per pixel with a blue-noise threshold (no alpha, only palette colours).
// The threshold tile is anchored to the texture, so the mix scrolls rigidly with the layer it belongs to.
class ZoneBlend {
  constructor(scene, key, variants) {
    this.w = variants[0].w; this.h = variants[0].h;
    this.src = variants.map(v => new Uint32Array(v.x.getImageData(0, 0, this.w, this.h).data.buffer.slice(0)));
    this.tex = scene.textures.createCanvas(key, this.w, this.h); this.ctx = this.tex.getContext();
    this.id = this.ctx.createImageData(this.w, this.h); this.out = new Uint32Array(this.id.data.buffer); this.key = -1;
  }
  set(lk, lc) {                       // lk, lc: 0..16 sixteenths of kelp / cave
    const key = lk * 17 + lc; if (key === this.key) return; this.key = key;
    const { w, h, src, out } = this, tc = lc * (BN_AREA / 16), tk = (lc + lk) * (BN_AREA / 16);
    for (let y = 0; y < h; y++) {
      const o = y * w, r = (y & BN_MASK) << BN_SHIFT;
      for (let x = 0; x < w; x++) { const b = BN[r | (x & BN_MASK)]; out[o + x] = src[b < tc ? 2 : b < tk ? 1 : 0][o + x]; }
    }
    this.ctx.putImageData(this.id, 0, 0); this.tex.refresh();
  }
}
