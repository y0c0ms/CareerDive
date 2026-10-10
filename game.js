// Deep Diver: Phaser scene (rendering, physics, shrines, fauna) and the window.__test hook.
const SPEED = 220, VSPEED = 210, SINK = 36, HIT_W = 27, HIT_H = 13;      // wpx per second / half hitbox in wpx
const BOOST_X = 1.7, BOOST_Y = 1.45, BOOST_DRAIN = 1 / 3, BOOST_REFILL = 1 / 4, BOOST_MIN = 0.15, BOOST_EMIT = 7, BOOST_POOL = 48;
const DIVER_MIN_Y = (SURF + 6) * K, DIVER_MAX_Y = (FLOOR - 8) * K;
const MAX_GLOWS = 14;

const SHEET_DEFS = {
  fish_red: () => makeFish(FISH_PALS.red), fish_blue: () => makeFish(FISH_PALS.blue),
  fish_gold: () => makeFish({ b: PAL.yellow[2], B: PAL.yellow[1], w: PAL.caustic[0], e: PAL.rock[0], k: PAL.yellow[0] }),
  sardine0: () => makeSardine(0), sardine1: () => makeSardine(1), sardine2: () => makeSardine(2),
  clown: makeClownfish, puffer: makePuffer, turtle: makeTurtle, manta0: () => makeManta(0), manta1: () => makeManta(1),
  crab: makeCrab, seahorse: makeSeahorse, angler: makeAngler,
  star_salmon: () => makeStarfish(PAL.salmon), star_gold: () => makeStarfish(PAL.gold), star_pink: () => makeStarfish(PAL.pink), star_crimson: () => makeStarfish(PAL.crimson),
  octo_purple: () => makeOctopus(PAL.purple), octo_pink: () => makeOctopus(PAL.pink), octo_salmon: () => makeOctopus(PAL.salmon),
  jelly_purple: () => makeJelly(9, 6, 3, PAL.purple), jelly_big: () => makeJelly(12, 6, 9, PAL.purple), jelly_pink: () => makeJelly(6, 6, 8, PAL.pink), jelly_teal: () => makeJelly(7, 6, 5, PAL.teal),
  diver: makeDiver, bub: makeBubbles,
  grass0: () => makeKelp(64, 38, 6, 5), grass1: () => makeKelp(60, 32, 6, 6), grass2: () => makeKelp(56, 44, 6, 7),
  kelp0: () => makeKelp(26, 92, 8, 9, { blades: 5, sway: 8, thick: 2, minLen: 0.6 }), kelp1: () => makeKelp(26, 80, 8, 15, { blades: 4, sway: 7, thick: 2, minLen: 0.6 }),
  kelp2: () => makeKelp(30, 120, 8, 21, { blades: 6, sway: 9, thick: 2, minLen: 0.55 }), kelp3: () => makeKelp(24, 104, 8, 27, { blades: 4, sway: 8, thick: 2, minLen: 0.7 })
};

const tri = p => { p -= Math.floor(p); return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; };       // triangle wave -1..1, rising first
// ---- view: desktop and tablets keep the classic 480+ x 270 internal view. On phones the picture is drawn at about one css pixel per internal pixel
// (a whole number of device pixels), which shows ~1.45x more of the world; the extra rows are sky above and bedrock below the 270-row world.
const PHONE_MAX_H = 560, TOP_FRAC = 0.4;
const vvSize = () => { const v = window.visualViewport; return { w: v ? v.width : innerWidth, h: v ? v.height : innerHeight }; };
function computeView() {
  const { w: vw, h: vh } = vvSize();
  if (UI.touch && vh <= PHONE_MAX_H && vw > vh) {
    const dpr = window.devicePixelRatio || 1, oldS = vh / GH;          // oldS: css px per internal px of the previous (classic) view
    // prefer a whole number of device pixels per internal pixel (perfectly crisp) when it shows at least 1.35x the old width, else zoom out to 1.45x
    let s = Math.max(1, Math.round(dpr)) / dpr; if (oldS / s < 1.35) s = oldS / 1.45;
    s = Math.max(0.8, s);
    const gh = Math.max(GH, Math.min(GH + PADT + PADB, Math.round(vh / s))), gw = Math.min(GW_MAX, Math.max(GW_MIN, 2 * Math.round(vw / s / 2))), pad = gh - GH;
    const top = Math.min(PADT, pad, Math.max(Math.round(pad * TOP_FRAC), Math.ceil(30 / s)));
    return { phone: true, gw, gh, top };
  }
  return { phone: false, gw: Math.min(GW_MAX, Math.max(GW_MIN, 2 * Math.round(GH * innerWidth / innerHeight / 2))), gh: GH, top: 0 };
}
let VIEW = computeView();

