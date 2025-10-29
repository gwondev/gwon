// src/components/HeartLike.jsx
import * as React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";

export default function HeartLike({ id }) {
  const [count, setCount] = React.useState(0);
  const url = `https://gwon.my/backend/like/${id}`;

  // 안전 가드 적용 버전
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) { setCount(0); return; }
        const data = await r.json();
        if (typeof data === "number") setCount(data);
        else if (data && typeof data.count === "number") setCount(data.count);
        else setCount(0);
      } catch {
        setCount(0);
      }
    })();
  }, [url]);

  const onClick = async () => {
    try {
      const r = await fetch(url, { method: "POST" });
      if (!r.ok) return;               // 실패면 그대로 두기
      const data = await r.json();
      if (typeof data === "number") setCount(data);
      else if (data && typeof data.count === "number") setCount(data.count);
    } catch {}
  };


  return (
    <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <Box height= {50}></Box>
      <ButtonBase
        onClick={onClick}
        aria-label="like"
        sx={{
          borderRadius: "9999px",
          p: 1.5,
          transition: "transform .12s, filter .12s",
          filter: "drop-shadow(0 0 8px rgba(91,140,255,.35))",
          "&:hover": { transform: "translateY(-2px)" },
          "&:active": { transform: "translateY(-1px)" },
        }}
      >
        {/* gradient heart svg */}
        <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5B8CFF" />
              <stop offset="100%" stopColor="#39E6B5" />
            </linearGradient>
          </defs>
          <path
            d="M12 21s-6.1-4.28-9.18-7.35C-0.2 10.03 1.2 5.9 5 5.2A4.9 4.9 0 0 1 12 8a4.9 4.9 0 0 1 7-2.8c3.8.7 5.2 4.83 2.18 8.45C18.1 16.72 12 21 12 21z"
            fill="url(#g)"
          />
        </svg>
      </ButtonBase>

      <Typography variant="caption" sx={{ fontSize: { xs: 12, sm: 13 }, color: "text.secondary", lineHeight: 1 }}>
        {count}
      </Typography>
      <Box height= {50}></Box>
    </Box>
  );
}
