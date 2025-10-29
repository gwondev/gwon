// src/OtherPages/PassButtonPages/KiaSeatPage.js
import { useMemo, useState } from "react";
import { Box, Typography, Button, Stack, Divider, ButtonGroup } from "@mui/material";
import { Title1 } from "../../styles/typography";
import MenuButton from "../../styles/Button"; // ✅ default export로 임포트

const SECTION = { id: "A", label: "1루 A블록", price: 10000 };

// 좌석 데이터 생성 (6행 x 10열 예시)
function makeSeats(sectionId) {
  const rows = 6, cols = 10;
  const sold = new Set([
    `${sectionId}-2-3`,
    `${sectionId}-3-5`,
    `${sectionId}-5-7`,
  ]); // 예시 판매완료
  const seats = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const id = `${sectionId}-${r}-${c}`;
      seats.push({ id, row: r, col: c, label: `${r}-${c}`, sold: sold.has(id) });
    }
  }
  return seats;
}

// 구역(앞/중간/뒤) 기준 행 범위
const ZONES = {
  front: { label: "앞쪽", rows: [1, 2] },
  middle: { label: "중간쪽", rows: [3, 4] },
  back:  { label: "뒤쪽", rows: [5, 6] },
};

export default function KiaSeatPage() {
  const [selected, setSelected] = useState([]);
  const [zone, setZone] = useState("front"); // front | middle | back
  const seatsAll = useMemo(() => makeSeats(SECTION.id), []);
  const visibleRows = ZONES[zone].rows;
  const seats = seatsAll.filter((s) => visibleRows.includes(s.row));
  const total = selected.length * SECTION.price;

  const toggleSeat = (seat) => {
    if (seat.sold) return;
    setSelected((prev) =>
      prev.find((s) => s.id === seat.id)
        ? prev.filter((s) => s.id !== seat.id)
        : [...prev, seat]
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f0f4ff 0%, #f8fbff 50%, #ffffff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: 2,
        py: 6,
        color: "#222",
      }}
    >
      <Title1 size={35} text="🎟️ 기아 타이거즈 좌석 선택" color="#222" />

      {/* 구역(앞/중간/뒤) 선택 - 큰 버튼 */}
      <Stack sx={{ mt: 3 }} alignItems="center">
        <ButtonGroup variant="outlined" aria-label="구역 선택" sx={{ borderColor: "#222" }}>
          {Object.entries(ZONES).map(([key, info]) => (
            <Button
              key={key}
              onClick={() => setZone(key)}
              sx={{
                px: 3,
                py: 1.25,
                fontSize: "clamp(16px, 2.6vw, 18px)",
                fontWeight: 800,
                textTransform: "none",
                borderColor: "#222",
                color: "#222",
                bgcolor: zone === key ? "#fff" : "transparent",
                "&:hover": { bgcolor: "#f5f5f5", borderColor: "#222" },
              }}
            >
              {info.label}
            </Button>
          ))}
        </ButtonGroup>
        <Typography variant="body2" sx={{ mt: 1.5, color: "#444" }}>
          현재: <b>{ZONES[zone].label}</b> (행 {visibleRows.join("–")})
        </Typography>
      </Stack>

      {/* 범례 */}
      <Stack direction="row" spacing={3} sx={{ mt: 3, alignItems: "center" }}>
        <Legend label="선택 가능" sx={{ borderColor: "#222", bgcolor: "#fff" }} />
        <Legend label="선택됨"   sx={{ borderColor: "#222", bgcolor: "#222", color: "#fff" }} />
        <Legend label="판매 완료" sx={{ borderColor: "#bbb", bgcolor: "#e9e9e9", color: "#888" }} />
      </Stack>

      {/* 좌석 그리드 (좌우 스크롤 가능) */}
      <Box
        sx={{
          mt: 4,
          width: "100%",
          maxWidth: 900,
          p: 2,
          borderRadius: 3,
          boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
          bgcolor: "#fff",
          overflowX: "auto", // 좌우 스크롤
        }}
      >
        <Typography variant="body2" sx={{ mb: 1.5, color: "#555", textAlign: "center" }}>
          ⚾️ 그라운드 방향
        </Typography>

        <Box
          role="grid"
          aria-label="좌석 선택 그리드"
          sx={{
            minWidth: 720, // 화면이 좁으면 가로 스크롤
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(56px, 1fr))",
            gap: 1,
            justifyItems: "center",
          }}
        >
          {seats.map((seat) => {
            const isSelected = !!selected.find((s) => s.id === seat.id);
            return (
              <SeatButton
                key={seat.id}
                label={seat.label}
                disabled={seat.sold}
                selected={isSelected}
                onClick={() => toggleSeat(seat)}
              />
            );
          })}
        </Box>
      </Box>

      {/* 요약/액션 */}
      <Box sx={{ mt: 4, width: "100%", maxWidth: 900 }}>
        <Divider sx={{ mb: 2 }} />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "center", sm: "center" }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: "clamp(16px, 2.4vw, 18px)" }}>
            선택 좌석: {selected.length ? selected.map((s) => s.label).join(", ") : "없음"}
          </Typography>

          {/* 👉 버튼 묶음을 'column'으로 세로 쌓기 */}
          <Stack
          alignItems={{ xs: "center", sm: "center" }}
            direction="column"
            spacing={1.25}
            sx={{ width: "100%", maxWidth: 500 }}
          >
            <Button
              onClick={() => setSelected([])}
              variant="outlined"
              sx={{
                width: "85%",           // MenuButton 폭(85%)과 통일
                mx: "auto",
                borderColor: "#222",
                color: "#222",
                px: 3,
                py: 1.25,
                fontSize: "clamp(16px, 2.6vw, 18px)",
                fontWeight: 800,
                textTransform: "none",
              }}
            >
              초기화
            </Button>

            <MenuButton
              size="clamp(18px, 3vw, 24px)"
              to={selected.length ? "pay" : "#"}   // 상대경로 → /pass/baseball/kia/schedule/seat/pay
              label={`${total.toLocaleString()}원 결제하기`}
            />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

function Legend({ label, sx }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        sx={{
          width: 22,
          height: 22,
          border: "2px solid",
          borderColor: "#222",
          borderRadius: 0.75,
          ...sx,
        }}
      />
      <Typography variant="body2" sx={{ color: "#444", fontSize: 14 }}>
        {label}
      </Typography>
    </Stack>
  );
}

// 좌석 버튼: 더 크게(손가락 터치 용이), 고대비, 단순 호버
function SeatButton({ label, selected, disabled, onClick }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected ? "true" : "false"}
      aria-label={`좌석 ${label}${disabled ? " (판매완료)" : ""}`}
      sx={{
        minWidth: 0,
        width: "clamp(48px, 7vw, 64px)",   // 큰 버튼
        height: "clamp(48px, 7vw, 64px)",  // 큰 버튼
        p: 0,
        borderRadius: 1.25,
        textTransform: "none",
        fontSize: "clamp(14px, 2.4vw, 18px)", // 큰 글자
        border: "2px solid",
        borderColor: disabled ? "#bbb" : "#222",
        bgcolor: disabled ? "#e9e9e9" : selected ? "#222" : "#fff",
        color: disabled ? "#888" : selected ? "#fff" : "#222",
        boxShadow: "none",
        "&:hover": {
          bgcolor: disabled ? "#e9e9e9" : selected ? "#222" : "#f5f5f5",
        },
      }}
    >
      {label}
    </Button>
  );
}
