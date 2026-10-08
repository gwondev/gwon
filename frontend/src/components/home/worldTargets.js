import { SCENE_COUNT } from "./worldState.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fibSphere(i, n, r) {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

function write(arr, i, x, y, z) {
  const o = i * 3;
  arr[o] = x;
  arr[o + 1] = y;
  arr[o + 2] = z;
}

/**
 * Eight layouts, same instance count.
 * Particles stay the same objects across scenes — the system was always there.
 */
export function makeTargets(count) {
  const rand = mulberry32(20261008);
  const scenes = Array.from({ length: SCENE_COUNT }, () => new Float32Array(count * 3));

  const facilities = [
    [-2.4, 0, -1.6],
    [2.2, 0, -1.8],
    [-2.0, 0, 1.8],
    [2.4, 0, 1.6],
    [0.0, 0, -2.6],
    [0.1, 0, 2.4],
  ];

  for (let i = 0; i < count; i++) {
    const u = rand();
    const v = rand();
    const w = rand();
    const r = 7.5 * Math.cbrt(u);
    const th = v * Math.PI * 2;
    const ph = Math.acos(2 * w - 1);
    write(scenes[0], i, r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.72, r * Math.sin(ph) * Math.sin(th));

    const net = fibSphere(i, count, 3.35);
    write(scenes[1], i, net[0], net[1], net[2]);

    if (i === 0) write(scenes[2], i, 0, 0, 0);
    else if (i < 6) {
      const a = ((i - 1) / 5) * Math.PI * 2;
      write(scenes[2], i, Math.cos(a) * 2.55, 0.05, Math.sin(a) * 2.55);
    } else {
      const a = (i / count) * Math.PI * 2;
      const rad = 3.6 + (i % 5) * 0.18;
      write(scenes[2], i, Math.cos(a) * rad, ((i % 7) - 3) * 0.12, Math.sin(a) * rad);
    }

    const f = facilities[i % facilities.length];
    write(
      scenes[3],
      i,
      f[0] + (rand() - 0.5) * 1.1,
      0.35 + (i % 8) * 0.18 + rand() * 0.08,
      f[2] + (rand() - 0.5) * 1.1
    );

    if (i < 4) {
      const a = (i / 4) * Math.PI * 2;
      write(scenes[4], i, Math.cos(a) * 2.1, Math.sin(a * 1.7) * 0.4, Math.sin(a) * 2.1);
    } else {
      const g = fibSphere(i, count, 1.15 + (i % 9) * 0.22);
      write(scenes[4], i, g[0], g[1], g[2]);
    }

    const ang = (i / count) * Math.PI * 2;
    write(scenes[5], i, Math.cos(ang) * (0.55 + (i % 6) * 0.22), ((i % 11) - 5) * 0.22, Math.sin(ang) * (0.55 + (i % 6) * 0.22));

    const stream = i % 2 === 0 ? -1 : 1;
    write(scenes[6], i, stream * (0.9 + (i % 4) * 0.15), ((i % 9) - 4) * 0.16, ((i / count) * 8 - 4) * (stream > 0 ? 1 : -0.85));

    if (i < 5) {
      const a = (i / 5) * Math.PI * 2;
      write(scenes[7], i, Math.cos(a) * 3.2, 0.2, Math.sin(a) * 3.2);
    } else {
      const s = fibSphere(i, count, 5.4);
      write(scenes[7], i, s[0], s[1] * 0.55, s[2]);
    }
  }

  return scenes;
}

export function makePairs(count) {
  const pairs = [];
  const n = Math.min(72, Math.floor(count * 0.35));
  for (let i = 0; i < n; i++) {
    pairs.push([i, (i + 7) % count], [i, (i + 13) % count]);
  }
  return pairs;
}
