import { getSetting } from "./settings.js";

export async function buildChatSystemInstruction(context) {
  const system = (await getSetting("chat_system_prompt", "")).trim();
  const extra = (await getSetting("chat_extra_prompt", "")).trim();

  if (!system) {
    throw new Error("AI 시스템 프롬프트가 설정되지 않았습니다. 관리자에게 문의해 주세요.");
  }

  return [
    system,
    extra && `\n[관리자 추가 지침]\n${extra}`,
    "\n[형식] 답변은 줄바꿈 포함 최대 2줄. 세 번째 줄은 쓰지 마라.",
    `\n[포트폴리오 데이터]\n${context}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** 답변에 ** 가 남아 있으면 제거 (DB 규칙 보조) */
export function sanitizeChatReply(text) {
  const cleaned = String(text)
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/\*\*/g, "")
    .trim();
  const lines = cleaned.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return lines.slice(0, 2).join("\n");
}
