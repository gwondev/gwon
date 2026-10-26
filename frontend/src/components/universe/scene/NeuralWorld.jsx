import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { POINT_FRAG, glowTexture, rng, damp, disposeTree } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * PROJECTS — 신경망.
 * 프로젝트 하나가 허브 하나다. 허브 둘레에 노드 군집이 있고, 연결선 위로 신호 펄스가 흐른다.
 * 허브 중심에는 프로젝트 성격(effect)에 맞는 구조물이 떠 있다.
 */
const _focus = new THREE.Vector3();
export const PALETTE = ["#8fd8ff", "#a993ff", "#7ff0cf", "#ffc58f", "#ff9fcf", "#b8f37a", "#ffd98a", "#7fb4ff"];

const NODE_VERT = /* glsl */ `
  attribute float aCluster;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uActive;
  uniform float uEnter;
  uniform float uPixel;
  varying vec3 vColor;
  varying float vAlpha;
  vec3 drift(vec3 p, float s) {
    return p + vec3(sin(uTime * 0.4 + s * 31.0), cos(uTime * 0.33 + s * 17.0), sin(uTime * 0.27 + s * 9.0)) * 0.12;
  }
  void main() {
    vec3 p = drift(position, aSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float on = aCluster < 0.0 ? 0.0 : 1.0 - step(0.5, abs(aCluster - uActive));
    float ignite = smoothstep(aSeed * 0.75, aSeed * 0.75 + 0.25, uEnter);
    float dim = uActive < 0.0 ? 0.75 : (aCluster < 0.0 ? 0.45 : mix(0.4, 1.0, on));
    vColor = aColor * (1.0 + on * 0.6);
    vAlpha = ignite * dim * (0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 60.0));
    gl_PointSize = aSize * (1.0 + on * 0.7) * uPixel * (60.0 / -mv.z);
  }
`;

const EDGE_VERT = /* glsl */ `
  attribute float aT;
  attribute float aCluster;
  attribute float aSeed;
  attribute float aNodeSeed;
  attribute vec3 aColor;
  uniform float uTime;
  varying float vT;
  varying float vCluster;
  varying float vSeed;
  varying vec3 vColor;
  vec3 drift(vec3 p, float s) {
    return p + vec3(sin(uTime * 0.4 + s * 31.0), cos(uTime * 0.33 + s * 17.0), sin(uTime * 0.27 + s * 9.0)) * 0.12;
  }
  void main() {
    vT = aT;
    vCluster = aCluster;
    vSeed = aSeed;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(drift(position, aNodeSeed), 1.0);
  }
`;

const EDGE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uActive;
  uniform float uEnter;
  varying float vT;
  varying float vCluster;
  varying float vSeed;
  varying vec3 vColor;
  void main() {
    float on = vCluster < 0.0 ? 0.0 : 1.0 - step(0.5, abs(vCluster - uActive));
    float speed = 0.25 + vSeed * 0.5 + on * 0.6;
    float ph = fract(uTime * speed + vSeed * 13.0);
    float pulse = smoothstep(0.07, 0.0, abs(vT - ph));
    float ignite = smoothstep(vSeed * 0.8, vSeed * 0.8 + 0.2, uEnter);
    float base = uActive < 0.0 ? 0.13 : mix(0.06, 0.28, on);
    float a = (base + pulse * (0.35 + on * 0.9)) * ignite;
    gl_FragColor = vec4(vColor * (1.0 + pulse * 1.5), a);
  }
