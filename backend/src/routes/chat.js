import { Router } from "express";
import { optionalAuth } from "../auth-middleware.js";
import { buildPortfolioContext } from "../lib/portfolio-context.js";
import { askGemini, getGeminiModels } from "../lib/gemini.js";
import { buildChatSystemInstruction, sanitizeChatReply } from "../lib/chat-prompt.js";
import { assertChatQuotaAvailable, getChatQuota, incrementChatQuota } from "../lib/chat-quota.js";
import { insertChatLog } from "../lib/chat-logs.js";

const router = Router();

router.use(optionalAuth);

router.get("/status", (_req, res) => {
  res.json({
    ready: Boolean(process.env.GEMINI_API_KEY?.trim()),
    models: getGeminiModels(),
  });
});

router.get("/quota", async (req, res) => {
  try {
    const quota = await getChatQuota(req);
    res.json(quota);
  } catch (err) {
    console.error("[chat/quota]", err.message);
    res.status(500).json({ error: err.message || "할당량 조회 실패" });
  }
});

router.post("/", async (req, res) => {
  try {
    const message = (req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "질문을 입력해주세요." });
    if (message.length > 500) return res.status(400).json({ error: "질문이 너무 깁니다." });

    if (!process.env.GEMINI_API_KEY?.trim()) {
      return res.status(503).json({ error: "AI 챗봇 API 키가 설정되지 않았습니다." });
    }

    await assertChatQuotaAvailable(req);

    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    const context = await buildPortfolioContext();
    const system = await buildChatSystemInstruction(context);

    const raw = await askGemini({ system, history, message });
    const reply = sanitizeChatReply(raw);
    const quota = await incrementChatQuota(req);
    try {
      await insertChatLog(req, message, reply);
    } catch (logErr) {
      console.error("[chat/log]", logErr.message);
    }
    res.json({ reply, quota });
  } catch (err) {
    console.error("[chat]", err.message);
    if (err.status === 429) {
      return res.status(429).json({ error: err.message, quota: err.quota });
    }
    res.status(500).json({ error: err.message || "AI 답변 생성에 실패했습니다." });
  }
});

export default router;
