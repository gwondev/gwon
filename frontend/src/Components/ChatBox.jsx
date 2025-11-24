import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
  Stack,
  Avatar,
  Chip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PersonIcon from "@mui/icons-material/Person";

export default function ChatBox() {
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  // 초기 환영 메시지 추가
  const [history, setHistory] = useState([
    { role: "ai", text: "안녕하세요! 저에 대해 무엇이든 물어봐주세요. 👋" }
  ]); 

  const API_KEY = process.env.REACT_APP_GPT_API;
  const scrollRef = useRef(null);

  // ✅ chatAiPrompt.txt 불러오기 (사용자 로직 유지)
  useEffect(() => {
    try {
      const promptUrl = new URL("../assets/chatAiPrompt.txt", import.meta.url);
      fetch(promptUrl)
        .then((res) => res.text())
        .then((text) => setSystemPrompt(text))
        .catch((err) =>
          console.error("⚠️ chatAiPrompt.txt 불러오기 실패:", err)
        );
    } catch (error) {
      console.warn("URL import failed, check your bundler settings.", error);
    }
  }, []);

  // 스크롤 자동 이동
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  // 🚀 메시지 전송
  const handleSend = async (questionText = input) => {
    const userQuestion = questionText.trim();
    if (!userQuestion || !systemPrompt) return;

    setInput("");
    setAnswer("");
    setLoading(true);

    // 1. 사용자 질문을 히스토리에 추가 (User Bubble)
    setHistory((prev) => [...prev, { role: "user", text: userQuestion }]);

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
            // 이전 대화 맥락 포함 (최근 4개)
            ...history.slice(-4).map(h => ({
              role: h.role === 'user' ? 'user' : 'assistant',
              content: h.text
            })),
            { role: "user", content: userQuestion },
          ],
          max_tokens: 150,
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const msg = data.choices?.[0]?.message?.content?.trim() || "응답이 없습니다.";
      setAnswer(msg);

      // 2. AI 응답을 히스토리에 추가 (AI Bubble)
      setHistory((prev) => [...prev, { role: "ai", text: msg }]);

    } catch (err) {
      console.error("❌ OpenAI API 호출 오류:", err);
      setHistory((prev) => [...prev, { role: "ai", text: "⚠️ 오류 발생 (API 연결 실패)" }]);
    } finally {
      setLoading(false);
    }
  };

  // 추천 질문
  const chips = ["이름이 뭐에요?", "기술 스택", "연락처", "프로젝트 경험"];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, sm: 4 },
        mt: 8,
        mb: 8,
        mx: "auto",
        maxWidth: 720,
        borderRadius: 3,
        textAlign: "center",
        // ✅ MenuCard 스타일 적용 (어두운 그라데이션)
        bgcolor: "background.paper",
        color: "text.primary",
        border: "1px solid rgba(255,255,255,0.06)",
        backgroundImage:
          "radial-gradient(120% 180% at 10% -20%, rgba(91,140,255,.08), transparent 60%), radial-gradient(100% 140% at 90% 120%, rgba(57,230,181,.06), transparent 60%)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* 헤더 */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 3,
          // ✅ MenuCard 텍스트 그라디언트 적용
          background: "linear-gradient(90deg, #5B8CFF 0%, #39E6B5 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "0 0 12px rgba(91,140,255,0.15)",
          display: "inline-block",
        }}
      >
        AI에게 질문하기
      </Typography>

      {/* 💬 채팅 영역 (스크롤 가능) */}
      <Box
        ref={scrollRef}
        sx={{
          height: 400,
          overflowY: "auto",
          p: 2,
          mb: 2,
          borderRadius: 2,
          bgcolor: "rgba(0,0,0,0.2)", // 내용 구분을 위한 짙은 배경
          border: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          "&::-webkit-scrollbar": { width: "6px" },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "3px" },
        }}
      >
        {history.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              alignSelf: item.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              display: "flex",
              flexDirection: item.role === "user" ? "row-reverse" : "row",
              alignItems: "flex-start",
              gap: 1,
            }}
          >
            {/* 아바타 아이콘 */}
            <Avatar
              sx={{
                width: 32, height: 32,
                bgcolor: item.role === "user" ? "rgba(91,140,255,0.2)" : "rgba(57,230,181,0.1)",
                color: item.role === "user" ? "#5B8CFF" : "#39E6B5",
              }}
            >
              {item.role === "user" ? <PersonIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
            </Avatar>

            {/* 말풍선 */}
            <Box
              sx={{
                p: 1.5,
                px: 2,
                borderRadius: 2,
                fontSize: "0.95rem",
                lineHeight: 1.5,
                // User: 그라디언트 배경 / AI: 짙은 배경
                background: item.role === "user" 
                  ? "linear-gradient(135deg, #5B8CFF 0%, #4A7DFF 100%)" 
                  : "rgba(255,255,255,0.08)",
                color: item.role === "user" ? "#fff" : "text.primary",
                // 말풍선 꼬리 효과
                borderRadius: item.role === "user" ? "18px 18px 2px 18px" : "18px 18px 18px 2px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              {item.text}
            </Box>
          </Box>
        ))}

        {/* 로딩 인디케이터 */}
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "rgba(57,230,181,0.1)", color: "#39E6B5" }}>
              <AutoAwesomeIcon fontSize="small" />
            </Avatar>
            <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.08)", borderRadius: "18px 18px 18px 2px" }}>
              <CircularProgress size={16} sx={{ color: "#39E6B5" }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* 추천 질문 칩 */}
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {chips.map((label) => (
          <Chip
            key={label}
            label={label}
            onClick={() => handleSend(label)}
            clickable
            sx={{
              bgcolor: "rgba(91,140,255,0.08)",
              color: "#5B8CFF",
              fontWeight: 600,
              border: "1px solid rgba(91,140,255,0.2)",
              "&:hover": { 
                bgcolor: "rgba(91,140,255,0.2)",
                borderColor: "#5B8CFF"
              },
            }}
          />
        ))}
      </Stack>

      {/* 입력창 */}
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="무엇이 궁금하신가요?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "rgba(255,255,255,0.05)",
              borderRadius: 2,
              color: "text.primary",
              "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
              "&:hover fieldset": { borderColor: "rgba(91,140,255,0.5)" },
              "&.Mui-focused fieldset": { borderColor: "#5B8CFF" },
            },
            input: { color: "text.primary" },
          }}
        />
        <Button
          variant="contained"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          sx={{
            minWidth: 56,
            borderRadius: 2,
            background: "linear-gradient(135deg, #5B8CFF 0%, #39E6B5 100%)",
            boxShadow: "0 4px 12px rgba(91, 140, 255, 0.3)",
            "&:disabled": { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }
          }}
        >
          <SendIcon />
        </Button>
      </Stack>
    </Paper>
  );
}