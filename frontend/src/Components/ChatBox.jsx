import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
} from "@mui/material";

export default function ChatBox() {
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [history, setHistory] = useState([]); // Q&A 스택형 저장합니다.s

  const API_KEY = process.env.REACT_APP_GPT_API;
  

  // ✅ chatAiPrompt.txt 불러오기
  useEffect(() => {
    const promptUrl = new URL("../assets/chatAiPrompt.txt", import.meta.url);
    fetch(promptUrl)
      .then((res) => res.text())
      .then((text) => setSystemPrompt(text))
      .catch((err) =>
        console.error("⚠️ chatAiPrompt.txt 불러오기 실패:", err)
      );
  }, []);

  // 🚀 메시지 전송
  const handleSend = async () => {
    if (!input.trim() || !systemPrompt) return;

    const userQuestion = input.trim();
    setAnswer("");
    setLoading(true);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userQuestion },
          ],
          max_tokens: 80,
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const msg = data.choices?.[0]?.message?.content?.trim() || "응답이 없습니다.";
      setAnswer(msg);

      // 👇 최신 질문·답변을 맨 위에 추가 (스택)
      setHistory((prev) => [{ q: userQuestion, a: msg }, ...prev].slice(0, 5));
    } catch (err) {
      console.error("❌ OpenAI API 호출 오류:", err);
      setAnswer("⚠️ 오류 발생 (API 연결 실패)");
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <Paper
      elevation={6}
      sx={{
        p: { xs: 3, sm: 5 },
        mt: 8,
        mb: 8,
        mx: "auto",
        maxWidth: 720,
        borderRadius: 4,
        textAlign: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#d1e5ff",
        boxShadow: "0 0 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* 헤더 */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 1,
          color: "#7dd3fc",
          fontSize: { xs: "1.3rem", sm: "1.6rem" },
        }}
      >
        저에 대해 질문해주세요!
      </Typography>

      {/* 입력 박스 */}
      <Box display="flex" justifyContent="center" alignItems="center" flexWrap="wrap">
        <TextField
          variant="outlined"
          placeholder="무엇이 궁금하신가요?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          sx={{
            width: { xs: "100%", sm: "70%" },
            mr: { sm: 2, xs: 0 },
            mb: { xs: 2, sm: 0 },
            backgroundColor: "#f8fafc",
            borderRadius: 1,
            input: { color: "#1e293b" },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={loading}
          sx={{
            minWidth: 110,
            py: 1.3,
            fontWeight: 600,
            fontSize: { xs: "0.9rem", sm: "1rem" },
            backgroundColor: "#2563eb",
            "&:hover": { backgroundColor: "#1d4ed8" },
          }}
        >
          {loading ? "전송 중..." : "전송"}
        </Button>
      </Box>

      {/* 로딩 중 */}
      <Box sx={{ mt: 4 }}>
        {loading && <CircularProgress size={28} sx={{ color: "#7dd3fc" }} />}
      </Box>

      {/* 💬 Q&A 히스토리 (최신이 맨 위) */}
      <Box
        sx={{
          mt: 5,
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {history.map((item, idx) => (
          <Paper
            key={idx}
            elevation={idx === 0 ? 6 : 2}
            sx={{
              backgroundColor:
                idx === 0
                  ? "rgba(125, 211, 252, 0.1)"
                  : "rgba(255,255,255,0.05)",
              border: idx === 0 ? "1px solid #38bdf8" : "none",
              transform: idx === 0 ? "scale(1.03)" : "none",
              transition: "all 0.3s ease",
              borderRadius: 2,
              p: 2.5,
            }}
          >
            <Typography
              sx={{
                color: idx === 0 ? "#bae6fd" : "#cbd5e1",
                fontWeight: 700,
                fontSize: idx === 0 ? "1.05rem" : "0.95rem",
              }}
            >
              Q. {item.q}
            </Typography>
            <Typography
              sx={{
                color: idx === 0 ? "#e0f2fe" : "#e2e8f0",
                mt: 1,
                fontSize: idx === 0 ? "1rem" : "0.9rem",
                lineHeight: 1.6,
              }}
            >
              A. {item.a}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* 📌 예시 Q&A */}
      <Box sx={{ mt: 5, textAlign: "left" }}>
        <Typography
          variant="subtitle1"
          sx={{
            mb: 1,
            color: "#7dd3fc",
            fontWeight: 600,
            fontSize: { xs: "1rem", sm: "1.1rem" },
          }}
        >
          📌 예시 질문
        </Typography>

        <Box
          sx={{
            pl: 2,
            color: "#cbd5e1",
            fontSize: { xs: "0.85rem", sm: "0.95rem" },
          }}
        >
          <Typography sx={{ mb: 1 }}>
            <b>Q.</b> 이름이 뭐에요?
          </Typography>
          <Typography sx={{ mb: 1 }}>
            <b>Q.</b> 여자친구 있어요?
          </Typography>
          <Typography sx={{ mb: 1 }}>
            <b>Q.</b> 대학교는 어디 다녀요?
          </Typography>
          <Typography sx={{ mb: 1 }}>
            <b>Q.</b> 음식 뭐 좋아해요?
          </Typography>
          <Typography sx={{ mb: 1 }}>
            <b>Q.</b> 1+1은?
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
