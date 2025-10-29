// src/MenuPages/TechPages.js
import { Box, Typography } from "@mui/material";

export default function TechPages() {
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: 2, textAlign: "center"}}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 800 }}>
        Tech Stack
      </Typography>
      {/* TODO: 기술 스택 상세 */}
      <Typography color="text.secondary">
        기술스택 페이지입니다. 내용을 채워주세요.
      </Typography>
    </Box>
  );
}
