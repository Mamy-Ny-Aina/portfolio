import { MADAGASCAR } from './madagascar';

// Formes 3D en nuages de points. Chaque forme contient exactement `count` points (x, y, z),
// pour que chaque particule puisse voyager d'une forme à l'autre.

export const SHAPES = ['planet', 'madagascar', 'helix', 'wave', 'network', 'atom', 'portal'] as const;
export type ShapeName = (typeof SHAPES)[number];

/** Position d'Antananarivo dans le repère normalisé de la carte (voir madagascar.ts). */
const TANA = { x: 0.0895, y: -0.008 };
const MAP_SCALE = 1.8;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

/** Indices mélangés : les particules ne gardent pas leur voisinage d'une forme à l'autre. */
function shuffledIndices(count: number, rand: () => number): Uint32Array {
  const idx = new Uint32Array(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  return idx;
}

/**
 * Écrit les points dans un ordre aléatoire. Les `reserved` derniers indices (les particules
 * « points chauds », plus grosses et lumineuses) ne sont remplis que via `pushHot`.
 */
function writer(count: number, rand: () => number, reserved = 0) {
  const out = new Float32Array(count * 3);
  const free = count - reserved;
  const order = shuffledIndices(free, rand);
  let n = 0;
  let h = 0;
  return {
    out,
    get size() {
      return n;
    },
    get full() {
      return n >= free;
    },
    push(x: number, y: number, z: number) {
      if (n >= free) return;
      const i = order[n++] * 3;
      out[i] = x;
      out[i + 1] = y;
      out[i + 2] = z;
    },
    pushHot(x: number, y: number, z: number) {
      if (h >= reserved) return;
      const i = (free + h++) * 3;
      out[i] = x;
      out[i + 1] = y;
      out[i + 2] = z;
    },
  };
}

function planet(count: number, rand: () => number): Float32Array {
  const w = writer(count, rand);
  const body = count;
  const surface = Math.floor(body * 0.62);
  const core = Math.floor(body * 0.1);
  const ring = body - surface - core;
  const R = 1.35;
  for (let i = 0; i < surface; i++) {
    const y = 1 - (i / (surface - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = GOLDEN * i;
    const k = R * (1 + gaussian(rand) * 0.012);
    w.push(Math.cos(th) * r * k, y * k, Math.sin(th) * r * k);
  }
  for (let i = 0; i < core; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const rr = R * 0.92 * Math.cbrt(rand());
    const s = Math.sqrt(1 - u * u);
    w.push(Math.cos(th) * s * rr, u * rr, Math.sin(th) * s * rr);
  }
  const tilt = 0.38;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  for (let i = 0; i < ring; i++) {
    const a = rand() * Math.PI * 2;
    const band = rand();
    const rr = band < 0.7 ? 1.85 + rand() * 0.55 : 2.5 + rand() * 0.18;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const y = gaussian(rand) * 0.018;
    // anneau incliné autour de l'axe X
    w.push(x, y * ct - z * st, y * st + z * ct);
  }
  return w.out;
}

function pointInPolygon(x: number, y: number, ring: number[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function madagascar(count: number, hot: number, rand: () => number): Float32Array {
  const w = writer(count, rand, hot);
  const body = count - hot;
  const outlineCount = Math.floor(body * 0.2);
  const fillCount = body - outlineCount;

  // Relief : les Hautes Terres centrales, légèrement à l'est du centre de l'île.
  const relief = (x: number, y: number) => 0.22 * Math.exp(-((x - 0.1 - y * 0.08) ** 2) / 0.035) * (1 - Math.abs(y) * 0.35);

  // Remplissage par échantillonnage de rejet
  let placed = 0;
  let guard = 0;
  while (placed < fillCount && guard++ < fillCount * 30) {
    const x = (rand() - 0.5) * 1.04;
    const y = rand() * 2 - 1;
    if (!MADAGASCAR.some((ring) => pointInPolygon(x, y, ring))) continue;
    const z = relief(x, y) + (rand() - 0.5) * 0.05;
    w.push(x * MAP_SCALE, y * MAP_SCALE, z * MAP_SCALE * 0.5);
    placed++;
  }

  // Contour : points répartis le long des côtes
  const segments: [number, number, number, number, number][] = [];
  let total = 0;
  for (const ring of MADAGASCAR) {
    for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length;
      const len = Math.hypot(ring[j] - ring[i], ring[j + 1] - ring[i + 1]);
      segments.push([ring[i], ring[i + 1], ring[j], ring[j + 1], len]);
      total += len;
    }
  }
  for (let i = 0; i < outlineCount + (fillCount - placed); i++) {
    let target = rand() * total;
    let seg = segments[0];
    for (const s of segments) {
      target -= s[4];
      if (target <= 0) {
        seg = s;
        break;
      }
    }
    const t = rand();
    const x = seg[0] + (seg[2] - seg[0]) * t;
    const y = seg[1] + (seg[3] - seg[1]) * t;
    w.push(x * MAP_SCALE, y * MAP_SCALE, (rand() - 0.5) * 0.02);
  }

  // Point chaud : Antananarivo
  for (let i = 0; i < hot; i++) {
    const r = Math.abs(gaussian(rand)) * 0.035;
    const a = rand() * Math.PI * 2;
    const x = TANA.x + Math.cos(a) * r;
    const y = TANA.y + Math.sin(a) * r;
    w.pushHot(x * MAP_SCALE, y * MAP_SCALE, (relief(TANA.x, TANA.y) + 0.04 + rand() * 0.05) * MAP_SCALE * 0.5);
  }
  return w.out;
}

function helix(count: number, rand: () => number): Float32Array {
  const w = writer(count, rand);
  const strands = Math.floor(count * 0.78);
  const rungs = count - strands;
  const turns = 2.6;
  const height = 4.2;
  const radius = 0.72;
  const roll = -0.5;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const put = (x: number, y: number, z: number) => w.push(x * cr - y * sr, x * sr + y * cr, z);
  for (let i = 0; i < strands; i++) {
    const strand = i % 2;
    const t = rand();
    const a = t * turns * Math.PI * 2 + strand * Math.PI;
    const j = gaussian(rand) * 0.035;
    put(Math.cos(a) * (radius + j), (t - 0.5) * height + gaussian(rand) * 0.02, Math.sin(a) * (radius + j));
  }
  const rungCount = 34;
  for (let i = 0; i < rungs; i++) {
    const k = Math.floor(rand() * rungCount);
    const t = (k + 0.5) / rungCount;
    const a = t * turns * Math.PI * 2;
    const s = rand() * 2 - 1;
    put(Math.cos(a) * radius * s, (t - 0.5) * height + gaussian(rand) * 0.01, Math.sin(a) * radius * s);
  }
  return w.out;
}

/** Relief en lignes (façon carte topographique) : des rangées de points dessinent les vagues. */
function wave(count: number, rand: () => number): Float32Array {
  const w = writer(count, rand);
  const rows = 34;
  const perRow = Math.floor(count / rows);
  const tilt = -0.95;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const height = (x: number, z: number, r: number) => {
    const hill = Math.exp(-((x - 0.5) ** 2 + (z + 0.15) ** 2 * 1.6) / 0.85);
    return 0.2 * Math.sin(1.35 * x + r * 0.23) * Math.cos(0.8 * z) + 0.62 * hill + 0.07 * Math.sin(3.2 * x - z * 2.1);
  };
  const put = (x: number, z: number, r: number) => {
    const y = height(x, z, r);
    w.push(x, y * ct - z * st, y * st + z * ct);
  };
  for (let r = 0; r < rows; r++) {
    const z = (r / (rows - 1) - 0.5) * 3.1;
    for (let k = 0; k < perRow; k++) put((k / (perRow - 1) - 0.5) * 5 + (rand() - 0.5) * 0.012, z + (rand() - 0.5) * 0.01, r);
  }
  while (!w.full) {
    const r = Math.floor(rand() * rows);
    put((rand() - 0.5) * 5, (r / (rows - 1) - 0.5) * 3.1, r);
  }
  return w.out;
}

function network(count: number, rand: () => number): Float32Array {
  const w = writer(count, rand);
  const layers = [4, 6, 6, 3];
  const nodes: [number, number, number][][] = layers.map((n, li) => {
    const x = (li / (layers.length - 1) - 0.5) * 3.6;
    return Array.from({ length: n }, (_, k) => {
      const y = (n === 1 ? 0 : k / (n - 1) - 0.5) * (n * 0.46);
      return [x, y, (rand() - 0.5) * 0.7] as [number, number, number];
    });
  });
  const flat = nodes.flat();
  const nodePoints = Math.floor(count * 0.36);
  for (let i = 0; i < nodePoints; i++) {
    const n = flat[Math.floor(rand() * flat.length)];
    w.push(n[0] + gaussian(rand) * 0.06, n[1] + gaussian(rand) * 0.06, n[2] + gaussian(rand) * 0.06);
  }
  while (!w.full) {
    const li = Math.floor(rand() * (layers.length - 1));
    const a = nodes[li][Math.floor(rand() * nodes[li].length)];
    const b = nodes[li + 1][Math.floor(rand() * nodes[li + 1].length)];
    const t = rand();
    w.push(a[0] + (b[0] - a[0]) * t + gaussian(rand) * 0.008, a[1] + (b[1] - a[1]) * t + gaussian(rand) * 0.008, a[2] + (b[2] - a[2]) * t);
  }
  return w.out;
}

function atom(count: number, rand: () => number): Float32Array {
  const w = writer(count, rand);
  const nucleus = Math.floor(count * 0.16);
  for (let i = 0; i < nucleus; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const r = 0.38 * Math.cbrt(rand());
    const s = Math.sqrt(1 - u * u);
    w.push(Math.cos(th) * s * r, u * r, Math.sin(th) * s * r);
  }
  const orbits = [
    { tilt: 1.2, yaw: 0 },
    { tilt: 1.2, yaw: (Math.PI * 2) / 3 },
    { tilt: 1.2, yaw: (Math.PI * 4) / 3 },
  ];
  while (!w.full) {
    const o = orbits[Math.floor(rand() * orbits.length)];
    const a = rand() * Math.PI * 2;
    const rx = 1.75 + gaussian(rand) * 0.02;
    const ry = 0.62 + gaussian(rand) * 0.02;
    let x = Math.cos(a) * rx;
    let y = Math.sin(a) * ry;
    let z = gaussian(rand) * 0.015;
    // inclinaison puis rotation de l'orbite
    const y2 = y * Math.cos(o.tilt) - z * Math.sin(o.tilt);
    z = y * Math.sin(o.tilt) + z * Math.cos(o.tilt);
    y = y2;
    const x2 = x * Math.cos(o.yaw) + z * Math.sin(o.yaw);
    z = -x * Math.sin(o.yaw) + z * Math.cos(o.yaw);
    x = x2;
    w.push(x, y, z);
  }
  return w.out;
}

function portal(count: number, rand: () => number): Float32Array {
  const w = writer(count, rand);
  const torus = Math.floor(count * 0.66);
  const R = 1.55;
  for (let i = 0; i < torus; i++) {
    const u = rand() * Math.PI * 2;
    const v = rand() * Math.PI * 2;
    const r = 0.14 * Math.sqrt(rand());
    w.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v));
  }
  // bras spiraux aspirés vers le centre
  while (!w.full) {
    const arm = Math.floor(rand() * 3);
    const t = Math.pow(rand(), 0.7);
    const r = 0.12 + t * 1.35;
    const a = r * 3.2 + (arm * Math.PI * 2) / 3 + gaussian(rand) * 0.12;
    w.push(Math.cos(a) * r, Math.sin(a) * r, (1 - t) * -0.9 + gaussian(rand) * 0.04);
  }
  return w.out;
}

export function buildShapes(count: number, hotCount: number): Record<ShapeName, Float32Array> {
  return {
    planet: planet(count, rng(11)),
    madagascar: madagascar(count, hotCount, rng(27)),
    helix: helix(count, rng(43)),
    wave: wave(count, rng(59)),
    network: network(count, rng(71)),
    atom: atom(count, rng(89)),
    portal: portal(count, rng(97)),
  };
}