class Main extends Phaser.Scene {
  constructor() { super('Main'); }
  create() {
    const repos = BOOT.repos;
    this.t = 0; this.gw = this.scale.gameSize.width; this.gh = this.scale.gameSize.height;
    this.world = layoutWorld(repos); this.lib = buildLibrary(); this.sc = new Scenery(this.world, this.lib);
    this.sheetN = {}; this.sheetHot = {}; this.sheetDim = {};
    for (const k in SHEET_DEFS) {
      let fr = SHEET_DEFS[k](); this.sheetN[k] = fr.length;
      if (k === 'angler' || k.startsWith('jelly_')) {           // dangerous: sheet = normal frames + brighter "hot" frames
        const h = withHot(k === 'angler' ? 'angler' : 'jelly', fr); fr = h.frames; this.sheetN[k] = h.base; this.sheetHot[k] = true;
        this.sheetDim[k] = { fw: fr[0].w, fh: fr[0].h, w: h.sprite[0], h: h.sprite[1], lure: h.lure };
      }
      addSheet(this, k, fr);
    }

    // ---- backdrop layers; zone-dependent ones are blue-noise-blended canvases (shafts and caustics are water-only: they start under the surface line)
    const L = this.lib, blank = (w, h) => mkCanvas(w, h);
    this.blends = [
      ['zWater', L.backdrop], ['zHaze', L.haze], ['zMid', L.mid], ['zClouds', [L.clouds, L.clouds, blank(TILE_W, 44)]],
      ['zShaftA', L.shaftsA], ['zShaftB', L.shaftsB], ['zCausA', L.causA], ['zCausB', L.causB], ['zSurf', L.surface]
    ].map(([key, v]) => new ZoneBlend(this, key, v));
    this.bg = this.add.image(0, 0, 'zWater').setOrigin(0, 0).setScrollFactor(0).setDepth(0);
    this.par = [];
    const par = (key, y, factor, depth, drift) => { const l = addParallax(this, key, y, TILE_W, factor, depth); l.driftSpeed = drift || 0; l.y0 = y; this.par.push(l); };
    par('zClouds', -40, 0.03, 0.45, -2); this.par[0].phoneOnly = true; par('zClouds', 3, 0.05, 0.5, 3); par('zHaze', 105, 0.15, 1); par('zShaftA', SURF + 1, 0.05, 0.6, 1.2); par('zShaftB', SURF + 1, 0.1, 0.7, -1.8);
    par('zCausA', SURF + 1, 0.02, 2.5, 5); par('zCausB', SURF + 1, 0.03, 2.6, -4); par('zMid', 173, 0.35, 4);
    par('zSurf', SURF - 2, 1, 4.4, 6);

    // ---- world segment pool (two canvases per slot: behind and in front of the action)
    this.slots = Array.from({ length: SEG_POOL }, (_, i) => {
      const mk = (key, depth) => { const tex = this.textures.createCanvas(key + i, SEG_W, SEGH); tex.context.imageSmoothingEnabled = false; return { tex, img: this.add.image(0, 0, key + i).setOrigin(0, 0).setDepth(depth).setVisible(false) }; };
      return { seg: -999, back: mk('segB', 4.5), front: mk('segF', 8) };
    });

    // ---- diver, bubbles
    this.diver = this.add.image(0, 0, 'diver', 0).setDepth(12);
    this.dbub = Array.from({ length: 6 }, (_, i) => ({ age: i * 0.7, ph: i, img: this.add.image(0, 0, 'bub', i % 3).setDepth(12) }));
    this.bpool = Array.from({ length: BOOST_POOL }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, img: this.add.image(0, 0, 'bub', 0).setDepth(12).setVisible(false) }));
    this.bpoolI = 0; this.emitted = 0; this.emitAcc = 0; this.burst = 0; this.trail = 0; this.brng = makeRng(555); this.testBoost = false;
    const brng = makeRng(99);
    this.bubs = makeBubbleField(28, GW_MAX, SEGH, brng); this.bubs.forEach(b => b.img = this.add.image(0, 0, 'bub', b.f).setDepth(11).setScrollFactor(0));

    // ---- runtime state
    this.live = new Map(); this.creatures = []; this.anim = []; this.shrineLive = new Map(); this.glows = new Map();
    this.found = new Set(); this.god = false; this.popupIdx = -1; this.dismissed = -1; this.hudTick = 0; this.animTick = 0;
    this.reset();
    UI.onClose = () => this.closePopup(true);
    UI.onRestart = () => { if (this.mode !== 'play') this.reset(); };
    this.scale.on('resize', gs => { this.gw = gs.width; this.gh = gs.height; });
    this.installTestHook();
    this.cameras.main.setBackgroundColor('#3d758e');
    const ld = $('loading'); ld.classList.add('done'); setTimeout(() => ld.remove(), 600);
  }

  reset() {
    this.x = START_X; this.y = Math.round(WH * 0.5); this.vx = this.vy = 0; this.facing = 1; this.mode = 'play'; this.snap = true;
    this.hearts = MAX_HEARTS; this.invuln = 0; this.kx = this.ky = 0; this.stam = 1; this.boosting = false; this.lock = false; this.trail = 0; this.burst = 0; this.emitAcc = 0;
    this.bpool.forEach(b => { b.on = false; b.img.setVisible(false); });
    this.popupIdx = -1; this.dismissed = -1; modal.close(); UI.end(null);
  }

  // ---------------- popup
  closePopup(manual) {
    if (!modal.isOpen()) return;
    if (manual) this.dismissed = this.popupIdx;
    this.popupIdx = -1; modal.close();
  }
  updatePopup() {
    const sh = this.world.shrines; let near = -1;
    for (let i = 0; i < sh.length; i++) if (Math.hypot(sh[i].x - this.x, sh[i].y - this.y) < SHRINE_RADIUS) { near = i; break; }
    if (near < 0) { this.dismissed = -1; if (this.popupIdx >= 0) this.closePopup(false); return; }
    if (near !== this.popupIdx && near !== this.dismissed) { this.popupIdx = near; this.found.add(near); modal.open(sh[near].repo); }
  }

  // ---------------- physics
  hitsPillar(x, y) {
    const boxes = this.world.boxes;
    for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (x + HIT_W > b.x && x - HIT_W < b.x + b.w && y + HIT_H > b.y && y - HIT_H < b.y + b.h) return true; }
    return false;
  }
  updateBoost(dt, req) {
    if (!req) this.lock = false;
    if (this.boosting) {
      this.stam -= BOOST_DRAIN * dt;
      if (!req || this.stam <= 0) { this.boosting = false; this.trail = 0.4; if (this.stam <= 0) { this.stam = 0; this.lock = true; } }
    } else if (req && !this.lock && this.stam >= BOOST_MIN) { this.boosting = true; this.burst = 6; }
    else if (!this.lock) this.stam = Math.min(1, this.stam + BOOST_REFILL * dt);     // an emptied meter stays empty until the button is released
  }
  hurt(ex, ey) {
    this.hearts--; UI.flash();
    if (this.hearts <= 0) { this.hearts = 0; this.crash(); return; }
    this.invuln = INVULN_S; this.kx = (this.x >= ex ? 1 : -1) * KNOCK; this.ky = (this.y >= ey ? 1 : -1) * KNOCK * 0.4;
  }
  checkEnemies() {
    const x = this.x, y = this.y;
    for (const c of this.creatures) {
      if (!ENEMY_KINDS[c.f.kind]) continue;
      for (const b of enemyBoxes(c, this.sheetDim)) if (Math.abs(x - b.cx) < HIT_W + b.w / 2 && Math.abs(y - b.cy) < HIT_H + b.h / 2) { this.hurt(b.cx, b.cy); return; }
    }
  }
  step(dt) {
    const a = UI.axis(); this.updateBoost(dt, UI.boostHeld() || this.testBoost);
    const bm = this.boosting, ease = Math.min(1, dt * (bm ? 16 : 12));
    const tvx = a.x * SPEED * (bm ? BOOST_X : 1), tvy = a.y ? a.y * VSPEED * (bm ? BOOST_Y : 1) : SINK;
    this.vx += (tvx - this.vx) * ease; this.vy += (tvy - this.vy) * ease;
    if (Math.abs(this.vx) < 2 && !a.x) this.vx = 0;
    this.x = Math.max(24, this.x + this.vx * dt); this.y += this.vy * dt;
    if (this.kx || this.ky) {                                   // knockback after a hit; never pushes the diver into a pillar
      const nx = Math.max(24, this.x + this.kx * dt), ny = Math.min(DIVER_MAX_Y, Math.max(DIVER_MIN_Y, this.y + this.ky * dt));
      if (!this.hitsPillar(nx, ny)) { this.x = nx; this.y = ny; }
      const dec = Math.exp(-dt * 7); this.kx *= dec; this.ky *= dec; if (Math.abs(this.kx) < 6 && Math.abs(this.ky) < 6) this.kx = this.ky = 0;
    }
    this.y = Math.min(DIVER_MAX_Y, Math.max(DIVER_MIN_Y, this.y));
    if (this.vx > 8) this.facing = 1; else if (this.vx < -8) this.facing = -1;
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (!this.god) {
      if (this.hitsPillar(this.x, this.y)) this.crash();
      else if (this.invuln <= 0) this.checkEnemies();
    }
    if (this.mode === 'play' && this.x >= this.world.W - 100) { this.mode = 'finished'; this.vx = this.vy = 0; this.closePopup(false); UI.end('finished', this.found.size, this.world.shrines.length); }
  }
  crash() { this.mode = 'crashed'; this.vx = this.vy = 0; this.closePopup(false); UI.end('crashed', this.found.size, this.world.shrines.length); }

  // ---------------- streaming of segments, plants, fauna and shrine overlays
  ensureSegments(camX) {
    const s0 = Math.max(-1, Math.floor(camX / SEG_W)), s1 = Math.min(this.sc.nSeg, Math.floor((camX + this.gw) / SEG_W));
    for (let s = s0; s <= s1; s++) {
      const slot = this.slots[((s % SEG_POOL) + SEG_POOL) % SEG_POOL];
      if (slot.seg !== s) {
        this.sc.paintBack(s, slot.back.tex.context); this.sc.paintFront(s, slot.front.tex.context); slot.back.tex.refresh(); slot.front.tex.refresh();
        slot.seg = s; slot.back.img.setPosition(s * SEG_W, -PADT).setVisible(true); slot.front.img.setPosition(s * SEG_W, -PADT).setVisible(true);
      }
    }
  }
  syncLive(camX) {
    const lo = Math.max(0, Math.floor((camX - 450) / SEG_W)), hi = Math.min(this.sc.nSeg - 1, Math.floor((camX + this.gw + 450) / SEG_W));
    for (const [s, objs] of this.live) if (s < lo || s > hi) {
      objs.forEach(o => o.destroy()); this.live.delete(s);
      this.creatures = this.creatures.filter(c => c.seg !== s); this.anim = this.anim.filter(a => a.seg !== s);
    }
    for (let s = lo; s <= hi; s++) if (!this.live.has(s)) this.spawnSegment(s);
  }
  spawnSegment(s) {
    const it = this.sc.items(s), objs = [];
    const plant = (key, p, depth) => { const img = this.add.image(Math.round(p.x), Math.round(p.y), key, 0).setOrigin(0.5, 1).setDepth(depth); objs.push(img); this.anim.push({ seg: s, img, n: this.sheetN[key], off: Math.floor(p.x) }); };
    it.grass.forEach(p => plant('grass' + p.k, p, 6));
    it.kelp.forEach(p => plant('kelp' + p.k, p, p.back ? 4.4 : 6.2));
    it.fauna.forEach(f => {
      const ground = f.depth < 7;
      for (let i = 0; i < f.n; i++) {
        const img = this.add.image(0, 0, f.sheet, 0).setDepth(f.depth + i * 0.001).setOrigin(0.5, ground ? 1 : 0.5); objs.push(img);
        const r = makeRng(hash2(Math.floor(f.x * 10), i + 7));
        this.creatures.push({ seg: s, f, img, n: this.sheetN[f.sheet], hot: !!this.sheetHot[f.sheet], dx: (r() - 0.5) * 2 * f.spread, dy: (r() - 0.5) * f.spread * 0.7, ph: r() * 6.28, sp: 0.85 + r() * 0.3 });
      }
    });
    this.live.set(s, objs);
  }
  updateCreatures(t) {
    for (const c of this.creatures) {
      const f = c.f, A = Math.max(1, f.range); let x, y, dir = 1;
      switch (f.kind) {
        case 'jelly': x = f.x + Math.sin(t * 0.22 + c.ph + f.phase) * f.range; y = f.y + Math.sin(t * 0.7 + f.phase) * 11; break;
        case 'seahorse': dir = Math.cos(t * 0.5 + f.phase) >= 0 ? 1 : -1; x = f.x + Math.sin(t * 0.5 + f.phase) * f.range; y = f.y + Math.sin(t * 1.1 + f.phase) * 4; break;
        case 'crab': case 'octopus': dir = Math.cos(t * f.speed / A * 0.5 + f.phase) >= 0 ? 1 : -1; x = f.x + Math.sin(t * f.speed / A * 0.5 + f.phase) * A; y = f.y; break;
        case 'star': x = f.x; y = f.y; break;
        case 'angler': { const pt = patrol(t * f.speed / (4 * A) + f.phase / 10); dir = pt.dir; x = f.x + pt.off * A; y = f.y + Math.sin(t * 0.8 + c.ph) * 4; break; }
        default: {
          const p = t * f.speed * c.sp / (4 * A) + f.phase / 10; dir = ((p % 1 + 1) % 1) < 0.5 ? 1 : -1;
          x = f.x + tri(p) * A + c.dx + Math.sin(t * 0.9 + c.ph) * 2.5; y = f.y + c.dy + Math.sin(t * 1.7 + c.ph) * (f.kind === 'manta' ? 7 : f.kind === 'turtle' ? 3 : 2);
        }
      }
      c.img.setPosition(Math.round(x), Math.round(y)).setFlipX(dir < 0).setFrame(Math.floor(t * f.fps + c.ph) % c.n + (c.hot && Math.sin(t * 4.2 + c.ph) > 0.2 ? c.n : 0));
    }
  }
  glowFor(sh) {
    const key = 'glow_' + sh.design + sh.step + sh.accent; let g = this.glows.get(key);
    if (g) return g;
    if (this.glows.size >= MAX_GLOWS) for (const [k, v] of this.glows) if (![...this.shrineLive.values()].some(e => e.glow.key === k)) { this.textures.remove(k); this.glows.delete(k); break; }
    const fr = makeShrineGlow(this.sc.stone(sh), ACCENTS[sh.accent](), 6); addSheet(this, key, fr);
    g = { key, n: fr.length, G: fr[0].w }; this.glows.set(key, g); return g;
  }
  syncShrines(camX, t) {
    const sh = this.world.shrines, lo = camX - 220, hi = camX + this.gw + 220;
    sh.forEach((s, i) => {
      const x = s.x / K, on = x > lo && x < hi, live = this.shrineLive.get(i);
      if (on && !live) {
        const g = this.glowFor(s), lbl = makeLabel(s.name, ACCENTS[s.accent]()), lk = 'lbl' + i; addTex(this, lk, lbl);
        const glow = this.add.image(0, 0, g.key, 0).setDepth(9.2), label = this.add.image(0, 0, lk).setDepth(9.3);
        this.shrineLive.set(i, { glow: Object.assign(glow, { key: g.key }), g, label, lk });
      } else if (!on && live) { live.glow.destroy(); live.label.destroy(); this.textures.remove(live.lk); this.shrineLive.delete(i); }
    });
    for (const [i, e] of this.shrineLive) {
      const s = sh[i], st = s.stone, cx = st.x + st.orb[0], cy = st.y + st.orb[1];
      e.glow.setPosition(cx, cy).setFrame(Math.floor(t * 5 + i) % e.g.n);
      e.label.setPosition(cx, Math.round(st.y - 8 + Math.sin(t * 1.8 + i) * 1.5));
    }
  }

  // ---------------- frame
  update(time, dtMs) {
    if (UI.paused) return;
    const dt = Math.min(dtMs / 1000, 0.05); this.t += dt; const t = this.t;
    if (this.mode === 'play') { this.step(dt); if (this.mode === 'play') this.updatePopup(); }
    const cam = this.cameras.main, gw = this.gw, top = VIEW.top, phone = VIEW.phone, maxCam = Math.max(0, this.world.W / K - gw);
    // desktop: the diver sits 36 % from the left and the camera stops at both ends of the world. Phones: the diver is held 42 % from the left at all times
    // (the camera may scroll past the ends, where a rock cliff stands) so it never ends up under the joystick, whose zone is the left edge
    const raw = this.x / K - gw * (phone ? 0.42 : 0.36), target = phone ? raw : Math.min(maxCam, Math.max(0, raw));
    if (this.snap) { this.camX = target; this.snap = false; } else this.camX += (target - this.camX) * (1 - Math.exp(-dt * 6));
    const camX = Math.round(this.camX); cam.scrollX = camX; cam.scrollY = -top;
    this.bg.setY(top - PADT); for (const l of this.par) for (const im of l.imgs) { im.y = l.y0 + top; if (l.phoneOnly) im.setVisible(top > 0); }

    // zone blending follows the camera centre
    const w = this.world.zones.weights((camX + gw / 2) * K), lc = Math.round(w.cave * 16), lk = Math.min(16 - lc, Math.round(w.kelp * 16));
    let budget = 2; for (const b of this.blends) { if (budget && b.key !== lk * 17 + lc) { b.set(lk, lc); budget--; } }
    updateParallax(this, this.par, dt);

    this.ensureSegments(camX); this.syncLive(camX); this.syncShrines(camX, t); this.updateCreatures(t);
    this.animTick += dt; if (this.animTick > 1 / 7) { this.animTick = 0; this.frame = (this.frame || 0) + 1; this.anim.forEach(a => a.img.setFrame((this.frame + a.off) % a.n)); }

    // diver
    const moving = Math.abs(this.vx) > 12;
    this.diver.setPosition(Math.round(this.x / K), Math.round(this.y / K)).setFlipX(this.facing < 0)
      .setFrame(this.vy < -60 ? 4 : this.vy > 90 ? 5 : Math.floor(t * (this.boosting ? 16 : moving ? 9 : 3)) % 4);
    const dx = Math.round(this.x / K), dy = Math.round(this.y / K);
    this.diver.setVisible(!(this.invuln > 0 && Math.floor(t * 12) % 2 === 0));
    this.updateBubbles(dt, dx, dy);
    this.dbub.forEach(b => { b.age += dt; if (b.age > 4.2) { b.age = 0; this.emitted++; } const k = b.age; b.img.setPosition(Math.round(dx + this.facing * 11 + Math.sin(k * 3 + b.ph) * 1.5), Math.round(dy - 7 - k * 14)).setVisible(k > 0.01 && dy - 7 - k * 14 > SURF); });
    this.bubs.forEach(b => { b.y -= b.sp * dt; if (b.y < SURF) { b.y = this.gh - top + 4; b.x = Math.random() * gw; } b.img.setPosition(Math.round(b.x + Math.sin(t * 2 + b.ph) * 1.5), Math.round(b.y) + top).setVisible(b.x < gw && b.y < this.gh - top); });

    HUD.draw({ dist: Math.round(this.x / 10), found: this.found.size, total: this.world.shrines.length, hearts: this.hearts, stamina: this.stam, boosting: this.boosting, lock: this.lock, blink: this.invuln > 0 && Math.floor(t * 8) % 2 === 0 });
  }

  // pooled boost bubbles: fixed ring of images, no allocation while playing
  updateBubbles(dt, dx, dy) {
    const emitting = this.mode === 'play' && (this.boosting || this.trail > 0);
    if (this.trail > 0) this.trail -= dt;
    if (emitting) { this.emitAcc += dt * BOOST_EMIT + this.burst; this.burst = 0; while (this.emitAcc >= 1) { this.emitAcc -= 1; this.spawnBubble(dx, dy); } } else { this.emitAcc = 0; this.burst = 0; }
    for (const b of this.bpool) {
      if (!b.on) continue;
      b.age += dt; b.x += b.vx * dt * (1 - b.age / b.life); b.y -= b.vy * dt;
      if (b.age >= b.life || b.y < SURF) { b.on = false; b.img.setVisible(false); continue; }
      b.img.setPosition(Math.round(b.x), Math.round(b.y)).setFrame(b.age < 0.25 ? 0 : b.age < 0.7 ? 1 : 2);
    }
  }
  spawnBubble(dx, dy) {
    const b = this.bpool[this.bpoolI++ % this.bpool.length], r = this.brng, mouth = (this.emitted & 1) === 0;
    b.on = true; b.age = 0; b.life = 0.9 + r() * 0.9; b.vy = 18 + r() * 30; b.vx = -this.facing * (10 + r() * 26);
    b.x = dx + (mouth ? this.facing * 11 : -this.facing * 9) + (r() - 0.5) * 2; b.y = dy + (mouth ? -7 : -3) + (r() - 0.5) * 2; this.emitted++;
    b.img.setVisible(true).setPosition(Math.round(b.x), Math.round(b.y)).setFrame(0);
  }

  installTestHook() {
    window.__test = {
      state: () => ({ x: Math.round(this.x), y: Math.round(this.y), mode: this.mode, found: this.found.size, total: this.world.shrines.length, popupOpen: modal.isOpen(), popupRepo: modal.repo ? modal.repo.name : null }),
      worldSize: () => ({ width: this.world.W, height: this.world.H }),
      teleport: (x, y) => { this.x = x; this.y = y; this.vx = this.vy = 0; this.snap = true; },
      shrines: () => this.world.shrines.map(s => ({ x: s.x, y: s.y, name: s.name, design: s.design })),
      obstacles: () => this.world.boxes.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
      godMode: on => { this.god = !!on; },
      boost: on => { this.testBoost = !!on; },
      hearts: () => this.hearts,
      enemies: () => this.creatures.filter(c => ENEMY_KINDS[c.f.kind]).flatMap(c => enemyBoxes(c, this.sheetDim).map(b => ({ x: Math.round(b.cx - b.w / 2), y: Math.round(b.cy - b.h / 2), w: Math.round(b.w), h: Math.round(b.h), kind: b.kind, part: b.part })))
    };
    // read-only diagnostics for tools/*.cjs, non-enumerable so __test keeps exactly the six documented functions
    Object.defineProperty(window.__test, 'inspect', { enumerable: false, value: () => {
        let px = 0, count = 0, maxSide = 0;
        for (const k in this.textures.list) { const src = this.textures.list[k].source && this.textures.list[k].source[0]; if (src && src.width) { px += src.width * src.height; count++; maxSide = Math.max(maxSide, src.width, src.height); } }
        return { textures: { count, megaPixels: +(px / 1e6).toFixed(2), maxSide }, live: { segments: this.live.size, creatures: this.creatures.length, displayObjects: this.children.length },
          shrines: this.world.shrines.map(s => ({ mount: s.mount, zone: s.zone, step: s.step, accent: s.accent })), gates: this.world.gates.length,
          boost: { stamina: +this.stam.toFixed(3), boosting: this.boosting, lock: this.lock, invuln: +this.invuln.toFixed(2), emitted: this.emitted, activeBubbles: this.bpool.filter(b => b.on).length },
          view: { phone: VIEW.phone, gw: this.gw, gh: this.gh, top: VIEW.top, camX: Math.round(this.camX), diverScreen: [Math.round(this.x / K - this.cameras.main.scrollX), Math.round(this.y / K - this.cameras.main.scrollY)], canvas: (() => { const r = this.game.canvas.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })(), diver: [Math.round(this.x / K), Math.round(this.y / K)] },
          onScreenKinds: [...new Set(this.creatures.filter(c => c.img.x > this.cameras.main.scrollX && c.img.x < this.cameras.main.scrollX + this.gw).map(c => c.f.sheet.replace(/\d$|_.*$/, '')))] };
      } });
  }
}

let BOOT = null;
loadRepos().then(res => {
  BOOT = res; VIEW = computeView();
  const game = new Phaser.Game({ type: Phaser.AUTO, width: VIEW.gw, height: VIEW.gh, parent: 'game', backgroundColor: '#3d758e', pixelArt: true, roundPixels: true,
    input: { keyboard: false, mouse: false, touch: false, gamepad: false }, scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [Main] });
  // recompute on every kind of viewport change: window resize, rotation, the URL bar sliding in/out (visualViewport), and a hybrid device switching to touch
  const fit = () => {
    VIEW = computeView();
    if (game.scale.gameSize.width !== VIEW.gw || game.scale.gameSize.height !== VIEW.gh) game.scale.setGameSize(VIEW.gw, VIEW.gh); else game.scale.refresh();
    const scn = game.scene.getScene('Main'); if (scn && scn.sys.isActive()) scn.snap = true;
  };
  for (const ev of ['resize', 'orientationchange', 'dd:touch']) addEventListener(ev, fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
}).catch(e => { $('loading-text').textContent = 'COULD NOT LOAD THE WORLD'; console.error(e); });
