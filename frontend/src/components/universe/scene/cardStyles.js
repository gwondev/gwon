/**
 * 자격증 카드 꾸밈 세트. 실제 자격증 정보와는 분리된 순수한 시각 설정이다.
 * 카드는 순서대로 세트를 하나씩 받고, 자격증이 세트 수보다 많아지면 처음부터 다시 돈다.
 * 등급·중요도에 따라 꾸밈을 다르게 주지 않는다. 세트를 늘리려면 배열에 한 줄 추가하면 된다.
 *   base/base2: 카드 바탕 그라데이션, glow: 테두리·문양·홀로그램 기조색, accent: 별·등급 표식,
 *   pattern: 가운데 문양(CardWorld 의 drawPattern), points: 별 꼭짓점 수.
 */
export const CARD_STYLES = [
  { base: "#0b1430", base2: "#1a2c63", glow: "#8fb8ff", accent: "#ffd58a", pattern: "constellation", points: 4 },
  { base: "#170d2c", base2: "#3b2370", glow: "#c3a6ff", accent: "#9fe8ff", pattern: "orbit", points: 5 },
  { base: "#071c22", base2: "#0f4450", glow: "#7ff0dc", accent: "#fff0b0", pattern: "rays", points: 8 },
  { base: "#22100f", base2: "#5a2a22", glow: "#ffb59a", accent: "#ffe7c0", pattern: "rings", points: 6 },
  { base: "#0d1424", base2: "#22385a", glow: "#a8d4ff", accent: "#ffc9e6", pattern: "lattice", points: 4 },
  { base: "#1e0f22", base2: "#55204f", glow: "#ff9fd8", accent: "#b6f0ff", pattern: "nova", points: 8 },
  { base: "#0c1a12", base2: "#1d4a30", glow: "#9ff0b8", accent: "#ffe08a", pattern: "meridian", points: 5 },
  { base: "#1b1709", base2: "#4d401a", glow: "#ffd98a", accent: "#ffffff", pattern: "prism", points: 6 },
  { base: "#0a1129", base2: "#253a7a", glow: "#7fa2ff", accent: "#ffb38a", pattern: "waves", points: 4 },
  { base: "#141022", base2: "#36305c", glow: "#b8b0ff", accent: "#ffe6a8", pattern: "grid", points: 5 },
  { base: "#06181f", base2: "#123a4d", glow: "#8fe4ff", accent: "#ffd0f0", pattern: "orbit", points: 6 },
  { base: "#1f0c16", base2: "#4f1c39", glow: "#ffa6c4", accent: "#fff2c4", pattern: "constellation", points: 8 },
  { base: "#101a0b", base2: "#2f4a1c", glow: "#c8f08f", accent: "#9fd8ff", pattern: "rings", points: 4 },
  { base: "#1c120a", base2: "#5a3518", glow: "#ffc48f", accent: "#c8e0ff", pattern: "rays", points: 5 },
  { base: "#0b0f1f", base2: "#1f2b55", glow: "#9fb8ff", accent: "#9ff0d0", pattern: "nova", points: 6 },
  { base: "#170b24", base2: "#432066", glow: "#d6a8ff", accent: "#ffd58a", pattern: "lattice", points: 8 },
  { base: "#08191a", base2: "#164745", glow: "#86f5e6", accent: "#ffb8a8", pattern: "prism", points: 4 },
  { base: "#1a1010", base2: "#4a2626", glow: "#ffb8b0", accent: "#b8ffe6", pattern: "meridian", points: 6 },
  { base: "#0f1420", base2: "#2a3a52", glow: "#c4dcff", accent: "#ffd6a0", pattern: "waves", points: 5 },
  { base: "#14140a", base2: "#3f3f1a", glow: "#f0e68f", accent: "#a8c8ff", pattern: "grid", points: 8 },
];

export function cardStyle(i) {
  return CARD_STYLES[((i % CARD_STYLES.length) + CARD_STYLES.length) % CARD_STYLES.length];
}

/**
 * 카드 앞면에 찍을 사실만 뽑는다. 따로 적힌 칸(issuer·acquired·score)이 있으면 그걸 쓰고,
 * 없으면 부제 "2026.09 · 한국산업인력공단" 을 날짜와 기관으로 나눈다. 없는 정보는 만들지 않는다.
 */
export function cardFacts(item) {
  const parts = String(item?.subtitle || "")
    .split("·")
    .map((x) => x.trim())
    .filter(Boolean);
  const date = String(item?.acquired || "").trim() || parts.find((x) => /\d{4}/.test(x)) || "";
  const issuer = String(item?.issuer || "").trim() || parts.filter((x) => x !== date).join(" · ");
  const desc = String(item?.description || "").trim();
  const grade = String(item?.score || "").trim() || (desc && desc.length <= 14 ? desc : "");
  return { title: String(item?.title || "").trim() || "자격증", issuer, date, grade };
}
