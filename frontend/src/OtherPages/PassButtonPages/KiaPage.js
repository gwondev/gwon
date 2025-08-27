// src/OtherPages/PassButtonPages/KiaPage.js
import React from "react";
import { Box, TextField,  Stack } from "@mui/material";
import { Title1 } from "../../styles/typography";
import MenuButton from "../../styles/Button";

function KiaPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f0f4ff 0%, #f8fbff 50%, #ffffff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: 2,
        py: 6,
        color: "#222",
      }}
    >
      <Title1 size={35} text="🐯 기아 타이거즈 예매" color="#222" />

      <Stack spacing={3} sx={{ mt: 6, width: "100%", maxWidth: 420, alignItems: "center" }}>
        <TextField
          fullWidth
          label="이름"
          variant="outlined"
          InputLabelProps={{ style: { color: "#222" } }}
          InputProps={{ style: { color: "#222" } }}
          sx={{
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: "#222" }, // 기본 테두리
              "&:hover fieldset": { borderColor: "#000" }, // hover 시
              "&.Mui-focused fieldset": { borderColor: "#000" }, // focus 시
            },
          }}
        />
        <TextField
          fullWidth
          label="전화번호"
          variant="outlined"
          placeholder="010-1234-5678"
          InputLabelProps={{ style: { color: "#222" } }}
          InputProps={{ style: { color: "#222" } }}
          sx={{
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: "#222" },
              "&:hover fieldset": { borderColor: "#000" },
              "&.Mui-focused fieldset": { borderColor: "#000" },
            },
          }}
        />
        <TextField
          fullWidth
          label="생년월일 (YYYY-MM-DD)"
          variant="outlined"
          placeholder="2001-03-23"
          InputLabelProps={{ style: { color: "#222" } }}
          InputProps={{ style: { color: "#222" } }}
          sx={{
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: "#222" },
              "&:hover fieldset": { borderColor: "#000" },
              "&.Mui-focused fieldset": { borderColor: "#000" },
            },
          }}
        />

        <MenuButton to="schedule"  label="제출하기" />
      </Stack>
    </Box>
  );
}

export default KiaPage;
