import { Box} from "@mui/material";
import { Stack } from "@mui/system";

import MenuButton from "../../styles/Button";
import { Title1 } from "../../styles/typography";



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
      <Title1 size={40} text= "⚾️ 야구예매" />
      <Box height={50}></Box>
      <Stack spacing={3} sx={{ width: "100%", alignItems: "center",maxWidth:1000 }}>
        
        <MenuButton to="kia" label="🐯 기아 타이거즈" />
        <MenuButton to="soon" label="🐻 두산 베어스" />
        <MenuButton to="soon" label="🕊️ 롯데 자이언츠" />
        <MenuButton to="soon" label="🦁 삼성 라이온즈" />
        <MenuButton to="soon" label="🦅 한화 이글스" />
        <MenuButton to="soon" label="🦕 NC 다이노스" />
        <MenuButton to="soon" label="🐶 SSG 랜더스" />
        <MenuButton to="soon" label="🧙 KT 위즈" />
        <MenuButton to="soon" label="👯 LG 트윈스" />
        <MenuButton to="soon" label="🦸 키움 히어로즈" />
      </Stack>
    </Box>
  );
}
