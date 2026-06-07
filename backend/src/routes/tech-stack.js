import { Router } from "express";
import { getTechStack } from "../lib/tech-stack.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const groups = await getTechStack();
    res.json({ groups });
  } catch (err) {
    console.error("[tech-stack]", err.message);
    res.status(500).json({ error: err.message || "기술스택 조회 실패" });
  }
});

export default router;
