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

function restPos(anchor, aspect, out, shifted = true) {
  out.copy(anchor.pos);
  if (aspect < 1.6) {
    const k = THREE.MathUtils.lerp(1, anchor.portrait, Math.min(1, (1.6 - aspect) / 1.05));
    out.sub(anchor.look).multiplyScalar(k).add(anchor.look);
  }
  return shifted ? out.addScaledVector(anchor.right, sideShift(anchor, aspect)) : out;
}

function restLook(anchor, aspect, out) {
  return out.copy(anchor.look).addScaledVector(anchor.right, sideShift(anchor, aspect));
}

const easeIn = (x) => x * x * x * (0.6 + 0.4 * x);
const easeOut = (x) => 1 - Math.pow(1 - x, 3.2);

export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useFrame((state, dt) => {
    const aspect = size.width / Math.max(1, size.height);
    const t = live.t;
    let fov;

    if (live.active && !live.reduced) {
      if (t < 0.5) {
        const a = anchorOf(live.from);
        const e = easeIn(t / 0.5);
        restPos(a, aspect, _a);
        restLook(a, aspect, _b);
        _pos.lerpVectors(_a, a.dive, e);
        _look.lerpVectors(_b, a.dive, e * 0.35);
        fov = a.fov + DIVE_FOV * e;
      } else {
        const a = anchorOf(live.to);
        const e = easeOut((t - 0.5) / 0.5);
        restPos(a, aspect, _a);
        restLook(a, aspect, _b);
        _pos.lerpVectors(a.inner, _a, e);
        _look.lerpVectors(a.innerLook, _b, Math.min(1, e * 1.25));
        fov = a.fov + DIVE_FOV * (1 - e);
      }
      camera.position.copy(_pos);
      curLook.copy(_look);
    } else {
      const a = anchorOf(live.active ? (t < 0.5 ? live.from : live.to) : live.index);
      restPos(a, aspect, _pos, false);
      _look.copy(a.look);
      if (live.focusPoint && a.focusDist) {
        _dir.copy(_pos).sub(live.focusPoint).normalize();
        _a.copy(live.focusPoint).addScaledVector(_dir, a.focusDist * (aspect < 1 ? a.portrait : 1));
        _pos.lerp(_a, 0.62);
        _look.lerp(live.focusPoint, 0.78);
      }
      const s = sideShift(a, aspect);
      _pos.addScaledVector(a.right, s);
      _look.addScaledVector(a.right, s);
      const time = state.clock.elapsedTime;
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
    }

    camera.lookAt(curLook);
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
