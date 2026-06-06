import { Router } from "express";
import { buildPortfolioContext } from "../lib/portfolio-context.js";
import { askGemini } from "../lib/gemini.js";
import { getSetting } from "../lib/settings.js";

const router = Router();

const BASE_SYSTEM = `당신은 이성권의 포트폴리오 웹사이트 AI 어시스턴트입니다.
반드시 아래 [포트폴리오 데이터]에 있는 정보만 근거로 답변하세요.
데이터에 없는 내용은 추측하지 말고 "등록된 정보에서 확인되지 않습니다"라고 답하세요.
답변은 한국어로, 간결하고 친절하게 작성하세요.
주어는 이성권입니다.`;

router.get("/status", (_req, res) => {
  res.json({
    ready: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  });
});

router.post("/", async (req, res) => {
  try {
    const message = (req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "질문을 입력해주세요." });
    if (message.length > 500) return res.status(400).json({ error: "질문이 너무 깁니다." });

    if (!process.env.GEMINI_API_KEY?.trim()) {
      return res.status(503).json({ error: "AI 챗봇 API 키가 설정되지 않았습니다." });
    }

    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    const extra = await getSetting("chat_extra_prompt", "");
    const context = await buildPortfolioContext();

    const system = [
      BASE_SYSTEM,
      extra.trim() && `\n[관리자 추가 지침]\n${extra.trim()}`,
      `\n[포트폴리오 데이터]\n${context}`,
    ]
      .filter(Boolean)
      .join("\n");

    const reply = await askGemini({ system, history, message });
    res.json({ reply });
  } catch (err) {
    console.error("[chat]", err.message);
    res.status(500).json({ error: err.message || "AI 답변 생성에 실패했습니다." });
  }
});

export default router;
