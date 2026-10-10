// Segment items and painter. Every segment (512 internal px wide) derives its decoration and fauna from
// hash(WORLD_SEED, segment index); only shrines and gates (from world.js) depend on the repo list.
const ceilNz = makeNoise(77);
const lerp = (a, b, t) => a + (b - a) * t;
const CEIL_NONE = -1000;

class Scenery {
  constructor(world, lib) {
    this.world = world; this.lib = lib; this.itemCache = new Map(); this.stoneCache = new Map(); this.pillarCache = new Map(); this.pedCache = new Map();
    this.shrineX = world.shrines.map(s => s.x / K);
    this.nSeg = Math.ceil(world.W / K / SEG_W);
  }
  // ---- ceiling of the cave zone (internal px): CEIL_NONE = none. Rows < 0 only show in tall (phone) views: there the ceiling slides up out of the extra sky rows
  ceilBottom(x) {
    const t = sstep(0.02, 0.85, this.world.zones.weights(x * K).cave);
    if (t <= 0) return CEIL_NONE;
    const target = SURF + 3 + (ceilNz.fbm(x / 16, 2.2, 2) - 0.5) * 7, b = lerp(-6, target, t);
    if (b >= 0) return Math.round(b);
    return -Math.round((PADT + 1) * (1 - t * (target + 6) / 6));
  }
  nearShrine(x, pad) {
    const xs = this.shrineX; let lo = 0, hi = xs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m; }
    for (const i of [lo - 1, lo]) if (i >= 0 && i < xs.length && Math.abs(xs[i] - x) < pad + this.world.shrines[i].stone.w / 2) return true;
    return false;
  }
  // dangerous creatures (jellyfish, anglerfish) never spawn within the first 600 wpx, inside a shrine radius, or over a pillar gate.
  // Open water is 810 wpx tall and one creature covers about 100 wpx, so a 190 wpx free lane always remains; creatures keep a gap to each other too.
  enemyOk(f, list) {
    const ext = f.range + (f.kind === 'angler' ? 26 : 16), lo = f.x - ext, hi = f.x + ext;
    if (lo * K < 600) return false;
    if (this.world.shrines.some(sh => Math.abs(sh.x / K - f.x) < SHRINE_RADIUS / K + ext + 8)) return false;
    if (this.world.gates.some(g => hi > g.x / K - 8 && lo < (g.x + g.w) / K + 8)) return false;
    return !list.some(o => ENEMY_KINDS[o.kind] && Math.abs(o.x - f.x) < o.range + ext + 30);
  }

  // ---- deterministic item lists per segment (internal px, world coordinates)
  items(s) {
    let it = this.itemCache.get(s); if (it) return it;
    it = this.genItems(s); this.itemCache.set(s, it);
    if (this.itemCache.size > 14) this.itemCache.delete(this.itemCache.keys().next().value);
    return it;
  }
  genItems(s) {
    const { lib, world } = this, z = world.zones, rng = makeRng(hash2(WORLD_SEED, s + 1000)), x0 = s * SEG_W;
    const out = { back: [], front: [], grass: [], kelp: [], fauna: [] }, X = () => x0 + rng() * SEG_W, Z = x => z.pickZone(x * K, rng());
    const add = (list, t, spr, cx, bottom, flip) => list.push({ t, spr, x: Math.round(cx - spr.w / 2), y: Math.round(bottom - spr.h), flip: !!flip, w: spr.w, h: spr.h });
    // rocks with corals seated on their ridge
    for (let i = 0; i < 3; i++) {
      const x = X(), zn = Z(x), rk = pick(rng, lib.rocks[zn]), bottom = FLOOR + ri(rng, 6, 16);
      if (this.nearShrine(x, 70)) continue;
      add(out.back, 'rock', rk, x, bottom); const rx = Math.round(x - rk.w / 2), ry = bottom - rk.h;
      const nc = zn === 'cave' ? ri(rng, 0, 1) : ri(rng, 1, 3);
      for (let k = 0; k < nc; k++) { const dx = ri(rng, 12, rk.w - 12), cs = pick(rng, zn === 'reef' ? lib.big.reef : lib.small[zn]); add(out.back, 'coral', cs, rx + dx, ry + rk.top[dx] + 3, rng() < 0.5); }
    }
    // corals on the sand
    for (let i = 0; i < 26; i++) {
      const x = X(), zn = Z(x), bottom = FLOOR + ri(rng, 0, 18), flip = rng() < 0.5, r = rng();
      if (zn === 'kelp' && r < 0.45) continue; if (zn === 'cave' && r < 0.7) continue;
      if (this.nearShrine(x, 34)) continue;
      add(out.back, 'coral', pick(rng, lib.small[zn]), x, bottom, flip);
    }
    for (let i = 0; i < 9; i++) { const x = X(); if (!this.nearShrine(x, 30)) add(out.back, 'pebble', pick(rng, lib.pebbles), x, FLOOR + ri(rng, 8, 24), rng() < 0.5); }
    // cave: stalagmites and stalactites
    for (let i = 0; i < 7; i++) {
      const x = X(), c = z.weights(x * K).cave, a = rng(), b = ri(rng, 0, 5), bottom = FLOOR + ri(rng, 4, 14);
      if (a < c * 0.9 && !this.nearShrine(x, 40)) add(out.back, 'spire', lib.up[b], x, bottom, rng() < 0.5);
    }
    for (let i = 0; i < 10; i++) {
      const x = X(), cb = this.ceilBottom(x), c = z.weights(x * K).cave, b = ri(rng, 0, 5), a = rng();
      if (cb >= SURF - 2 && a < c && !this.nearShrine(x, 36)) add(out.back, 'spire', lib.down[b], x, cb - 4 + lib.down[b].h, false);
    }
    // front layer: big corals, low rocks, cave stalagmites
    for (let i = 0; i < 3; i++) {
      const x = X(), zn = Z(x), r = rng(), keep = zn === 'reef' ? 0.8 : zn === 'kelp' ? 0.45 : 0.2, bottom = GH - ri(rng, 0, 7);
      if (r < keep && !this.nearShrine(x, 50)) add(out.front, 'coral', pick(rng, lib.big[zn]), x, bottom, rng() < 0.5);
    }
    for (let i = 0; i < 2; i++) { const x = X(); if (rng() < 0.7 && !this.nearShrine(x, 60)) add(out.front, 'rock', pick(rng, lib.frontRocks), x, GH + ri(rng, 0, 5), rng() < 0.5); }
    for (let i = 0; i < 4; i++) { const x = X(), c = z.weights(x * K).cave; if (rng() < c * 0.7 && !this.nearShrine(x, 50)) add(out.front, 'spire', lib.up[ri(rng, 2, 5)], x, GH + 4, rng() < 0.5); }
    // animated plants (Phaser images)
    for (let i = 0; i < 12; i++) { const x = X(), zn = Z(x), r = rng(), gk = ri(rng, 0, 2); if (zn !== 'cave' && r < (zn === 'kelp' ? 0.9 : 0.6) && !this.nearShrine(x, 40)) out.grass.push({ x, y: FLOOR + ri(rng, 2, 16), k: gk }); }
    for (let i = 0; i < 9; i++) { const x = X(), zn = Z(x), r = rng(), kk = ri(rng, 0, 3), back = rng() < 0.3; if (r < (zn === 'kelp' ? 0.85 : zn === 'reef' ? 0.12 : 0) && !this.nearShrine(x, 44)) out.kelp.push({ x, y: FLOOR + ri(rng, 2, 18), k: kk, back, ph: rng() * 8 }); }
    // fauna
    for (let i = 0; i < 9; i++) {
      const x = X(), zn = Z(x);
      if (rng() < 0.78) { const f = this.fauna(rng, zn, x); if (f && (!ENEMY_KINDS[f.kind] || this.enemyOk(f, out.fauna))) out.fauna.push(f); }
    }
    // dedicated danger pass: density by zone (rare on the reef, common in the cave), independent of the fauna table above
    const er = makeRng(hash2(WORLD_SEED, s + 5000));
    for (let i = 0; i < 3; i++) {
      if (er() >= ENEMY_CHANCE[z.dominant((x0 + SEG_W / 2) * K)]) continue;
      for (let tries = 0; tries < 8; tries++) {                       // look for a free spot (gates and shrines are avoided)
        const x = x0 + er() * SEG_W, zn = z.pickZone(x * K, er()), force = zn === 'cave' ? (er() < 0.55 ? 'angler' : 'jelly') : 'jelly';
        const f = this.fauna(er, zn, x, force); if (this.enemyOk(f, out.fauna)) { out.fauna.push(f); break; }
      }
    }
    return out;
  }
  fauna(rng, zone, x, force) {
    const T = FAUNA_TABLE[zone], total = T.reduce((a, e) => a + e[1], 0); let r = rng() * total, kind = T[0][0];
    for (const [k, w] of T) { if (r < w) { kind = k; break; } r -= w; }
    if (force) kind = force;
    const ground = () => FLOOR + ri(rng, 3, 16), common = { kind, x, phase: rng() * 10 };
    switch (kind) {
      case 'reefFish': return Object.assign(common, { sheet: pick(rng, ['fish_red', 'fish_blue', 'fish_gold']), n: ri(rng, 4, 8), y: ri(rng, 70, 215), range: ri(rng, 90, 190), speed: 9 + rng() * 9, spread: 30, fps: 6, depth: 8.4 });
      case 'sardine': return Object.assign(common, { sheet: 'sardine' + ri(rng, 0, 2), n: ri(rng, 9, 16), y: ri(rng, 62, 200), range: ri(rng, 110, 200), speed: 16 + rng() * 10, spread: 34, fps: 8, depth: 8.4 });
      case 'clown': return Object.assign(common, { sheet: 'clown', n: ri(rng, 2, 3), y: ri(rng, 175, 232), range: ri(rng, 20, 50), speed: 7 + rng() * 5, spread: 14, fps: 7, depth: 8.4 });
      case 'puffer': return Object.assign(common, { sheet: 'puffer', n: 1, y: ri(rng, 100, 215), range: ri(rng, 50, 110), speed: 5 + rng() * 4, spread: 0, fps: 4, depth: 8.4 });
      case 'turtle': return Object.assign(common, { sheet: 'turtle', n: 1, y: ri(rng, 85, 200), range: ri(rng, 170, 260), speed: 7 + rng() * 3, spread: 0, fps: 4, depth: 8.2 });
      case 'manta': return Object.assign(common, { sheet: 'manta' + ri(rng, 0, 1), n: 1, y: ri(rng, 62, 130), range: ri(rng, 220, 320), speed: 17 + rng() * 7, spread: 0, fps: 5, depth: 8.2 });
      case 'angler': return Object.assign(common, { sheet: 'angler', n: 1, y: ri(rng, 100, 210), range: ri(rng, 60, 120), speed: 6 + rng() * 4, spread: 0, fps: 5, depth: 8.4 });
      case 'jelly': return Object.assign(common, { sheet: zone === 'cave' ? pick(rng, ['jelly_teal', 'jelly_pink', 'jelly_teal']) : pick(rng, ['jelly_purple', 'jelly_big', 'jelly_pink']), n: 1, y: ri(rng, 80, 190), range: ri(rng, 20, 60), speed: 0, spread: 0, fps: 5, depth: 8.5 });
      case 'seahorse': return Object.assign(common, { sheet: 'seahorse', n: 1, y: ri(rng, 130, 225), range: ri(rng, 6, 16), speed: 0, spread: 0, fps: 6, depth: 6.3 });
      case 'crab': return Object.assign(common, { sheet: 'crab', n: 1, y: ground(), range: ri(rng, 22, 60), speed: 6 + rng() * 5, spread: 0, fps: 7, depth: 6.5 });
      case 'octopus': return Object.assign(common, { sheet: pick(rng, ['octo_purple', 'octo_pink', 'octo_salmon']), n: 1, y: ground() + 2, range: ri(rng, 10, 36), speed: 3 + rng() * 2, spread: 0, fps: 5, depth: 6.5 });
      default: return Object.assign(common, { sheet: pick(rng, ['star_salmon', 'star_gold', 'star_pink', 'star_crimson']), n: 1, y: ground() + 2, range: 0, speed: 0, spread: 0, fps: 2, depth: 6.4 });
    }
  }

  // ---- cached sprites
  stone(sh) {
    const key = sh.design + sh.step + sh.accent; let st = this.stoneCache.get(key);
    if (!st) { st = makeShrineStone(sh.design, sh.step, ACCENTS[sh.accent]()); this.stoneCache.set(key, st); }
    return st;
  }
  pillar(g, gi, hang) {
    const key = gi + (hang ? 'h' : 's'); let c = this.pillarCache.get(key); if (c) return c;
    const zn = this.world.zones.dominant(g.x + g.w / 2), w = Math.round(g.w / K), h = Math.round((hang ? g.gapTop : WH - g.gapBottom) / K);
    c = makePillar(w, h, g.seed + (hang ? 1 : 0), zn, hang);
    this.pillarCache.set(key, c); if (this.pillarCache.size > 30) this.pillarCache.delete(this.pillarCache.keys().next().value);
    return c;
  }
  pedestal(w, seed) {
    const key = w + ':' + (seed & 3); let p = this.pedCache.get(key); if (!p) { p = makePedestal(w, seed); this.pedCache.set(key, p); }
    return p;
  }

  // ---- painting
  paintBack(s, ctx) {
    const x0 = s * SEG_W, lib = this.lib, world = this.world;
    ctx.setTransform(1, 0, 0, 1, 0, PADT); ctx.clearRect(0, -PADT, SEG_W, SEGH);          // canvas row 0 is world row -PADT
    ctx.drawImage(lib.sand.c, (s & 1) * SEG_W, 0, SEG_W, 36, 0, GH - 36, SEG_W, 36);
    ctx.drawImage(lib.seabedExt.c, (s & 1) * SEG_W, 0, SEG_W, PADB, 0, GH, SEG_W, PADB);
    // cave ceiling
    let any = false; for (let x = 0; x < SEG_W; x += 16) if (this.ceilBottom(x0 + x) > -PADT) { any = true; break; }
    if (any) this.paintCeiling(x0, ctx);
    for (const n of [s - 1, s, s + 1]) {
      if (n < 0 || n >= this.nSeg) continue;
      for (const it of this.items(n).back) if (it.x + it.w > x0 && it.x < x0 + SEG_W) stamp(ctx, it.spr, it.x - x0, it.y, it.flip);
    }
    for (const sh of world.shrines) {
      const st = sh.stone; if (st.x + st.w + 40 < x0 || st.x - 40 > x0 + SEG_W) continue;
      this.paintShrine(sh, x0, ctx);
    }
    this.paintWalls(x0, ctx);
    tintBack(ctx, x0, world.zones);          // cave darkening / kelp green, baked into the world-anchored pixels (flat steps, no screen-space dither)
  }
  // beyond both ends of the world the view (which may scroll past them on phones, to keep the diver off the controls) shows a rock cliff
  paintWalls(x0, ctx) {
    const Wi = this.world.W / K;
    if (x0 >= 0 && x0 + SEG_W <= Wi - 12) return;
    const R = PAL.rock, M = PAL.moss, cv = mkCanvas(SEG_W, SEGH), nz = ceilNz;
    const edge = (y, right) => right ? Wi + 4 + Math.round(nz.fbm(y / 9, 6.1, 2) * 9) : -4 - Math.round(nz.fbm(y / 9, 1.7, 2) * 9);
    paint(cv, (x, yy) => {
      const wx = x0 + x, y = yy - PADT, right = wx > Wi / 2, e = edge(y, right);
      if (right ? wx < e : wx > e) return null;
      const dd = right ? wx - e : e - wx;
      if (dd < 1) return R[0];
      if (dd < 3 && nz.n2(y / 3, wx / 3) < 0.7) return R[3];
      const v = nz.fbm(wx / 9, y / 6, 3) + 0.08 * Math.min(6, dd) / 6 - 0.12 * (dd > 30 ? 1 : 0);
      if (y > GH - 36 && y < GH + 4) return v > 0.62 ? R[2] : R[1];
      return v > 0.74 ? R[3] : v > 0.62 ? R[2] : v > 0.44 ? R[1] : R[0];
    });
    ctx.drawImage(cv.c, 0, -PADT);
  }
  paintCeiling(x0, ctx) {
    const R = PAL.rock, cv = mkCanvas(SEG_W, PADT + SURF + 12), nz = ceilNz;
    paint(cv, (x, yy) => {
      const y = yy - PADT, b = this.ceilBottom(x0 + x); if (y > b) return null;
      const d = b - y; if (d === 0) return R[0];
      if (d === 1) return R[1];
      const v = nz.fbm((x0 + x) / 8, y / 4, 3) + 0.12 * (d / 12);
      return v > 0.8 ? R[2] : v > 0.52 ? R[1] : R[0];
    });
    ctx.drawImage(cv.c, 0, -PADT);
  }
  paintShrine(sh, x0, ctx) {
    const st = sh.stone, spr = this.stone(sh), lx = st.x - x0, cx = lx + Math.round(st.w / 2);
    if (sh.mount === 'ledge') {
      const rk = makeLedgeRock(st.w + 36, sh.ledgeH + 6, sh.i); stamp(ctx, rk, lx - 18, FLOOR + 6 - sh.ledgeH, false);
    } else if (sh.mount === 'floating') {
      const w = st.w + 22, ped = this.pedestal(w, hash32(sh.repo.full_name)); stamp(ctx, ped, cx - (w >> 1), st.y + st.h - 3, false);
    } else if (sh.mount === 'hanging' || sh.mount === 'ceiling') {
      const top = st.y + (spr.top ? spr.top[1] : 0), cxx = lx + (spr.top ? spr.top[0] : Math.round(st.w / 2));
      for (let y = sh.mount === 'hanging' ? SURF : SURF + 2; y < top; y++) { const a = (y >> 1) & 1; px(ctx, cxx, y, a ? PAL.rock[3] : PAL.rock[1]); px(ctx, cxx + 1, y, a ? PAL.rock[1] : PAL.rock[0]); }
      if (sh.mount === 'hanging') stamp(ctx, this.lib.buoy, cxx - 3, SURF - 6, false);
      else stamp(ctx, this.lib.down[3], cxx - 6, SURF - 1, false);
    }
    stamp(ctx, spr, lx, st.y, false);
  }
  paintFront(s, ctx) {
    const x0 = s * SEG_W, world = this.world;
    ctx.setTransform(1, 0, 0, 1, 0, PADT); ctx.clearRect(0, -PADT, SEG_W, SEGH);
    for (const n of [s - 1, s, s + 1]) {
      if (n < 0 || n >= this.nSeg) continue;
      for (const it of this.items(n).front) if (it.x + it.w > x0 && it.x < x0 + SEG_W) stamp(ctx, it.spr, it.x - x0, it.y, it.flip);
    }
    world.gates.forEach((g, gi) => {
      const gx = Math.round(g.x / K), gw = Math.round(g.w / K); if (gx + gw < x0 || gx > x0 + SEG_W) return;
      const top = this.pillar(g, gi, true);
      stamp(ctx, top, gx - x0, 0, false); extendMirrored(ctx, top, gx - x0, 0, PADT, -1);        // the pillars run on into the extra rows of tall views
      const bottom = this.pillar(g, gi, false), by = Math.round(g.gapBottom / K);
      stamp(ctx, bottom, gx - x0, by, false); extendMirrored(ctx, bottom, gx - x0, by + bottom.h, PADB, 1);
      const r = this.lib.pebbles[gi % 3]; stamp(ctx, r, gx - x0 - 5, GH - 12, false); stamp(ctx, this.lib.pebbles[(gi + 1) % 3], gx - x0 + gw - 8, GH - 10, true);
    });
  }
}
// repeat a sprite past its edge by mirroring its nearest rows (dir -1: above edgeY, dir 1: below edgeY), seamless for stone
function extendMirrored(ctx, spr, x, edgeY, n, dir) {
  for (let j = 0; j < n; j++) {
    const r = j % (2 * spr.h), k = r < spr.h ? r : 2 * spr.h - 1 - r, sy = dir < 0 ? k : spr.h - 1 - k;
    ctx.drawImage(spr.c, 0, sy, spr.w, 1, Math.round(x), dir < 0 ? edgeY - 1 - j : edgeY + j, spr.w, 1);
  }
}
function makeLedgeRock(w, h, seed) { return makeRock(w, h, 900 + seed * 7, { bumps: 2, steep: 0.35, moss: 0.3, cracks: 3 }); }

const ENEMY_CHANCE = { reef: 0.12, kelp: 0.4, cave: 0.8 };      // per slot, 3 slots per 512-px segment
// fauna mix per zone: [kind, weight]
const FAUNA_TABLE = {
  reef: [['reefFish', 5], ['clown', 2.5], ['puffer', 1.5], ['turtle', 1.2], ['manta', 0.9], ['crab', 3], ['star', 4], ['seahorse', 0.8], ['jelly', 1], ['sardine', 1]],
  kelp: [['sardine', 5], ['reefFish', 1.5], ['seahorse', 3], ['jelly', 3], ['turtle', 1.2], ['crab', 1.5], ['star', 2], ['clown', 0.8], ['puffer', 0.6]],
  cave: [['jelly', 6], ['octopus', 3], ['crab', 2.5], ['angler', 2.5], ['sardine', 1], ['star', 1]]
};
