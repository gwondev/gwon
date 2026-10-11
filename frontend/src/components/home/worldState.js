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
  // 역방향 이탈 중이면 { from: 프로젝트 장면, u: 0..1 }. 이 동안 카메라는 progress 대신 이 값을 따른다.
  reverse: null,
};
