
import { Link } from "react-router-dom";
import { Button } from "@mui/material";


// 공통 버튼
export default function MenuButton({ to, label, size }) {
    const fontSize =
    size == null
      ? "clamp(25px, 2.2vw, 35px)"
      : typeof size === "number"
      ? `${size}px`
      : size;
  return (
    <Button
      variant="contained"
      component={Link}
      to={to}
      disableElevation
      sx={{
        height: { xs: 60, sm: 68, md: 76 },
        width: "85%",             // 가로폭 80%
        mx: "auto",               // 가운데 정렬
        bgcolor: "background.paper",
        color: "text.primary",
        fontSize,
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