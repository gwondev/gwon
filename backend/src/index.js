import express from "express";
import cors from "cors";
import { initDb, pingDb } from "./db.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import { crudRouter } from "./routes/crud.js";

import chatRouter from "./routes/chat.js";
import calendarRouter from "./routes/calendar.js";
import techStackRouter from "./routes/tech-stack.js";
import portfolioRouter from "./routes/portfolio.js";
import binanceRouter from "./routes/binance.js";

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.set("trust proxy", 1);

app.use(cors());
// 사진·영상(base64)이 포함된 미디어 묶음을 받기 위해 넉넉히 설정
app.use(express.json({ limit: "40mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true, db: true });
  } catch {
    // 프로세스가 살아 있으면 200 — DB만 잠시 안 되어도 터널이 502를 내지 않게 한다
    res.json({ ok: true, db: false });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/chat", chatRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/tech-stack", techStackRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/binance", binanceRouter);
app.use("/api/projects", crudRouter("projects"));
app.use("/api/activities", crudRouter("activities"));
app.use("/api/certifications", crudRouter("certifications"));
app.use("/api/careers", crudRouter("careers"));

// 공통 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: err.message || "서버 오류가 발생했습니다." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`[backend] listening on :${PORT}`));

initDb().catch((err) => {
  console.error("[backend] DB 초기화 실패 (프로세스는 유지):", err.message);
});
