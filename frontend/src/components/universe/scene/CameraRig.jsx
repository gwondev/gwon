import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { damp } from "./util.js";

/**
 * 카메라의 유일한 주인.
 * pos/look/fov: 머무는 자리. dive: 떠날 때 빨려 들어가는 지점. inner: 도착할 때 빠져나오는 지점.
 * 세로 화면(portrait)에서는 같은 장면이 들어오도록 뒤로 물러난다.
 */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ANCHORS = {
  gateway: { pos: V(0, 0.82, 14.5), look: V(0, -0.15, 0), fov: 40, dive: V(0, 0.05, 0.35), inner: V(0, 0.02, 0.45), innerLook: V(0, 0, -4), portrait: 1.75, shift: -2.6 },
  projects: { pos: V(0, 2.4, 19), look: V(0, 0, 0), fov: 48, dive: V(0.3, 0.2, 1.2), inner: V(0, 0.4, -2), innerLook: V(0, 0, -12), portrait: 1.55, focusDist: 8.5, shift: 2.6 },
  infrastructure: { pos: V(20, 15, 25), look: V(0, 1.2, 0), fov: 40, dive: V(1.4, 0.9, 2.2), inner: V(0, 1.4, -1), innerLook: V(-6, 1.2, -10), portrait: 1.5, focusDist: 10, shift: 3.2 },
  credentials: { pos: V(0, 1.4, 15.5), look: V(0, 0, 0), fov: 44, dive: V(0, 0, 0.9), inner: V(0, 0, 0.6), innerLook: V(0, 0, -6), portrait: 1.6, focusDist: 9, shift: 2.6 },
  activities: { pos: V(0, 3.4, 17), look: V(0, 1.4, 0), fov: 48, dive: V(0, 1.6, 1.5), inner: V(0, 22, 9), innerLook: V(0, 6, -6), portrait: 1.45, focusDist: 7.5, shift: 2.2 },
  career: { pos: V(0, 3.2, 17.5), look: V(0, 0, 0), fov: 46, dive: V(0, 0.3, 2.4), inner: V(0.6, 15, 1.6), innerLook: V(0, 0, 0), portrait: 1.55, focusDist: 8, shift: 2.8 },
  awards: { pos: V(0, 0.6, 16), look: V(0, 0, 0), fov: 46, dive: V(0, 0, 0.8), inner: V(0, 0, 0.5), innerLook: V(0, 0, -6), portrait: 1.55, focusDist: 8, shift: 2.6 },
  profile: { pos: V(0, 0.6, 15), look: V(0, 0, 0), fov: 46, dive: V(0, 0, 1.6), inner: V(0, 0, -5), innerLook: V(0, 0, -14), portrait: 1.5, shift: 2.4 },
};
const UP = V(0, 1, 0);
Object.values(ANCHORS).forEach((a) => {
  a.right = new THREE.Vector3().subVectors(a.look, a.pos).cross(UP).normalize();
});
const FALLBACK = ANCHORS.gateway;
const DIVE_FOV = 30;

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const curLook = new THREE.Vector3();

function anchorOf(i) {
  return ANCHORS[live.ids[i]] || FALLBACK;
}

/** 넓은 화면에서는 왼쪽 글자 자리를 비우도록 장면을 오른쪽으로 민다. */
function sideShift(anchor, aspect) {
  return (anchor.shift || 0) * Math.min(1, Math.max(0, (aspect - 1.1) / 0.6));
}

/** 세로 화면에서 블랙홀 이외의 세계를 살짝 위로 올려, 아래 조작 자리를 비운다. */
function portraitLift(anchor, aspect) {
  if (aspect >= 1.05 || anchor === ANCHORS.gateway) return 0;
  return 1.55 * Math.min(1, (1.05 - aspect) / 0.4);
}

function restPos(anchor, aspect, out, shifted = true) {
  out.copy(anchor.pos);
  if (aspect < 1.6) {
    const k = THREE.MathUtils.lerp(1, anchor.portrait, Math.min(1, (1.6 - aspect) / 1.05));
    out.sub(anchor.look).multiplyScalar(k).add(anchor.look);
  }
  out.y += portraitLift(anchor, aspect) * 0.2;
  return shifted ? out.addScaledVector(anchor.right, sideShift(anchor, aspect)) : out;
}

function restLook(anchor, aspect, out) {
  out.copy(anchor.look).addScaledVector(anchor.right, sideShift(anchor, aspect));
  out.y -= portraitLift(anchor, aspect);
  return out;
}

const easeIn = (x) => x * x * x * (0.6 + 0.4 * x);
const easeOut = (x) => 1 - Math.pow(1 - x, 3.2);

/** 블랙홀로 떨어질 때는 직선이 아니라 원반을 따라 감기며 들어간다. s: 0(바깥)→1(중심). */
function spiral(out, s, sign) {
  const ang = sign * 1.15 * Math.pow(s, 1.35);
  const c = Math.cos(ang);
  const n = Math.sin(ang);
  const x = out.x * c - out.z * n;
  const z = out.x * n + out.z * c;
  out.x = x;
  out.z = z;
  return out;
}

