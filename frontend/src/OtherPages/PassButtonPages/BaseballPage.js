import { Box, Typography } from "@mui/material";
import { Stack } from "@mui/system";

import MenuButton from "../../styles/Button";



export default function BaseballPage() {
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
      

      <Stack spacing={4} sx={{ width: "100%", alignItems: "center",maxWidth:1000 }}>
        <Typography variant="h2" fontWeight={900} sx={{ mt: 6, textAlign: "center", color: "#222" }}>
        ⚾️ 구단 선택
        </Typography>
        <MenuButton to="kia" label="🐯 기아 타이거즈" />
        <MenuButton to="doosan" label="🐻 두산 베어스" />
        <MenuButton to="lotte" label="🕊️ 롯데 자이언츠" />
        <MenuButton to="samsung" label="🦁 삼성 라이온즈" />
        <MenuButton to="hanwha" label="🦅 한화 이글스" />
        <MenuButton to="nc" label="🦕 NC 다이노스" />
        <MenuButton to="ssg" label="🐶 SSG 랜더스" />
        <MenuButton to="kt" label="🧙 KT 위즈" />
        <MenuButton to="lg" label="👯 LG 트윈스" />
        <MenuButton to="kiwoom" label="🦸 키움 히어로즈" />
      </Stack>
    </Box>
  );
}
