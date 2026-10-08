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

export function buildNetwork(count, attractors) {
  const rand = mulberry32(1108);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const useA = rand() < 0.62 && attractors.length;
    const a = attractors[i % attractors.length];
    const spread = useA ? 3.4 : 11;
    const u = rand();
    const v = rand();
    const w = rand();
    const r = spread * Math.cbrt(u);
    const th = v * Math.PI * 2;
    const ph = Math.acos(2 * w - 1);
    const ox = useA ? a[0] : (rand() - 0.5) * 10;
    const oy = useA ? a[1] : (rand() - 0.5) * 5;
    const oz = useA ? a[2] : -4 - rand() * 78;
    pos[i * 3] = ox + r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = oy + r * Math.cos(ph) * 0.55;
    pos[i * 3 + 2] = oz + r * Math.sin(ph) * Math.sin(th);
  }

  const links = [];
  const maxLinks = Math.min(count * 2, 520);
  for (let i = 0; i < count && links.length < maxLinks; i += 1) {
    let best = -1;
    let bestD = 6.2;
    const ix = pos[i * 3];
    const iy = pos[i * 3 + 1];
    const iz = pos[i * 3 + 2];
    for (let j = i + 1; j < Math.min(count, i + 28); j++) {
      const dx = ix - pos[j * 3];
      const dy = iy - pos[j * 3 + 1];
      const dz = iz - pos[j * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) links.push([i, best]);
  }

  const line = new Float32Array(links.length * 6);
  for (let k = 0; k < links.length; k++) {
    const [a, b] = links[k];
    const o = k * 6;
    line[o] = pos[a * 3];
    line[o + 1] = pos[a * 3 + 1];
    line[o + 2] = pos[a * 3 + 2];
    line[o + 3] = pos[b * 3];
    line[o + 4] = pos[b * 3 + 1];
    line[o + 5] = pos[b * 3 + 2];
  }

  return { pos, line, links };
}