`;

function hubPositions(n) {
  return Array.from({ length: n }, (_, i) => {
    const th = Math.PI / 2 + (i / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(th) * 7.2, Math.sin(th) * 3.6, Math.sin(th * 2 + 0.6) * 2.4 - 0.5);
  });
}

function buildNetwork(hubs, mobile) {
  const r = rng(1337 + hubs.length);
  const perHub = mobile ? 34 : 74;
  const background = mobile ? 90 : 240;
  const nodes = [];
  const col = new THREE.Color();

  nodes.push({ p: new THREE.Vector3(0, 0, -0.5), c: -1, s: 0.02, size: 5, color: new THREE.Color("#ffffff") });
  hubs.forEach((h, k) => {
    col.set(PALETTE[k % PALETTE.length]);
    nodes.push({ p: h.clone(), c: k, s: r() * 0.2, size: 7, color: col.clone(), hub: true });
    for (let j = 0; j < perHub; j++) {
      const g = () => (r() + r() + r() - 1.5) * 1.5;
      const p = new THREE.Vector3(g(), g(), g()).multiplyScalar(1.15).add(h);
      nodes.push({ p, c: k, s: r(), size: 1.6 + r() * 2.2, color: col.clone().lerp(new THREE.Color("#ffffff"), r() * 0.35) });
    }
  });
  for (let j = 0; j < background; j++) {
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const rad = Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    const p = new THREE.Vector3(s * Math.cos(th) * 14 * rad, u * 8 * rad, s * Math.sin(th) * 9 * rad - 1);
    nodes.push({ p, c: -1, s: r(), size: 1 + r() * 1.6, color: new THREE.Color("#c9dcff") });
  }

  const edges = [];
  const seen = new Set();
  const link = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    edges.push([a, b]);
  };
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    const best = [];
    for (let j = 1; j < nodes.length; j++) {
      if (j === i) continue;
      const m = nodes[j];
      if (n.c >= 0 && m.c >= 0 && m.c !== n.c) continue;
      const d = n.p.distanceToSquared(m.p);
      if (d > 10) continue;
      best.push([d, j]);
    }
    best.sort((a, b) => a[0] - b[0]);
    const k = n.c >= 0 ? 3 : 2;
    best.slice(0, k).forEach(([, j]) => link(i, j));
  }
  const hubIdx = nodes.map((n, i) => (n.hub ? i : -1)).filter((i) => i >= 0);
  hubIdx.forEach((h, k) => {
    link(0, h);
    link(h, hubIdx[(k + 1) % hubIdx.length]);
  });

  const nGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(nodes.length * 3);
  const cluster = new Float32Array(nodes.length);
  const seed = new Float32Array(nodes.length);
  const size = new Float32Array(nodes.length);
  const color = new Float32Array(nodes.length * 3);
  nodes.forEach((n, i) => {
    n.p.toArray(pos, i * 3);
    cluster[i] = n.c;
    seed[i] = n.s;
    size[i] = n.size;
    n.color.toArray(color, i * 3);
  });
  nGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  nGeo.setAttribute("aCluster", new THREE.BufferAttribute(cluster, 1));
  nGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  nGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  nGeo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));

  const eGeo = new THREE.BufferGeometry();
  const ep = new Float32Array(edges.length * 6);
  const et = new Float32Array(edges.length * 2);
  const ec = new Float32Array(edges.length * 2);
  const es = new Float32Array(edges.length * 2);
  const ens = new Float32Array(edges.length * 2);
  const ecol = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => {
    const na = nodes[a];
    const nb = nodes[b];
    na.p.toArray(ep, i * 6);
    nb.p.toArray(ep, i * 6 + 3);
    et[i * 2] = 0;
    et[i * 2 + 1] = 1;
    const c = na.c >= 0 && na.c === nb.c ? na.c : -1;
    ec[i * 2] = ec[i * 2 + 1] = c;
    es[i * 2] = es[i * 2 + 1] = r();
    ens[i * 2] = na.s;
    ens[i * 2 + 1] = nb.s;
    const cc = c >= 0 ? na.color : new THREE.Color("#9fb8e8");
    cc.toArray(ecol, i * 6);
    cc.toArray(ecol, i * 6 + 3);
  });
  eGeo.setAttribute("position", new THREE.BufferAttribute(ep, 3));
  eGeo.setAttribute("aT", new THREE.BufferAttribute(et, 1));
  eGeo.setAttribute("aCluster", new THREE.BufferAttribute(ec, 1));
  eGeo.setAttribute("aSeed", new THREE.BufferAttribute(es, 1));
  eGeo.setAttribute("aNodeSeed", new THREE.BufferAttribute(ens, 1));
  eGeo.setAttribute("aColor", new THREE.BufferAttribute(ecol, 3));

  return { nGeo, eGeo };
}

function gearGeometry() {
  const shape = new THREE.Shape();
  const teeth = 12;
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? 0.95 : 0.72;
    const a0 = a - 0.09;
    const a1 = a + 0.09;
    if (i === 0) shape.moveTo(Math.cos(a0) * rad, Math.sin(a0) * rad);
    else shape.lineTo(Math.cos(a0) * rad, Math.sin(a0) * rad);
    shape.lineTo(Math.cos(a1) * rad, Math.sin(a1) * rad);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  g.center();
  return new THREE.EdgesGeometry(g, 20);
}

function Motif({ effect, color }) {
  const ref = useRef(null);
  const parts = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const group = new THREE.Group();
    if (effect === "infrastructure") {
      const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.3, 0.32, 0.9));
      for (let i = 0; i < 4; i++) {
        const l = new THREE.LineSegments(box, mat);
        l.position.y = (i - 1.5) * 0.42;
        l.userData.rack = i;
        group.add(l);
      }
    } else if (effect === "data-flow") {
      const pts = Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      });
      const circle = new THREE.BufferGeometry().setFromPoints(pts);
      for (let i = 0; i < 4; i++) {
        const l = new THREE.LineLoop(circle, mat.clone());
        l.userData.ripple = i / 4;
        group.add(l);
      }
      group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color, wireframe: true })));
    } else if (effect === "neural-recognition") {
      const layers = [4, 6, 6, 3];
      const verts = [];
      const nodes = [];
      layers.forEach((n, li) => {
        for (let j = 0; j < n; j++) nodes.push([li, new THREE.Vector3((li - 1.5) * 0.6, (j - (n - 1) / 2) * 0.32, 0)]);
      });
      nodes.forEach(([li, p]) => nodes.forEach(([lj, q]) => lj === li + 1 && verts.push(p, q)));
      group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(verts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })));
      const dot = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(nodes.map(([, p]) => p)),
        new THREE.PointsMaterial({ color, size: 0.12, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      group.add(dot);
    } else if (effect === "mechanical-pulse") {
      const gear = new THREE.LineSegments(gearGeometry(), mat);
      gear.userData.spin = 1;
      group.add(gear);
      const small = new THREE.LineSegments(gearGeometry(), mat);
      small.scale.setScalar(0.5);
      small.position.set(1.12, 0.55, 0);
      small.userData.spin = -2;
      group.add(small);
    } else if (effect === "code-stream") {
      const n = 90;
      const pos = new Float32Array(n * 3);
      const r = rng(5);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.floor(r() * 7) - 3) * 0.22;
        pos[i * 3 + 1] = r() * 2.4 - 1.2;
        pos[i * 3 + 2] = (r() - 0.5) * 0.3;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.09, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      pts.userData.stream = true;
      group.add(pts);
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.7, 2.5, 0.05)), mat));
    } else {
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.75, 0)), mat));
    }
    return group;
  }, [effect, color]);

  useEffect(() => () => disposeTree(parts), [parts]);

  useSectionFrame("projects", ref, (state) => {
    const t = state.clock.elapsedTime * (live.reduced ? 0.2 : 1);
    parts.children.forEach((c) => {
      if (c.userData.spin) c.rotation.z = t * 0.4 * c.userData.spin;
      if (c.userData.rack !== undefined) c.material.opacity = 0.45 + 0.4 * Math.max(0, Math.sin(t * 3 - c.userData.rack));
      if (c.userData.ripple !== undefined) {
        const k = (t * 0.35 + c.userData.ripple) % 1;
        c.scale.setScalar(0.3 + k * 1.3);
        c.material.opacity = (1 - k) * 0.9;
      }
      if (c.userData.stream) {
        const a = c.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          let y = a.getY(i) - 0.012 * (1 + (i % 5) * 0.3);
          if (y < -1.2) y += 2.4;
          a.setY(i, y);
        }
        a.needsUpdate = true;
      }
    });
    ref.current.rotation.y = Math.sin(t * 0.2) * 0.35;
  });

  return <primitive object={parts} ref={ref} />;
}

export default function NeuralWorld({ projects }) {
  const group = useRef(null);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);
  const n = Math.max(1, projects.length);
  const hubs = useMemo(() => hubPositions(n), [n]);
  const net = useMemo(() => buildNetwork(hubs, mobile), [hubs, mobile]);
  const hubRefs = useRef([]);

  const nodeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NODE_VERT,
        fragmentShader: POINT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uActive: { value: -1 }, uEnter: { value: 1 }, uPixel: { value: 1 } },
      }),
    []
  );
  const edgeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EDGE_VERT,
        fragmentShader: EDGE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uActive: { value: -1 }, uEnter: { value: 1 } },
      }),
    []
  );

  useEffect(
    () => () => {
      net.nGeo.dispose();
      net.eGeo.dispose();
    },
    [net]
  );

  useSectionFrame("projects", group, (state, dt, p) => {
    const t = state.clock.elapsedTime * (live.reduced ? 0.25 : 1);
    const target = live.focus >= 0 && live.focus < n ? live.focus : -1;
    for (const m of [nodeMat, edgeMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uActive.value = target;
      m.uniforms.uEnter.value = p.enter;
    }
    nodeMat.uniforms.uPixel.value = dpr * (mobile ? 0.8 : 1);
    hubRefs.current.forEach((h, k) => {
      if (!h) return;
      const s = target === k ? 1.25 : target < 0 ? 1 : 0.8;
      h.scale.setScalar(damp(h.scale.x, s, 5, dt));
    });
    group.current.rotation.y = Math.sin(t * 0.05) * 0.12 + live.pointerX * 0.05;
    publishFocus(p.settled, target >= 0 ? _focus.copy(hubs[target]).applyMatrix4(group.current.matrixWorld) : null);
  });

  return (
    <group ref={group}>
      <lineSegments geometry={net.eGeo} material={edgeMat} frustumCulled={false} />
      <points geometry={net.nGeo} material={nodeMat} frustumCulled={false} />
      {hubs.map((h, k) => (
        <group key={k} position={h} ref={(el) => (hubRefs.current[k] = el)}>
          <sprite scale={[2.4, 2.4, 1]}>
            <spriteMaterial map={glowTexture()} color={PALETTE[k % PALETTE.length]} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
          <Motif effect={projects[k]?.effect || "none"} color={PALETTE[k % PALETTE.length]} />
        </group>
      ))}
    </group>
  );
}
