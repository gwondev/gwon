// src/components/HeartLike.jsx
import * as React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import confetti from "canvas-confetti"; // ✅ 폭죽 라이브러리

export default function HeartLike({ id }) {
  const [count, setCount] = React.useState(0);
  const [isBouncing, setIsBouncing] = React.useState(false); // ✅ 애니메이션 상태
  const buttonRef = React.useRef(null); // ✅ 버튼 위치 찾기용

  const url = `https://gwon.my/api/like/${id}`;

  // 💥 폭죽 및 바운스 이펙트 함수
  const triggerEffect = () => {
    // 1. 바운스 애니메이션 실행 (0.3초 뒤 복귀)
    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 300);

    // 2. 폭죽 터뜨리기 (버튼 위치 계산)
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // 화면 기준 좌표를 0~1 사이 값으로 변환
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        origin: { x, y }, // 버튼 중앙에서 발사
        particleCount: 40, // 입자 개수
        spread: 70,        // 퍼지는 각도
        startVelocity: 20, // 속도
        colors: ['#5B8CFF', '#39E6B5', '#FF6B6B'], // 하트랑 어울리는 색
        disableForReducedMotion: true,
        zIndex: 9999,
      });
    }
  };

  // 초기 데이터 로드
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) { setCount(0); return; }
        const data = await r.json();
        const val = typeof data === "number" ? data : data?.count;
        if (typeof val === "number") setCount(val);
      } catch { setCount(0); }
    })();
  }, [url]);

  // STOMP 구독
  React.useEffect(() => {
    let client = null;
    try {
      const socket = new SockJS('https://gwon.my/ws');
      client = Stomp.over(socket);
      // 로그 지저분하면 끄기 (선택)
      // client.debug = () => {}; 

      client.connect({}, () => {
        client.subscribe(`/topic/like/${id}`, (message) => {
          try {
            const body = JSON.parse(message.body);
            const newCount = body && typeof body.count === 'number' ? body.count : null;
            
            if (newCount !== null) {
              // ✅ 값이 바뀔 때만 상태 업데이트 및 이펙트 실행
              setCount((prev) => {
                if (newCount > prev) { 
                   // ❗ 남이 눌러서 숫자가 올라갔을 때도 이펙트 펑!
                   triggerEffect(); 
                }
                return newCount;
              });
            }
          } catch (e) {}
        });
      });
    } catch (e) {}
    
    return () => {
      try { if (client) client.disconnect(); } catch (e) {}
    };
  }, [id]);

  // 내가 클릭했을 때
  const onClick = async () => {
    // ✅ 누르자마자 일단 이펙트 실행 (반응성 향상)
    triggerEffect();

    try {
      const r = await fetch(url, { method: "POST" });
      if (!r.ok) return;
      const data = await r.json();
      // 여기서 setCount는 STOMP가 해줄 수도 있고, API 응답이 해줄 수도 있음
      // 중복 업데이트는 React가 알아서 처리함
      const val = typeof data === "number" ? data : data?.count;
      if (typeof val === "number") setCount(val);
    } catch {}
  };

  return (
    <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <Box height={50}></Box>
      <ButtonBase
        ref={buttonRef} // ✅ 위치 참조 연결
        onClick={onClick}
        aria-label="like"
        sx={{
          borderRadius: "9999px",
          p: 1.5,
          transition: "transform .12s, filter .12s",
          filter: "drop-shadow(0 0 8px rgba(91,140,255,.35))",
          "&:hover": { transform: "translateY(-2px)" },
          "&:active": { transform: "translateY(-1px)" },
          // ✅ 바운스 애니메이션 적용 (isBouncing일 때 커짐)
          transform: isBouncing ? "scale(1.4) !important" : "scale(1)",
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
      <Box height={50}></Box>
    </Box>
  );
}