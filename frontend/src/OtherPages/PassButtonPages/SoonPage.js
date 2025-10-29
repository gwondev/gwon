import React from "react";
import { Box, Typography } from "@mui/material";

function SoonPage() {
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
      <Typography variant="h5" fontWeight={900} sx={{ mt: 6, textAlign: "center", color: "#222" }}>
        PASS : 손쉬운예매
      </Typography>
      <Typography variant="h6" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
        구현 예정 페이지입니다.
      </Typography>
    </Box>
  );
}

export default SoonPage;
