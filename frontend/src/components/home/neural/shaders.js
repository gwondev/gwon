export const NOISE = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`;

export const planetVert = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
varying vec3 vW;
void main() {
  vPos = position;
  vN = normalize(normalMatrix * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const earthFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uCam;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vW;
${NOISE}
void main() {
  vec3 n = normalize(vPos);
  float land = smoothstep(0.46, 0.54, fbm(n * 3.4));
  vec3 ocean = vec3(0.02, 0.08, 0.18);
  vec3 continent = vec3(0.12, 0.22, 0.14);
  vec3 desert = vec3(0.28, 0.22, 0.12);
  vec3 col = mix(ocean, mix(continent, desert, fbm(n * 6.2)), land);
  float cloud = smoothstep(0.55, 0.75, fbm(n * 4.0 + vec3(uTime * 0.012, 0.0, 0.0)));
  col = mix(col, vec3(0.82, 0.86, 0.9), cloud * 0.45);
  float night = pow(max(0.0, -dot(normalize(vN), normalize(vec3(0.4, 0.2, 1.0)))), 1.4);
  col += land * night * vec3(0.55, 0.42, 0.22) * 0.35;
  vec3 view = normalize(uCam - vW);
  float fres = pow(1.0 - max(0.0, dot(normalize(vN), view)), 3.2);
  col += vec3(0.25, 0.45, 0.8) * fres * 0.55;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const atmoFrag = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 view = normalize(uCam - vW);
  float fres = pow(1.0 - max(0.0, dot(normalize(vN), view)), 2.6);
  gl_FragColor = vec4(uColor, fres * 0.55);
}
`;

export const sunFrag = /* glsl */ `
uniform float uTime;
varying vec3 vPos;
varying vec3 vN;
${NOISE}
void main() {
  vec3 n = normalize(vPos);
  float s = fbm(n * 4.5 + vec3(uTime * 0.08, uTime * 0.05, 0.0));
  vec3 hot = vec3(1.0, 0.82, 0.45);
  vec3 deep = vec3(0.75, 0.22, 0.04);
  vec3 col = mix(deep, hot, s);
  float rim = pow(1.0 - max(0.0, dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 2.0);
  col += vec3(1.0, 0.55, 0.15) * rim * 0.45;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const marsFrag = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
${NOISE}
void main() {
  vec3 n = normalize(vPos);
  float t = fbm(n * 5.2);
  float crater = smoothstep(0.62, 0.7, fbm(n * 9.0));
  vec3 col = mix(vec3(0.28, 0.12, 0.07), vec3(0.55, 0.28, 0.14), t);
  col = mix(col, vec3(0.18, 0.08, 0.05), crater * 0.55);
  float light = 0.35 + 0.65 * max(0.0, dot(normalize(vN), normalize(vec3(0.5, 0.4, 1.0))));
  gl_FragColor = vec4(col * light, 1.0);
}
`;

export const holeFrag = /* glsl */ `
uniform float uTime;
varying vec3 vPos;
varying vec3 vN;
${NOISE}
void main() {
  vec3 n = normalize(vPos);
  float r = length(n.xy);
  float disk = smoothstep(0.22, 0.28, r) * (1.0 - smoothstep(0.72, 0.98, r));
  float spin = atan(n.y, n.x) + uTime * 0.35 / max(0.18, r);
  float band = 0.5 + 0.5 * sin(spin * 18.0 + fbm(n * 8.0) * 6.0);
  vec3 hot = vec3(1.0, 0.78, 0.42);
  vec3 cool = vec3(0.15, 0.35, 0.7);
  vec3 col = mix(cool, hot, band) * disk;
  float hole = 1.0 - smoothstep(0.0, 0.22, r);
  col *= 1.0 - hole;
  float lens = pow(smoothstep(0.2, 0.45, r) * (1.0 - smoothstep(0.45, 0.7, r)), 1.2);
  col += vec3(0.9, 0.7, 0.4) * lens * 0.65;
  gl_FragColor = vec4(col, max(disk, hole * 0.95));
}
`;

export const nebulaFrag = /* glsl */ `
uniform float uTime;
varying vec3 vPos;
${NOISE}
void main() {
  vec3 n = normalize(vPos);
  float a = fbm(n * 3.2 + vec3(uTime * 0.02, 0.0, 0.0));
  float b = fbm(n * 6.1 - vec3(0.0, uTime * 0.015, 0.0));
  vec3 col = mix(vec3(0.18, 0.04, 0.22), vec3(0.55, 0.22, 0.12), a);
  col = mix(col, vec3(0.2, 0.35, 0.7), b * 0.55);
  float alpha = smoothstep(0.28, 0.7, a * 0.6 + b * 0.4) * 0.42;
  gl_FragColor = vec4(col, alpha);
}
`;
