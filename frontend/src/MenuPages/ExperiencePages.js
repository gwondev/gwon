import { Box, Typography } from "@mui/material";

export default function ExperiencePages() {
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: 2, textAlign: "center"}}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 800 }}>
        Projects & Activities
      </Typography>
      {/* TODO: 프로젝트/활동/경력 */}
      <Typography color="text.secondary">
        프로젝트/활동/경력 페이지입니다. 내용을 채워주세요.
      </Typography>
    </Box>
  );
}
