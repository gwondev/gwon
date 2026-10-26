import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live, presence, sectionIndex } from "../director.js";
import { SECTION_BY_ID } from "../sections.js";
import { rng } from "./util.js";

/** 관문을 뺀 모든 세계에 깔리는 별 배경. 섹션 색으로 아주 살짝 물든다. */
const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  varying float vTw;
  varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vTw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.6) + aSeed * 40.0);
    vSeed = aSeed;
    gl_PointSize = aSize * uPixel;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uTint;
  uniform float uFade;
  varying float vTw;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    vec3 base = mix(vec3(1.0, 0.92, 0.82), vec3(0.78, 0.86, 1.0), vSeed);
    gl_FragColor = vec4(mix(base, uTint, 0.35), a * a * vTw * uFade);
  }
`;

const _c = new THREE.Color();

export default function SpaceBackdrop() {
  const ref = useRef(null);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const n = mobile ? 1600 : 4200;
    const r = rng(7);
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rad = 120 + r() * 60;
      pos[i * 3] = s * Math.cos(th) * rad;
      pos[i * 3 + 1] = u * rad;
      pos[i * 3 + 2] = s * Math.sin(th) * rad;
      size[i] = 0.6 + Math.pow(r(), 6) * 3.2;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [mobile]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixel: { value: 1 },
          uTint: { value: new THREE.Color("#ffffff") },
          uFade: { value: 1 },
        },
      }),
    []
  );

  useFrame((state, dt) => {
    if (!ref.current) return;
    const g = presence(sectionIndex("gateway"));
    ref.current.visible = !g.visible;
    if (g.visible) return;
    const id = live.ids[live.active && live.t >= 0.5 ? live.to : live.active ? live.from : live.index];
    _c.set(SECTION_BY_ID[id]?.color || "#ffffff");
    const u = material.uniforms;
    u.uTint.value.lerp(_c, 1 - Math.exp(-dt * 2));
    u.uTime.value = state.clock.elapsedTime;
    u.uPixel.value = dpr * (mobile ? 1.6 : 1.9);
    ref.current.position.copy(state.camera.position);
    ref.current.rotation.y = state.clock.elapsedTime * 0.004;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-5} />;
}
