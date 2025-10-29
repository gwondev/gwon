import { Box, Typography } from "@mui/material";

export default function CertificationPages() {
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: 2, textAlign: "center"}}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 800 }}>
        Certifications
      </Typography>
      {/* TODO: 자격증 목록 */}
      <Typography color="text.secondary">
        자격증 페이지입니다. 내용을 채워주세요.
      </Typography>
    </Box>
  );
}
