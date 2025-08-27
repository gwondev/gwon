// src/OtherPages/PassButtonPages/KiaSchedulePage.js
import React from "react";
import { Box, Stack } from "@mui/material";
import { Title1 } from "../../styles/typography";
import MenuButton from "../../styles/Button"; // ✅ default export로 임포트

// MVP용 하드코딩 일정
const games = [
  { date: "08.27(수)", time: "18:30", opp: "SSG", park: "문학" },
  { date: "08.28(목)", time: "18:30", opp: "SSG", park: "문학" },
  { date: "08.29(금)", time: "18:30", opp: "KT",  park: "수원" },
  { date: "08.30(토)", time: "18:00", opp: "KT",  park: "수원" },
  { date: "08.31(일)", time: "18:00", opp: "KT",  park: "수원" },
];

export default function KiaSchedulePage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f0f4ff 0%, #f8fbff 50%, #ffffff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: 2,
        py: 6,
        color: "#222",
      }}
    >
      <Title1 size={35} text="🐯 기아 타이거즈 일정선택" color="#222" />
      <Box height={40} />

      <Stack
        spacing={3}
        sx={{ width: "100%", alignItems: "center", maxWidth: 820 }}
      >
        {games.map((g, i) => {
          const label = `${g.date}  ${g.time}   KIA  vs  ${g.opp}   (${g.park})`;
          return (
            <MenuButton
              key={i}
              to="seat"
              label={label}
            />
          );
        })}
      </Stack>
    </Box>
  );
}
