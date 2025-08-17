// src/components/MenuCard.js
import { Typography, Stack, Paper, ButtonBase } from "@mui/material";
import { Link } from "react-router-dom";

/** MenuCard
 * - 전체 클릭(리플 제거), 고정 크기, 그라데이션 배경 + 호버 부양
 * - 모든 요소: 가로 가운데 + 위쪽부터 차례로 쌓임
 * - 내부 라우팅: to prop 사용 (react-router-dom Link로 렌더)
 */
export default function MenuCard({ title, hint, items = [], to}) {
  // 긴 영문/기호도 줄바꿈 유도
  const wrap = { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" };

  return (
    <ButtonBase
    component={Link}
      to={to}
      disableRipple
      sx={{ width: "100%", display: "block", textAlign: "left", borderRadius: 3 }}
      aria-label={typeof title === "string" ? title : "card"}
    >
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 1.5,

          p: 3,
          borderRadius: 3,
          bgcolor: "background.paper",
          color: "text.primary",
          border: "1px solid rgba(255,255,255,0.06)",
          backgroundImage:
            "radial-gradient(120% 180% at 10% -20%, rgba(91,140,255,.08), transparent 60%), radial-gradient(100% 140% at 90% 120%, rgba(57,230,181,.06), transparent 60%)",

          height: { xs: 370, sm: 400, md: 440 },
          width: { xs: 360, sm: 480, md: 500 },

          transform: "translateY(0)",
          transition: "transform .16s ease, box-shadow .16s ease, border-color .16s ease",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 14px 36px rgba(91,140,255,.16)",
            borderColor: "rgba(91,140,255,.28)",
          },
          "&:active": { transform: "translateY(-1px)" },
        }}
      >
        {/* 헤더 */}
        <Stack spacing={0.75} sx={{ alignItems: "center", textAlign: "center", width: "100%", maxWidth: 520 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              letterSpacing: 1.2,
              lineHeight: 1.1,
              background: "linear-gradient(90deg, #5B8CFF 0%, #39E6B5 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 12px rgba(91,140,255,0.15)",
              ...wrap,
            }}
          >
            {title}
          </Typography>

          {hint && (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, ...wrap }}>
              {hint}
            </Typography>
          )}
        </Stack>

        {/* 내용 */}
        <Stack spacing={0.9} sx={{ alignItems: "center", textAlign: "center", width: "100%", maxWidth: 520 }}>
          {items.slice(0, 6).map((it, i) => (
            <Stack key={i} spacing={0.25} alignItems="center" sx={{ width: "100%" }}>
              <Typography variant="body1" sx={{ fontWeight: 700, ...wrap }}>
                {it.head}
              </Typography>
              {it.detail && (
                <Typography variant="caption" color="text.secondary" sx={wrap}>
                  {it.detail}
                </Typography>
              )}
            </Stack>
          ))}
        </Stack>
      </Paper>
    </ButtonBase>
  );
}
