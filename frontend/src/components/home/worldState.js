export const worldState = {
  progress: 0,
  pointerX: 0,
  pointerY: 0,
  reduced: false,
  mobile: false,
  warp: 0,
  velocity: 0,
  hoverIndex: -1,
  quiet: 0,
  effect: "none",
  effectIndex: -1,
  // 워프가 출발하는 장면(0 인트로, 1..N 프로젝트). null 이면 바로 앞 장면에서 출발한다.
  warpFrom: null,
  // 뒤로 빠지는 워프 중이면 true. 앞으로 가는 추종 속도는 건드리지 않는다.
  warpBack: false,
  editDrag: false,
  planets: null,
  liveProjects: null,
};
