// Procedural world layout: a pure function of the repo list and a fixed seed.
// Everything is generated left to right from per-item seeds, so appending a repo only extends the world.
// Units: "wpx" (world pixels) = 3 internal pixels. Physics and the __test hook use wpx, rendering uses internal px (wpx / K).
const K = 3, GH = 270, WH = GH * K;                    // internal height 270 -> world height 810 wpx
const SURF = Math.round(0.18 * GH), FLOOR = Math.round(0.92 * GH);   // water surface / seabed line (internal px)
const SURF_W = SURF * K, FLOOR_W = FLOOR * K;
const WORLD_SEED = 20261010, START_X = 180, SHRINE_RADIUS = 130, BLEND_W = 600;

const hash32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const hash2 = (a, b) => { let h = Math.imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0x7F4A7C15, 0xC2B2AE35); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return h >>> 0; };

// ---- zones: three equal fractions of the world width, blended over BLEND_W around each border
function makeZones(W) {
  const b1 = W / 3, b2 = 2 * W / 3, h = BLEND_W / 2;
  const weights = x => { const t1 = sstep(b1 - h, b1 + h, x), t2 = sstep(b2 - h, b2 + h, x); return { reef: 1 - t1, kelp: t1 * (1 - t2), cave: t2 }; };
  const dominant = x => { const w = weights(x); return w.cave > 0.5 ? 'cave' : w.kelp >= w.reef ? 'kelp' : 'reef'; };
  // random zone for a decoration item: probability follows the blend weights
  const pickZone = (x, r) => { const w = weights(x); return r < w.cave ? 'cave' : r < w.cave + w.kelp ? 'kelp' : 'reef'; };
  return { weights, dominant, pickZone };
}

// ---- language -> accent ramp (dark, mid, light)
const ACCENTS = {
  yellow: () => PAL.yellow, gold: () => PAL.gold, blue: () => PAL.blue, teal: () => PAL.teal, pink: () => PAL.pink, crimson: () => PAL.crimson,
  purple: () => PAL.purple, salmon: () => PAL.salmon, kelp: () => [PAL.kelp[0], PAL.kelp[1], PAL.kelp[3]], grey: () => [PAL.haze[0], PAL.caustic[1], PAL.caustic[0]]
};
const LANG_ACCENT = { JavaScript: 'yellow', TypeScript: 'blue', Python: 'teal', HTML: 'gold', CSS: 'purple', Svelte: 'crimson', Kotlin: 'purple', Shell: 'kelp',
  'Jupyter Notebook': 'salmon', Java: 'crimson', Go: 'teal', Rust: 'gold', C: 'pink', 'C++': 'pink', 'C#': 'purple', Ruby: 'crimson', PHP: 'purple', Swift: 'gold', Dart: 'blue', Vue: 'kelp' };
function accentKey(lang) {
  if (!lang) return 'grey';
  if (LANG_ACCENT[lang]) return LANG_ACCENT[lang];
  const keys = Object.keys(ACCENTS).filter(k => k !== 'grey');
  return keys[hash32(lang) % keys.length];
}
const starStep = stars => stars >= 3 ? 2 : stars >= 1 ? 1 : 0;

// ---- shrine stone sizes (needed to place the orb): silhouette depends on (design, step) only, so cache with a neutral accent
const dimCache = {};
function stoneDims(design, step) {
  const key = design + step;
  if (!dimCache[key]) { const s = makeShrineStone(design, step, ACCENTS.grey()); dimCache[key] = { w: s.w, h: s.h, orb: s.orb, top: s.top }; }
  return dimCache[key];
}

// ---- shrines: one per repo, in API order
const SHRINE_AVOID = 7;            // a design never repeats within the last 7 shrines (so any 8 neighbours differ)
function layoutShrines(repos, zones) {
  const out = [], recent = [];
  repos.forEach((repo, i) => {
    const rng = makeRng(hash32(repo.full_name));
    const nominal = 1250 + i * 1100 + (rng() * 500 - 250);
    const x = Math.round(i ? Math.max(out[i - 1].x + 700, nominal) : nominal);
    const free = SHRINE_DESIGNS.filter(d => !recent.includes(d));
    const design = free[Math.floor(rng() * free.length)];
    recent.push(design); if (recent.length > SHRINE_AVOID) recent.shift();
    const step = starStep(repo.stargazers_count || 0), dm = stoneDims(design, step);
    const zone = zones.dominant(x), m = rng();
    const mount = m < 0.3 ? 'seabed' : m < 0.55 ? 'ledge' : m < 0.8 ? 'floating' : (zone === 'cave' ? 'ceiling' : 'hanging');
    // internal-px geometry of the stone's top-left corner; orb y follows from the stone
    let top, ledgeH = 0, chain = 0;
    if (mount === 'seabed') top = FLOOR + 4 - dm.h;
    else if (mount === 'ledge') { ledgeH = 26 + Math.floor(rng() * 44); top = FLOOR + 6 - ledgeH + 2 - dm.h; if (top < SURF + 8) { ledgeH -= SURF + 8 - top; top = SURF + 8; } }
    else if (mount === 'floating') top = Math.round(SURF + 12 + rng() * Math.max(4, FLOOR - 70 - dm.h - SURF - 12));
    else { chain = 12 + Math.floor(rng() * 36); top = SURF + chain; if (top + dm.h > FLOOR - 24) { chain -= top + dm.h - FLOOR + 24; top = SURF + chain; } }
    const sx = Math.round(x / K - dm.w / 2);
    out.push({ i, repo, name: repo.name, x, y: Math.round((top + dm.orb[1]) * K), design, step, accent: accentKey(repo.language), mount, ledgeH, chain,
      stone: { x: sx, y: top, w: dm.w, h: dm.h, orb: dm.orb, top: dm.top }, zone });
  });
  return out;
}

// ---- obstacles: rock pillars with gaps (a gate = hanging pillar + standing pillar around a 190-260 wpx gap)
function layoutGates(W, shrines) {
  const rng = makeRng(hash2(WORLD_SEED, 0xA11)), gates = [];
  let x = 800;
  while (x < W - 700) {
    const w = 84 + Math.floor(rng() * 48), gapH = 190 + Math.floor(rng() * 70), pillar = 90;
    const lo = SURF_W + pillar + gapH / 2, hi = FLOOR_W - pillar - gapH / 2, c = Math.round(lo + rng() * (hi - lo));
    const seed = Math.floor(rng() * 1e9), spacing = 560 + Math.floor(rng() * 420);
    const blocker = shrines.find(s => Math.abs(x + w / 2 - s.x) < 230 + w / 2);   // keep every shrine free of pillars
    if (blocker) { x = blocker.x + 230 + w; continue; }
    gates.push({ x, w, gapTop: Math.round(c - gapH / 2), gapBottom: Math.round(c + gapH / 2), seed });
    x += spacing;
  }
  return gates;
}
const gateBoxes = gates => gates.flatMap(g => [{ x: g.x, y: 0, w: g.w, h: g.gapTop }, { x: g.x, y: g.gapBottom, w: g.w, h: WH - g.gapBottom }]);

function layoutWorld(repos) {
  const W = 1600 + repos.length * 1100, zones = makeZones(W), shrines = layoutShrines(repos, zones), gates = layoutGates(W, shrines);
  return { W, H: WH, zones, shrines, gates, boxes: gateBoxes(gates) };
}
