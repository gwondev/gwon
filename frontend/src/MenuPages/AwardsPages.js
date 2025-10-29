// src/MenuPages/AwardsPages.js
import { Box, Typography } from "@mui/material";

export default function AwardsPages() {
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: 2, textAlign: "center" }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 800 }}>
        Awards
      </Typography>
      {/* TODO: 수상이력 내용 */}
      <Typography color="text.secondary">
        수상이력 페이지입니다. 내용을 채워주세요.
      </Typography>
    </Box>
  );
}