/** 궤적이 바뀐 순간의 어긋남. 매 프레임 줄어들며 새 궤적으로 합류한다. */
const offPos = new THREE.Vector3();
const offLook = new THREE.Vector3();
let offFov = 0;
let offRoll = 0;
let seenSeq = -1;
let roll = 0;
const BLEND_RATE = 6.5;

export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  if (import.meta.env.DEV && window.__uv) window.__uv.camera = camera;

  useFrame((state, dt) => {
    const aspect = size.width / Math.max(1, size.height);
    const t = live.t;
    const time = state.clock.elapsedTime;
    let fov;
    let wantRoll = 0;

    if (live.active && !live.reduced) {
      if (t < 0.5) {
        const a = anchorOf(live.from);
        const e = easeIn(t / 0.5);
        restPos(a, aspect, _a);
        restLook(a, aspect, _b);
        _pos.lerpVectors(_a, a.dive, e);
        _look.lerpVectors(_b, a.dive, e * 0.35);
        fov = a.fov + DIVE_FOV * e;
        if (a === ANCHORS.gateway) {
          spiral(_pos, e, live.dir);
          wantRoll = 0.42 * live.dir * Math.pow(e, 1.8);
        }
      } else {
        const a = anchorOf(live.to);
        const e = easeOut((t - 0.5) / 0.5);
        restPos(a, aspect, _a);
        restLook(a, aspect, _b);
        _pos.lerpVectors(a.inner, _a, e);
        _look.lerpVectors(a.innerLook, _b, Math.min(1, e * 1.25));
        fov = a.fov + DIVE_FOV * (1 - e);
        if (a === ANCHORS.gateway) {
          spiral(_pos, 1 - e, -live.dir);
          wantRoll = -0.42 * live.dir * Math.pow(1 - e, 1.8);
        }
      }
      if (live.seq !== seenSeq) {
        seenSeq = live.seq;
        offPos.copy(camera.position).sub(_pos);
        offLook.copy(curLook).sub(_look);
        offFov = camera.fov - fov;
        offRoll = roll - wantRoll;
      }
      const k = Math.exp(-dt * BLEND_RATE);
      offPos.multiplyScalar(k);
      offLook.multiplyScalar(k);
      offFov *= k;
      offRoll *= k;
      camera.position.copy(_pos).add(offPos);
      curLook.copy(_look).add(offLook);
      fov += offFov;
      roll = wantRoll + offRoll;
    } else {
      seenSeq = live.seq;
      const a = anchorOf(live.active ? (t < 0.5 ? live.from : live.to) : live.index);
      restPos(a, aspect, _pos, false);
      _look.copy(a.look);
      if (a === ANCHORS.gateway && !live.reduced) {
        const az = Math.sin(time * 0.045) * 0.2 + Math.sin(time * 0.11 + 0.7) * 0.05;
        _pos.sub(a.look);
        const c = Math.cos(az);
        const n = Math.sin(az);
        const x = _pos.x * c - _pos.z * n;
        _pos.z = _pos.x * n + _pos.z * c;
        _pos.x = x;
        _pos.y += Math.sin(time * 0.06 + 0.4) * 0.55;
        _pos.add(a.look);
        wantRoll = Math.sin(time * 0.05 + 1.1) * 0.025;
      }
      if (live.focusPoint && a.focusDist) {
        _dir.copy(_pos).sub(live.focusPoint).normalize();
        _a.copy(live.focusPoint).addScaledVector(_dir, a.focusDist * (aspect < 1 ? a.portrait : 1));
        _pos.lerp(_a, 0.62);
        _look.lerp(live.focusPoint, 0.78);
      }
      const s = sideShift(a, aspect);
      _pos.addScaledVector(a.right, s);
      _look.addScaledVector(a.right, s);
      const calm = live.reduced ? 0.15 : 1;
      _pos.x += Math.sin(time * 0.11) * 0.35 * calm + live.pointerX * 0.7 * calm;
      _pos.y += Math.sin(time * 0.09 + 1.2) * 0.22 * calm + live.pointerY * 0.4 * calm;
      const k = live.active ? 30 : 2.2;
      camera.position.x = damp(camera.position.x, _pos.x, k, dt);
      camera.position.y = damp(camera.position.y, _pos.y, k, dt);
      camera.position.z = damp(camera.position.z, _pos.z, k, dt);
      curLook.x = damp(curLook.x, _look.x, k, dt);
      curLook.y = damp(curLook.y, _look.y, k, dt);
      curLook.z = damp(curLook.z, _look.z, k, dt);
      fov = damp(camera.fov, a.fov, 4, dt);
      roll = damp(roll, wantRoll, 3, dt);
    }

    camera.lookAt(curLook);
    if (Math.abs(roll) > 1e-4) camera.rotateZ(roll);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/** 처음 그릴 때 카메라를 현재 섹션 자리에 바로 세운다. */
export function placeCamera(camera, aspect) {
  const a = anchorOf(live.index);
  restPos(a, aspect, _pos);
  camera.position.copy(_pos);
  restLook(a, aspect, curLook);
  camera.lookAt(curLook);
  camera.fov = a.fov;
  camera.updateProjectionMatrix();
}
