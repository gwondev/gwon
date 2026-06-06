import express from "express";
import cors from "cors";
import { initDb, pingDb } from "./db.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import { crudRouter } from "./routes/crud.js";

import chatRouter from "./routes/chat.js";

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/chat", chatRouter);
app.use("/api/projects", crudRouter("projects"));
app.use("/api/activities", crudRouter("activities"));
app.use("/api/certifications", crudRouter("certifications"));
app.use("/api/careers", crudRouter("careers"));

// 공통 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[backend] listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("[backend] DB 초기화 실패, 종료합니다.", err.message);
    process.exit(1);
  });
