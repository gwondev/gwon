// src/OtherPages/PassButtonPages/KiaPayPage.js
import React from "react";
import { Box, Stack } from "@mui/material";
import { Title1 } from "../../styles/typography";
import MenuButton from "../../styles/Button";

export default function KiaPayPage() {
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
      <Title1 size={35} text="💳 결제" color="#222" />
      <Box height={40} />

      <Stack spacing={3} sx={{ width: "100%", alignItems: "center", maxWidth: 820 }}>
        <MenuButton to="soon" label="🟡 카카오페이 결제" />
        <MenuButton to="soon"      label="🔵 토스 결제" />
        <MenuButton to="soon"    label="📱 휴대폰 소액결제" />
        <MenuButton to="soon"      label="🤝 만나서 결제 (현장)" />
      </Stack>
    </Box>
  );
}
