import { useFrame } from "@react-three/fiber";
import { live, presence, sectionIndex } from "../director.js";

/**
 * 섹션 장면 공통 프레임 훅. 화면에 없는 장면은 숨기고 계산도 건너뛴다.
 * fn(state, dt, p) — p.enter: 도착 진행(0..1), p.leave: 떠남 진행(0..1), p.settled: 머무는 중.
 */
export function useSectionFrame(id, groupRef, fn) {
  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const i = sectionIndex(id);
    const p = i >= 0 ? presence(i) : { visible: false, enter: 0, leave: 0 };
    g.visible = p.visible;
    if (!p.visible) return;
    const settled = !live.active && live.index === i;
    fn(state, Math.min(dt, 0.05), { ...p, settled });
  });
}

/** 섹션이 머무는 중일 때 선택된 항목 위치를 카메라에 알린다. */
export function publishFocus(settled, point) {
  if (!settled) return;
  live.focusPoint = live.focus >= 0 && point ? point : null;
}
