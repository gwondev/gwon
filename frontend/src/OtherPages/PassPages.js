import { Box, Typography, Stack, Button } from "@mui/material";
import { Link, Outlet } from "react-router-dom";



// 공통 버튼
function MenuButton({ to, label }) {
  return (
    <Button
      variant="contained"
      component={Link}
      to={to}
      disableElevation
      sx={{
        height: 100,
        width: "100%",             // 가로폭 80%
        mx: "auto",               // 가운데 정렬
        bgcolor: "background.paper",
        color: "text.primary",
        fontSize: 35,
        fontWeight: 700,
        py: 2.5,
        borderRadius: 3,
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        "&:hover": {
          bgcolor: "background.paper",
          transform: "translateY(-2px)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
        },
        transition: "all .15s ease",
      }}
    >
      {label}
    </Button>
  );
}



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

      <Stack spacing={3.5} sx={{ width: "100%", maxWidth: 550 }}>
        {items.map((it) => (
          <MenuButton key={it.to} to={it.to} label={it.label} />
        ))}
      </Stack>
      <Outlet />
    </Box>
  );
}
