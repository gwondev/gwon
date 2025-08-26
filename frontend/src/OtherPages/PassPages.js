import { Box, Typography, Stack } from "@mui/material";
import {  Outlet } from "react-router-dom";
import MenuButton from "../styles/Button";






export default function PassPages() {
  const items = [
    { to: "baseball", label: "⚾️  야구" },
    { to: "soccer", label: "⚽️  축구" },
    { to: "movie", label: "🎬  영화" },
    { to: "performance", label: "🎭  공연" },
  ];

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
      }}
    >
      {/* 제목 강조 */}
      <Typography variant="h3" fontWeight={900} sx={{ mb: 6, color: "#222" }}>
        PASS : 손쉬운예매
      </Typography>

      <Stack spacing={4} sx={{ width: "100%", alignItems: "center" ,maxWidth:1000}}>
        {items.map((it) => (
          <MenuButton key={it.to} to={it.to} label={it.label} />
        ))}
      </Stack>
      <Outlet />
    </Box>
  );
}
